# Persist Analytics & Subscriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist financial score, forecast, insights, and subscriptions to the existing (currently unused) Prisma models on Plaid sync, add a subscription-status editing feature, and serve stored snapshots with a live fallback.

**Architecture:** A Plaid sync writes one analytics snapshot (TS-computed, deterministic, no external dependency) plus upserted subscriptions. Read endpoints for financial-health, forecast, and subscriptions prefer the latest stored rows and fall back to live computation when none exist. A new PATCH endpoint lets users change subscription status; subscription upserts preserve user-set status across re-syncs.

**Tech Stack:** Fastify + Prisma (Postgres) backend, Next.js (App Router) frontend, vitest for backend unit tests.

---

## File Structure

- `backend/prisma/schema.prisma` — add `@@unique([userId, merchantName])` to `Subscription`.
- `backend/src/lib/analytics-persistence.ts` — **new.** Pure mapping helpers (score/forecast/insight/subscription → Prisma data) + `persistAnalyticsSnapshot(...)` writer. Pure helpers are unit-tested; the writer is thin.
- `backend/src/modules/plaid/routes.ts` — call `persistAnalyticsSnapshot` after a sync (best-effort).
- `backend/src/routes/index.ts` — subscriptions read from DB + derive display fields; financial-health and forecast read stored-first; add `PATCH /api/subscriptions/:id`.
- `backend/tests/analytics-persistence.test.ts` — **new.** Tests for pure helpers.
- `backend/tests/subscription-status.test.ts` — **new.** Tests for status validation.
- `frontend/lib/api.ts` — add `status` to `SubscriptionsResponse`.
- `frontend/components/subscription-actions.tsx` — **new.** Client component: status buttons → PATCH.
- `frontend/app/subscriptions/page.tsx` — render `<SubscriptionActions>` per row, show status.

---

## Task 1: Schema unique constraint + migration

**Files:**
- Modify: `backend/prisma/schema.prisma` (the `Subscription` model)

- [ ] **Step 1: Add the unique constraint**

In `backend/prisma/schema.prisma`, inside `model Subscription { ... }`, add the
constraint as the last line before the closing brace:

```prisma
model Subscription {
  id             String             @id @default(cuid())
  userId         String
  merchantName   String
  category       String?
  monthlyCost    Decimal            @db.Decimal(12, 2)
  yearlyCost     Decimal            @db.Decimal(12, 2)
  lastChargedAt  DateTime?
  nextExpectedAt DateTime?
  confidence     Float
  status         SubscriptionStatus @default(active)
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt
  user           User               @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, merchantName])
}
```

- [ ] **Step 2: Create and apply the migration**

Ensure Postgres is running (`docker compose up -d` from repo root if needed), then:

Run: `cd backend && npx prisma migrate dev --name subscription_user_merchant_unique`
Expected: migration created under `backend/prisma/migrations/`, applied, and
"Your database is now in sync with your schema." Prisma Client regenerates.

- [ ] **Step 3: Verify the client typechecks**

