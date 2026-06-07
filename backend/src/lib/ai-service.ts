import type { Account, Transaction } from "@prisma/client";

import { env } from "../config/env.js";

type AiSummaryResponse = {
  score?: {
    score: number;
    savingsRate: number;
    savingsRateLabel?: string;
    displaySavingsRate?: number;
    savingsRateIsExtreme?: boolean;
    spendingConsistency?: number;
    emergencyFundDays?: number;
    subscriptionBurden?: number;
    factors?: Array<{ label: string; value: number }>;
    recommendations?: string[];
  };
  forecast?: {
    projectedBalance: number;
    lowestProjectedBalance: number;
    lowBalanceRisk: boolean;
    riskProbability: number;
    dailyDelta?: number;
    keyPoints?: Array<{ label: string; balance: number }>;
  };
  insights?: Array<{ title: string; summary: string; severity: string }>;
  modelVersion?: string;
};

export type AiChatResponse = {
  answer: string;
  decision?: string;
  dataPoints?: Array<{ label: string; value: string }>;
  followUps?: string[];
  source?: string;
};

export type AiWeeklyReportResponse = {
  periodLabel: string;
  cards: Array<{ label: string; value: string; detail: string }>;
  insights: Array<{ title: string; summary: string; severity: string }>;
  weeklySpend: Array<{ label: string; amount: number }>;
  llmSummary?: string | null;
  forecast?: {
    projectedBalance: number;
    safeToSpend: number;
    riskProbability: number;
  };
  source?: string;
};

const AI_CHAT_TIMEOUT_MS = 30000;
const AI_REPORT_TIMEOUT_MS = 30000;
const AI_SUMMARY_TIMEOUT_MS = 8000;

export async function requestAiSummary({
  accounts,
  transactions,
  monthlyIncome,
  monthlySpending,
  currentBalance,
  monthlySubscriptionCost,
}: {
  accounts: Account[];
  transactions: Transaction[];
  monthlyIncome: number;
  monthlySpending: number;
  currentBalance: number;
  monthlySubscriptionCost: number;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_SUMMARY_TIMEOUT_MS);

  try {
    const response = await fetch(`${env.AI_SERVICE_URL}/analytics/summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...buildAnalyticsPayload({
          accounts,
          transactions,
          monthlyIncome,
          monthlySpending,
          currentBalance,
          monthlySubscriptionCost,
        }),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as AiSummaryResponse;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestAiChat({
  question,
  accounts,
  transactions,
  monthlyIncome,
  monthlySpending,
  currentBalance,
  monthlySubscriptionCost,
}: {
  question: string;
  accounts: Account[];
  transactions: Transaction[];
  monthlyIncome: number;
  monthlySpending: number;
  currentBalance: number;
  monthlySubscriptionCost: number;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_CHAT_TIMEOUT_MS);

  try {
    const response = await fetch(`${env.AI_SERVICE_URL}/analytics/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        ...buildAnalyticsPayload({
          accounts,
          transactions,
          monthlyIncome,
          monthlySpending,
          currentBalance,
          monthlySubscriptionCost,
        }),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as AiChatResponse;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestAiWeeklyReport({
  accounts,
  transactions,
  monthlyIncome,
  monthlySpending,
  currentBalance,
  monthlySubscriptionCost,
}: {
  accounts: Account[];
  transactions: Transaction[];
  monthlyIncome: number;
  monthlySpending: number;
  currentBalance: number;
  monthlySubscriptionCost: number;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REPORT_TIMEOUT_MS);

  try {
    const response = await fetch(`${env.AI_SERVICE_URL}/analytics/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        buildAnalyticsPayload({
          accounts,
          transactions,
          monthlyIncome,
          monthlySpending,
          currentBalance,
          monthlySubscriptionCost,
        }),
      ),
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as AiWeeklyReportResponse;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function buildAnalyticsPayload({
  accounts,
  transactions,
  monthlyIncome,
  monthlySpending,
  currentBalance,
  monthlySubscriptionCost,
}: {
  accounts: Account[];
  transactions: Transaction[];
  monthlyIncome: number;
  monthlySpending: number;
  currentBalance: number;
  monthlySubscriptionCost: number;
}) {
  const cashAccountIds = new Set(accounts.filter((account) => account.type === "depository").map((account) => account.id));

  return {
    current_balance: currentBalance,
    monthly_income: monthlyIncome,
    monthly_spending: monthlySpending,
    monthly_subscription_cost: monthlySubscriptionCost,
    transactions: transactions.filter((transaction) => cashAccountIds.has(transaction.accountId)).slice(0, 300).map((transaction) => ({
      amount: Number(transaction.amount),
      direction: transaction.direction,
      category: transaction.categoryPrimary,
      merchant_name: transaction.merchantName,
      description: transaction.description,
      occurred_at: transaction.occurredAt.toISOString(),
      pending: transaction.pending,
    })),
    accounts: accounts.map((account) => ({
      name: account.name,
      type: account.type,
      subtype: account.subtype,
      current_balance: Number(account.currentBalance),
      available_balance: Number(account.availableBalance ?? account.currentBalance),
    })),
  };
}
