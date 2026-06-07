# Dashboard Metrics + Employment Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a user-declared employment profile and richer dashboard metrics (declared-income-or-surplus, calendar spending windows, balance trend/MoM/per-account) in Layout B.

**Architecture:** Employment fields live on the `User` model. `summarizeDashboard` gains an optional profile argument and emits new fields; balance history is reconstructed from transactions (no new storage). A profile REST endpoint backs a skippable onboarding modal and a Settings section. The dashboard renders Layout B.

**Tech Stack:** Fastify + Prisma (Postgres) backend, Vitest tests; Next.js (App Router) + Tailwind frontend; Clerk auth.

---

## File Structure

**Backend**
- `backend/prisma/schema.prisma` — add employment fields to `User` (+ migration).
- `backend/src/lib/financial-analytics.ts` — pay normalization, income/surplus, spending windows, balance reconstruction, per-account breakdown.
- `backend/src/lib/profile.ts` (new) — `UserFinancialProfile` type + `normalizeMonthlyPay`, shared by analytics and routes.
- `backend/src/routes/index.ts` — pass profile into `summarizeDashboard`; add `GET/PATCH /api/profile`.
- `backend/tests/financial-analytics.test.ts` — extend.
- `backend/tests/profile.test.ts` (new) — profile helper tests.

**Frontend**
- `frontend/lib/api.ts` — extend `DashboardOverview`, add `getProfile`/`updateProfile`.
- `frontend/components/balance-card.tsx` (new) — balance with trend, MoM, accounts.
- `frontend/components/onboarding-modal.tsx` (new) — skippable employment questions.
- `frontend/components/settings-control-center.tsx` — employment edit section.
- `frontend/app/dashboard/page.tsx` — Layout B.

---

## Task 1: Employment fields on User model

**Files:**
- Modify: `backend/prisma/schema.prisma` (model `User`, lines 29-45)

- [ ] **Step 1: Add fields to the User model**

In `model User`, after `lastName String?` (line 34), add:

```prisma
  employmentStatus String   @default("unknown") // "employed" | "unemployed" | "unknown"
  jobTitle         String?
  grossPay         Decimal? @db.Decimal(12, 2)  // amount per pay period
  payFrequency     String?                       // weekly|biweekly|semimonthly|monthly|annually
  onboardedAt      DateTime?                      // null => onboarding not completed
```

- [ ] **Step 2: Create and apply the migration**

Run: `cd backend && npx prisma migrate dev --name add_employment_profile`
Expected: migration created under `backend/prisma/migrations/`, applied, `Prisma Client` regenerated.

- [ ] **Step 3: Verify client types**

Run: `cd backend && npx prisma generate && npm run typecheck`
Expected: PASS (no type errors). `User` now has `employmentStatus`, `grossPay`, etc.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat: add employment profile fields to User"
```

---

## Task 2: Pay normalization helper

**Files:**
- Create: `backend/src/lib/profile.ts`
- Test: `backend/tests/profile.test.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/profile.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { normalizeMonthlyPay } from "../src/lib/profile.js";

