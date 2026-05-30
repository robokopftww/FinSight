import type { FastifyInstance } from "fastify";

import { requireAppUser } from "../lib/auth.js";
import { calculateHealthScore, detectSubscriptions, summarizeDashboard } from "../lib/financial-analytics.js";
import { chatResponse } from "../lib/mock-data.js";
import { prisma } from "../lib/prisma.js";

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

    const transactions = await prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { occurredAt: "desc" },
      take: 100,
    });

    return reply.send({
      data: transactions.map((transaction) => ({
        id: transaction.id,
        merchant: transaction.merchantName ?? transaction.description,
        merchantName: transaction.merchantName,
        description: transaction.description,
        amount: transaction.direction === "outflow" ? -Number(transaction.amount) : Number(transaction.amount),
        category: formatCategory(transaction.categoryPrimary ?? "Uncategorized"),
        categoryPrimary: formatCategory(transaction.categoryPrimary ?? "Uncategorized"),
        date: transaction.occurredAt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        occurredAt: transaction.occurredAt,
        status: transaction.pending ? "Pending" : transaction.isRecurring ? "Recurring" : "Posted",
      })),
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

    return reply.send({ data: detectSubscriptions(transactions) });
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
        data: { categoryPrimary },
      });
    }

    return {
      id,
      status: "updated",
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
