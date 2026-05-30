import type { Account, Transaction } from "@prisma/client";

const chartColors = ["#8ef0d1", "#58b8ff", "#ffb65e", "#ff7b72", "#d0a2ff", "#f7d154"];
const internalTransferCategories = new Set(["TRANSFER_OUT", "TRANSFER_IN", "LOAN_PAYMENTS"]);

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    return value.toNumber();
  }

  return Number(value ?? 0);
}

function currency(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function toDisplayCategory(category: string) {
  return category
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isInternalTransfer(transaction: Transaction) {
  return internalTransferCategories.has(transaction.categoryPrimary ?? "");
}

function formatPercent(value: number) {
  if (value <= -100) {
    return "-100%+";
  }

  if (value >= 100) {
    return "100%+";
  }

  return `${currency(value)}%`;
}

function getAnalysisWindow(transactions: Transaction[]) {
  const dates = transactions.map((transaction) => transaction.occurredAt.getTime());
  const latest = dates.length ? new Date(Math.max(...dates)) : new Date();
  const start = new Date(latest);
  start.setDate(start.getDate() - 30);

  return { start, latest };
}

export function summarizeDashboard(accounts: Account[], transactions: Transaction[]) {
  const currentBalance = currency(accounts.reduce((total, account) => total + toNumber(account.currentBalance), 0));
  const { start } = getAnalysisWindow(transactions);
  const recentTransactions = transactions.filter((transaction) => transaction.occurredAt >= start);
  const outflows = recentTransactions.filter((transaction) => transaction.direction === "outflow");
  const inflows = recentTransactions.filter((transaction) => transaction.direction === "inflow");
  const monthlySpending = currency(outflows.reduce((total, transaction) => total + toNumber(transaction.amount), 0));
  const monthlyIncome = currency(inflows.reduce((total, transaction) => total + toNumber(transaction.amount), 0));
  const savingsRate = monthlyIncome > 0 ? currency(((monthlyIncome - monthlySpending) / monthlyIncome) * 100) : 0;
  const displaySavingsRate = clamp(savingsRate, -100, 100);
  const flexibleOutflows = outflows.filter((transaction) => !isInternalTransfer(transaction));
  const transferOutflows = outflows.filter((transaction) => isInternalTransfer(transaction));
  const internalTransferTotal = currency(transferOutflows.reduce((total, transaction) => total + toNumber(transaction.amount), 0));

  const byCategory = new Map<string, number>();
  for (const transaction of flexibleOutflows.length ? flexibleOutflows : outflows) {
    const category = toDisplayCategory(transaction.categoryPrimary ?? "Uncategorized");
    byCategory.set(category, (byCategory.get(category) ?? 0) + toNumber(transaction.amount));
  }

  const spendingBreakdown = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([category, amount], index) => ({
      category,
      amount: currency(amount),
      fill: chartColors[index % chartColors.length],
    }));

  const dailyNet = (monthlyIncome - monthlySpending) / 30;
  const forecast = [
    { label: "Today", balance: currentBalance },
    { label: "Day 7", balance: currency(currentBalance + dailyNet * 7) },
    { label: "Day 30", balance: currency(currentBalance + dailyNet * 30) },
    { label: "Day 90", balance: currency(currentBalance + dailyNet * 90) },
  ];
  const lowestForecastBalance = Math.min(...forecast.map((point) => point.balance));
  const safeToSpend = currency(Math.max(currentBalance - Math.max(monthlySpending * 0.5, 500), 0));
  const healthScore = calculateHealthScore({
    savingsRate,
    monthlyIncome,
    monthlySpending,
    currentBalance,
    subscriptionBurden: 0,
  }).score;

  const topCategory = spendingBreakdown[0];
  const isOutflowHeavy = monthlyIncome > 0 && monthlySpending > monthlyIncome * 3;
  const insightHighlights = [
    {
      id: "forecast-risk",
      title: lowestForecastBalance < 500 ? "Low-balance risk detected" : "Cash flow runway is stable",
      summary:
        lowestForecastBalance < 500
          ? `Your projected balance may fall below $500 if the current 30-day pace continues.`
          : `Your projected 30-day balance is ${formatCurrency(forecast[2].balance)} based on synced Plaid activity.`,
      severity: lowestForecastBalance < 500 ? "high" : "low",
    },
    {
      id: "category-spend",
      title: topCategory ? `${topCategory.category} is your top spend category` : "No spending categories yet",
      summary: topCategory
        ? `${topCategory.category} accounts for ${formatCurrency(topCategory.amount)} in recent outflows.`
        : "Connect and sync more transactions to generate category-level insights.",
      severity: topCategory ? "medium" : "low",
    },
    {
      id: "savings-rate",
      title: isOutflowHeavy ? "Sandbox data is outflow-heavy" : `Savings rate is ${formatPercent(savingsRate)}`,
      summary:
        isOutflowHeavy
          ? `Plaid sandbox activity includes ${formatCurrency(internalTransferTotal)} in transfers and loan-style outflows, which can distort savings rate.`
          : savingsRate >= 20
          ? "Your recent income and spending pattern is supporting a strong savings rate."
          : "Reducing flexible spending could improve your score and safe-to-spend buffer.",
      severity: savingsRate >= 20 ? "low" : "medium",
    },
  ];

  return {
    currentBalance,
    availableBalance: currency(accounts.reduce((total, account) => total + toNumber(account.availableBalance), 0)),
    monthlySpending,
    monthlyIncome,
    savingsRate,
    displaySavingsRate,
    savingsRateLabel: formatPercent(savingsRate),
    savingsRateIsExtreme: Math.abs(savingsRate) > 100,
    healthScore,
    safeToSpend,
    riskProbability: lowestForecastBalance < 500 ? 0.71 : 0.22,
    spendingBreakdown,
    forecast,
    insightHighlights,
    metricCopy: {
      currentBalance: accounts.length ? `${accounts.length} synced Plaid accounts` : "No accounts connected yet",
      monthlySpending: isOutflowHeavy ? "Sandbox outflows are unusually high" : "Based on recent synced transactions",
      monthlyIncome: monthlyIncome > 0 ? "Detected from recent inflows" : "No recent income detected",
      savingsRate: isOutflowHeavy ? "Capped for display due to sandbox data" : "Based on recent income minus spending",
    },
  };
}

export function detectSubscriptions(transactions: Transaction[]) {
  const outflows = transactions.filter((transaction) => transaction.direction === "outflow");
  const byMerchant = new Map<string, Transaction[]>();

  for (const transaction of outflows) {
    const merchant = transaction.merchantName ?? transaction.description;
    byMerchant.set(merchant, [...(byMerchant.get(merchant) ?? []), transaction]);
  }

  return [...byMerchant.entries()]
    .map(([merchantName, merchantTransactions]) => {
      const sortedTransactions = [...merchantTransactions].sort(
        (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime(),
      );
      const amounts = merchantTransactions.map((transaction) => toNumber(transaction.amount));
      const average = amounts.reduce((total, amount) => total + amount, 0) / amounts.length;
      const consistentAmount =
        amounts.length >= 2 && amounts.every((amount) => Math.abs(amount - average) <= Math.max(average * 0.2, 5));

      if (!consistentAmount) {
        return null;
      }

      return {
        id: merchantName,
        name: merchantName,
        merchantName,
        monthlyCost: currency(average),
        yearlyCost: currency(average * 12),
        chargeCount: merchantTransactions.length,
        cadence: merchantTransactions.length >= 3 ? "Recurring" : "Likely recurring",
        confidence: merchantTransactions.length >= 3 ? 0.86 : 0.68,
        lastChargedAt: sortedTransactions[0]?.occurredAt,
        category: toDisplayCategory(sortedTransactions[0]?.categoryPrimary ?? "Uncategorized"),
        opportunity: average > 25 ? "Review" : "Keep",
        note:
          average > 25
            ? "Recurring charge detected with meaningful annual cost."
            : "Recurring charge detected from transaction cadence.",
      };
    })
    .filter((subscription): subscription is NonNullable<typeof subscription> => Boolean(subscription))
    .sort((a, b) => (b?.monthlyCost ?? 0) - (a?.monthlyCost ?? 0))
    .slice(0, 9);
}

export function calculateHealthScore({
  savingsRate,
  monthlyIncome,
  monthlySpending,
  currentBalance,
  subscriptionBurden,
}: {
  savingsRate: number;
  monthlyIncome: number;
  monthlySpending: number;
  currentBalance: number;
  subscriptionBurden: number;
}) {
  const savingsComponent = Math.min(Math.max(savingsRate, 0), 30) / 30;
  const spendingConsistency = monthlyIncome > 0 ? Math.max(1 - monthlySpending / Math.max(monthlyIncome, 1), 0) : 0.45;
  const emergencyFundDays = monthlySpending > 0 ? Math.round((currentBalance / monthlySpending) * 30) : 90;
  const runwayComponent = Math.min(emergencyFundDays / 90, 1);
  const subscriptionComponent = Math.max(1 - subscriptionBurden / 10, 0);
  const savingsRateIsExtreme = Math.abs(savingsRate) > 100;
  const score = Math.round(
    savingsComponent * 35 + spendingConsistency * 25 + runwayComponent * 25 + subscriptionComponent * 15,
  );

  return {
    score: Math.max(0, Math.min(score, 100)),
    savingsRate: currency(savingsRate),
    savingsRateLabel: formatPercent(savingsRate),
    displaySavingsRate: clamp(savingsRate, -100, 100),
    savingsRateIsExtreme,
    spendingConsistency: Math.round(spendingConsistency * 100),
    emergencyFundDays,
    subscriptionBurden: currency(subscriptionBurden),
    summary: savingsRateIsExtreme
      ? "Plaid sandbox data can contain large transfers and loan-style outflows, so FinSight caps the displayed savings rate while keeping the score grounded in the synced transactions."
      : "FinSight scores your recent savings momentum, spending consistency, subscription burden, and cash runway from synced account activity.",
    factors: [
      { label: "Savings rate", value: Math.round(savingsComponent * 100) },
      { label: "Spending consistency", value: Math.round(spendingConsistency * 100) },
      { label: "Emergency runway", value: Math.round(runwayComponent * 100) },
      { label: "Subscription burden", value: Math.round(subscriptionComponent * 100) },
    ],
    recommendations: [
      savingsRate < 20
        ? "Aim for a 20% savings rate by reducing flexible outflows or setting an automatic transfer."
        : "Your savings rate is healthy. Keep protecting that monthly margin.",
      emergencyFundDays < 60
        ? "Build cash reserves until your emergency runway reaches at least 60 days."
        : "Your emergency runway is in a strong range for short-term shocks.",
      subscriptionBurden > 5
        ? "Review subscriptions because they are taking a noticeable share of income."
        : "Subscription burden looks controlled based on recent income.",
    ],
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
