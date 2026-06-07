# Multiple Institution Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users add additional Plaid institutions and disconnect one institution without affecting the others.

**Architecture:** Plaid status becomes the source of a per-institution summary. A focused backend helper enforces item ownership before deletion, relying on existing Prisma cascades for institution-scoped data cleanup. Dashboard opens Plaid Link for additional institutions; Settings renders individual disconnect controls.

**Tech Stack:** Fastify, Prisma, Vitest, Next.js, React, Plaid Link.

---

### Task 1: Owned Plaid Item Deletion

**Files:**
- Create: `backend/src/lib/plaid-items.ts`
- Create: `backend/tests/plaid-items.test.ts`
- Modify: `backend/src/modules/plaid/routes.ts`

- [ ] Write a failing helper test proving an owned Item is deleted and a foreign Item is not.
- [ ] Run `cd backend && npx vitest run tests/plaid-items.test.ts` and confirm failure.
- [ ] Implement `deleteOwnedPlaidItem` and add `DELETE /api/plaid/items/:itemId`.
- [ ] Extend `/api/plaid/status` with per-institution account counts.
- [ ] Run focused tests and backend typecheck.

### Task 2: Dashboard Add-Institution Action

**Files:**
- Modify: `frontend/components/bank-connection-panel.tsx`

- [ ] Reuse the existing Link-token flow for connected and disconnected users.
- [ ] Show `Add another institution` beside `Sync` when connected.
- [ ] Remove the all-connections Disconnect action from the dashboard.
- [ ] Clear the Link token after successful exchange so every add action starts a fresh Link session.

### Task 3: Settings Institution Controls

**Files:**
- Modify: `frontend/components/settings-control-center.tsx`

- [ ] Extend Settings status types with institution IDs, counts, and sync times.
- [ ] Render one row per institution with an individually scoped Disconnect button.
- [ ] Call `DELETE /api/plaid/items/:itemId`, then refresh status.
- [ ] Preserve the existing broad data-reset action.

### Task 4: Verification

- [ ] Run `cd backend && npm test && npm run typecheck`.
- [ ] Run `cd frontend && npx tsc --noEmit && npm run lint && npm run build`.
- [ ] Run `git diff --check` and review the final diff.
