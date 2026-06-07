# Persist Analytics & Subscriptions — Design

**Date:** 2026-06-07
**Status:** Approved (design)
**Context:** WealthLens currently recomputes the financial score, forecast, insights,
and subscriptions on every request and never writes the matching Prisma models
(`FinancialScore`, `Forecast`, `Insight`, `Subscription`). Those tables are dead,
and the settings "delete data" actions clear empty tables. This work makes the
schema honest, adds a real subscription-management feature, and speeds up reads.

This is a student/portfolio project. Scope is intentionally lean: ship visible,
demo-able features and keep the app working. No history charts, scheduled jobs,
or time-series endpoints in this round.

## Goals

1. Persist analytics + subscriptions so the four models are actually used.
2. Add a visible feature: view and edit subscription status (cancel / pause / reactivate).
3. Faster page loads by serving stored snapshots instead of recomputing live.

## Non-goals (deferred)

- History / trend charts and time-series endpoints.
- Scheduled background snapshot jobs.
- Dropping unused schema (we are persisting, not removing).

## Write trigger

All persistence happens **on Plaid sync** (`POST /api/plaid/sync`), since that is
the only time underlying transaction data changes. After the existing
transaction sync completes, the route recomputes analytics once and writes a
snapshot.

```
POST /api/plaid/sync
  → sync transactions (existing behavior)
  → recompute once:
      - detectSubscriptions(transactions)        (TS)
      - requestAiSummary(...)                     (Python AI; TS fallback if offline)
  → persist snapshot:
      FinancialScore  → append one row
      Forecast        → append one row
      Insight         → replace latest set (deleteMany + createMany)
      Subscription    → upsert per merchant (preserve user status)
```

If the AI service is offline, the existing TypeScript fallback values are
persisted instead, so a snapshot is always written.

## Read behavior

| Endpoint | Source | Fallback |
| --- | --- | --- |
| `GET /api/subscriptions` | DB (`Subscription` rows) | live `detectSubscriptions` if no rows |
| `GET /api/forecast` | latest `Forecast` | live compute if no snapshot |
| `GET /api/financial-health` | live (unchanged) | — |
| `GET /api/dashboard/overview` | live (unchanged) | — |

The existing live-compute functions are kept as the fallback path, so the app
still works for users who have never synced (e.g. demo / mock-data mode). No page
breaks if the snapshot is missing.

`financial-health` and `dashboard` stay on their live paths: both surface rich
fields (factors, recommendations, AI insight merge) that the snapshot tables do
not store. Their rows are still persisted on sync, so the schema is honest and a
future round can add the missing columns and switch the reads. Forecast and
subscriptions switch to stored-first now because their stored shape is complete.

## Schema change

One change, requires a migration:

```prisma
model Subscription {
  // ...existing fields...
  @@unique([userId, merchantName])
}
```

This enables `prisma.subscription.upsert` keyed on `(userId, merchantName)`.

Field mapping (all fields already exist):

- `FinancialScore`: `score`, `savingsRate`, `spendingVolatility` (← spendingConsistency),
  `subscriptionBurden`, `emergencyFundDays`, `explanation` (← summary), `calculatedAt` (default now).
- `Forecast`: `horizonDays=90`, `projectedBalance`, `lowestProjectedBalance`,
  `lowBalanceRisk`, `riskProbability`, `data` (Json: forecast key points), `generatedAt`.
- `Insight`: `type` (enum), `title`, `summary`, `severity` (enum), `payload` (Json).
- `Subscription`: `merchantName`, `category`, `monthlyCost`, `yearlyCost`,
  `lastChargedAt`, `nextExpectedAt`, `confidence`, `status`.

## Subscription upsert rules

- Match on `(userId, merchantName)`.
- On insert: `status = active`.
- On update: refresh `monthlyCost`, `yearlyCost`, `lastChargedAt`, `confidence`,
  `category`. **Never overwrite `status`** — the user's cancelled/paused choice survives re-sync.
- Subscriptions detected previously but absent from the latest detection are left
  as-is (not deleted) so a one-off gap in data does not wipe history. (Simple and
  safe for a student project; can revisit later.)

## New endpoint

`PATCH /api/subscriptions/:id`
- Body: `{ status: "active" | "cancelled" | "paused" }`
- Auth: `requireAppUser`; scoped to the user's own subscription (`updateMany` with `userId`).
- Returns the updated row.

## Frontend

Subscriptions page (`frontend/app/subscriptions/page.tsx` +
`frontend/components/` — a client component for the rows):
- Each subscription row gets an action button:
  - `active` → "Pause" and "Cancel"
  - `paused` → "Reactivate" and "Cancel"
  - `cancelled` → "Reactivate"
- Buttons call `PATCH /api/subscriptions/:id` with a bearer token, then refresh.
- Minimal status indicator (text label is enough; no badge/filter polish this round).

## Error handling

- Persistence failures during sync are logged but do not fail the sync response
  (transactions already saved; analytics snapshot is best-effort).
- PATCH validates `status` against the enum; invalid → 400.
- Reads always fall back to live compute, so a missing/partial snapshot never
  500s a page.

## Testing

- Backend (vitest): subscription upsert preserves status; PATCH validation;
  fallback selection (stored vs live) given presence/absence of rows. Pure-logic
  helpers extracted so they are testable without a DB.
- Manual: sync → see persisted subs → cancel one → re-sync → status still cancelled.

## Out of scope / future

- Score and forecast history charts (data will already be accumulating).
- `nextExpectedAt` computation (left null for now).
- Pruning old FinancialScore/Forecast rows.
