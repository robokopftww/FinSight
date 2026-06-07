import type { Account, Transaction } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { buildAnalyticsPayload } from "../src/lib/ai-service.js";

describe("buildAnalyticsPayload", () => {
  it("sends only depository-account transactions to cash forecasting", () => {
    const accounts = [
      { id: "cash-1", type: "depository", name: "Checking", subtype: "checking", currentBalance: 5000, availableBalance: 4900 },
      { id: "credit-1", type: "credit", name: "Gold Card", subtype: "credit card", currentBalance: 400, availableBalance: 9600 },
    ] as unknown as Account[];
    const transactions = [
      { accountId: "cash-1", amount: 1000, direction: "inflow", occurredAt: new Date("2026-05-01"), pending: false },
      { accountId: "credit-1", amount: 300, direction: "outflow", occurredAt: new Date("2026-05-02"), pending: false },
    ] as unknown as Transaction[];

    const payload = buildAnalyticsPayload({
      accounts,
      transactions,
      monthlyIncome: 1000,
      monthlySpending: 300,
      currentBalance: 5000,
      monthlySubscriptionCost: 0,
    });

    expect(payload.transactions).toHaveLength(1);
    expect(payload.transactions[0]?.direction).toBe("inflow");
  });
});
