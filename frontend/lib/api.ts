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

export type TransactionCategoryOption = {
  raw: string;
  label: string;
};

export type TransactionRow = {
  id: string;
  merchant?: string;
  merchantName?: string | null;
  description: string;
  amount: number;
  category?: string;
  categoryPrimary?: string;
  categoryRaw?: string;
  direction?: "inflow" | "outflow";
  status?: string;
  date?: string;
  occurredAt?: string;
};

export type TransactionsResponse = {
  data: TransactionRow[];
  categories?: TransactionCategoryOption[];
  summary?: {
    count: number;
    income: number;
    spending: number;
    net: number;
  };
};

export type SubscriptionsResponse = {
  data: Array<{
    id?: string;
    name?: string;
    merchantName?: string;
    monthlyCost: number;
    yearlyCost: number;
    opportunity: string;
    note?: string;
    chargeCount?: number;
    cadence?: string;
    confidence?: number;
    lastChargedAt?: string;
    category?: string;
  }>;
  summary?: {
    count: number;
    totalMonthly: number;
    totalYearly: number;
    reviewMonthly: number;
    reviewYearly: number;
  };
};

export type FinancialHealthResponse = {
  score: number;
  savingsRate: number;
  savingsRateLabel?: string;
  displaySavingsRate?: number;
  savingsRateIsExtreme?: boolean;
  spendingConsistency: number;
  emergencyFundDays: number;
  subscriptionBurden: number;
  summary?: string;
  factors: Array<{ label: string; value: number }>;
  recommendations: string[];
};

export type WeeklyReportResponse = {
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
      // Authenticated responses are per-user. The Next data cache is keyed on
      // URL (not the Authorization header), so caching would risk serving one
      // user's financial data to another. Never cache when a token is present.
      ...(token ? { cache: "no-store" as const } : { next: { revalidate: 30 } }),
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
  return getJson<TransactionsResponse>("/api/transactions", {
    data: transactions,
  }, token);
}

export async function getSubscriptions(token?: string | null) {
  return getJson<SubscriptionsResponse>("/api/subscriptions", {
    data: subscriptions,
  }, token);
}

export async function getFinancialHealth(token?: string | null) {
  return getJson<FinancialHealthResponse>("/api/financial-health", {
    score: overview.healthScore,
    savingsRate: overview.savingsRate,
    spendingConsistency: healthFactors[1].value,
    emergencyFundDays: 42,
    subscriptionBurden: 3.4,
    factors: healthFactors,
    recommendations,
  }, token);
}

export async function getWeeklyReport(token?: string | null) {
  return getJson<WeeklyReportResponse>("/api/reports/weekly", {
    periodLabel: "Demo week",
    cards: [
      { label: "This week spending", value: "$1,248", detail: "Demo report until Plaid data is synced." },
      { label: "Change vs last week", value: "+12.4%", detail: "$138 higher than last week." },
      { label: "Top category", value: "Food And Drink", detail: "$420" },
      { label: "Largest transaction", value: "$184", detail: "Whole Foods" },
    ],
    insights,
    weeklySpend: [
      { label: "Mon", amount: 120 },
      { label: "Tue", amount: 80 },
      { label: "Wed", amount: 260 },
      { label: "Thu", amount: 140 },
      { label: "Fri", amount: 310 },
      { label: "Sat", amount: 220 },
      { label: "Sun", amount: 118 },
    ],
    llmSummary:
      "Spending rose this week in the demo data, led by food and everyday purchases. Your forecast remains stable, but recurring increases are worth watching before they compound.",
    forecast: {
      projectedBalance: overview.currentBalance,
      safeToSpend: overview.safeToSpend,
      riskProbability: 0.18,
    },
    source: "mock-fallback",
  }, token);
}

export { cashFlowForecast, healthFactors, insights, overview, recommendations, spendingBreakdown, subscriptions };
