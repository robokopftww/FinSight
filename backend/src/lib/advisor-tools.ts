import { z } from "zod";

import { prisma } from "./prisma.js";
import { summarizeDashboard } from "./financial-analytics.js";

export const transactionQuerySchema = z.object({
  category: z.string().optional(),
  merchant: z.string().optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  minAmount: z.number().optional(),
  maxAmount: z.number().optional(),
  limit: z.number().int().positive().max(200).optional(),
});

export type TransactionQuery = z.infer<typeof transactionQuerySchema>;

// Note: the Prisma `Transaction` model stores the transaction date as
// `occurredAt` (not `date`) and has no separate `category` field beyond
// `categoryPrimary`. The query below is written against the actual schema
// (backend/prisma/schema.prisma); the returned shape still matches the
// `{ id, date, merchant, category, amount, direction }` contract.
export async function getRecentTransactionsForUser(
  userId: string,
  args: Record<string, unknown>,
) {
  const q = transactionQuerySchema.parse(args);
  const limit = Math.min(q.limit ?? 50, 200);
  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      ...(q.category ? { categoryPrimary: q.category } : {}),
      ...(q.merchant ? { merchantName: { contains: q.merchant, mode: "insensitive" } } : {}),
      ...(q.startDate ? { occurredAt: { gte: new Date(q.startDate) } } : {}),
      ...(q.endDate ? { occurredAt: { lte: new Date(q.endDate) } } : {}),
      ...(q.minAmount !== undefined ? { amount: { gte: q.minAmount } } : {}),
      ...(q.maxAmount !== undefined ? { amount: { lte: q.maxAmount } } : {}),
    },
    orderBy: { occurredAt: "desc" },
    take: limit,
    select: {
      id: true,
      occurredAt: true,
      merchantName: true,
      description: true,
      categoryPrimary: true,
      amount: true,
      direction: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    date: r.occurredAt?.toISOString().slice(0, 10),
    merchant: r.merchantName ?? r.description,
    category: r.categoryPrimary,
    amount: Number(r.amount),
    direction: r.direction,
  }));
}

export async function getSubscriptionsForUser(userId: string) {
  const rows = await prisma.subscription.findMany({
    where: { userId },
    orderBy: { monthlyCost: "desc" },
  });
  return rows.map((s) => {
    const yearly = Number(s.yearlyCost ?? 0);
    const monthly = Number(s.monthlyCost ?? 0);
    const cadence = yearly > 0 && monthly > 0
      ? Math.abs(yearly / 12 - monthly) < 1
        ? "monthly"
        : "yearly"
      : undefined;
    return {
      name: s.merchantName ?? "Subscription",
      monthlyCost: monthly,
      note: s.category ?? undefined,
      lastChargedAt: s.lastChargedAt?.toISOString(),
      cadence,
    };
  });
}

export async function getBalanceForUser(userId: string, args: Record<string, unknown>) {
  const asOfDate = typeof args.asOfDate === "string"
    ? args.asOfDate
    : new Date().toISOString().slice(0, 10);

  const accounts = await prisma.account.findMany({
    where: { userId },
  });
  const transactions = await prisma.transaction.findMany({
    where: { userId },
  });

  const overview = summarizeDashboard(accounts, transactions);

  return {
    asOfDate,
    totalBalance: Number(overview.currentBalance ?? 0),
    accounts: (overview.accountsBreakdown ?? []).map((a) => ({
      name: a.name,
      mask: a.mask ?? null,
      balance: Number(a.currentBalance ?? 0),
    })),
  };
}

export async function getInsightsForUser(userId: string, args: Record<string, unknown>) {
  const severity = args.severity as "high" | "medium" | "low" | undefined;
  const rows = await prisma.insight.findMany({
    where: {
      userId,
      ...(severity ? { severity } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((i) => ({
    title: i.title,
    summary: i.summary,
    severity: i.severity,
    createdAt: i.createdAt.toISOString(),
  }));
}

export async function getForecastForUser(userId: string, args: Record<string, unknown>) {
  const horizon = [7, 30, 90].includes(args.horizonDays as number)
    ? (args.horizonDays as number)
    : 30;

  const forecast = await prisma.forecast.findFirst({
    where: { userId, horizonDays: horizon },
    orderBy: { generatedAt: "desc" },
  });

  const points = forecast?.data && typeof forecast.data === "object" && "points" in forecast.data
    ? (forecast.data as { points: Array<{ date: string; balance: number }> }).points
    : [];

  return {
    horizonDays: horizon,
    points: points.map((p) => ({ date: p.date, balance: Number(p.balance) })),
    safeToSpend: Number(forecast?.projectedBalance ?? 0),
  };
}
