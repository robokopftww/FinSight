# Dashboard Advisor Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the separate Advisor page with an auto-opening dashboard chat drawer.

**Architecture:** Adapt the existing `AdvisorChat` into a drawer-friendly chat surface and wrap it in a new dashboard-only controller that owns open/close behavior. Existing backend endpoints and persisted history remain unchanged. Navigation and the old Advisor page are removed.

**Tech Stack:** Next.js App Router, React client components, Clerk, Tailwind, existing advisor REST endpoints.

---

### Task 1: Drawer-Friendly Advisor Chat

**Files:**
- Modify: `frontend/components/advisor-chat.tsx`

- [ ] Add a compact drawer presentation with scrollable messages, starter prompt chips, clear-history action, and pinned input.
- [ ] Preserve existing API calls, history behavior, data points, and source labels.
- [ ] Run frontend typecheck and lint.

### Task 2: Dashboard Advisor Drawer Controller

**Files:**
- Create: `frontend/components/dashboard-advisor.tsx`
- Modify: `frontend/app/dashboard/page.tsx`

- [ ] Create a client controller that starts open on mount.
- [ ] Add close button, backdrop click, Escape handling, and floating reopen button.
- [ ] Render it on the dashboard and remove the static advisor preview.
- [ ] Run frontend typecheck and lint.

### Task 3: Remove Separate Advisor Surface

**Files:**
- Modify: `frontend/components/app-shell.tsx`
- Modify: `frontend/proxy.ts`
- Delete: `frontend/app/advisor/page.tsx`

- [ ] Remove Advisor navigation and route protection entry.
- [ ] Delete the page.
- [ ] Run the production build and verify `/advisor` is absent.

### Task 4: Full Verification

- [ ] Run backend tests and typecheck to verify no API regression.
- [ ] Run AI-service tests.
- [ ] Run frontend typecheck, lint, and build.
- [ ] Browser-check the dashboard interaction if an authenticated session is available.
- [ ] Run `git diff --check` and review final scope.