Run: `cd backend && npm run typecheck`
Expected: PASS (no output errors).

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(db): add unique (userId, merchantName) for subscription upsert"
```

---

## Task 2: Pure persistence mapping helpers

**Files:**
- Create: `backend/src/lib/analytics-persistence.ts`
- Test: `backend/tests/analytics-persistence.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/analytics-persistence.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx vitest run analytics-persistence`
Expected: FAIL — cannot find module `../src/lib/analytics-persistence.js`.

- [ ] **Step 3: Implement the helpers**

Create `backend/src/lib/analytics-persistence.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run analytics-persistence`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Typecheck**

Run: `cd backend && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/lib/analytics-persistence.ts backend/tests/analytics-persistence.test.ts
git commit -m "feat(backend): add analytics persistence mapping helpers"
```

---

## Task 3: Write the snapshot on Plaid sync

**Files:**
- Modify: `backend/src/modules/plaid/routes.ts` (the `/api/plaid/sync` handler, end of the route before `return reply.send(...)`)

- [ ] **Step 1: Import the dependencies**

At the top of `backend/src/modules/plaid/routes.ts`, add to the existing imports:

```typescript
import {
  calculateHealthScore,
  detectSubscriptions,
  summarizeDashboard,
} from "../../lib/financial-analytics.js";
import { persistAnalyticsSnapshot } from "../../lib/analytics-persistence.js";
```

- [ ] **Step 2: Persist after the sync loop**

In the `/api/plaid/sync` handler, find the final `return reply.send({ addedCount, modifiedCount, removedCount });`. Immediately **before** it, insert:

```typescript
    try {
      const [accountsForSnapshot, transactionsForSnapshot] = await Promise.all([
        prisma.account.findMany({ where: { userId: user.id } }),
        prisma.transaction.findMany({
          where: { userId: user.id },
          orderBy: { occurredAt: "desc" },
        }),
      ]);

      const dashboard = summarizeDashboard(accountsForSnapshot, transactionsForSnapshot);
      const detected = detectSubscriptions(transactionsForSnapshot);
      const monthlySubscriptionCost = detected.reduce((total, sub) => total + sub.monthlyCost, 0);
      const subscriptionBurden =
        dashboard.monthlyIncome > 0 ? (monthlySubscriptionCost / dashboard.monthlyIncome) * 100 : 0;
      const score = calculateHealthScore({
        savingsRate: dashboard.savingsRate,
        monthlyIncome: dashboard.monthlyIncome,
        monthlySpending: dashboard.monthlySpending,
        currentBalance: dashboard.currentBalance,
        subscriptionBurden,
      });

      await persistAnalyticsSnapshot(prisma, user.id, {
        score: {
          score: score.score,
          savingsRate: score.savingsRate,
          spendingConsistency: score.spendingConsistency,
          subscriptionBurden: score.subscriptionBurden,
          emergencyFundDays: score.emergencyFundDays,
          summary: score.summary,
        },
        forecast: {
          forecast: dashboard.forecast,
          riskProbability: dashboard.riskProbability,
        },
        insights: dashboard.insightHighlights,
        subscriptions: detected.map((sub) => ({
          merchantName: sub.merchantName,
          category: sub.category,
          monthlyCost: sub.monthlyCost,
          yearlyCost: sub.yearlyCost,
          confidence: sub.confidence,
          lastChargedAt: sub.lastChargedAt ?? null,
        })),
      });
    } catch (error) {
      request.log.error({ error }, "Failed to persist analytics snapshot after sync");
    }

```

(The snapshot is best-effort: a failure logs but does not fail the sync response.)

- [ ] **Step 3: Typecheck**

Run: `cd backend && npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Manual smoke (optional, needs Plaid sandbox + DB)**

Run the backend (`npm run dev:backend`), connect a Plaid sandbox item, hit
"Sync". Then in `npx prisma studio` confirm `FinancialScore`, `Forecast`,
`Insight`, and `Subscription` have rows for the user.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/plaid/routes.ts
git commit -m "feat(backend): persist analytics snapshot on plaid sync"
```

---

## Task 4: Subscriptions endpoint reads from DB (with live fallback)

**Files:**
- Modify: `backend/src/routes/index.ts` (the `GET /api/subscriptions` handler)

- [ ] **Step 1: Replace the handler body**

Find `app.get("/api/subscriptions", ...)` in `backend/src/routes/index.ts` and
replace the whole handler with:

```typescript
  app.get("/api/subscriptions", async (request, reply) => {
    const user = await requireAppUser(request, reply);

    if (!user) {
      return reply;
    }

    const stored = await prisma.subscription.findMany({
      where: { userId: user.id },
      orderBy: { monthlyCost: "desc" },
    });

    if (stored.length) {
      const data = stored.map((sub) => {
        const monthlyCost = Number(sub.monthlyCost);
        const yearlyCost = Number(sub.yearlyCost);
        return {
          id: sub.id,
          name: sub.merchantName,
          merchantName: sub.merchantName,
          monthlyCost: currency(monthlyCost),
          yearlyCost: currency(yearlyCost),
          opportunity: monthlyCost > 25 ? "Review" : "Keep",
          note:
            monthlyCost > 25
              ? "Recurring charge detected with meaningful annual cost."
              : "Recurring charge detected from transaction cadence.",
          confidence: sub.confidence,
          lastChargedAt: sub.lastChargedAt ?? undefined,
          category: sub.category ?? undefined,
          status: sub.status,
        };
      });
      const reviewMonthly = data
        .filter((sub) => sub.opportunity === "Review" && sub.status !== "cancelled")
        .reduce((total, sub) => total + sub.monthlyCost, 0);
      const activeData = data.filter((sub) => sub.status !== "cancelled");

      return reply.send({
        data,
        summary: {
          count: data.length,
          totalMonthly: currency(activeData.reduce((total, sub) => total + sub.monthlyCost, 0)),
          totalYearly: currency(activeData.reduce((total, sub) => total + sub.yearlyCost, 0)),
          reviewMonthly: currency(reviewMonthly),
          reviewYearly: currency(reviewMonthly * 12),
        },
      });
    }

    const transactions = await prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { occurredAt: "desc" },
    });
    const subscriptions = detectSubscriptions(transactions);
    const reviewMonthly = subscriptions
      .filter((subscription) => subscription.opportunity === "Review")
      .reduce((total, subscription) => total + subscription.monthlyCost, 0);

    return reply.send({
      data: subscriptions,
      summary: {
        count: subscriptions.length,
        totalMonthly: currency(subscriptions.reduce((total, subscription) => total + subscription.monthlyCost, 0)),
        totalYearly: currency(subscriptions.reduce((total, subscription) => total + subscription.yearlyCost, 0)),
        reviewMonthly: currency(reviewMonthly),
        reviewYearly: currency(reviewMonthly * 12),
      },
    });
  });
