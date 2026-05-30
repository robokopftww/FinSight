import type { FastifyInstance } from "fastify";

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

    return reply.send(summarizeDashboard(accounts, transactions));
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

    return reply.send(
      calculateHealthScore({
        savingsRate: dashboard.savingsRate,
        monthlyIncome: dashboard.monthlyIncome,
        monthlySpending: dashboard.monthlySpending,
        currentBalance: dashboard.currentBalance,
        subscriptionBurden,
      }),
    );
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
