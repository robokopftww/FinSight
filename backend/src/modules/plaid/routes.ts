import type { FastifyInstance } from "fastify";
import { CountryCode, Products } from "plaid";
import { z } from "zod";

import { env } from "../../config/env.js";
import { requireAppUser } from "../../lib/auth.js";
import {
  calculateHealthScore,
  detectSubscriptions,
  summarizeDashboard,
} from "../../lib/financial-analytics.js";
import { persistAnalyticsSnapshot } from "../../lib/analytics-persistence.js";
import { getPlaidClient, isPlaidConfigured } from "../../lib/plaid.js";
import { deleteOwnedPlaidItem } from "../../lib/plaid-items.js";
import { prisma } from "../../lib/prisma.js";

const exchangeTokenSchema = z.object({
  publicToken: z.string().min(1),
  institutionName: z.string().optional().nullable(),
});

function mapPlaidAccountType(value: unknown) {
  return typeof value === "string" ? value : String(value ?? "unknown");
}

function mapTransactionCategory(transaction: {
  personal_finance_category?: {
    primary?: string | null;
    detailed?: string | null;
  } | null;
  category?: string[] | null;
}) {
  return {
    primary: transaction.personal_finance_category?.primary ?? transaction.category?.[0] ?? "Uncategorized",
    detailed: transaction.personal_finance_category?.detailed ?? transaction.category?.[1] ?? null,
  };
}

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

