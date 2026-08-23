import { z } from "zod";

import { prisma } from "./prisma.js";

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
