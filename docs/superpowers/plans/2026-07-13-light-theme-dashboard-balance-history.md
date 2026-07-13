# Light Theme and Balance History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the full WealthLens frontend to a cohesive light theme, move bank connection controls into Settings, and replace the dashboard's miniature balance bars with a prominent six-month balance-history chart.

**Architecture:** Keep the existing dashboard API and `balanceTrend` calculation unchanged. Add one tested frontend helper for period-change math and one focused Recharts component for historical balance rendering, then compose it into the dashboard. Apply the light theme through shared tokens and primitives first, followed by targeted route and component updates so the result remains explicit and maintainable.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Recharts 3, Clerk, Plaid Link, Vitest.

## Global Constraints

- Use a white and soft-gray canvas, white cards, dark navy text, and visible neutral borders across every frontend route.
- Use saturated blue for product actions, green for positive financial movement, red for negative financial movement, and amber for warnings.
- Do not add a dark-mode toggle or persisted theme preference.
- Describe the new visualization as cash balance history, not true net worth.
- Reuse the existing `balanceTrend` API field; do not add a schema migration or backend endpoint.
- Keep existing Plaid, backend, and AI fallbacks unchanged.
- Do not perform unrelated structural refactors.

---

### Task 1: Add tested balance-period calculations

**Files:**
- Create: `frontend/lib/balance-history.ts`
- Create: `frontend/lib/balance-history.test.ts`
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`

**Interfaces:**
- Consumes: `Array<{ label: string; balance: number }>` from `DashboardOverview.balanceTrend`.
- Produces: `calculateBalanceChange(points: BalanceHistoryPoint[]): BalanceHistoryChange | null`.

- [ ] **Step 1: Install the frontend test runner**

Run:

```bash
npm install --workspace frontend --save-dev vitest
```

Add this script to `frontend/package.json`:

```json
"test": "vitest run"
```

- [ ] **Step 2: Write the failing calculation tests**

Create `frontend/lib/balance-history.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { calculateBalanceChange } from "./balance-history";

