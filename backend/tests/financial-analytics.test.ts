import { describe, expect, it } from "vitest";
import type { Account, Transaction } from "@prisma/client";

import {
  calculateHealthScore,
  detectSubscriptions,
  summarizeDashboard,
} from "../src/lib/financial-analytics.js";

const DAY_MS = 1000 * 60 * 60 * 24;

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    userId: "user-1",
    accountId: "acct-1",
    plaidTransactionId: Math.random().toString(36).slice(2),
    merchantName: "Test Merchant",
    description: "Test",
    amount: 100 as unknown as Transaction["amount"],
    direction: "outflow",
    categoryPrimary: "GENERAL_MERCHANDISE",
    categoryDetailed: null,
    isRecurring: false,
    occurredAt: new Date(),
    pending: false,
    raw: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Transaction;
}

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "acct-1",
    userId: "user-1",
    itemId: "item-1",
    plaidItemId: "plaid-item-1",
    plaidAccountId: "plaid-acct-1",
    institutionName: "Test Bank",
    name: "Checking",
    mask: "0000",
    type: "depository",
    subtype: "checking",
    currentBalance: 5000 as unknown as Account["currentBalance"],
    availableBalance: 5000 as unknown as Account["availableBalance"],
    currencyCode: "USD",
    lastSyncedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Account;
}

describe("detectSubscriptions", () => {
  it("flags charges spaced at a monthly cadence with a consistent amount", () => {
    const base = Date.now();
    const transactions = [0, 1, 2].map((monthsAgo) =>
      makeTransaction({
        merchantName: "Netflix",
        amount: 15.99 as unknown as Transaction["amount"],
        occurredAt: new Date(base - monthsAgo * 30 * DAY_MS),
      }),
    );

    const subs = detectSubscriptions(transactions);
    const netflix = subs.find((s) => s.merchantName === "Netflix");

    expect(netflix).toBeDefined();
    expect(netflix?.cadence).toContain("Monthly");
  });

  it("does not flag same-priced purchases at random intervals (e.g. groceries)", () => {
    const base = Date.now();
    // Same price, but spaced 2, 3, 19 days apart — not a recurring cadence.
    const offsets = [0, 2, 5, 24];
    const transactions = offsets.map((daysAgo) =>
      makeTransaction({
        merchantName: "Whole Foods",
        amount: 42 as unknown as Transaction["amount"],
        occurredAt: new Date(base - daysAgo * DAY_MS),
      }),
    );

    const subs = detectSubscriptions(transactions);
    expect(subs.find((s) => s.merchantName === "Whole Foods")).toBeUndefined();
  });

  it("ignores merchants with only a single charge", () => {
    const subs = detectSubscriptions([makeTransaction({ merchantName: "OneOff" })]);
    expect(subs).toHaveLength(0);
  });
});

describe("calculateHealthScore", () => {
  it("clamps the score to the 0-100 range", () => {
    const result = calculateHealthScore({
      savingsRate: 50,
      monthlyIncome: 8000,
      monthlySpending: 2000,
      currentBalance: 30000,
      subscriptionBurden: 0,
    });

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("marks extreme savings rates", () => {
    const result = calculateHealthScore({
      savingsRate: 250,
      monthlyIncome: 1000,
      monthlySpending: -2000,
      currentBalance: 5000,
      subscriptionBurden: 0,
    });

    expect(result.savingsRateIsExtreme).toBe(true);
    expect(result.displaySavingsRate).toBeLessThanOrEqual(100);
  });
});

describe("summarizeDashboard", () => {
  it("sums account balances and derives savings rate from recent activity", () => {
    const now = Date.now();
    const transactions = [
      makeTransaction({ direction: "inflow", amount: 4000 as unknown as Transaction["amount"], occurredAt: new Date(now - 2 * DAY_MS) }),
      makeTransaction({ direction: "outflow", amount: 1000 as unknown as Transaction["amount"], occurredAt: new Date(now - 1 * DAY_MS) }),
    ];

    const dashboard = summarizeDashboard([makeAccount()], transactions);

    expect(dashboard.currentBalance).toBe(5000);
    expect(dashboard.monthlyIncome).toBe(4000);
    expect(dashboard.monthlySpending).toBe(1000);
    expect(dashboard.savingsRate).toBe(75);
  });
});