describe("normalizeMonthlyPay", () => {
  it("converts each pay frequency to a monthly amount", () => {
    expect(normalizeMonthlyPay(1000, "weekly")).toBeCloseTo(1000 * 52 / 12, 2);
    expect(normalizeMonthlyPay(1000, "biweekly")).toBeCloseTo(1000 * 26 / 12, 2);
    expect(normalizeMonthlyPay(1000, "semimonthly")).toBe(2000);
    expect(normalizeMonthlyPay(1000, "monthly")).toBe(1000);
    expect(normalizeMonthlyPay(12000, "annually")).toBe(1000);
  });

  it("returns 0 for missing or invalid input", () => {
    expect(normalizeMonthlyPay(null, "monthly")).toBe(0);
    expect(normalizeMonthlyPay(1000, null)).toBe(0);
    expect(normalizeMonthlyPay(1000, "fortnightly")).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/profile.test.ts`
Expected: FAIL — cannot find module `../src/lib/profile.js`.

- [ ] **Step 3: Write minimal implementation**

Create `backend/src/lib/profile.ts`:

```typescript
export type PayFrequency = "weekly" | "biweekly" | "semimonthly" | "monthly" | "annually";

export type EmploymentStatus = "employed" | "unemployed" | "unknown";

export type UserFinancialProfile = {
  employmentStatus: EmploymentStatus;
  jobTitle: string | null;
  grossPay: number | null;
  payFrequency: PayFrequency | null;
};

const MONTHLY_MULTIPLIER: Record<PayFrequency, number> = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  semimonthly: 2,
  monthly: 1,
  annually: 1 / 12,
};

export function normalizeMonthlyPay(grossPay: number | null | undefined, payFrequency: string | null | undefined): number {
  if (!grossPay || grossPay <= 0) {
    return 0;
  }

  const multiplier = MONTHLY_MULTIPLIER[(payFrequency ?? "") as PayFrequency];

  if (!multiplier) {
    return 0;
  }

  return Math.round(grossPay * multiplier * 100) / 100;
}

export function hasDeclaredIncome(profile: UserFinancialProfile | undefined): boolean {
  return Boolean(
    profile &&
      profile.employmentStatus === "employed" &&
      profile.grossPay &&
      profile.grossPay > 0 &&
      profile.payFrequency,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/profile.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/profile.ts backend/tests/profile.test.ts
git commit -m "feat: add pay-frequency normalization helper"
```

---

## Task 3: Income vs surplus in summarizeDashboard

**Files:**
- Modify: `backend/src/lib/financial-analytics.ts` (`summarizeDashboard`, ~lines 67-171)
- Test: `backend/tests/financial-analytics.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `describe("summarizeDashboard", ...)` in `backend/tests/financial-analytics.test.ts`:

```typescript
  it("uses declared salary as monthly income when employed", () => {
    const now = Date.now();
    const transactions = [
      makeTransaction({ direction: "inflow", amount: 200 as unknown as Transaction["amount"], occurredAt: new Date(now - 2 * DAY_MS) }),
      makeTransaction({ direction: "outflow", amount: 1000 as unknown as Transaction["amount"], occurredAt: new Date(now - 1 * DAY_MS) }),
    ];

    const dashboard = summarizeDashboard([makeAccount()], transactions, {
      employmentStatus: "employed",
      jobTitle: "Engineer",
      grossPay: 3000,
      payFrequency: "monthly",
    });

    expect(dashboard.incomeMode).toBe("income");
    expect(dashboard.monthlyIncome).toBe(3000);
    expect(dashboard.incomeCard.label).toBe("Monthly income");
  });

  it("falls back to surplus (net cash flow) when no job is declared", () => {
    const now = Date.now();
    const transactions = [
      makeTransaction({ direction: "inflow", amount: 200 as unknown as Transaction["amount"], occurredAt: new Date(now - 2 * DAY_MS) }),
      makeTransaction({ direction: "outflow", amount: 1000 as unknown as Transaction["amount"], occurredAt: new Date(now - 1 * DAY_MS) }),
    ];

    const dashboard = summarizeDashboard([makeAccount()], transactions, {
      employmentStatus: "unemployed",
      jobTitle: null,
      grossPay: null,
      payFrequency: null,
    });

    expect(dashboard.incomeMode).toBe("surplus");
    expect(dashboard.incomeCard.label).toBe("Monthly surplus");
    expect(dashboard.incomeCard.value).toBe(200 - 1000); // -800 net cash flow
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx vitest run tests/financial-analytics.test.ts`
Expected: FAIL — `incomeMode`/`incomeCard` undefined; `summarizeDashboard` takes 2 args.

- [ ] **Step 3: Implement income vs surplus**

In `backend/src/lib/financial-analytics.ts`, add the import at the top (after line 1):

```typescript
import { hasDeclaredIncome, normalizeMonthlyPay, type UserFinancialProfile } from "./profile.js";
```

Change the signature (line 67):

```typescript
export function summarizeDashboard(
  accounts: Account[],
  transactions: Transaction[],
  profile?: UserFinancialProfile,
) {
```

The `monthlySpending`/`monthlyIncome` lines from Task-0 (transfers already excluded via `flexibleOutflows`/`flexibleInflows`) stay. After the `savingsRate`/`displaySavingsRate` lines (~line 80), add:

```typescript
  const netCashFlow = currency(monthlyIncome - monthlySpending);
  const declaredMonthlyIncome = normalizeMonthlyPay(profile?.grossPay ?? null, profile?.payFrequency ?? null);
  const incomeMode: "income" | "surplus" = hasDeclaredIncome(profile) ? "income" : "surplus";
  const incomeCard =
    incomeMode === "income"
      ? {
          label: "Monthly income",
          value: declaredMonthlyIncome,
          subtitle: profile?.jobTitle
            ? `${profile.jobTitle} · paid ${profile?.payFrequency}`
            : `Paid ${profile?.payFrequency}`,
        }
      : {
          label: "Monthly surplus",
          value: netCashFlow,
          subtitle: "Net cash flow (income minus spending)",
        };
```

In the returned object (~line 146), add these fields alongside the existing ones:

```typescript
    incomeMode,
    incomeCard,
    netCashFlow,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run tests/financial-analytics.test.ts`
Expected: PASS (existing tests + 2 new). The `savingsRate: 75` test still passes (it passes no profile → surplus mode, but `monthlyIncome`/`savingsRate` are unchanged).

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/financial-analytics.ts backend/tests/financial-analytics.test.ts
git commit -m "feat: declared-income vs surplus on dashboard summary"
```

---

## Task 4: Calendar spending windows

**Files:**
- Modify: `backend/src/lib/financial-analytics.ts` (`summarizeDashboard`)
- Test: `backend/tests/financial-analytics.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `describe("summarizeDashboard", ...)`:

```typescript
  it("computes calendar spending windows excluding internal transfers", () => {
    const thisMonth = new Date();
    const startOfMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1, 12);
    const earlierThisYear = new Date(thisMonth.getFullYear(), 0, 15, 12);

    const transactions = [
      makeTransaction({ direction: "outflow", amount: 300 as unknown as Transaction["amount"], occurredAt: startOfMonth }),
      makeTransaction({ direction: "outflow", amount: 700 as unknown as Transaction["amount"], occurredAt: earlierThisYear }),
      // internal transfer must be excluded from every window
      makeTransaction({ direction: "outflow", amount: 5000 as unknown as Transaction["amount"], categoryPrimary: "TRANSFER_OUT", occurredAt: startOfMonth }),
    ];

    const dashboard = summarizeDashboard([makeAccount()], transactions);

    expect(dashboard.spendingThisMonth).toBe(300);
    expect(dashboard.spendingYearToDate).toBe(1000);
    expect(dashboard.spendingAvgMonthly).toBeGreaterThan(0);
    expect(dashboard.monthsOfHistory).toBeGreaterThanOrEqual(1);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/financial-analytics.test.ts`
Expected: FAIL — `spendingThisMonth` undefined.

- [ ] **Step 3: Implement spending windows**

In `summarizeDashboard`, after the `incomeCard` block, add. Note `allFlexibleOutflows` is computed over ALL transactions (not just the 30-day `recentTransactions`), so add it from the full list:

```typescript
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfThisYear = new Date(now.getFullYear(), 0, 1);

  const allOutflows = transactions.filter((transaction) => transaction.direction === "outflow");
  const allFlexibleOutflows = allOutflows.filter((transaction) => !isInternalTransfer(transaction));

  const spendingThisMonth = currency(
    allFlexibleOutflows
      .filter((transaction) => transaction.occurredAt >= startOfThisMonth)
      .reduce((total, transaction) => total + toNumber(transaction.amount), 0),
  );
  const spendingYearToDate = currency(
    allFlexibleOutflows
      .filter((transaction) => transaction.occurredAt >= startOfThisYear)
      .reduce((total, transaction) => total + toNumber(transaction.amount), 0),
  );

  const monthKeys = new Set(
    allFlexibleOutflows.map((transaction) => `${transaction.occurredAt.getFullYear()}-${transaction.occurredAt.getMonth()}`),
  );
  const monthsOfHistory = Math.max(monthKeys.size, 1);
  const totalFlexibleSpend = allFlexibleOutflows.reduce((total, transaction) => total + toNumber(transaction.amount), 0);
  const spendingAvgMonthly = currency(totalFlexibleSpend / monthsOfHistory);
```

Add to the returned object:

```typescript
    spendingThisMonth,
    spendingYearToDate,
    spendingAvgMonthly,
    monthsOfHistory,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/financial-analytics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/financial-analytics.ts backend/tests/financial-analytics.test.ts
git commit -m "feat: calendar spending windows (month/YTD/average)"
```

---

## Task 5: Balance reconstruction + MoM + per-account breakdown

**Files:**
- Modify: `backend/src/lib/financial-analytics.ts`
- Test: `backend/tests/financial-analytics.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `describe("summarizeDashboard", ...)`:

```typescript
  it("reconstructs balance history and month-over-month change", () => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15, 12);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 5, 12);

    // currentBalance 5000. One inflow of 1000 this month means last month's
    // end balance was 4000 -> MoM change +1000.
    const transactions = [
      makeTransaction({ direction: "inflow", amount: 1000 as unknown as Transaction["amount"], occurredAt: thisMonth }),
      makeTransaction({ direction: "outflow", amount: 200 as unknown as Transaction["amount"], occurredAt: lastMonth }),
    ];

    const dashboard = summarizeDashboard([makeAccount()], transactions);

    expect(dashboard.monthOverMonthChange?.amount).toBe(1000);
    expect(Array.isArray(dashboard.balanceTrend)).toBe(true);
    expect(dashboard.accountsBreakdown).toEqual([
      { name: "Checking", mask: "0000", currentBalance: 5000 },
    ]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/financial-analytics.test.ts`
Expected: FAIL — `monthOverMonthChange` undefined.

- [ ] **Step 3: Implement reconstruction helpers and fields**

Add these module-level helpers near the other helpers (after `clamp`, ~line 28):

```typescript
function signedFlow(transaction: Transaction) {
  const amount = toNumber(transaction.amount);
  return transaction.direction === "inflow" ? amount : -amount;
}

// Reconstruct the balance as of the end of `boundary` by subtracting every flow
// that occurred strictly after it from the known current balance.
function balanceAsOf(currentBalance: number, transactions: Transaction[], boundary: Date) {
  const futureFlow = transactions
    .filter((transaction) => transaction.occurredAt > boundary)
    .reduce((total, transaction) => total + signedFlow(transaction), 0);
  return currency(currentBalance - futureFlow);
}
```

In `summarizeDashboard`, after the spending-window block, add:

```typescript
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const balanceEndOfLastMonth = balanceAsOf(currentBalance, transactions, endOfLastMonth);
  const monthOverMonthChange =
    transactions.length > 0
      ? {
          amount: currency(currentBalance - balanceEndOfLastMonth),
          percent:
            balanceEndOfLastMonth !== 0
              ? currency(((currentBalance - balanceEndOfLastMonth) / Math.abs(balanceEndOfLastMonth)) * 100)
              : 0,
        }
      : null;

  const balanceTrend = [5, 4, 3, 2, 1, 0].map((monthsAgo) => {
    const boundary = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0, 23, 59, 59);
    const label = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1).toLocaleString("en-US", { month: "short" });
    return { label, balance: balanceAsOf(currentBalance, transactions, boundary) };
  });

  const accountsBreakdown = accounts.map((account) => ({
    name: account.name,
    mask: account.mask,
    currentBalance: currency(toNumber(account.currentBalance)),
  }));
```

Add to the returned object:

```typescript
    monthOverMonthChange,
    balanceTrend: transactions.length > 0 ? balanceTrend : [],
    accountsBreakdown,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/financial-analytics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/financial-analytics.ts backend/tests/financial-analytics.test.ts
git commit -m "feat: balance trend, MoM change, per-account breakdown"
```

---

## Task 6: Thread profile into the dashboard overview route

**Files:**
- Modify: `backend/src/routes/index.ts` (`/api/dashboard/overview`, ~lines 160-190)

- [ ] **Step 1: Pass the user's profile into summarizeDashboard**

In the `/api/dashboard/overview` handler, change the `summarizeDashboard` call (line ~174) to pass the profile derived from `user`:

```typescript
    const dashboard = summarizeDashboard(accounts, transactions, {
      employmentStatus: (user.employmentStatus ?? "unknown") as "employed" | "unemployed" | "unknown",
      jobTitle: user.jobTitle ?? null,
      grossPay: user.grossPay ? Number(user.grossPay) : null,
      payFrequency: (user.payFrequency ?? null) as
        | "weekly"
        | "biweekly"
        | "semimonthly"
        | "monthly"
        | "annually"
        | null,
    });
```

`mergeDashboardAnalytics` spreads `dashboard`, so the new fields reach the client automatically — no change needed there.

- [ ] **Step 2: Typecheck**

Run: `cd backend && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Run the full backend test suite**

Run: `cd backend && npm test`
Expected: PASS (all prior + new tests).

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/index.ts
git commit -m "feat: feed employment profile into dashboard overview"
```

---

## Task 7: Profile REST endpoints

**Files:**
- Modify: `backend/src/routes/index.ts` (add routes inside `registerRoutes`)

- [ ] **Step 1: Add GET and PATCH /api/profile**

Inside `registerRoutes`, after the `/api/dashboard/overview` handler, add:

```typescript
  app.get("/api/profile", async (request, reply) => {
    const user = await requireAppUser(request, reply);

    if (!user) {
      return reply;
    }

    return reply.send({
      employmentStatus: user.employmentStatus ?? "unknown",
      jobTitle: user.jobTitle ?? null,
      grossPay: user.grossPay ? Number(user.grossPay) : null,
      payFrequency: user.payFrequency ?? null,
      onboardedAt: user.onboardedAt ?? null,
    });
  });

  app.patch("/api/profile", async (request, reply) => {
    const user = await requireAppUser(request, reply);

    if (!user) {
      return reply;
    }

    const bodySchema = z
      .object({
        employmentStatus: z.enum(["employed", "unemployed", "unknown"]),
        jobTitle: z.string().trim().max(120).optional().nullable(),
        grossPay: z.number().positive().max(100_000_000).optional().nullable(),
        payFrequency: z.enum(["weekly", "biweekly", "semimonthly", "monthly", "annually"]).optional().nullable(),
      })
      .superRefine((value, ctx) => {
        if (value.employmentStatus === "employed") {
          if (!value.grossPay) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "grossPay is required when employed", path: ["grossPay"] });
          }
          if (!value.payFrequency) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "payFrequency is required when employed", path: ["payFrequency"] });
          }
        }
      });

    const parsed = bodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(422).send({ error: "Invalid profile", details: parsed.error.flatten() });
    }

    const data = parsed.data;
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        employmentStatus: data.employmentStatus,
        jobTitle: data.employmentStatus === "employed" ? data.jobTitle ?? null : null,
        grossPay: data.employmentStatus === "employed" ? data.grossPay ?? null : null,
        payFrequency: data.employmentStatus === "employed" ? data.payFrequency ?? null : null,
        onboardedAt: user.onboardedAt ?? new Date(),
      },
    });

    return reply.send({
      employmentStatus: updated.employmentStatus,
      jobTitle: updated.jobTitle,
      grossPay: updated.grossPay ? Number(updated.grossPay) : null,
      payFrequency: updated.payFrequency,
      onboardedAt: updated.onboardedAt,
    });
  });
