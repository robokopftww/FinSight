import {
  cashFlowForecast,
  healthFactors,
  insights,
  overview,
  recommendations,
  spendingBreakdown,
  subscriptions,
  transactions,
} from "./mock-data";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

export type DashboardOverview = {
  currentBalance: number;
  availableBalance?: number;
  monthlySpending: number;
  monthlyIncome: number;
  savingsRate: number;
  savingsRateLabel?: string;
  savingsRateIsExtreme?: boolean;
  healthScore?: number;
  safeToSpend: number;
  riskProbability?: number;
  spendingBreakdown: Array<{ category: string; amount: number; fill: string }>;
  forecast: Array<{ label?: string; day?: string; balance: number }>;
  insightHighlights: Array<{ title: string; summary: string; severity: string }>;
  metricCopy?: {
    currentBalance: string;
    monthlySpending: string;
    monthlyIncome: string;
    savingsRate: string;
  };
};

async function getJson<T>(path: string, fallback: T, token?: string | null): Promise<T> {
  if (!apiBaseUrl) {
    return fallback;
  }

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : undefined,
      next: { revalidate: 30 },
    });

    if (!response.ok) {
      return fallback;
    }

    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

export async function getDashboardOverview(token?: string | null) {
  return getJson<DashboardOverview>("/api/dashboard/overview", {
    ...overview,
    spendingBreakdown,
    forecast: cashFlowForecast,
    insightHighlights: insights,
  }, token);
}

export async function getTransactions(token?: string | null) {
  return getJson("/api/transactions", {
    data: transactions,
  }, token);
}

export async function getSubscriptions(token?: string | null) {
  return getJson("/api/subscriptions", {
    data: subscriptions,
  }, token);
}

export async function getFinancialHealth(token?: string | null) {
  return getJson("/api/financial-health", {
    score: overview.healthScore,
    savingsRate: overview.savingsRate,
    spendingConsistency: healthFactors[1].value,
    emergencyFundDays: 42,
    subscriptionBurden: 3.4,
    factors: healthFactors,
    recommendations,
  }, token);
}

export { cashFlowForecast, healthFactors, insights, overview, recommendations, spendingBreakdown, subscriptions };
