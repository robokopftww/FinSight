import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const events: string[] = [];
  const accountQueries: Array<Record<string, unknown>> = [];
  const transactionQueries: Array<Record<string, unknown>> = [];
  const now = new Date("2026-07-13T17:00:00.000Z");
  const authenticatedUser = {
    id: "user-1",
    clerkId: "clerk-1",
    email: "owner@example.com",
    firstName: "Owner",
    lastName: "User",
    employmentStatus: "unknown",
    jobTitle: null,
    grossPay: null,
    payFrequency: null,
    onboardedAt: now,
  };
  const plaidItems = [
    {
      id: "item-1",
      userId: "user-1",
      plaidItemId: "plaid-item-1",
      accessToken: "access-1",
      institutionName: "First Platypus Bank",
      transactionsCursor: null,
    },
    {
      id: "item-2",
      userId: "user-2",
      plaidItemId: "plaid-item-2",
      accessToken: "access-2",
      institutionName: "Other User Bank",
      transactionsCursor: null,
    },
  ];
  const accounts = [
    {
      id: "account-1",
      userId: "user-1",
      itemId: "item-1",
      plaidItemId: "plaid-item-1",
      plaidAccountId: "plaid-account-1",
      institutionName: "First Platypus Bank",
      name: "Checking",
      mask: "1234",
      type: "depository",
      subtype: "checking",
      currentBalance: 100,
      availableBalance: 90,
      currencyCode: "USD",
      lastSyncedAt: null as Date | null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "account-2",
      userId: "user-2",
      itemId: "item-2",
      plaidItemId: "plaid-item-2",
      plaidAccountId: "plaid-account-2",
      institutionName: "Other User Bank",
      name: "Other Checking",
      mask: "9999",
      type: "depository",
      subtype: "checking",
      currentBalance: 999_999,
      availableBalance: 999_999,
      currencyCode: "USD",
      lastSyncedAt: null as Date | null,
      createdAt: now,
      updatedAt: now,
    },
  ];
  const transactions: Array<Record<string, unknown>> = [];

  const accountsGet = vi.fn(async ({ access_token }: { access_token: string }) => {
    events.push("accounts-get");

    if (access_token !== "access-1") {
      throw new Error(`Unexpected access token: ${access_token}`);
    }

    return {
      data: {
        accounts: [
          {
            account_id: "plaid-account-1",
            name: "Checking",
            mask: "1234",
            type: "depository",
            subtype: "checking",
            balances: {
              current: 9125.42,
              available: 9000.12,
              iso_currency_code: "USD",
            },
          },
        ],
      },
    };
  });
  const transactionsSync = vi.fn(async ({ access_token }: { access_token: string }) => {
    events.push("transactions-sync");

    if (access_token !== "access-1") {
      throw new Error(`Unexpected access token: ${access_token}`);
    }

    return {
      data: {
        added: [
          {
            account_id: "plaid-account-1",
            transaction_id: "tx-added",
            merchant_name: "Corner Cafe",
            name: "Corner Cafe",
            amount: 25,
            date: "2026-07-12",
            pending: false,
            personal_finance_category: {
              primary: "FOOD_AND_DRINK",
              detailed: "FOOD_AND_DRINK_COFFEE",
            },
          },
        ],
        modified: [
          {
            account_id: "plaid-account-1",
            transaction_id: "tx-modified",
            merchant_name: "Transit Pass",
            name: "Transit Pass",
            amount: 40,
            date: "2026-07-11",
            pending: false,
            personal_finance_category: {
              primary: "TRANSPORTATION",
              detailed: "TRANSPORTATION_PUBLIC_TRANSIT",
            },
          },
        ],
        removed: [{ transaction_id: "tx-removed" }],
        next_cursor: "cursor-1",
        has_more: false,
      },
    };
  });

  const prisma = {
    plaidItem: {
      findMany: vi.fn(async ({ where }: { where: { userId?: string } }) =>
        plaidItems.filter((item) => !where.userId || item.userId === where.userId),
      ),
      update: vi.fn(async () => {
        events.push("transaction-sync-complete");
        return plaidItems[0];
      }),
    },
    account: {
      upsert: vi.fn(async (args: { where: { plaidAccountId: string }; update: Record<string, unknown> }) => {
        events.push("account-upsert");
        const account = accounts.find((candidate) => candidate.plaidAccountId === args.where.plaidAccountId);

        if (!account) {
          throw new Error("Expected seeded account");
        }

        Object.assign(account, args.update);
        return account;
      }),
      findMany: vi.fn(async ({ where }: { where: { itemId?: string; userId?: string } }) => {
        accountQueries.push(where);
        return accounts.filter(
          (account) =>
            (!where.itemId || account.itemId === where.itemId) &&
            (!where.userId || account.userId === where.userId),
        );
      }),
    },
    transaction: {
      upsert: vi.fn(async (args: { create: Record<string, unknown> }) => {
        events.push("transaction-upsert");
        const transaction = {
          id: "transaction-1",
          createdAt: now,
          updatedAt: now,
          ...args.create,
        };
        transactions.push(transaction);
        return transaction;
      }),
      updateMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        transactionQueries.push(where);
        return { count: 1 };
      }),
      deleteMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        transactionQueries.push(where);
        return { count: 1 };
      }),
      findMany: vi.fn(async ({ where }: { where: { userId?: string } }) => {
        transactionQueries.push(where);
        return transactions.filter((transaction) => !where.userId || transaction.userId === where.userId);
      }),
    },
  };

  return {
    accountQueries,
    accounts,
    accountsGet,
    authenticatedUser,
    events,
    persistAnalyticsSnapshot: vi.fn(async (_store, userId: string) => {
      events.push("analytics-persistence");
      expect(userId).toBe("user-1");
    }),
    prisma,
    requestAiSummary: vi.fn().mockResolvedValue(null),
    transactionQueries,
    transactionsSync,
  };
});