```

`z` is already imported? Check the top of `routes/index.ts`. If not, add `import { z } from "zod";` to the imports.

- [ ] **Step 2: Typecheck**

Run: `cd backend && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Manual smoke (optional, requires running backend + token)**

Run backend, then:
`curl -s -H "Authorization: Bearer <clerk-token>" http://localhost:4000/api/profile`
Expected: JSON with `employmentStatus: "unknown"` for a fresh user.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/index.ts
git commit -m "feat: add GET/PATCH /api/profile endpoints"
```

---

## Task 8: Frontend API types and profile calls

**Files:**
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Extend DashboardOverview and add profile types/calls**

In `frontend/lib/api.ts`, add these fields to the `DashboardOverview` type (after `metricCopy`):

```typescript
  incomeMode?: "income" | "surplus";
  incomeCard?: { label: string; value: number; subtitle: string };
  netCashFlow?: number;
  spendingThisMonth?: number;
  spendingYearToDate?: number;
  spendingAvgMonthly?: number;
  monthsOfHistory?: number;
  monthOverMonthChange?: { amount: number; percent: number } | null;
  balanceTrend?: Array<{ label: string; balance: number }>;
  accountsBreakdown?: Array<{ name: string; mask: string | null; currentBalance: number }>;
```

After the `DashboardOverview` type, add the profile type and functions:

```typescript
export type UserProfile = {
  employmentStatus: "employed" | "unemployed" | "unknown";
  jobTitle: string | null;
  grossPay: number | null;
  payFrequency: "weekly" | "biweekly" | "semimonthly" | "monthly" | "annually" | null;
  onboardedAt: string | null;
};

