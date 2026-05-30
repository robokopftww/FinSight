import type { FastifyInstance } from "fastify";
import { CountryCode, Products } from "plaid";
import { z } from "zod";

import { env } from "../../config/env.js";
import { requireAppUser } from "../../lib/auth.js";
import { getPlaidClient, isPlaidConfigured } from "../../lib/plaid.js";
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

    const [itemsCount, accountsCount, transactionsCount] = await Promise.all([
      prisma.plaidItem.count({ where: { userId: user.id } }),
      prisma.account.count({ where: { userId: user.id } }),
      prisma.transaction.count({ where: { userId: user.id } }),
    ]);

    return reply.send({
      configured: isPlaidConfigured(),
      connected: accountsCount > 0,
      itemsCount,
      accountsCount,
      transactionsCount,
    });
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

      while (hasMore) {
        const response = await plaid.transactionsSync({
          access_token: plaidItem.accessToken,
          cursor,
          count: 100,
        });

        const accounts = await prisma.account.findMany({
          where: { itemId: plaidItem.id },
        });
        const accountIdByPlaidId = new Map(accounts.map((account) => [account.plaidAccountId, account.id]));

        for (const transaction of response.data.added) {
          const accountId = accountIdByPlaidId.get(transaction.account_id);

          if (!accountId) {
            continue;
          }

          const category = mapTransactionCategory(transaction);

          await prisma.transaction.upsert({
            where: { plaidTransactionId: transaction.transaction_id },
            create: {
              userId: user.id,
              accountId,
              plaidTransactionId: transaction.transaction_id,
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
            update: {
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
          addedCount += 1;
        }

        for (const transaction of response.data.modified) {
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
          modifiedCount += 1;
        }

        for (const transaction of response.data.removed) {
          await prisma.transaction.deleteMany({
            where: {
              userId: user.id,
              plaidTransactionId: transaction.transaction_id,
            },
          });
          removedCount += 1;
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

    return reply.send({
      addedCount,
      modifiedCount,
      removedCount,
    });
  });
}
