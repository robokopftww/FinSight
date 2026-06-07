import type { PrismaClient } from "@prisma/client";

type InsightSeverity = "low" | "medium" | "high";
type InsightType = "spending" | "forecast" | "subscription" | "score";

export type ScoreInput = {
  score: number;
  savingsRate: number;
  spendingConsistency: number;
  subscriptionBurden: number;
  emergencyFundDays: number;
  summary?: string;
};

export type ForecastPoint = { label?: string; balance: number };

export type ForecastInput = {
  forecast: ForecastPoint[];
  riskProbability: number;
};

export type InsightHighlight = {
  id?: string;
  title: string;
  summary: string;
  severity?: string;
};

export type DetectedSubscription = {
  merchantName: string;
  category?: string | null;
  monthlyCost: number;
  yearlyCost: number;
  confidence: number;
  lastChargedAt?: Date | null;
};

const LOW_BALANCE_FLOOR = 500;
const FORECAST_HORIZON_DAYS = 90;

export function mapInsightSeverity(severity?: string): InsightSeverity {
  return severity === "high" || severity === "medium" || severity === "low" ? severity : "low";
}

export function mapInsightType(id?: string): InsightType {
  switch (id) {
    case "forecast-risk":
      return "forecast";
    case "savings-rate":
      return "score";
    case "category-spend":
      return "spending";
    default:
      return "spending";
  }
}

export function buildScoreCreateData(input: ScoreInput) {
  return {
    score: input.score,
    savingsRate: input.savingsRate,
    spendingVolatility: input.spendingConsistency,
    subscriptionBurden: input.subscriptionBurden,
    emergencyFundDays: input.emergencyFundDays,
    explanation: input.summary ?? null,
  };
}

export function buildForecastCreateData(input: ForecastInput) {
  const balances = input.forecast.map((point) => point.balance);
  const lowest = balances.length ? Math.min(...balances) : 0;
  const projected = balances.length ? balances[balances.length - 1] : 0;

  return {
    horizonDays: FORECAST_HORIZON_DAYS,
    projectedBalance: projected,
    lowestProjectedBalance: lowest,
    lowBalanceRisk: lowest < LOW_BALANCE_FLOOR,
    riskProbability: input.riskProbability,
    data: input.forecast,
  };
}

export function buildInsightRows(highlights: InsightHighlight[]) {
  return highlights.map((highlight) => ({
    type: mapInsightType(highlight.id),
    title: highlight.title,
    summary: highlight.summary,
    severity: mapInsightSeverity(highlight.severity),
    payload: {},
  }));
}

export function buildSubscriptionUpsert(userId: string, sub: DetectedSubscription) {
  const shared = {
    category: sub.category ?? null,
    monthlyCost: sub.monthlyCost,
    yearlyCost: sub.yearlyCost,
    confidence: sub.confidence,
    lastChargedAt: sub.lastChargedAt ?? null,
  };

  return {
    where: { userId_merchantName: { userId, merchantName: sub.merchantName } },
    create: { userId, merchantName: sub.merchantName, status: "active" as const, ...shared },
    update: { ...shared },
  };
}

export async function persistAnalyticsSnapshot(
  prisma: PrismaClient,
  userId: string,
  snapshot: {
    score: ScoreInput;
    forecast: ForecastInput;
    insights: InsightHighlight[];
    subscriptions: DetectedSubscription[];
  },
) {
  await prisma.financialScore.create({
    data: { userId, ...buildScoreCreateData(snapshot.score) },
  });

  await prisma.forecast.create({
    data: { userId, ...buildForecastCreateData(snapshot.forecast) },
  });

  await prisma.insight.deleteMany({ where: { userId } });
  const insightRows = buildInsightRows(snapshot.insights);
  if (insightRows.length) {
    await prisma.insight.createMany({
      data: insightRows.map((row) => ({ userId, ...row })),
    });
  }

  for (const sub of snapshot.subscriptions) {
    await prisma.subscription.upsert(buildSubscriptionUpsert(userId, sub));
  }
}