export async function getProfile(token?: string | null) {
  return getJson<UserProfile>(
    "/api/profile",
    { employmentStatus: "unknown", jobTitle: null, grossPay: null, payFrequency: null, onboardedAt: null },
    token,
  );
}

export async function updateProfile(profile: Partial<UserProfile>, token: string | null) {
  if (!apiBaseUrl) {
    throw new Error("API base URL is not configured");
  }

  const response = await fetch(`${apiBaseUrl}/api/profile`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
    body: JSON.stringify(profile),
  });

  if (!response.ok) {
    throw new Error("Failed to update profile");
  }

  return (await response.json()) as UserProfile;
}
```

- [ ] **Step 2: Typecheck frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/api.ts
git commit -m "feat: frontend dashboard + profile API types"
```

---

## Task 9: Balance card component

**Files:**
- Create: `frontend/components/balance-card.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/components/balance-card.tsx`:

```tsx
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { Panel } from "@/components/ui/panel";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

type BalanceCardProps = {
  currentBalance: number;
  monthOverMonthChange?: { amount: number; percent: number } | null;
  balanceTrend?: Array<{ label: string; balance: number }>;
  accountsBreakdown?: Array<{ name: string; mask: string | null; currentBalance: number }>;
};

export function BalanceCard({ currentBalance, monthOverMonthChange, balanceTrend = [], accountsBreakdown = [] }: BalanceCardProps) {
  const positive = (monthOverMonthChange?.amount ?? 0) >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  const maxBalance = Math.max(...balanceTrend.map((point) => point.balance), 1);

  return (
    <Panel className="p-5">
      <div className="text-sm text-slate-400">Current balance</div>
      <div className="mt-3 flex items-baseline gap-3">
        <div className="text-3xl font-semibold text-white">{formatCurrency(currentBalance)}</div>
        {monthOverMonthChange && (
          <div className={`flex items-center gap-1 text-sm ${positive ? "text-emerald-400" : "text-rose-400"}`}>
            <Icon className="size-4" />
            {formatCurrency(Math.abs(monthOverMonthChange.amount))} ({monthOverMonthChange.percent}%)
          </div>
        )}
      </div>

      {balanceTrend.length > 0 && (
        <div className="mt-4 flex h-12 items-end gap-1">
          {balanceTrend.map((point) => (
            <div key={point.label} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-emerald-400/70"
                style={{ height: `${Math.max((point.balance / maxBalance) * 100, 4)}%` }}
              />
              <span className="text-[10px] text-slate-500">{point.label}</span>
            </div>
          ))}
        </div>
      )}

      {accountsBreakdown.length > 1 && (
        <div className="mt-4 space-y-1">
          {accountsBreakdown.map((account) => (
            <div key={`${account.name}-${account.mask}`} className="flex justify-between text-xs text-slate-400">
              <span>
                {account.name}
                {account.mask ? ` ·${account.mask}` : ""}
              </span>
              <span className="text-slate-200">{formatCurrency(account.currentBalance)}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/balance-card.tsx
git commit -m "feat: balance card with trend, MoM, accounts"
```

