import { describe, expect, it } from "vitest";

import {
  buildForecastCreateData,
  buildInsightRows,
  buildScoreCreateData,
  buildSubscriptionUpsert,
  mapInsightSeverity,
  mapInsightType,
} from "../src/lib/analytics-persistence.js";

describe("mapInsightSeverity", () => {
  it("passes through valid severities", () => {
    expect(mapInsightSeverity("high")).toBe("high");
    expect(mapInsightSeverity("medium")).toBe("medium");
    expect(mapInsightSeverity("low")).toBe("low");
  });
  it("defaults unknown severities to low", () => {
    expect(mapInsightSeverity("urgent")).toBe("low");
    expect(mapInsightSeverity(undefined)).toBe("low");
  });
});

describe("mapInsightType", () => {
  it("maps known insight ids to enum types", () => {
    expect(mapInsightType("forecast-risk")).toBe("forecast");
    expect(mapInsightType("category-spend")).toBe("spending");
    expect(mapInsightType("savings-rate")).toBe("score");
  });
  it("defaults unknown ids to spending", () => {
    expect(mapInsightType("something-else")).toBe("spending");
  });
});

describe("buildScoreCreateData", () => {
  it("maps health-score fields to FinancialScore columns", () => {
    const data = buildScoreCreateData({
      score: 72,
      savingsRate: 18.5,
      spendingConsistency: 64,
      subscriptionBurden: 3.2,
      emergencyFundDays: 48,
      summary: "Looks fine",
    });
    expect(data).toEqual({
      score: 72,
      savingsRate: 18.5,
      spendingVolatility: 64,
      subscriptionBurden: 3.2,
      emergencyFundDays: 48,
      explanation: "Looks fine",
    });
  });
});

describe("buildForecastCreateData", () => {
  it("derives projected/lowest/risk from the forecast series", () => {
    const data = buildForecastCreateData({
      forecast: [
        { label: "Today", balance: 1000 },
        { label: "Day 7", balance: 800 },
        { label: "Day 30", balance: 400 },
        { label: "Day 90", balance: 200 },
      ],
      riskProbability: 0.71,
    });
    expect(data.horizonDays).toBe(90);
    expect(data.projectedBalance).toBe(200);
    expect(data.lowestProjectedBalance).toBe(200);
    expect(data.lowBalanceRisk).toBe(true);
    expect(data.riskProbability).toBe(0.71);
    expect(data.data).toEqual([
      { label: "Today", balance: 1000 },
      { label: "Day 7", balance: 800 },
      { label: "Day 30", balance: 400 },
      { label: "Day 90", balance: 200 },
    ]);
  });
  it("flags no risk when the series stays above the floor", () => {
    const data = buildForecastCreateData({
      forecast: [
        { label: "Today", balance: 5000 },
        { label: "Day 90", balance: 6000 },
      ],
      riskProbability: 0.22,
    });
    expect(data.lowBalanceRisk).toBe(false);
    expect(data.lowestProjectedBalance).toBe(5000);
  });
});

describe("buildInsightRows", () => {
  it("maps highlights to insight rows", () => {
    const rows = buildInsightRows([
      { id: "forecast-risk", title: "Risk", summary: "s1", severity: "high" },
      { id: "category-spend", title: "Cat", summary: "s2", severity: "medium" },
    ]);
    expect(rows).toEqual([
      { type: "forecast", title: "Risk", summary: "s1", severity: "high", payload: {} },
      { type: "spending", title: "Cat", summary: "s2", severity: "medium", payload: {} },
    ]);
  });
});

describe("buildSubscriptionUpsert", () => {
  const sub = {
    merchantName: "Netflix",
    category: "Entertainment",
    monthlyCost: 15.99,
    yearlyCost: 191.88,
    confidence: 0.86,
    lastChargedAt: new Date("2026-05-01T00:00:00Z"),
  };

  it("sets status active only on create, never on update", () => {
    const result = buildSubscriptionUpsert("user-1", sub);
    expect(result.where).toEqual({
      userId_merchantName: { userId: "user-1", merchantName: "Netflix" },
    });
    expect(result.create.status).toBe("active");
    expect(result.create.userId).toBe("user-1");
    expect(result.create.monthlyCost).toBe(15.99);
    expect("status" in result.update).toBe(false);
    expect(result.update.monthlyCost).toBe(15.99);
    expect(result.update.confidence).toBe(0.86);
  });
});
