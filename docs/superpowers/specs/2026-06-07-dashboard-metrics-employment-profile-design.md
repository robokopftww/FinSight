# Dashboard Metrics Redesign + Employment Profile — Design

**Date:** 2026-06-07
**Status:** Approved (pending spec review)

## Problem

The dashboard's four metric cards (Current balance, Monthly spending, Monthly income, Savings rate) show shallow data. Monthly income is misleading when no salary context exists, and spending is a single 30-day number with no historical comparison. We want richer, more useful metrics plus a user-declared employment profile that grounds the income figure.

## Goals

1. Richer balance card: total + month-over-month change + net-worth trend + per-account breakdown.
2. Income card driven by a user-declared salary; falls back to "Monthly surplus" (net cash flow) when no job is declared.
3. Spending shown across three windows: this month, year-to-date, average monthly.
4. Employment profile collected at onboarding (skippable) and editable in Settings.

## Non-Goals

- No new balance-snapshot storage or cron job — balance history is reconstructed from transactions.
- No multi-currency handling beyond what exists.
- No change to the savings-rate formula (already corrected to exclude internal transfers).

## Decisions (from brainstorming)

| Question | Decision |
|----------|----------|
| Income source when employed | Declared salary, normalized to monthly. Plaid inflows still feed surplus/savings math. |
| Surplus (no job) definition | Net cash flow: flexible inflows − flexible spending (internal transfers excluded). |
| Spending windows | Calendar: this month (since 1st), YTD (since Jan 1), average = avg monthly across history. |
| Average basis | Average per calendar month. |
| Balance extras | Month-over-month change, per-account breakdown, net-worth trend line. |
| Profile flow | Skippable onboarding modal + editable in Settings. |
| Layout | Layout B (two tiers). |

## Data Model

Add to `User` (`backend/prisma/schema.prisma`):

```prisma
employmentStatus String   @default("unknown") // "employed" | "unemployed" | "unknown"
jobTitle         String?
grossPay         Decimal? @db.Decimal(12, 2)  // amount per pay period
payFrequency     String?                       // "weekly"|"biweekly"|"semimonthly"|"monthly"|"annually"
onboardedAt      DateTime?                      // null => onboarding not completed/skipped
```

Prisma migration. No new tables.

## Backend Analytics (`backend/src/lib/financial-analytics.ts`)

### Pay normalization → monthly
- weekly × 52/12
- biweekly × 26/12
- semimonthly × 2
- monthly × 1
- annually ÷ 12

Helper `normalizeMonthlyPay(grossPay, payFrequency): number`.

### Income vs surplus
- If `employmentStatus === "employed"` and `grossPay` set: `monthlyIncome = normalizeMonthlyPay(...)`, card label "Monthly income", with subtitle `<jobTitle> · paid <frequency>`.
- Else: card label "Monthly surplus", value = net cash flow = `flexibleInflows − flexibleSpending` (internal transfers already excluded).
- Emit a discriminator field (e.g. `incomeMode: "income" | "surplus"`) plus the label/value so the frontend renders conditionally.

### Spending windows (calendar, internal transfers excluded)
- `spendingThisMonth`: outflows since the 1st of the current month.
- `spendingYearToDate`: outflows since Jan 1.
- `spendingAvgMonthly`: total flexible spend ÷ count of distinct calendar months present in history. Guard against divide-by-zero.
- Also expose `monthsOfHistory` for the "Across N months" subtitle.

### Balance history reconstruction (no new storage)
- `balanceAt(t) = currentBalance − Σ signedFlow(tx) for tx.occurredAt > t`, where signedFlow = +amount for inflow, −amount for outflow.
- `monthOverMonthChange = currentBalance − balanceAt(endOfLastMonth)` (absolute + percent).
- `balanceTrend`: array of `{ label, balance }` for the last ~6 calendar months, each = `balanceAt(endOfThatMonth)`.
- When there is insufficient history, return an empty trend and null MoM so the UI can hide them.

### Per-account breakdown
- `accountsBreakdown`: `[{ name, mask, currentBalance }]` from existing `Account` rows. Frontend hides the list when only one account.

Savings rate unchanged.

## Profile API

- `GET /api/profile` → current employment fields + `onboardedAt`.
- `PATCH /api/profile` → update employment fields; sets `onboardedAt` when first saved/skipped.
- Auth via Clerk, same pattern as existing routes in `backend/src/modules/plaid/routes.ts`.
- Validation: `employmentStatus` enum; if `employed`, `grossPay` > 0 and `payFrequency` in enum; otherwise those may be null.

## Frontend

### Onboarding modal (skippable)
- Fires when `onboardedAt == null` after sign-in.
- Flow: "Are you employed?" → if yes: job title (text), gross pay (number), pay frequency (select). Buttons: Save / Skip.
- Skip or unemployed → `employmentStatus` set accordingly, `onboardedAt` stamped, dashboard shows surplus view.

### Settings (`frontend/components/settings-control-center.tsx`)
- Add an editable Employment section with the same fields, calling `PATCH /api/profile`.

### Dashboard (`frontend/app/dashboard/page.tsx`) — Layout B
- Top row (grid `1.6fr 1fr 1fr`):
  - **Balance card** (new `balance-card.tsx`): total, MoM change (green/red), net-worth trend sparkline, per-account list.
  - **Income / Surplus card**: conditional label + value + subtitle, from `incomeMode`.
  - **Savings rate card**: existing.
- Second row (grid 3 equal): **This month's spending**, **This year (YTD)**, **Average / month** (reuse `MetricCard`).
- Extend `getDashboardOverview` (`frontend/lib/api.ts`) return type and `summarizeDashboard` output with the new fields.

## Testing

- Extend `backend/tests/financial-analytics.test.ts`:
  - `normalizeMonthlyPay` for each frequency.
  - income mode = "income" with declared salary; "surplus" without.
  - calendar windows: this month / YTD / average across multi-month fixtures.
  - balance reconstruction + MoM change.
  - internal transfers excluded from all spending windows.
- Profile route test (GET/PATCH, validation).
- Existing 17 tests stay green.

## Edge Cases

- No transaction history: YTD/average = 0, trend hidden, MoM null.
- `employed` but no salary entered: fall back to surplus view.
- Single connected account: skip per-account breakdown.
- Pay frequency missing while employed: treat as not-yet-complete → surplus view until set.

## Files Touched

- `backend/prisma/schema.prisma` (+ migration)
- `backend/src/lib/financial-analytics.ts`
- `backend/src/modules/plaid/routes.ts` (or new `profile` module) — profile endpoints + dashboard payload
- `backend/tests/financial-analytics.test.ts`, new profile route test
- `frontend/app/dashboard/page.tsx`
- `frontend/components/balance-card.tsx` (new), onboarding modal (new), `settings-control-center.tsx`
- `frontend/lib/api.ts`