---

## Task 10: Dashboard Layout B

**Files:**
- Modify: `frontend/app/dashboard/page.tsx` (the metric `section`, lines 33-50)

- [ ] **Step 1: Replace the metric section with Layout B**

Add the import at the top:

```tsx
import { BalanceCard } from "@/components/balance-card";
```

Replace the existing `<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"> ... </section>` (lines 33-50) with:

```tsx
      <section className="grid gap-4 xl:grid-cols-[1.6fr_1fr_1fr]">
        <BalanceCard
          currentBalance={data.currentBalance}
          monthOverMonthChange={data.monthOverMonthChange}
          balanceTrend={data.balanceTrend}
          accountsBreakdown={data.accountsBreakdown}
        />
        <MetricCard
          label={data.incomeCard?.label ?? "Monthly income"}
          value={formatCurrency(data.incomeCard?.value ?? data.monthlyIncome)}
          delta={data.incomeCard?.subtitle ?? "Detected from inflows"}
          trend={(data.incomeCard?.value ?? data.monthlyIncome) >= 0 ? "up" : "down"}
        />
        <MetricCard
          label="Savings rate"
          value={formatSavingsRate(data)}
          delta={data.metricCopy?.savingsRate ?? "Income minus spending"}
          trend={data.savingsRate < 0 ? "down" : "up"}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="This month's spending"
          value={formatCurrency(data.spendingThisMonth ?? data.monthlySpending)}
          delta={
            (data.spendingThisMonth ?? 0) > (data.spendingAvgMonthly ?? 0)
              ? "Above your average"
              : "At or below average"
          }
          trend={(data.spendingThisMonth ?? 0) > (data.spendingAvgMonthly ?? 0) ? "down" : "up"}
        />
        <MetricCard
          label="This year (YTD)"
          value={formatCurrency(data.spendingYearToDate ?? 0)}
          delta={`Across ${data.monthsOfHistory ?? 0} month${(data.monthsOfHistory ?? 0) === 1 ? "" : "s"}`}
        />
        <MetricCard
          label="Average / month"
          value={formatCurrency(data.spendingAvgMonthly ?? 0)}
          delta="Baseline pace"
        />
      </section>
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Visual check**

Run the frontend (`npm run dev:frontend` from repo root) and load `/dashboard`. Confirm top row = Balance (wide) + Income/Surplus + Savings rate; second row = three spending cards.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/dashboard/page.tsx
git commit -m "feat: dashboard Layout B with new metric cards"
```