vi.mock("../src/lib/auth.js", () => ({
  requireAppUser: vi.fn().mockResolvedValue(mocks.authenticatedUser),
}));

vi.mock("../src/lib/plaid.js", () => ({
  getPlaidClient: () => ({
    accountsGet: mocks.accountsGet,
    transactionsSync: mocks.transactionsSync,
  }),
  isPlaidConfigured: () => true,
}));

vi.mock("../src/lib/prisma.js", () => ({ prisma: mocks.prisma }));

vi.mock("../src/lib/analytics-persistence.js", () => ({
  persistAnalyticsSnapshot: mocks.persistAnalyticsSnapshot,
}));

vi.mock("../src/lib/ai-service.js", () => ({
  requestAiChat: vi.fn(),
  requestAiSummary: mocks.requestAiSummary,
  requestAiWeeklyReport: vi.fn(),
}));

import { registerPlaidRoutes } from "../src/modules/plaid/routes.js";
import { registerRoutes } from "../src/routes/index.js";

describe("authenticated Plaid sync route", () => {
  const apps: Array<ReturnType<typeof Fastify>> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("refreshes owned balances before transactions and exposes them through the next Overview read", async () => {
    const app = Fastify({ logger: false });
    apps.push(app);
    await registerPlaidRoutes(app);
    await registerRoutes(app);

    const syncResponse = await app.inject({ method: "POST", url: "/api/plaid/sync" });

    expect(syncResponse.statusCode).toBe(200);
    const syncBody = syncResponse.json();
    expect(syncBody).toMatchObject({
      addedCount: 1,
      modifiedCount: 1,
      removedCount: 1,
      refreshedAccountsCount: 1,
    });
    expect(new Date(syncBody.syncedAt).toISOString()).toBe(syncBody.syncedAt);

    expect(mocks.events.indexOf("account-upsert")).toBeLessThan(mocks.events.indexOf("transactions-sync"));
    expect(mocks.events.indexOf("transaction-sync-complete")).toBeLessThan(
      mocks.events.indexOf("analytics-persistence"),
    );
    expect(mocks.accounts[0].lastSyncedAt?.toISOString()).toBe(syncBody.syncedAt);

    const overviewResponse = await app.inject({ method: "GET", url: "/api/dashboard/overview" });

    expect(overviewResponse.statusCode).toBe(200);
    expect(overviewResponse.json()).toMatchObject({
      currentBalance: 9125.42,
      availableBalance: 9000.12,
      accountsBreakdown: [{ name: "Checking", mask: "1234", currentBalance: 9125.42 }],
    });

    expect(mocks.prisma.plaidItem.findMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(mocks.accountsGet).toHaveBeenCalledTimes(1);
    expect(mocks.accountsGet).toHaveBeenCalledWith({ access_token: "access-1" });
    expect(mocks.accountQueries).toContainEqual({ userId: "user-1" });
    expect(mocks.transactionQueries).toContainEqual({ userId: "user-1" });
    expect(mocks.prisma.transaction.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ userId: "user-1" }) }),
    );
    expect(mocks.prisma.transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "user-1" }) }),
    );
    expect(mocks.prisma.transaction.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "user-1" }) }),
    );
  });
});
