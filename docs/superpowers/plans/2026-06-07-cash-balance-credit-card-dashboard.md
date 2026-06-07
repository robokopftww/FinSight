# Cash Balance and Credit Card Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct dashboard cash balance calculations and add a credit-card payments-due card.

**Architecture:** `summarizeDashboard` classifies Plaid accounts by their stored `type`. All liquidity calculations use depository accounts only, while credit accounts feed a separate credit-card summary. The frontend renders a focused credit-card card and labels unavailable Liabilities details honestly.

**Tech Stack:** TypeScript, Prisma account models, Vitest, Next.js, React, Tailwind.

---

### Task 1: Account Classification Analytics

**Files:**
- Modify: `backend/tests/financial-analytics.test.ts`
- Modify: `backend/src/lib/financial-analytics.ts`

- [ ] Write failing tests with depository, credit, and investment accounts.
- [ ] Verify the tests fail because credit balances are currently included in cash.
- [ ] Filter cash calculations and account breakdown to `type === "depository"`.
- [ ] Add credit-card total and breakdown fields.
- [ ] Run focused analytics tests and backend typecheck.

### Task 2: Credit Card Dashboard Card

**Files:**
- Create: `frontend/components/credit-card-payments-card.tsx`
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/app/dashboard/page.tsx`

- [ ] Add the new dashboard response types.
- [ ] Create the card with outstanding total, per-card breakdown, and unavailable Liabilities detail label.
- [ ] Place the card beside the cash balance in the top dashboard section.
- [ ] Run frontend typecheck, lint, and build.

### Task 3: Verification

- [ ] Run `cd backend && npm test && npm run typecheck`.
- [ ] Run `cd frontend && npx tsc --noEmit && npm run lint && npm run build`.
- [ ] Run `git diff --check` and review calculations and labels.