---

## Task 11: Onboarding modal

**Files:**
- Create: `frontend/components/onboarding-modal.tsx`
- Modify: `frontend/app/dashboard/page.tsx` (render the modal)

- [ ] **Step 1: Create the modal component**

Create `frontend/components/onboarding-modal.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

import { getProfile, updateProfile, type UserProfile } from "@/lib/api";
import { Button } from "@/components/ui/button";

const frequencies: UserProfile["payFrequency"][] = ["weekly", "biweekly", "semimonthly", "monthly", "annually"];

export function OnboardingModal() {
  const { getToken, isSignedIn } = useAuth();
  const [open, setOpen] = useState(false);
  const [employed, setEmployed] = useState<boolean | null>(null);
  const [jobTitle, setJobTitle] = useState("");
  const [grossPay, setGrossPay] = useState("");
  const [payFrequency, setPayFrequency] = useState<UserProfile["payFrequency"]>("monthly");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isSignedIn) {
      return;
    }
    void (async () => {
      const profile = await getProfile(await getToken());
      if (!profile.onboardedAt) {
        setOpen(true);
      }
    })();
  }, [isSignedIn, getToken]);

  if (!open) {
    return null;
  }

  async function persist(payload: Partial<UserProfile>) {
    setSaving(true);
    try {
      await updateProfile(payload, await getToken());
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (employed) {
      await persist({
        employmentStatus: "employed",
        jobTitle: jobTitle || null,
        grossPay: grossPay ? Number(grossPay) : null,
        payFrequency,
      });
    } else {
      await persist({ employmentStatus: "unemployed", jobTitle: null, grossPay: null, payFrequency: null });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6">
        <h2 className="text-xl font-semibold text-white">Tell us about your income</h2>
        <p className="mt-2 text-sm text-slate-400">This personalizes your income and surplus metrics. You can change it anytime in Settings.</p>

        <div className="mt-5 space-y-4">
          <div>
            <div className="text-sm text-slate-300">Are you employed?</div>
            <div className="mt-2 flex gap-2">
              <Button variant={employed === true ? "primary" : "secondary"} onClick={() => setEmployed(true)}>Yes</Button>
              <Button variant={employed === false ? "primary" : "secondary"} onClick={() => setEmployed(false)}>No</Button>
            </div>
          </div>

          {employed && (
            <div className="space-y-3">
              <input
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                placeholder="Job title (e.g. Software Engineer)"
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
              />
              <input
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                placeholder="Gross pay per period (e.g. 2500)"
                type="number"
                value={grossPay}
                onChange={(event) => setGrossPay(event.target.value)}
              />
              <select
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                value={payFrequency ?? "monthly"}
                onChange={(event) => setPayFrequency(event.target.value as UserProfile["payFrequency"])}
              >
                {frequencies.map((frequency) => (
                  <option key={frequency} value={frequency ?? "monthly"}>{frequency}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-between">
          <Button variant="ghost" onClick={() => persist({ employmentStatus: "unknown", jobTitle: null, grossPay: null, payFrequency: null })} disabled={saving}>
            Skip for now
          </Button>
          <Button onClick={handleSave} disabled={saving || employed === null}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Confirm Button variants exist**

Run: `grep -n "variant" frontend/components/ui/button.tsx`
Expected: a `variant` prop with at least `default`, `secondary`, `ghost`. If the names differ, adjust the `variant=` values above to match the actual variants.

- [ ] **Step 3: Render the modal on the dashboard**

In `frontend/app/dashboard/page.tsx`, add the import:

```tsx
import { OnboardingModal } from "@/components/onboarding-modal";
```

Render it just inside the `<AppShell ...>` opening tag, before `<BankConnectionPanel />`:

```tsx
      <OnboardingModal />
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/onboarding-modal.tsx frontend/app/dashboard/page.tsx
git commit -m "feat: skippable employment onboarding modal"
```

---

## Task 12: Settings employment section

**Files:**
- Modify: `frontend/components/settings-control-center.tsx`

- [ ] **Step 1: Add an employment edit section**

In `frontend/components/settings-control-center.tsx`, add imports for `getProfile`, `updateProfile`, `type UserProfile` from `@/lib/api`, then add state + a section that loads the profile on mount and PATCHes on save. Mirror the modal's fields (employed toggle, job title, gross pay, frequency select). Concretely, add inside the component body:

```tsx
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      setProfile(await getProfile(await getToken()));
    })();
  }, [getToken]);

  async function saveProfile(next: UserProfile) {
    setProfileSaving(true);
    try {
      const updated = await updateProfile(next, await getToken());
      setProfile(updated);
    } finally {
      setProfileSaving(false);
    }
  }
```

Then render a `Panel`/section (matching the file's existing section markup) with the same inputs as the onboarding modal, bound to `profile` and calling `saveProfile`. Use the existing `getToken` from this component (it already uses Clerk auth for status calls — reuse that hook; if not present, add `const { getToken } = useAuth();`).

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Visual check**

Load `/settings`, confirm the employment section renders, saving updates the income card on `/dashboard`.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/settings-control-center.tsx
git commit -m "feat: editable employment profile in settings"
```

---

## Task 13: Full verification

- [ ] **Step 1: Backend tests + typecheck**

Run: `cd backend && npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 2: Frontend typecheck + lint**

Run: `cd frontend && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 3: Manual end-to-end**

Run backend + frontend. New user → onboarding modal appears → declare a job → dashboard shows "Monthly income" with the declared figure; skip/unemployed → "Monthly surplus". Spending row shows month/YTD/average. Balance card shows MoM + trend (+ accounts when >1).

- [ ] **Step 4: Final commit (if any pending)**

```bash
git status
```
Expected: clean tree on `feat/dashboard-metrics-employment-profile`.