```

- [ ] **Step 2: Typecheck**

Run: `cd backend && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/index.ts
git commit -m "feat(backend): serve subscriptions from DB with live fallback"
```

---

## Task 5: PATCH subscription status endpoint

**Files:**
- Modify: `backend/src/routes/index.ts` (add route + a pure validator helper)
- Test: `backend/tests/subscription-status.test.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/subscription-status.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { parseSubscriptionStatus } from "../src/routes/index.js";

describe("parseSubscriptionStatus", () => {
  it("accepts valid statuses", () => {
    expect(parseSubscriptionStatus("active")).toBe("active");
    expect(parseSubscriptionStatus("paused")).toBe("paused");
    expect(parseSubscriptionStatus("cancelled")).toBe("cancelled");
  });
  it("rejects anything else", () => {
    expect(parseSubscriptionStatus("deleted")).toBeNull();
    expect(parseSubscriptionStatus(undefined)).toBeNull();
    expect(parseSubscriptionStatus(42)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run subscription-status`
Expected: FAIL — `parseSubscriptionStatus` is not exported.

- [ ] **Step 3: Add the validator helper**

In `backend/src/routes/index.ts`, add this exported helper near the other
top-level helper functions (e.g. just after `function currency(...)`):

```typescript
export function parseSubscriptionStatus(value: unknown): "active" | "paused" | "cancelled" | null {
  return value === "active" || value === "paused" || value === "cancelled" ? value : null;
}
```

- [ ] **Step 4: Add the PATCH route**

In `backend/src/routes/index.ts`, inside `registerRoutes`, add this route next to
the other subscription/transaction routes (e.g. after the `PATCH
/api/transactions/:id/category` route):

```typescript
  app.patch("/api/subscriptions/:id", async (request, reply) => {
    const user = await requireAppUser(request, reply);

    if (!user) {
      return reply;
    }

    const { id } = request.params as { id: string };
    const body = request.body as { status?: unknown };
    const status = parseSubscriptionStatus(body.status);

    if (!status) {
      return reply.code(400).send({ error: "status must be one of active, paused, cancelled" });
    }

    const result = await prisma.subscription.updateMany({
      where: { id, userId: user.id },
      data: { status },
    });

    if (result.count === 0) {
      return reply.code(404).send({ error: "Subscription not found" });
    }

    return reply.send({ id, status });
  });
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && npx vitest run subscription-status`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `cd backend && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/index.ts backend/tests/subscription-status.test.ts
git commit -m "feat(backend): add PATCH subscription status endpoint"
```

---

## Task 6: forecast reads stored-first

**Files:**
- Modify: `backend/src/routes/index.ts` (the `GET /api/forecast` handler)

> **Note:** `GET /api/financial-health` is intentionally left on its live path.
> The `FinancialScore` table has no columns for `factors`/`recommendations`, so
> serving the page from a snapshot would blank out those sections. The row is
> still persisted on sync (honest schema); we just keep the read live so the
> health page stays rich. Only forecast and subscriptions switch to stored-first.

- [ ] **Step 1: forecast — prefer the latest stored forecast**

In the `GET /api/forecast` handler, right after the `if (!user) { return reply; }`
guard, insert:

```typescript
    const latestForecast = await prisma.forecast.findFirst({
      where: { userId: user.id },
      orderBy: { generatedAt: "desc" },
    });

    if (latestForecast) {
      return reply.send({
        data: latestForecast.data,
        source: "persisted-snapshot",
      });
    }
```

(The existing AI/live path below remains as the fallback.)

- [ ] **Step 3: Typecheck**

Run: `cd backend && npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Run all backend tests**

Run: `cd backend && npm run test`
Expected: PASS (all suites).

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/index.ts
git commit -m "feat(backend): serve financial-health and forecast from snapshot"
```

---

## Task 7: Frontend — subscription status type + actions UI

**Files:**
- Modify: `frontend/lib/api.ts` (add `status` to `SubscriptionsResponse`)
- Create: `frontend/components/subscription-actions.tsx`
- Modify: `frontend/app/subscriptions/page.tsx`

- [ ] **Step 1: Add `status` to the response type**

In `frontend/lib/api.ts`, in the `SubscriptionsResponse` `data` array item type,
add the optional field (after `category?: string;`):

```typescript
    category?: string;
    status?: "active" | "paused" | "cancelled";
```

- [ ] **Step 2: Create the client actions component**

Create `frontend/components/subscription-actions.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

type Status = "active" | "paused" | "cancelled";

export function SubscriptionActions({ id, status }: { id?: string; status?: Status }) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  if (!id) {
    return null;
  }

  const current: Status = status ?? "active";

  async function update(next: Status) {
    if (!apiBaseUrl) {
      return;
    }
    setPending(true);
    try {
      const token = await getToken();
      await fetch(`${apiBaseUrl}/api/subscriptions/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: next }),
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
        {current}
      </span>
      {current !== "cancelled" ? (
        <Button variant="ghost" disabled={pending} onClick={() => update("cancelled")}>
          Cancel
        </Button>
      ) : null}
      {current === "active" ? (
        <Button variant="ghost" disabled={pending} onClick={() => update("paused")}>
          Pause
        </Button>
      ) : null}
      {current !== "active" ? (
        <Button variant="ghost" disabled={pending} onClick={() => update("active")}>
          Reactivate
        </Button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Render the actions in the subscriptions page**

In `frontend/app/subscriptions/page.tsx`, add the import at the top:

```tsx
import { SubscriptionActions } from "@/components/subscription-actions";
```

Then, inside the subscription card, replace the closing of the card (the note
paragraph) so the actions render beneath it. Find:

```tsx
                <p className="mt-6 text-sm leading-7 text-slate-300">
                  {item.note ?? "Recurring charge detected from historical transaction cadence."}
                </p>
              </div>
```

Replace with:

```tsx
                <p className="mt-6 text-sm leading-7 text-slate-300">
                  {item.note ?? "Recurring charge detected from historical transaction cadence."}
                </p>
                <SubscriptionActions id={item.id} status={item.status} />
              </div>
```

- [ ] **Step 4: Typecheck the frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS (exit 0).

- [ ] **Step 5: Lint the frontend**

Run: `npm run lint:frontend`
Expected: PASS (no errors).

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/api.ts frontend/components/subscription-actions.tsx frontend/app/subscriptions/page.tsx
git commit -m "feat(frontend): add subscription status actions"
```

---

## Task 8: Full verification + PR

**Files:** none (verification only)

- [ ] **Step 1: Backend typecheck + tests + build**

Run: `cd backend && npm run typecheck && npm run test && npm run build`
Expected: all PASS.

- [ ] **Step 2: Frontend lint + build (no Clerk key, mirroring CI)**

Run: `cd frontend && NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4000 npx next build`
Expected: build succeeds; `/subscriptions` listed as a route.

- [ ] **Step 3: AI service tests (unchanged, sanity)**

Run: `cd ai-service && .venv/bin/python -m pytest -q`
Expected: PASS.

- [ ] **Step 4: Push and open PR**

```bash
git push -u origin feat/persist-analytics
gh pr create --base main --head feat/persist-analytics \
  --title "feat: persist analytics and subscriptions" \
  --body "Implements docs/superpowers/specs/2026-06-07-persist-analytics-design.md. Persists score/forecast/insights/subscriptions on Plaid sync, adds subscription status editing (PATCH + UI), and serves stored snapshots with live fallback."
```

- [ ] **Step 5: Watch CI to green**

Run: `gh pr checks <pr-number> --watch --interval 15`
Expected: Backend, Frontend, AI Service all pass.

---

## Notes / decisions baked in

- **Dashboard overview is intentionally unchanged** — it keeps its richer AI merge.
  Honest-schema and speed goals are met via sync writes + the financial-health,
  forecast, and subscriptions read paths. Revisit dashboard later if desired.
- **Snapshot is TS-computed**, not AI-computed, so sync stays fast and deterministic
  and the helpers are unit-testable without a DB or network. AI still powers the
  advisor and weekly report live paths.
- **Subscriptions absent from a later detection are left in place** (not deleted),
  so a one-off data gap does not wipe a user's history.
