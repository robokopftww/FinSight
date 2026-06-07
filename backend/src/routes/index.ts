import type { FastifyInstance } from "fastify";

import { requestAiChat, requestAiSummary, requestAiWeeklyReport } from "../lib/ai-service.js";
import { requireAppUser } from "../lib/auth.js";
import {
  calculateHealthScore,
  detectSubscriptions,
  isInternalTransferCategory,
  summarizeDashboard,
} from "../lib/financial-analytics.js";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { isPlaidConfigured } from "../lib/plaid.js";
import { profileUpdateSchema } from "../lib/profile.js";

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

  app.get("/api/settings/status", async (request, reply) => {
    const user = await requireAppUser(request, reply);

    if (!user) {
      return reply;
    }

    const [plaidItems, accountsCount, transactionsCount, latestAccount, latestTransaction, chatCount] = await Promise.all([
      prisma.plaidItem.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          institutionName: true,
          lastSyncedAt: true,
          createdAt: true,
          _count: { select: { accounts: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.account.count({ where: { userId: user.id } }),
      prisma.transaction.count({ where: { userId: user.id } }),
      prisma.account.findFirst({
        where: { userId: user.id },
        orderBy: { lastSyncedAt: "desc" },
        select: { lastSyncedAt: true },
      }),
      prisma.transaction.findFirst({
        where: { userId: user.id },
        orderBy: { occurredAt: "desc" },
        select: { occurredAt: true },
      }),
      prisma.chatHistory.count({ where: { userId: user.id } }),
    ]);
    const ai = await getAiRuntimeStatus();

    return reply.send({
      user: {
        id: user.id,
        clerkId: user.clerkId,
        email: user.email,
        name: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
      },
      database: {
        connected: true,
        provider: "PostgreSQL",
      },
      clerk: {
        configured: Boolean(env.CLERK_SECRET_KEY && env.CLERK_PUBLISHABLE_KEY),
      },
      plaid: {
        configured: isPlaidConfigured(),
        environment: env.PLAID_ENV,
        connected: accountsCount > 0,
        itemsCount: plaidItems.length,
        accountsCount,
        transactionsCount,
        institutions: plaidItems.map((item) => item.institutionName),
        institutionConnections: plaidItems.map((item) => ({
          id: item.id,
          name: item.institutionName,
          accountsCount: item._count.accounts,
          lastSyncedAt: item.lastSyncedAt,
        })),
        lastSyncedAt: latestAccount?.lastSyncedAt ?? plaidItems[0]?.lastSyncedAt ?? null,
        latestTransactionAt: latestTransaction?.occurredAt ?? null,
      },
      ai,
      data: {
        chatMessages: chatCount,
      },
    });
  });

  app.delete("/api/settings/plaid-connection", async (request, reply) => {
    const user = await requireAppUser(request, reply);

    if (!user) {
      return reply;
    }

    const result = await prisma.$transaction(async (tx) => {
      const transactions = await tx.transaction.deleteMany({ where: { userId: user.id } });
      const accounts = await tx.account.deleteMany({ where: { userId: user.id } });
      const plaidItems = await tx.plaidItem.deleteMany({ where: { userId: user.id } });
      const subscriptions = await tx.subscription.deleteMany({ where: { userId: user.id } });

      return {
        transactions: transactions.count,
        accounts: accounts.count,
        plaidItems: plaidItems.count,
        subscriptions: subscriptions.count,
      };
    });

    return reply.send({ disconnected: true, removed: result });
  });

  app.delete("/api/settings/sandbox-data", async (request, reply) => {
    const user = await requireAppUser(request, reply);

    if (!user) {
      return reply;
    }

    const result = await prisma.$transaction(async (tx) => {
      const chatHistory = await tx.chatHistory.deleteMany({ where: { userId: user.id } });
      const insights = await tx.insight.deleteMany({ where: { userId: user.id } });
      const forecasts = await tx.forecast.deleteMany({ where: { userId: user.id } });
      const scores = await tx.financialScore.deleteMany({ where: { userId: user.id } });
      const subscriptions = await tx.subscription.deleteMany({ where: { userId: user.id } });
      const transactions = await tx.transaction.deleteMany({ where: { userId: user.id } });
      const accounts = await tx.account.deleteMany({ where: { userId: user.id } });
      const plaidItems = await tx.plaidItem.deleteMany({ where: { userId: user.id } });

      return {
        chatHistory: chatHistory.count,
        insights: insights.count,
        forecasts: forecasts.count,
        scores: scores.count,
        subscriptions: subscriptions.count,
        transactions: transactions.count,
        accounts: accounts.count,
        plaidItems: plaidItems.count,
      };
    });

    return reply.send({ cleared: true, removed: result });
  });

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

    const dashboard = summarizeDashboard(accounts, transactions, {
      employmentStatus: (user.employmentStatus ?? "unknown") as "employed" | "unemployed" | "unknown",
      jobTitle: user.jobTitle ?? null,
      grossPay: user.grossPay ? Number(user.grossPay) : null,
      payFrequency: (user.payFrequency ?? null) as
        | "weekly"
        | "biweekly"
        | "semimonthly"
        | "monthly"
        | "annually"
        | null,
    });
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

  app.get("/api/profile", async (request, reply) => {
    const user = await requireAppUser(request, reply);

    if (!user) {
      return reply;
    }

    return reply.send(serializeProfile(user));
  });

  app.patch("/api/profile", async (request, reply) => {
    const user = await requireAppUser(request, reply);

    if (!user) {
      return reply;
    }

    const parsed = profileUpdateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(422).send({ error: "Invalid profile", details: parsed.error.flatten() });
    }

    const data = parsed.data;
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        employmentStatus: data.employmentStatus,
        jobTitle: data.employmentStatus === "employed" ? data.jobTitle ?? null : null,
        grossPay: data.employmentStatus === "employed" ? data.grossPay ?? null : null,
        payFrequency: data.employmentStatus === "employed" ? data.payFrequency ?? null : null,
        onboardedAt: user.onboardedAt ?? new Date(),
      },
    });

    return reply.send(serializeProfile(updated));
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

    const stored = await prisma.subscription.findMany({
      where: { userId: user.id },
      orderBy: { monthlyCost: "desc" },
    });

    if (stored.length) {
      const data = stored.map((sub) => {
        const monthlyCost = Number(sub.monthlyCost);
        const yearlyCost = Number(sub.yearlyCost);
        return {
          id: sub.id,
          name: sub.merchantName,
          merchantName: sub.merchantName,
          monthlyCost: currency(monthlyCost),
          yearlyCost: currency(yearlyCost),
          opportunity: monthlyCost > 25 ? "Review" : "Keep",
          note:
            monthlyCost > 25
              ? "Recurring charge detected with meaningful annual cost."
              : "Recurring charge detected from transaction cadence.",
          confidence: sub.confidence,
          lastChargedAt: sub.lastChargedAt ?? undefined,
          category: sub.category ?? undefined,
          status: sub.status,
        };
      });
      const reviewMonthly = data
        .filter((sub) => sub.opportunity === "Review" && sub.status !== "cancelled")
        .reduce((total, sub) => total + sub.monthlyCost, 0);
      const activeData = data.filter((sub) => sub.status !== "cancelled");

      return reply.send({
        data,
        summary: {
          count: data.length,
          totalMonthly: currency(activeData.reduce((total, sub) => total + sub.monthlyCost, 0)),
          totalYearly: currency(activeData.reduce((total, sub) => total + sub.yearlyCost, 0)),
          reviewMonthly: currency(reviewMonthly),
          reviewYearly: currency(reviewMonthly * 12),
        },
      });
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

    const latestForecast = await prisma.forecast.findFirst({
      where: { userId: user.id },
      orderBy: { generatedAt: "desc" },
    });

    if (latestForecast) {
      return reply.send({
        data: latestForecast.data,
        source: "persisted-snapshot",
      });
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

    // Use the AI forecast when available so this endpoint agrees with the
    // dashboard overview, which also prefers the AI key points.
    const forecast = aiSummary?.forecast?.keyPoints?.length
      ? aiSummary.forecast.keyPoints
      : dashboard.forecast;

    return reply.send({
      data: forecast,
      source: aiSummary?.modelVersion ?? "typescript-fallback",
    });
  });

  app.get(
    "/api/reports/weekly",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
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
    },
  );

  app.post(
    "/api/advisor/chat",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
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
    },
  );

  app.get("/api/advisor/history", async (request, reply) => {
    const user = await requireAppUser(request, reply);

    if (!user) {
      return reply;
    }

    const rows = await prisma.chatHistory.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 80,
    });

    return reply.send({
      data: rows.reverse().map((row) => ({
        id: row.id,
        role: row.role,
        content: row.message,
        createdAt: row.createdAt,
        ...extractChatContext(row.contextSnapshot),
      })),
    });
  });

  app.delete("/api/advisor/history", async (request, reply) => {
    const user = await requireAppUser(request, reply);

    if (!user) {
      return reply;
    }

    const deleted = await prisma.chatHistory.deleteMany({
      where: { userId: user.id },
    });

    return reply.send({ deletedCount: deleted.count });
  });

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

  app.patch("/api/subscriptions/:id", async (request, reply) => {
    const user = await requireAppUser(request, reply);

    if (!user) {
      return reply;
    }

    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { status?: unknown };
    const status = parseSubscriptionStatus(body.status);

    if (!status) {
      return reply.code(400).send({ error: "status must be one of active, paused, cancelled" });
    }

    const result = await prisma.subscription.updateMany({
      where: { id, userId: user.id },
      data: { status },
    });

    if (result.count === 0) {
      return reply.code(404).send({ error: "Subscription not found" });
    }

    return reply.send({ id, status });
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

export function parseSubscriptionStatus(value: unknown): "active" | "paused" | "cancelled" | null {
  return value === "active" || value === "paused" || value === "cancelled" ? value : null;
}

function currency(value: number) {
  return Math.round(value * 100) / 100;
}

function serializeProfile(profile: {
  employmentStatus: string;
  jobTitle: string | null;
  grossPay: unknown;
  payFrequency: string | null;
  onboardedAt: Date | null;
}) {
  return {
    employmentStatus: profile.employmentStatus,
    jobTitle: profile.jobTitle,
    grossPay: profile.grossPay ? Number(profile.grossPay) : null,
    payFrequency: profile.payFrequency,
    onboardedAt: profile.onboardedAt,
  };
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

function extractChatContext(context: unknown) {
  if (!isRecord(context)) {
    return {};
  }

  return {
    decision: typeof context.decision === "string" ? context.decision : undefined,
    source: typeof context.source === "string" ? context.source : undefined,
    dataPoints: isDataPointArray(context.dataPoints) ? context.dataPoints : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isDataPointArray(value: unknown): value is Array<{ label: string; value: string }> {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.label === "string" &&
        typeof item.value === "string",
    )
  );
}

async function getAiRuntimeStatus() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(`${env.AI_SERVICE_URL}/health`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error("AI service health check failed");
    }

    const body = (await response.json()) as {
      service?: string;
      llm?: {
        provider?: string;
        model?: string;
        configured?: boolean;
      };
    };

    return {
      online: true,
      service: body.service ?? "finsight-ai-service",
      analytics: "python-analytics-v1",
      llmProvider: body.llm?.provider ?? "gemini",
      llmModel: body.llm?.model ?? "gemini-2.5-flash",
      llmConfigured: Boolean(body.llm?.configured),
      fallbackMode: !body.llm?.configured,
    };
  } catch {
    return {
      online: false,
      service: "offline",
      analytics: "typescript-fallback",
      llmProvider: "gemini",
      llmModel: "gemini-2.5-flash",
      llmConfigured: false,
      fallbackMode: true,
    };
  } finally {
    clearTimeout(timeout);
  }
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
  const flexibleOutflows = currentOutflows.filter(
    (transaction) => !isInternalTransferCategory(transaction.categoryPrimary),
  );
  const categoryCandidates = flexibleOutflows.length ? flexibleOutflows : currentOutflows;
  const byCategory = new Map<string, number>();

  for (const transaction of categoryCandidates) {
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
