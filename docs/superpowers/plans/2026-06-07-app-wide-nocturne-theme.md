# App-Wide Nocturne Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every WealthLens page use the landing page's Nocturne color palette.

**Architecture:** Centralize semantic palette values in `frontend/app/globals.css`, then replace hardcoded mint/emerald references in shared components and pages with those variables. Preserve warning/error colors and all existing layouts.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS v4, Recharts.

---

### Task 1: Centralize Nocturne Tokens

**Files:**
- Modify: `frontend/app/globals.css`

- [ ] Define background, surface, accent, accent-soft, accent-border, and accent-text variables.
- [ ] Update the global page background and text selection colors.

### Task 2: Migrate Shared Components

**Files:**
- Modify: shared components under `frontend/components`

- [ ] Update the app shell, panels, buttons, advisor UI, dialogs, charts, badges, and positive statuses.
- [ ] Preserve amber and rose warning/error states.

### Task 3: Migrate Route Pages

**Files:**
- Modify: route files under `frontend/app`

- [ ] Update remaining page-local mint/emerald colors and dark surfaces.
- [ ] Keep the landing page's existing Nocturne scoped styling unchanged except shared data colors.

### Task 4: Verify

- [ ] Run `rg` to confirm theme mint/emerald remnants are removed.
- [ ] Run `npm run lint --workspace frontend`.
- [ ] Run `npm run build --workspace frontend`.
- [ ] Inspect representative routes in the browser at desktop and mobile widths.
