import type { FastifyInstance } from "fastify";

import { requestAiChat, requestAiSummary, requestAiWeeklyReport } from "../lib/ai-service.js";
import { requireAppUser } from "../lib/auth.js";
import { calculateHealthScore, detectSubscriptions, summarizeDashboard } from "../lib/financial-analytics.js";
import { chatResponse } from "../lib/mock-data.js";
import { prisma } from "../lib/prisma.js";

const editableCategories = [
  "FOOD_AND_DRINK",
  "GENERAL_MERCHANDISE",
  "TRANSPORTATION",
  "RENT_AND_UTILITIES",
  "ENTERTAINMENT",
  "TRAVEL",
  "PERSONAL_CARE",
  "GENERAL_SERVICES",
  "LOAN_PAYMENTS",
  "TRANSFER_OUT",
  "TRANSFER_IN",
  "BANK_FEES",
  "MEDICAL",
  "INCOME",
  "UNCATEGORIZED",
];

export async function registerRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    status: "ok",
    service: "finsight-backend",
  }));

  app.get("/api/dashboard/overview", async (request, reply) => {
    const user = await requireAppUser(request, reply);

    if (!user) {
      return reply;
    }

    const [accounts, transactions] = await Promise.all([
      prisma.account.findMany({ where: { userId: user.id } }),
      prisma.transaction.findMany({
        where: { userId: user.id },
        orderBy: { occurredAt: "desc" },
      }),
    ]);

    const dashboard = summarizeDashboard(accounts, transactions);
    const subscriptions = detectSubscriptions(transactions);
    const monthlySubscriptionCost = subscriptions.reduce(
      (total, subscription) => total + subscription.monthlyCost,
      0,
    );
    const aiSummary = await requestAiSummary({
      accounts,
      transactions,
      monthlyIncome: dashboard.monthlyIncome,
      monthlySpending: dashboard.monthlySpending,
      currentBalance: dashboard.currentBalance,
      monthlySubscriptionCost,
    });

    return reply.send(mergeDashboardAnalytics(dashboard, aiSummary));
  });

  app.get("/api/transactions", async (request, reply) => {
    const user = await requireAppUser(request, reply);

    if (!user) {
      return reply;
    }

    const query = request.query as {
      search?: string;
      category?: string;
      direction?: string;
      limit?: string;
    };
    const search = query.search?.trim();
    const category = query.category && query.category !== "all" ? normalizeCategory(query.category) : undefined;
    const direction = query.direction === "inflow" || query.direction === "outflow" ? query.direction : undefined;
    const limit = Math.min(Math.max(Number(query.limit ?? 150), 25), 300);
    const where = {
      userId: user.id,
      ...(direction ? { direction } : {}),
      ...(category ? { categoryPrimary: category } : {}),
      ...(search
        ? {
            OR: [
              { merchantName: { contains: search, mode: "insensitive" as const } },
              { description: { contains: search, mode: "insensitive" as const } },
              { categoryPrimary: { contains: normalizeCategory(search), mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [transactions, totalCount, categoryRows] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        take: limit,
      }),
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where: { userId: user.id },
        distinct: ["categoryPrimary"],
        select: { categoryPrimary: true },
        orderBy: { categoryPrimary: "asc" },
      }),
    ]);

    const categoryOptions = [
      ...new Set([
        ...categoryRows.map((row) => normalizeCategory(row.categoryPrimary ?? "UNCATEGORIZED")),
        ...editableCategories,
      ]),
    ]
      .sort()
      .map((raw) => ({
        raw,
        label: formatCategory(raw),
      }));

    const summary = transactions.reduce(
      (totals, transaction) => {
        const amount = Number(transaction.amount);

        if (transaction.direction === "outflow") {
          totals.spending += amount;
        } else {
          totals.income += amount;
        }

        return totals;
      },
      { count: totalCount, income: 0, spending: 0 },
    );

    return reply.send({
      data: transactions.map((transaction) => ({
        id: transaction.id,
        merchant: transaction.merchantName ?? transaction.description,
        merchantName: transaction.merchantName,
        description: transaction.description,
        amount: transaction.direction === "outflow" ? -Number(transaction.amount) : Number(transaction.amount),
        category: formatCategory(transaction.categoryPrimary ?? "Uncategorized"),
        categoryPrimary: formatCategory(transaction.categoryPrimary ?? "Uncategorized"),
        categoryRaw: normalizeCategory(transaction.categoryPrimary ?? "UNCATEGORIZED"),
        direction: transaction.direction,
        date: transaction.occurredAt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        occurredAt: transaction.occurredAt,
        status: transaction.pending ? "Pending" : transaction.isRecurring ? "Recurring" : "Posted",
      })),
      categories: categoryOptions,
      summary: {
        count: summary.count,
        income: currency(summary.income),
        spending: currency(summary.spending),
        net: currency(summary.income - summary.spending),
      },
    });
  });

  app.get("/api/subscriptions", async (request, reply) => {
    const user = await requireAppUser(request, reply);

    if (!user) {
      return reply;
    }

    const transactions = await prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { occurredAt: "desc" },
    });

    const subscriptions = detectSubscriptions(transactions);
    const reviewMonthly = subscriptions
      .filter((subscription) => subscription.opportunity === "Review")
      .reduce((total, subscription) => total + subscription.monthlyCost, 0);

    return reply.send({
      data: subscriptions,
      summary: {
        count: subscriptions.length,
        totalMonthly: currency(subscriptions.reduce((total, subscription) => total + subscription.monthlyCost, 0)),
        totalYearly: currency(subscriptions.reduce((total, subscription) => total + subscription.yearlyCost, 0)),
        reviewMonthly: currency(reviewMonthly),
        reviewYearly: currency(reviewMonthly * 12),
      },
    });
  });

  app.get("/api/financial-health", async (request, reply) => {
    const user = await requireAppUser(request, reply);

    if (!user) {
      return reply;
    }

    const [accounts, transactions] = await Promise.all([
      prisma.account.findMany({ where: { userId: user.id } }),
      prisma.transaction.findMany({
        where: { userId: user.id },
        orderBy: { occurredAt: "desc" },
      }),
    ]);
    const dashboard = summarizeDashboard(accounts, transactions);
    const detectedSubscriptions = detectSubscriptions(transactions);
    const monthlySubscriptionCost = detectedSubscriptions.reduce(
      (total, subscription) => total + (subscription?.monthlyCost ?? 0),
      0,
    );
    const subscriptionBurden =
      dashboard.monthlyIncome > 0 ? (monthlySubscriptionCost / dashboard.monthlyIncome) * 100 : 0;

    const localScore = calculateHealthScore({
        savingsRate: dashboard.savingsRate,
        monthlyIncome: dashboard.monthlyIncome,
        monthlySpending: dashboard.monthlySpending,
        currentBalance: dashboard.currentBalance,
        subscriptionBurden,
    });
    const aiSummary = await requestAiSummary({
      accounts,
      transactions,
      monthlyIncome: dashboard.monthlyIncome,
      monthlySpending: dashboard.monthlySpending,
      currentBalance: dashboard.currentBalance,
      monthlySubscriptionCost,
    });

    return reply.send({
      ...localScore,
      ...(aiSummary?.score ?? {}),
      source: aiSummary?.modelVersion ?? "typescript-fallback",
    });
  });

  app.get("/api/forecast", async (request, reply) => {
    const user = await requireAppUser(request, reply);

    if (!user) {
      return reply;
    }

    const [accounts, transactions] = await Promise.all([
      prisma.account.findMany({ where: { userId: user.id } }),
      prisma.transaction.findMany({
        where: { userId: user.id },
        orderBy: { occurredAt: "desc" },
      }),
    ]);

    return reply.send({ data: summarizeDashboard(accounts, transactions).forecast });
  });

  app.get("/api/reports/weekly", async (request, reply) => {
    const user = await requireAppUser(request, reply);

    if (!user) {
      return reply;
    }

    const [accounts, transactions] = await Promise.all([
      prisma.account.findMany({ where: { userId: user.id } }),
      prisma.transaction.findMany({
        where: { userId: user.id },
        orderBy: { occurredAt: "desc" },
      }),
    ]);
    const dashboard = summarizeDashboard(accounts, transactions);
    const subscriptions = detectSubscriptions(transactions);
    const monthlySubscriptionCost = subscriptions.reduce(
      (total, subscription) => total + subscription.monthlyCost,
      0,
    );
    const aiReport = await requestAiWeeklyReport({
      accounts,
      transactions,
      monthlyIncome: dashboard.monthlyIncome,
      monthlySpending: dashboard.monthlySpending,
      currentBalance: dashboard.currentBalance,
      monthlySubscriptionCost,
    });

    return reply.send(aiReport ?? buildFallbackWeeklyReport(dashboard, transactions));
  });

  app.post("/api/advisor/chat", async (request, reply) => {
    const user = await requireAppUser(request, reply);

    if (!user) {
      return reply;
    }

    const body = request.body as { question?: string };
    const question = body.question?.trim();

    if (!question) {
      return reply.code(400).send({ error: "Question is required." });
    }

    const [accounts, transactions] = await Promise.all([
      prisma.account.findMany({ where: { userId: user.id } }),
      prisma.transaction.findMany({
        where: { userId: user.id },
        orderBy: { occurredAt: "desc" },
      }),
    ]);
    const dashboard = summarizeDashboard(accounts, transactions);
    const subscriptions = detectSubscriptions(transactions);
    const monthlySubscriptionCost = subscriptions.reduce(
      (total, subscription) => total + subscription.monthlyCost,
      0,
    );
    const aiChat = await requestAiChat({
      question,
      accounts,
      transactions,
      monthlyIncome: dashboard.monthlyIncome,
      monthlySpending: dashboard.monthlySpending,
      currentBalance: dashboard.currentBalance,
      monthlySubscriptionCost,
    });
    const answer = aiChat ?? buildFallbackAdvisorResponse(question, dashboard);

    await prisma.chatHistory.createMany({
      data: [
        {
          userId: user.id,
          role: "user",
          message: question,
          contextSnapshot: {
            currentBalance: dashboard.currentBalance,
            monthlyIncome: dashboard.monthlyIncome,
            monthlySpending: dashboard.monthlySpending,
          },
        },
        {
          userId: user.id,
          role: "assistant",
          message: answer.answer,
          contextSnapshot: {
            source: answer.source ?? "typescript-fallback",
            decision: answer.decision,
            dataPoints: answer.dataPoints,
          },
        },
      ],
    });

    return reply.send(answer);
  });
  app.post("/api/chat", async () => chatResponse);

  app.patch("/api/transactions/:id/category", async (request, reply) => {
    const user = await requireAppUser(request, reply);

    if (!user) {
      return reply;
    }

    const { id } = request.params as { id: string };
    const body = request.body as { categoryPrimary?: string; category?: string };
    const categoryPrimary = body.categoryPrimary ?? body.category;

    if (categoryPrimary) {
      await prisma.transaction.updateMany({
        where: {
          id,
          userId: user.id,
        },
        data: { categoryPrimary: normalizeCategory(categoryPrimary) },
      });
    }

    return {
      id,
      status: "updated",
      category: categoryPrimary ? formatCategory(categoryPrimary) : undefined,
      categoryRaw: categoryPrimary ? normalizeCategory(categoryPrimary) : undefined,
    };
  });
}

