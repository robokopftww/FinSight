import { describe, expect, it, vi } from "vitest";

import { refreshPlaidAccounts } from "../src/lib/plaid-account-sync.js";

describe("refreshPlaidAccounts", () => {
  it("upserts current and available Plaid balances with the shared sync timestamp", async () => {
    const syncedAt = new Date("2026-07-13T17:00:00.000Z");
    const store = {
      account: {
        upsert: vi.fn().mockResolvedValue({ id: "account-1" }),
      },
    };
    const fetchAccounts = vi.fn().mockResolvedValue([
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
    ]);

    const count = await refreshPlaidAccounts({
      store,
      item: {
        id: "item-1",
        userId: "user-1",
        plaidItemId: "plaid-item-1",
        accessToken: "access-1",
        institutionName: "First Platypus Bank",
      },
      fetchAccounts,
      syncedAt,
    });

    expect(count).toBe(1);
    expect(fetchAccounts).toHaveBeenCalledWith("access-1");
    expect(store.account.upsert).toHaveBeenCalledWith({
      where: { plaidAccountId: "plaid-account-1" },
      create: {
        userId: "user-1",
        itemId: "item-1",
        plaidItemId: "plaid-item-1",
        plaidAccountId: "plaid-account-1",
        institutionName: "First Platypus Bank",
        name: "Checking",
        mask: "1234",
        type: "depository",
        subtype: "checking",
        currentBalance: 9125.42,
        availableBalance: 9000.12,
        currencyCode: "USD",
        lastSyncedAt: syncedAt,
      },
      update: {
        itemId: "item-1",
        institutionName: "First Platypus Bank",
        name: "Checking",
        mask: "1234",
        type: "depository",
        subtype: "checking",
        currentBalance: 9125.42,
        availableBalance: 9000.12,
        currencyCode: "USD",
        lastSyncedAt: syncedAt,
      },
    });
  });

  it("returns zero when Plaid reports no accounts", async () => {
    const store = { account: { upsert: vi.fn() } };

    const count = await refreshPlaidAccounts({
      store,
      item: {
        id: "item-1",
        userId: "user-1",
        plaidItemId: "plaid-item-1",
        accessToken: "access-1",
        institutionName: "First Platypus Bank",
      },
      fetchAccounts: vi.fn().mockResolvedValue([]),
      syncedAt: new Date(),
    });

    expect(count).toBe(0);
    expect(store.account.upsert).not.toHaveBeenCalled();
  });
});