describe("calculateBalanceChange", () => {
  test("returns a positive dollar and percentage change", () => {
    expect(calculateBalanceChange([
      { label: "Jan", balance: 1_000 },
      { label: "Jun", balance: 1_250 },
    ])).toEqual({
      startBalance: 1_000,
      endBalance: 1_250,
      amount: 250,
      percent: 25,
      direction: "up",
    });
  });

  test("returns a negative change", () => {
    expect(calculateBalanceChange([
      { label: "Jan", balance: 2_000 },
      { label: "Jun", balance: 1_500 },
    ])).toEqual({
      startBalance: 2_000,
      endBalance: 1_500,
      amount: -500,
      percent: -25,
      direction: "down",
    });
  });

  test("omits percentage when the period starts at zero", () => {
    expect(calculateBalanceChange([
      { label: "Jan", balance: 0 },
      { label: "Jun", balance: 500 },
    ])?.percent).toBeNull();
  });

  test("returns null without two historical points", () => {
    expect(calculateBalanceChange([])).toBeNull();
    expect(calculateBalanceChange([{ label: "Jun", balance: 500 }])).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test and verify RED**

Run:

```bash
npm test --workspace frontend -- lib/balance-history.test.ts
```

Expected: FAIL because `frontend/lib/balance-history.ts` does not exist.

- [ ] **Step 4: Implement the minimal calculation helper**

Create `frontend/lib/balance-history.ts`:

```ts
export type BalanceHistoryPoint = {
  label: string;
  balance: number;
};

export type BalanceHistoryChange = {
  startBalance: number;
  endBalance: number;
  amount: number;
  percent: number | null;
  direction: "up" | "down";
};

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

export function calculateBalanceChange(points: BalanceHistoryPoint[]): BalanceHistoryChange | null {
  if (points.length < 2) {
    return null;
  }

  const startBalance = points[0].balance;
  const endBalance = points.at(-1)?.balance ?? startBalance;
  const amount = Math.round((endBalance - startBalance) * 100) / 100;

  return {
    startBalance,
    endBalance,
    amount,
    percent: startBalance === 0 ? null : roundToOneDecimal((amount / Math.abs(startBalance)) * 100),
    direction: amount >= 0 ? "up" : "down",
  };
}
```

- [ ] **Step 5: Run the test and verify GREEN**

Run:

```bash
npm test --workspace frontend -- lib/balance-history.test.ts
```

Expected: 4 tests PASS with no warnings.

- [ ] **Step 6: Commit the calculation unit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/lib/balance-history.ts frontend/lib/balance-history.test.ts
git commit -m "test(dashboard): cover balance history change"
```

---

### Task 2: Build the balance-history chart and simplify the balance card

**Files:**
- Create: `frontend/components/charts/balance-history-chart.tsx`
- Modify: `frontend/components/balance-card.tsx`
- Modify: `frontend/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `BalanceHistoryPoint[]` and `calculateBalanceChange` from Task 1.
- Produces: `BalanceHistoryChart({ data }: { data: BalanceHistoryPoint[] })`.

- [ ] **Step 1: Create the chart component**

Implement `frontend/components/charts/balance-history-chart.tsx` as a client component. Use `useSyncExternalStore` with the same mounted pattern as `CashFlowChart`, `ResponsiveContainer`, `AreaChart`, `Area`, `CartesianGrid`, `XAxis`, `YAxis`, and `Tooltip`.

Use these exact presentation rules:

```tsx
const positive = change?.direction === "up";
const changeClass = positive ? "text-emerald-600" : "text-red-600";
const stroke = "#2563eb";
const grid = "#dbe4f0";
const tick = "#64748b";
```

The header copy is:

```tsx
<h2>Balance over time</h2>
<p>Estimated cash balance across your last six months of synced activity.</p>
```

The change summary must show the signed formatted dollar change and, when non-null, the signed percentage followed by `over this period`. When `calculateBalanceChange(data)` returns null, render:

```tsx
<div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm text-slate-500">
  Sync more transaction history to show how your balance changes over time.
</div>
```

Format Y-axis and tooltip values as compact USD with `Intl.NumberFormat`.

- [ ] **Step 2: Remove the miniature history bars from `BalanceCard`**

Delete the `balanceTrend` prop and all bar-height calculations and rendering. Retain current balance, month-over-month change, and account breakdown. Change the positive class to `text-emerald-600` and the negative class to `text-red-600`.

- [ ] **Step 3: Compose the full-width chart into the dashboard**

In `frontend/app/dashboard/page.tsx`:

- Remove the `BankConnectionPanel` import and render.
- Import `BalanceHistoryChart`.
- Stop passing `balanceTrend` into `BalanceCard`.
- Add this after the primary balance/credit-card section:

```tsx
<BalanceHistoryChart data={data.balanceTrend ?? []} />
```

- [ ] **Step 4: Verify chart integration**

Run:

```bash
npm run lint --workspace frontend
npm run build --workspace frontend
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit the dashboard visualization**

```bash
git add frontend/components/charts/balance-history-chart.tsx frontend/components/balance-card.tsx frontend/app/dashboard/page.tsx
git commit -m "feat(dashboard): add balance history chart"
```

---

### Task 3: Move bank connection management into Settings

**Files:**
- Modify: `frontend/app/settings/page.tsx`
- Modify: `frontend/components/settings-control-center.tsx`

**Interfaces:**
- Consumes: existing `BankConnectionPanel` with no API changes.
- Produces: one Settings flow for connect, sync, add institution, inspect, and disconnect actions.

- [ ] **Step 1: Place connection setup on Settings**

Import `BankConnectionPanel` into `frontend/app/settings/page.tsx` and render it immediately before `SettingsControlCenter`.

- [ ] **Step 2: Remove duplicate institution controls**

In `SettingsControlCenter`:

- Rename the Plaid section heading from `Plaid connection` to `Connected institutions`.
- Update its description to `Review and disconnect the institutions that supply balances and transactions to WealthLens.`
- Remove the section's configuration-status tile and `Sync transactions` button because `BankConnectionPanel` owns setup and syncing.
- Retain institution rows, last-synced details, disconnect buttons, and the no-institution state.
- Remove `RefreshCw` and `syncTransactions` only if they are no longer used elsewhere; retain the settings-wide refresh action.

- [ ] **Step 3: Verify Settings behavior**

Run:

```bash
npm run lint --workspace frontend
```

Expected: exit 0 with no unused imports.

- [ ] **Step 4: Commit the Settings relocation**

```bash
git add frontend/app/settings/page.tsx frontend/components/settings-control-center.tsx
git commit -m "refactor(settings): move bank connection controls"
```

---

### Task 4: Establish the light design system

**Files:**
- Modify: `frontend/app/globals.css`
- Modify: `frontend/components/ui/panel.tsx`
- Modify: `frontend/components/ui/button.tsx`
- Modify: `frontend/components/app-shell.tsx`
- Modify: `frontend/lib/clerk-appearance.ts`
- Modify: `frontend/components/auth-overlay-shell.tsx`
- Modify: `frontend/components/charts/cash-flow-chart.tsx`
- Modify: `frontend/components/charts/spending-breakdown-chart.tsx`

**Interfaces:**
- Produces: shared light tokens and primitives consumed by all pages and feature components.

- [ ] **Step 1: Replace the root palette**

Set these tokens in `:root`:

```css
--background: #f4f7fb;
--foreground: #0f172a;
--muted: #64748b;
--color-surface: #ffffff;
--color-accent: #2563eb;
--color-accent-strong: #1d4ed8;
--color-accent-soft: rgba(37, 99, 235, 0.09);
--color-accent-soft-strong: rgba(37, 99, 235, 0.14);
--color-accent-border: rgba(37, 99, 235, 0.22);
--color-accent-text: #1d4ed8;
--color-positive: #059669;
--color-negative: #dc2626;
--color-warning: #d97706;
--color-border: #dbe4f0;
```

Change the page background to soft blue-white radial gradients over `var(--background)`, body text to `var(--foreground)`, selection to blue, and input placeholders to slate 400.

- [ ] **Step 2: Convert the landing-page palette**

Change `.wl-landing` tokens to a light background, white panels, slate borders, blue accent, navy text, and slate-muted copy. Update the sticky header, hero wash, panels, buttons, demo preview, pricing cards, testimonials, and footer so no dark canvas or white-on-dark assumptions remain. Preserve the existing layout and motion.

- [ ] **Step 3: Update shared primitives and application shell**

Use:

```tsx
// Panel
"rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]"

// Button variants
primary: "bg-blue-600 px-5 py-3 text-white shadow-sm hover:bg-blue-700"
secondary: "border border-slate-300 bg-white px-5 py-3 text-slate-800 hover:bg-slate-50"
ghost: "px-4 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-950"
```

Convert `AppShell` to the light page gradient, white sidebar and header card, slate text, blue active navigation, and restrained slate shadows.

- [ ] **Step 4: Update Clerk and authentication overlays**

Set Clerk variables to white backgrounds, slate text, slate input borders, blue actions, green success, and red errors. Keep the blurred landing-page backdrop but use a translucent white overlay instead of black. The close button becomes a white card with slate border and dark icon.

- [ ] **Step 5: Update existing chart chrome**

For both existing charts, use slate-200 grid/border, slate-500 ticks, white tooltips with slate-900 text, and blue chart accents. Preserve their data and dimensions.

- [ ] **Step 6: Verify the foundation**

Run:

```bash
npm run lint --workspace frontend
npm run build --workspace frontend
```

Expected: both commands exit 0.

- [ ] **Step 7: Commit the light design foundation**

```bash
git add frontend/app/globals.css frontend/components/ui/panel.tsx frontend/components/ui/button.tsx frontend/components/app-shell.tsx frontend/lib/clerk-appearance.ts frontend/components/auth-overlay-shell.tsx frontend/components/charts/cash-flow-chart.tsx frontend/components/charts/spending-breakdown-chart.tsx
git commit -m "style: establish light finance theme"
```

---

### Task 5: Convert all feature surfaces and semantic financial colors

**Files:**
- Modify: `frontend/app/dashboard/page.tsx`
- Modify: `frontend/app/demo/page.tsx`
- Modify: `frontend/app/financial-health/page.tsx`
- Modify: `frontend/app/reports/page.tsx`
- Modify: `frontend/app/subscriptions/page.tsx`
- Modify: `frontend/app/sign-in/[[...sign-in]]/page.tsx`
- Modify: `frontend/app/sign-up/[[...sign-up]]/page.tsx`
- Modify: `frontend/components/add-subscription.tsx`
- Modify: `frontend/components/advisor-chat.tsx`
- Modify: `frontend/components/balance-card.tsx`
- Modify: `frontend/components/bank-connection-panel.tsx`
- Modify: `frontend/components/credit-card-payments-card.tsx`
- Modify: `frontend/components/dashboard-advisor.tsx`
- Modify: `frontend/components/insight-card.tsx`
- Modify: `frontend/components/metric-card.tsx`
- Modify: `frontend/components/onboarding-modal.tsx`
- Modify: `frontend/components/score-ring.tsx`
- Modify: `frontend/components/settings-control-center.tsx`
- Modify: `frontend/components/site-header.tsx`
- Modify: `frontend/components/subscription-actions.tsx`
- Modify: `frontend/components/transactions-workbench.tsx`

**Interfaces:**
- Consumes: the light tokens and primitives from Task 4.
- Produces: consistent light styling on every authenticated, demo, modal, drawer, and data-table surface.

- [ ] **Step 1: Convert hard-coded dark utility classes**

Apply these semantic replacements, adjusting context when a blue button or colored badge needs white text:

```text
text-white         -> text-slate-950
text-slate-100     -> text-slate-800
text-slate-200     -> text-slate-700
text-slate-300     -> text-slate-600
text-slate-400     -> text-slate-500
border-white/6-12  -> border-slate-200 or border-slate-300
bg-white/4-6       -> bg-white or bg-slate-50
bg-white/7-10      -> bg-slate-100
bg-slate-950/20-30 -> bg-slate-50
```

Do not globally replace accent-button text: blue buttons and user chat bubbles must use `text-white`.

- [ ] **Step 2: Apply green/red financial semantics**

- `MetricCard` uses `text-emerald-600` and a pale green icon background for `trend="up"`, and `text-red-600` with pale red for `trend="down"`.
- Positive transaction amounts use `text-emerald-600`; spending amounts use `text-red-600`.
- Positive balance changes use green; negative changes use red.
- High-risk insight badges use red, medium warnings use amber, and low/healthy states use green.
- Credit-card liabilities use red accents rather than neutral white.

- [ ] **Step 3: Check overlays and interaction states**

Keep modal backdrops dark enough to focus attention, but render modal cards white. Ensure advisor messages, data-point cards, selects, inputs, hover states, and disabled states remain readable.

- [ ] **Step 4: Scan for remaining dark-theme assumptions**

Run:

```bash
rg -n "text-white|text-slate-100|text-slate-200|text-slate-300|border-white/|bg-white/[0-9]|bg-slate-950/|#070d1a|#0a1222|rgba\(6,10,18" frontend/app frontend/components frontend/lib -g '*.tsx' -g '*.css'
```

Expected: only intentional white text on saturated buttons/chat bubbles and intentional dark modal backdrops remain.

- [ ] **Step 5: Run frontend verification**

```bash
npm test --workspace frontend
npm run lint --workspace frontend
npm run build --workspace frontend
```

Expected: tests, lint, and build all exit 0.

- [ ] **Step 6: Commit the complete page conversion**

```bash
git add frontend/app frontend/components frontend/lib
git commit -m "style: convert product surfaces to light theme"
```

---

### Task 6: Full regression and visual verification

**Files:**
- Modify only files that fail verification.

**Interfaces:**
- Verifies all outputs from Tasks 1-5.

- [ ] **Step 1: Run the complete automated suite**

```bash
npm test --workspace frontend
npm run lint:frontend
npm run build:frontend
npm run typecheck:backend
npm run test:backend
npm run build:backend
npm run test:ai
```

Expected: every command exits 0.

- [ ] **Step 2: Run the frontend locally**

```bash
npm run dev:frontend
```

Open the local site and inspect desktop and mobile widths.

- [ ] **Step 3: Visually verify every surface**

Inspect:

- Landing header, hero, features, product preview, testimonials, pricing, calls to action, and footer.
- Sign-in and sign-up overlays.
- Demo mode.
- Dashboard, including positive and negative balance-history states.
- Transactions, subscriptions, financial health, reports, and Settings.
- Onboarding modal, add-subscription modal, advisor drawer, inputs, selects, and tooltips.

Confirm the dashboard contains no bank connection panel and Settings supports connect, sync, add-institution, inspect, and disconnect actions.

- [ ] **Step 4: Check the final diff**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only intended implementation files are changed.

- [ ] **Step 5: Commit any verification fixes**

If verification required fixes:

```bash
git add frontend
git commit -m "fix(ui): resolve light theme regressions"
```