function formatCategory(category: string) {
  return category
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeCategory(category: string) {
  return category
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function currency(value: number) {
  return Math.round(value * 100) / 100;
}

function mergeDashboardAnalytics(
  dashboard: ReturnType<typeof summarizeDashboard>,
  aiSummary: Awaited<ReturnType<typeof requestAiSummary>>,
) {
  if (!aiSummary) {
    return {
      ...dashboard,
      analyticsSource: "typescript-fallback",
    };
  }

  return {
    ...dashboard,
    forecast: aiSummary.forecast?.keyPoints?.length ? aiSummary.forecast.keyPoints : dashboard.forecast,
    healthScore: aiSummary.score?.score ?? dashboard.healthScore,
    riskProbability: aiSummary.forecast?.riskProbability ?? dashboard.riskProbability,
    insightHighlights: aiSummary.insights?.length ? aiSummary.insights : dashboard.insightHighlights,
    analyticsSource: aiSummary.modelVersion ?? "python-analytics",
    aiForecast: aiSummary.forecast,
  };
}

function buildFallbackAdvisorResponse(question: string, dashboard: ReturnType<typeof summarizeDashboard>) {
  const purchaseAmount = extractPurchaseAmount(question);
  const safeToSpend = dashboard.safeToSpend;

  if (purchaseAmount) {
    const remaining = safeToSpend - purchaseAmount;
    const projectedBalance = dashboard.forecast.find((point) => point.label === "Day 30")?.balance ?? dashboard.currentBalance;
    const affordable = remaining >= 0 && projectedBalance - purchaseAmount >= 500;

    return {
      answer: affordable
        ? `A ${formatCurrency(purchaseAmount)} purchase looks affordable based on your synced data. Your safe-to-spend buffer would be about ${formatCurrency(remaining)} afterward.`
        : `I would be cautious with a ${formatCurrency(purchaseAmount)} purchase. It would leave your safe-to-spend buffer near ${formatCurrency(remaining)} based on current cash flow.`,
      decision: affordable ? "affordable" : "caution",
      dataPoints: [
        { label: "Current balance", value: formatCurrency(dashboard.currentBalance) },
        { label: "Safe to spend", value: formatCurrency(safeToSpend) },
        { label: "Projected 30-day balance", value: formatCurrency(projectedBalance) },
      ],
      followUps: ["How can I save more money?", "Why did I spend so much this month?"],
      source: "typescript-fallback",
    };
  }

  return {
    answer: `Based on your synced activity, your current balance is ${formatCurrency(dashboard.currentBalance)}, monthly spending is ${formatCurrency(dashboard.monthlySpending)}, and your safe-to-spend estimate is ${formatCurrency(dashboard.safeToSpend)}.`,
    decision: "summary",
    dataPoints: [
      { label: "Current balance", value: formatCurrency(dashboard.currentBalance) },
      { label: "Monthly spending", value: formatCurrency(dashboard.monthlySpending) },
      { label: "Monthly income", value: formatCurrency(dashboard.monthlyIncome) },
      { label: "Savings rate", value: dashboard.savingsRateLabel },
    ],
    followUps: ["Can I afford a $400 purchase?", "How can I save more money?"],
    source: "typescript-fallback",
  };
}

function extractPurchaseAmount(question: string) {
  const match = question.match(/\$?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/);

  if (!match) {
    return null;
  }

  return Number(match[1].replace(/,/g, ""));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function buildFallbackWeeklyReport(
  dashboard: ReturnType<typeof summarizeDashboard>,
  transactions: Awaited<ReturnType<typeof prisma.transaction.findMany>>,
) {
  const dates = transactions.map((transaction) => transaction.occurredAt.getTime());
  const latest = dates.length ? new Date(Math.max(...dates)) : new Date();
  const start = new Date(latest);
  start.setDate(start.getDate() - 6);
  const previousStart = new Date(latest);
  previousStart.setDate(previousStart.getDate() - 13);
  const previousEnd = new Date(latest);
  previousEnd.setDate(previousEnd.getDate() - 7);
  const currentOutflows = transactions.filter(
    (transaction) => transaction.direction === "outflow" && transaction.occurredAt >= start && transaction.occurredAt <= latest,
  );
  const previousOutflows = transactions.filter(
    (transaction) =>
      transaction.direction === "outflow" &&
      transaction.occurredAt >= previousStart &&
      transaction.occurredAt <= previousEnd,
  );
  const currentSpending = currentOutflows.reduce((total, transaction) => total + Number(transaction.amount), 0);
  const previousSpending = previousOutflows.reduce((total, transaction) => total + Number(transaction.amount), 0);
  const changeAmount = currentSpending - previousSpending;
  const changePercent = previousSpending ? (changeAmount / previousSpending) * 100 : currentSpending ? 100 : 0;
  const largest = currentOutflows.sort((a, b) => Number(b.amount) - Number(a.amount))[0];
  const byCategory = new Map<string, number>();

  for (const transaction of currentOutflows) {
    const category = formatCategory(transaction.categoryPrimary ?? "Uncategorized");
    byCategory.set(category, (byCategory.get(category) ?? 0) + Number(transaction.amount));
  }

  const topCategory = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    periodLabel: `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${latest.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    cards: [
      {
        label: "This week spending",
        value: formatCurrency(currentSpending),
        detail: `${currentOutflows.length} outflow transactions analyzed.`,
      },
      {
        label: "Change vs last week",
        value: `${changePercent >= 0 ? "+" : ""}${currency(changePercent)}%`,
        detail: `${formatCurrency(Math.abs(changeAmount))} ${changeAmount > 0 ? "higher" : changeAmount < 0 ? "lower" : "unchanged"}.`,
      },
      {
        label: "Top category",
        value: topCategory?.[0] ?? "None",
        detail: topCategory ? formatCurrency(topCategory[1]) : "No outflows this week.",
      },
      {
        label: "Largest transaction",
        value: formatCurrency(largest ? Number(largest.amount) : 0),
        detail: largest?.merchantName ?? largest?.description ?? "No transaction",
      },
    ],
    insights: dashboard.insightHighlights,
    weeklySpend: [],
    forecast: {
      projectedBalance: dashboard.forecast.find((point) => point.label === "Day 30")?.balance ?? dashboard.currentBalance,
      safeToSpend: dashboard.safeToSpend,
      riskProbability: dashboard.riskProbability,
    },
    source: "typescript-fallback",
  };
}