export async function registerPlaidRoutes(app: FastifyInstance) {
  app.get("/api/plaid/status", async (request, reply) => {
    const user = await requireAppUser(request, reply);

    if (!user) {
      return reply;
    }

    const [plaidItems, accountsCount, transactionsCount] = await Promise.all([
      prisma.plaidItem.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          institutionName: true,
          lastSyncedAt: true,
          _count: { select: { accounts: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.account.count({ where: { userId: user.id } }),
      prisma.transaction.count({ where: { userId: user.id } }),
    ]);

    return reply.send({
      configured: isPlaidConfigured(),
      environment: env.PLAID_ENV,
      connected: accountsCount > 0,
      itemsCount: plaidItems.length,
      accountsCount,
      transactionsCount,
      institutions: plaidItems.map((item) => ({
        id: item.id,
        name: item.institutionName,
        accountsCount: item._count.accounts,
        lastSyncedAt: item.lastSyncedAt,
      })),
    });
  });

  app.delete("/api/plaid/items/:itemId", async (request, reply) => {
    const user = await requireAppUser(request, reply);

    if (!user) {
      return reply;
    }

    const { itemId } = request.params as { itemId: string };
    let deleted;

    try {
      const plaid = getPlaidClient();
      deleted = await deleteOwnedPlaidItem(prisma, user.id, itemId, (accessToken) =>
        plaid.itemRemove({ access_token: accessToken }),
      );
    } catch (error) {
      const plaidError = getPlaidError(error);
      request.log.warn({ plaidError, itemId }, "Plaid item removal failed");

      return reply.status(409).send({
        error: "Unable to disconnect this institution from Plaid right now.",
        plaidErrorCode: plaidError.code,
      });
    }

    if (!deleted) {
      return reply.status(404).send({ error: "Connected institution not found" });
    }

    return reply.send({ disconnected: true, itemId: deleted.id });
  });

  app.post("/api/plaid/link-token", async (request, reply) => {
    const user = await requireAppUser(request, reply);

    if (!user) {
      return reply;
    }

    if (!isPlaidConfigured()) {
      return reply.status(501).send({
        error: "Plaid is not configured",
        missing: ["PLAID_CLIENT_ID", "PLAID_SECRET"],
      });
    }

    const plaid = getPlaidClient();
    const response = await plaid.linkTokenCreate({
      client_name: "FinSight",
      language: "en",
      country_codes: [CountryCode.Us],
      products: [Products.Transactions],
      user: {
        client_user_id: user.id,
      },
      transactions: {
        days_requested: 90,
      },
    });

    return reply.send({
      linkToken: response.data.link_token,
      expiration: response.data.expiration,
    });
  });

  app.post("/api/plaid/exchange-public-token", async (request, reply) => {
    const user = await requireAppUser(request, reply);

    if (!user) {
      return reply;
    }

    if (!isPlaidConfigured()) {
      return reply.status(501).send({ error: "Plaid is not configured" });
    }

    const payload = exchangeTokenSchema.parse(request.body);
    const plaid = getPlaidClient();
    const exchange = await plaid.itemPublicTokenExchange({
      public_token: payload.publicToken,
    });

    const accessToken = exchange.data.access_token;
    const plaidItemId = exchange.data.item_id;
    const accountsResponse = await plaid.accountsGet({
      access_token: accessToken,
    });

    const plaidItem = await prisma.plaidItem.upsert({
      where: { plaidItemId },
      create: {
        userId: user.id,
        plaidItemId,
        accessToken,
        institutionName: payload.institutionName ?? "Connected institution",
      },
      update: {
        accessToken,
        institutionName: payload.institutionName ?? "Connected institution",
      },
    });

    for (const account of accountsResponse.data.accounts) {
      await prisma.account.upsert({
        where: { plaidAccountId: account.account_id },
        create: {
          userId: user.id,
          itemId: plaidItem.id,
          plaidItemId,
          plaidAccountId: account.account_id,
          institutionName: plaidItem.institutionName,
          name: account.name,
          mask: account.mask,
          type: mapPlaidAccountType(account.type),
          subtype: account.subtype ? mapPlaidAccountType(account.subtype) : null,
          currentBalance: account.balances.current ?? 0,
          availableBalance: account.balances.available,
          currencyCode: account.balances.iso_currency_code ?? "USD",
          lastSyncedAt: new Date(),
        },
        update: {
          itemId: plaidItem.id,
          institutionName: plaidItem.institutionName,
          name: account.name,
          mask: account.mask,
          type: mapPlaidAccountType(account.type),
          subtype: account.subtype ? mapPlaidAccountType(account.subtype) : null,
          currentBalance: account.balances.current ?? 0,
          availableBalance: account.balances.available,
          currencyCode: account.balances.iso_currency_code ?? "USD",
          lastSyncedAt: new Date(),
        },
      });
    }

    return reply.send({
      itemId: plaidItem.id,
      accountsCount: accountsResponse.data.accounts.length,
    });
  });

  app.post("/api/plaid/sync", async (request, reply) => {
    const user = await requireAppUser(request, reply);

    if (!user) {
      return reply;
    }

    if (!isPlaidConfigured()) {
      return reply.status(501).send({ error: "Plaid is not configured" });
    }

    const plaid = getPlaidClient();
    const plaidItems = await prisma.plaidItem.findMany({
      where: { userId: user.id },
    });

    let addedCount = 0;
    let modifiedCount = 0;
    let removedCount = 0;

    for (const plaidItem of plaidItems) {
      let cursor = plaidItem.transactionsCursor ?? undefined;
      let hasMore = true;

      // Account → id map is stable for the duration of a sync, so fetch it once
      // per item instead of on every page.
      const accounts = await prisma.account.findMany({
        where: { itemId: plaidItem.id },
      });
      const accountIdByPlaidId = new Map(accounts.map((account) => [account.plaidAccountId, account.id]));

      while (hasMore) {
        let response;

        try {
          response = await plaid.transactionsSync({
            access_token: plaidItem.accessToken,
            cursor,
            count: 100,
          });
        } catch (error) {
          const plaidError = getPlaidError(error);
          request.log.warn({ plaidError, plaidItemId: plaidItem.id }, "Plaid transaction sync failed");

          return reply.status(409).send({
            error:
              plaidError.code === "INVALID_ACCESS_TOKEN" || plaidError.code === "ITEM_LOGIN_REQUIRED"
                ? "Stored Plaid connection cannot sync anymore. Disconnect this bank and reconnect it."
                : "Unable to sync transactions from Plaid right now.",
            plaidErrorCode: plaidError.code,
            plaidErrorMessage: plaidError.message,
          });
        }

        const addable = response.data.added.filter((transaction) => accountIdByPlaidId.has(transaction.account_id));

        await runInChunks(addable, 10, async (transaction) => {
          const accountId = accountIdByPlaidId.get(transaction.account_id)!;
          const category = mapTransactionCategory(transaction);
          const fields = {
            merchantName: transaction.merchant_name,
            description: transaction.name,
            amount: Math.abs(transaction.amount),
            direction: transaction.amount >= 0 ? "outflow" : "inflow",
            categoryPrimary: category.primary,
            categoryDetailed: category.detailed,
            occurredAt: new Date(transaction.date),
            pending: transaction.pending,
            raw: toJson(transaction),
          };

          await prisma.transaction.upsert({
            where: { plaidTransactionId: transaction.transaction_id },
            create: {
              userId: user.id,
              accountId,
              plaidTransactionId: transaction.transaction_id,
              ...fields,
            },
            update: fields,
          });
        });
        addedCount += addable.length;

        await runInChunks(response.data.modified, 10, async (transaction) => {
          const category = mapTransactionCategory(transaction);

          await prisma.transaction.updateMany({
            where: {
              userId: user.id,
              plaidTransactionId: transaction.transaction_id,
            },
            data: {
              merchantName: transaction.merchant_name,
              description: transaction.name,
              amount: Math.abs(transaction.amount),
              direction: transaction.amount >= 0 ? "outflow" : "inflow",
              categoryPrimary: category.primary,
              categoryDetailed: category.detailed,
              occurredAt: new Date(transaction.date),
              pending: transaction.pending,
              raw: toJson(transaction),
            },
          });
        });
        modifiedCount += response.data.modified.length;

        const removedIds = response.data.removed
          .map((transaction) => transaction.transaction_id)
          .filter((id): id is string => Boolean(id));

        if (removedIds.length) {
          const deleted = await prisma.transaction.deleteMany({
            where: {
              userId: user.id,
              plaidTransactionId: { in: removedIds },
            },
          });
          removedCount += deleted.count;
        }

        cursor = response.data.next_cursor;
        hasMore = response.data.has_more;
      }

      await prisma.plaidItem.update({
        where: { id: plaidItem.id },
        data: {
          transactionsCursor: cursor,
          lastSyncedAt: new Date(),
        },
      });
    }

    try {
      const [accountsForSnapshot, transactionsForSnapshot] = await Promise.all([
        prisma.account.findMany({ where: { userId: user.id } }),
        prisma.transaction.findMany({
          where: { userId: user.id },
          orderBy: { occurredAt: "desc" },
        }),
      ]);

      const dashboard = summarizeDashboard(accountsForSnapshot, transactionsForSnapshot);
      const detected = detectSubscriptions(transactionsForSnapshot);
      const monthlySubscriptionCost = detected.reduce((total, sub) => total + sub.monthlyCost, 0);
      const subscriptionBurden =
        dashboard.monthlyIncome > 0 ? (monthlySubscriptionCost / dashboard.monthlyIncome) * 100 : 0;
      const score = calculateHealthScore({
        savingsRate: dashboard.savingsRate,
        monthlyIncome: dashboard.monthlyIncome,
        monthlySpending: dashboard.monthlySpending,
        currentBalance: dashboard.currentBalance,
        subscriptionBurden,
      });

      await persistAnalyticsSnapshot(prisma, user.id, {
        score: {
          score: score.score,
          savingsRate: score.savingsRate,
          spendingConsistency: score.spendingConsistency,
          subscriptionBurden: score.subscriptionBurden,
          emergencyFundDays: score.emergencyFundDays,
          summary: score.summary,
        },
        forecast: {
          forecast: dashboard.forecast,
          riskProbability: dashboard.riskProbability,
        },
        insights: dashboard.insightHighlights,
        subscriptions: detected.map((sub) => ({
          merchantName: sub.merchantName,
          category: sub.category,
          monthlyCost: sub.monthlyCost,
          yearlyCost: sub.yearlyCost,
          confidence: sub.confidence,
          lastChargedAt: sub.lastChargedAt ?? null,
        })),
      });
    } catch (error) {
      request.log.error({ error }, "Failed to persist analytics snapshot after sync");
    }

    return reply.send({
      addedCount,
      modifiedCount,
      removedCount,
    });
  });
}

async function runInChunks<T>(items: T[], size: number, task: (item: T) => Promise<void>) {
  for (let index = 0; index < items.length; index += size) {
    const chunk = items.slice(index, index + size);
    await Promise.all(chunk.map(task));
  }
}

function getPlaidError(error: unknown) {
  const responseData = (error as { response?: { data?: { error_code?: string; error_message?: string } } }).response?.data;

  return {
    code: responseData?.error_code ?? "UNKNOWN_PLAID_ERROR",
    message: responseData?.error_message ?? (error instanceof Error ? error.message : "Unknown Plaid error"),
  };
}
