# Overview Refresh and Floating Advisor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh Plaid balances and transactions whenever Overview opens, make the balance summary useful at every account count, and replace the automatic drawer with a closed-by-default floating advisor chatbox.

**Architecture:** Extend the existing `POST /api/plaid/sync` path with a tested account-balance refresh helper so persisted balances are current before the route recomputes analytics. A small client refresh controller calls that endpoint once per Overview mount and refreshes the server-rendered route after success. The balance card remains presentational, while a tested advisor window reducer drives the floating chat lifecycle without unmounting the chat after first open.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Clerk, Fastify 5, Prisma 6, Plaid SDK 42, Vitest 4.

## Global Constraints

- Render the saved Overview snapshot immediately; never block the page on Plaid.
- Run one background refresh per Overview mount, with an explicit retry only after failure.
- Refresh both Plaid account balances and transactions before regenerating analytics.
- Keep existing Plaid error messages and authenticated ownership boundaries.
- Show available balance, monthly movement, every connected cash account, and refresh status in the balance card.
- Start the advisor closed; do not persist its open state.
- Use a non-modal floating window with no backdrop or page dimming.
- Preserve advisor state after first open for the remainder of that Overview mount.
- Do not add polling, sockets, scheduled jobs, new analytics widgets, or changes to the advisor API.

---

### Task 1: Refresh Plaid account balances during sync

**Files:**
- Create: `backend/src/lib/plaid-account-sync.ts`
- Create: `backend/tests/plaid-account-sync.test.ts`
- Modify: `backend/src/modules/plaid/routes.ts`

**Interfaces:**
- Consumes: an owned Plaid item, a structural Prisma account store, an injected `accountsGet` fetcher, and one synchronization timestamp.
- Produces: `refreshPlaidAccounts(options: RefreshPlaidAccountsOptions): Promise<number>`, returning the number of refreshed accounts.
- The existing `POST /api/plaid/sync` response gains `refreshedAccountsCount: number` and `syncedAt: string` while retaining its transaction counts.

- [ ] **Step 1: Write the failing account refresh tests**

Create `backend/tests/plaid-account-sync.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import { refreshPlaidAccounts } from "../src/lib/plaid-account-sync.js";

describe("refreshPlaidAccounts", () => {
  it("upserts current and available Plaid balances with the shared sync timestamp", async () => {
    const syncedAt = new Date("2026-07-13T17:00:00.000Z");
    const store = {
      account: {
        upsert: vi.fn().mockResolvedValue({ id: "account-1" }),
      },
    };
    const fetchAccounts = vi.fn().mockResolvedValue([
      {
        account_id: "plaid-account-1",
        name: "Checking",
        mask: "1234",
        type: "depository",
        subtype: "checking",
        balances: {
          current: 9125.42,
          available: 9000.12,
          iso_currency_code: "USD",
        },
      },
    ]);

    const count = await refreshPlaidAccounts({
      store,
      item: {
        id: "item-1",
        userId: "user-1",
        plaidItemId: "plaid-item-1",
        accessToken: "access-1",
        institutionName: "First Platypus Bank",
      },
      fetchAccounts,
      syncedAt,
    });

    expect(count).toBe(1);
    expect(fetchAccounts).toHaveBeenCalledWith("access-1");
    expect(store.account.upsert).toHaveBeenCalledWith({
      where: { plaidAccountId: "plaid-account-1" },
      create: {
        userId: "user-1",
        itemId: "item-1",
        plaidItemId: "plaid-item-1",
        plaidAccountId: "plaid-account-1",
        institutionName: "First Platypus Bank",
        name: "Checking",
        mask: "1234",
        type: "depository",
        subtype: "checking",
        currentBalance: 9125.42,
        availableBalance: 9000.12,
        currencyCode: "USD",
        lastSyncedAt: syncedAt,
      },
      update: {
        itemId: "item-1",
        institutionName: "First Platypus Bank",
        name: "Checking",
        mask: "1234",
        type: "depository",
        subtype: "checking",
        currentBalance: 9125.42,
        availableBalance: 9000.12,
        currencyCode: "USD",
        lastSyncedAt: syncedAt,
      },
    });
  });

  it("returns zero when Plaid reports no accounts", async () => {
    const store = { account: { upsert: vi.fn() } };

    const count = await refreshPlaidAccounts({
      store,
      item: {
        id: "item-1",
        userId: "user-1",
        plaidItemId: "plaid-item-1",
        accessToken: "access-1",
        institutionName: "First Platypus Bank",
      },
      fetchAccounts: vi.fn().mockResolvedValue([]),
      syncedAt: new Date(),
    });

    expect(count).toBe(0);
    expect(store.account.upsert).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npm test --workspace backend -- plaid-account-sync.test.ts
```

Expected: FAIL because `backend/src/lib/plaid-account-sync.ts` does not exist.

- [ ] **Step 3: Implement the account refresh helper**

Create `backend/src/lib/plaid-account-sync.ts`:

```ts
type PlaidItemReference = {
  id: string;
  userId: string;
  plaidItemId: string;
  accessToken: string;
  institutionName: string;
};

type PlaidAccountSnapshot = {
  account_id: string;
  name: string;
  mask?: string | null;
  type: string;
  subtype?: string | null;
  balances: {
    current?: number | null;
    available?: number | null;
    iso_currency_code?: string | null;
  };
};

type AccountWrite = {
  userId: string;
  itemId: string;
  plaidItemId: string;
  plaidAccountId: string;
  institutionName: string;
  name: string;
  mask: string | null;
  type: string;
  subtype: string | null;
  currentBalance: number;
  availableBalance: number | null;
  currencyCode: string;
  lastSyncedAt: Date;
};

type AccountSyncStore = {
  account: {
    upsert(args: {
      where: { plaidAccountId: string };
      create: AccountWrite;
      update: Omit<AccountWrite, "userId" | "plaidItemId" | "plaidAccountId">;
    }): Promise<unknown>;
  };
};

export type RefreshPlaidAccountsOptions = {
  store: AccountSyncStore;
  item: PlaidItemReference;
  fetchAccounts: (accessToken: string) => Promise<PlaidAccountSnapshot[]>;
  syncedAt: Date;
};

export async function refreshPlaidAccounts({
  store,
  item,
  fetchAccounts,
  syncedAt,
}: RefreshPlaidAccountsOptions) {
  const accounts = await fetchAccounts(item.accessToken);

  await Promise.all(
    accounts.map((account) => {
      const shared = {
        itemId: item.id,
        institutionName: item.institutionName,
        name: account.name,
        mask: account.mask ?? null,
        type: String(account.type),
        subtype: account.subtype ? String(account.subtype) : null,
        currentBalance: account.balances.current ?? 0,
        availableBalance: account.balances.available ?? null,
        currencyCode: account.balances.iso_currency_code ?? "USD",
        lastSyncedAt: syncedAt,
      };

      return store.account.upsert({
        where: { plaidAccountId: account.account_id },
        create: {
          userId: item.userId,
          plaidItemId: item.plaidItemId,
          plaidAccountId: account.account_id,
          ...shared,
        },
        update: shared,
      });
    }),
  );

  return accounts.length;
}
```

- [ ] **Step 4: Run the helper tests and verify GREEN**

Run:

```bash
npm test --workspace backend -- plaid-account-sync.test.ts
```

Expected: 2 tests PASS.

- [ ] **Step 5: Integrate account refresh before transaction and analytics work**

In `backend/src/modules/plaid/routes.ts`, import the helper:

```ts
import { refreshPlaidAccounts } from "../../lib/plaid-account-sync.js";
```

Initialize these values immediately before the Plaid-item loop:

```ts
let refreshedAccountsCount = 0;
const syncedAt = new Date();
```

At the start of each `for (const plaidItem of plaidItems)` iteration, before loading the account ID map, add:

```ts
try {
  refreshedAccountsCount += await refreshPlaidAccounts({
    store: prisma,
    item: plaidItem,
    fetchAccounts: async (accessToken) => {
      const response = await plaid.accountsGet({ access_token: accessToken });
      return response.data.accounts;
    },
    syncedAt,
  });
} catch (error) {
  const plaidError = getPlaidError(error);
  request.log.warn({ plaidError, plaidItemId: plaidItem.id }, "Plaid account refresh failed");

  return reply.status(409).send({
    error:
      plaidError.code === "INVALID_ACCESS_TOKEN" || plaidError.code === "ITEM_LOGIN_REQUIRED"
        ? "Stored Plaid connection cannot sync anymore. Disconnect this bank and reconnect it."
        : "Unable to refresh account balances from Plaid right now.",
    plaidErrorCode: plaidError.code,
    plaidErrorMessage: plaidError.message,
  });
}
```

Use the shared timestamp in the existing item update:

```ts
lastSyncedAt: syncedAt,
```

Extend the successful response:

```ts
return reply.send({
  addedCount,
  modifiedCount,
  removedCount,
  refreshedAccountsCount,
  syncedAt: syncedAt.toISOString(),
});
```

The existing analytics block remains after the loop, so it reads refreshed account records.

- [ ] **Step 6: Verify backend behavior**

Run:

```bash
npm run typecheck:backend
npm run test:backend
npm run build:backend
```

Expected: typecheck and build exit 0; all backend tests pass.

- [ ] **Step 7: Commit the backend refresh fix**

```bash
git add backend/src/lib/plaid-account-sync.ts backend/tests/plaid-account-sync.test.ts backend/src/modules/plaid/routes.ts
git commit -m "fix(plaid): refresh balances during sync"
```

---

### Task 2: Add the once-per-open Overview refresh controller

**Files:**
- Create: `frontend/lib/overview-refresh.ts`
- Create: `frontend/lib/overview-refresh.test.ts`
- Create: `frontend/components/overview-refresh-controller.tsx`

**Interfaces:**
- Produces: `overviewRefreshReducer(state, action): OverviewRefreshState` for deterministic UI state.
- Produces: `OverviewRefreshController`, a client component that renders status, calls `POST /api/plaid/sync` once after Clerk loads, and calls `router.refresh()` after success.

- [ ] **Step 1: Write the failing refresh-state tests**

Create `frontend/lib/overview-refresh.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { initialOverviewRefreshState, overviewRefreshReducer } from "./overview-refresh";

describe("overviewRefreshReducer", () => {
  test("moves from idle to refreshing and success", () => {
    const refreshing = overviewRefreshReducer(initialOverviewRefreshState, { type: "start" });
    expect(refreshing).toEqual({ status: "refreshing" });
    expect(overviewRefreshReducer(refreshing, { type: "succeed" })).toEqual({ status: "success" });
  });

  test("stores a retryable failure and clears it on retry", () => {
    const failed = overviewRefreshReducer(initialOverviewRefreshState, {
      type: "fail",
      message: "Couldn’t refresh",
    });
    expect(failed).toEqual({ status: "error", message: "Couldn’t refresh" });
    expect(overviewRefreshReducer(failed, { type: "start" })).toEqual({ status: "refreshing" });
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npm test --workspace frontend -- lib/overview-refresh.test.ts
```

Expected: FAIL because `frontend/lib/overview-refresh.ts` does not exist.

- [ ] **Step 3: Implement the refresh reducer**

Create `frontend/lib/overview-refresh.ts`:

```ts
export type OverviewRefreshState =
  | { status: "idle" }
  | { status: "refreshing" }
  | { status: "success" }
  | { status: "error"; message: string };

export type OverviewRefreshAction =
  | { type: "start" }
  | { type: "succeed" }
  | { type: "fail"; message: string };

export const initialOverviewRefreshState: OverviewRefreshState = { status: "idle" };

export function overviewRefreshReducer(
  _state: OverviewRefreshState,
  action: OverviewRefreshAction,
): OverviewRefreshState {
  switch (action.type) {
    case "start":
      return { status: "refreshing" };
    case "succeed":
      return { status: "success" };
    case "fail":
      return { status: "error", message: action.message };
  }
}
```

- [ ] **Step 4: Run the reducer tests and verify GREEN**

Run:

```bash
npm test --workspace frontend -- lib/overview-refresh.test.ts
```

Expected: 2 tests PASS.

- [ ] **Step 5: Implement the client refresh controller**

Create `frontend/components/overview-refresh-controller.tsx`:

```tsx
"use client";

import { useAuth } from "@clerk/nextjs";
import { CheckCircle2, Loader2, RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef } from "react";

import {
  initialOverviewRefreshState,
  overviewRefreshReducer,
} from "@/lib/overview-refresh";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

export function OverviewRefreshController() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const started = useRef(false);
  const [state, dispatch] = useReducer(overviewRefreshReducer, initialOverviewRefreshState);

  const refreshOverview = useCallback(async () => {
    dispatch({ type: "start" });

    try {
      if (!apiBaseUrl) {
        throw new Error("API unavailable");
      }

      const token = await getToken();
      const response = await fetch(`${apiBaseUrl}/api/plaid/sync`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) {
        throw new Error("Refresh failed");
      }

      dispatch({ type: "succeed" });
      router.refresh();
    } catch {
      dispatch({ type: "fail", message: "Couldn’t refresh" });
    }
  }, [getToken, router]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || started.current) {
      return;
    }

    started.current = true;
    void refreshOverview();
  }, [isLoaded, isSignedIn, refreshOverview]);

  return (
    <div className="flex min-h-8 items-center text-xs" aria-live="polite">
      {state.status === "refreshing" ? (
        <span className="inline-flex items-center gap-2 text-slate-500">
          <Loader2 className="size-3.5 animate-spin" />
          Updating accounts…
        </span>
      ) : null}
      {state.status === "success" ? (
        <span className="inline-flex items-center gap-2 text-emerald-700">
          <CheckCircle2 className="size-3.5" />
          Updated just now
        </span>
      ) : null}
      {state.status === "error" ? (
        <button
          type="button"
          className="inline-flex items-center gap-2 text-amber-700 transition hover:text-amber-800"
          onClick={() => void refreshOverview()}
        >
          <RefreshCcw className="size-3.5" />
          {state.message}. Retry
        </button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 6: Verify the frontend unit**

Run:

```bash
npm test --workspace frontend
npm run lint:frontend
```

Expected: all frontend tests pass and lint exits 0.

- [ ] **Step 7: Commit the refresh controller**

```bash
git add frontend/lib/overview-refresh.ts frontend/lib/overview-refresh.test.ts frontend/components/overview-refresh-controller.tsx
git commit -m "feat(overview): refresh data on open"
```

---

### Task 3: Fill and compact the balance summary

**Files:**
- Create: `frontend/components/balance-card.test.tsx`
- Modify: `frontend/components/balance-card.tsx`
- Modify: `frontend/app/dashboard/page.tsx`

**Interfaces:**
- `BalanceCardProps` gains `availableBalance?: number` and `refreshStatus?: ReactNode`.
- The card always renders the supplied `accountsBreakdown`, including a single account.
- Dashboard composes `<OverviewRefreshController />` into the card footer.

- [ ] **Step 1: Write the failing balance-card rendering test**

Create `frontend/components/balance-card.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { BalanceCard } from "./balance-card";

describe("BalanceCard", () => {
  test("shows available balance, one connected account, and refresh status", () => {
    const html = renderToStaticMarkup(
      <BalanceCard
        currentBalance={8824}
        availableBalance={8610}
        monthOverMonthChange={{ amount: -93, percent: -1.04 }}
        accountsBreakdown={[{ name: "Checking", mask: "1234", currentBalance: 8824 }]}
        refreshStatus={<span>Updated just now</span>}
      />,
    );

    expect(html).toContain("Available balance");
    expect(html).toContain("$8,610");
    expect(html).toContain("Checking ·1234");
    expect(html).toContain("Updated just now");
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npm test --workspace frontend -- components/balance-card.test.tsx
```

Expected: FAIL because `availableBalance` and `refreshStatus` are not accepted or rendered.

- [ ] **Step 3: Implement the compact, information-rich card**

Replace `frontend/components/balance-card.tsx` with:

```tsx
import { ArrowDownRight, ArrowUpRight, Landmark } from "lucide-react";
import type { ReactNode } from "react";

import { Panel } from "@/components/ui/panel";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

type BalanceCardProps = {
  currentBalance: number;
  availableBalance?: number;
  monthOverMonthChange?: { amount: number; percent: number } | null;
  accountsBreakdown?: Array<{ name: string; mask: string | null; currentBalance: number }>;
  refreshStatus?: ReactNode;
};

export function BalanceCard({
  currentBalance,
  availableBalance,
  monthOverMonthChange,
  accountsBreakdown = [],
  refreshStatus,
}: BalanceCardProps) {
  const positive = (monthOverMonthChange?.amount ?? 0) >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;

  return (
    <Panel className="overflow-hidden">
      <div className="bg-gradient-to-br from-blue-50 via-white to-white p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-slate-500">Current balance</div>
          <span className="flex size-10 items-center justify-center rounded-2xl bg-blue-600 text-white">
            <Landmark className="size-5" />
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-baseline gap-3">
          <div className="text-4xl font-semibold tracking-tight text-slate-950">
            {formatCurrency(currentBalance)}
          </div>
          {monthOverMonthChange ? (
            <div className={`flex items-center gap-1 text-sm font-medium ${positive ? "text-emerald-600" : "text-red-600"}`}>
              <Icon className="size-4" />
              {formatCurrency(Math.abs(monthOverMonthChange.amount))} ({monthOverMonthChange.percent}%)
            </div>
          ) : null}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-blue-100 bg-white/80 p-3">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Available balance</div>
            <div className="mt-2 font-semibold text-slate-950">
              {formatCurrency(availableBalance ?? currentBalance)}
            </div>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-white/80 p-3">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Cash accounts</div>
            <div className="mt-2 font-semibold text-slate-950">{accountsBreakdown.length}</div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 px-6 py-4">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Connected cash</div>
        <div className="mt-3 space-y-2">
          {accountsBreakdown.map((account) => (
            <div key={`${account.name}-${account.mask}`} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-600">{account.name}{account.mask ? ` ·${account.mask}` : ""}</span>
              <span className="font-medium text-slate-950">{formatCurrency(account.currentBalance)}</span>
            </div>
          ))}
          {accountsBreakdown.length === 0 ? (
            <div className="text-sm text-slate-500">No cash accounts connected.</div>
          ) : null}
        </div>
        {refreshStatus ? <div className="mt-4 border-t border-slate-200 pt-3">{refreshStatus}</div> : null}
      </div>
    </Panel>
  );
}
```

- [ ] **Step 4: Compose refresh status and stop grid stretching**

In `frontend/app/dashboard/page.tsx`, import:

```ts
import { OverviewRefreshController } from "@/components/overview-refresh-controller";
```

Change the primary card row and props to:

```tsx
<section className="grid items-start gap-4 xl:grid-cols-2">
  <BalanceCard
    currentBalance={data.currentBalance}
    availableBalance={data.availableBalance}
    monthOverMonthChange={data.monthOverMonthChange}
    accountsBreakdown={data.accountsBreakdown}
    refreshStatus={<OverviewRefreshController />}
  />
  <CreditCardPaymentsCard
    totalOutstanding={data.creditCardBalance ?? 0}
    detailsAvailable={data.creditCardDetailsAvailable}
    cards={data.creditCards}
  />
</section>
```

- [ ] **Step 5: Verify balance-card behavior**

Run:

```bash
npm test --workspace frontend -- components/balance-card.test.tsx
npm run lint:frontend
npm run build:frontend
```

Expected: the balance-card test passes; lint and build exit 0.

- [ ] **Step 6: Commit the Overview composition**

```bash
git add frontend/components/balance-card.tsx frontend/components/balance-card.test.tsx frontend/app/dashboard/page.tsx
git commit -m "style(overview): enrich balance summary"
```

---

### Task 4: Replace the advisor drawer with a floating chatbox

**Files:**
- Create: `frontend/lib/advisor-window.ts`
- Create: `frontend/lib/advisor-window.test.ts`
- Modify: `frontend/components/dashboard-advisor.tsx`
- Modify: `frontend/components/advisor-chat.tsx`

**Interfaces:**
- Produces: `advisorWindowReducer(state, action): AdvisorWindowState` with `open` and `hasOpened` state.
- `DashboardAdvisor` starts from `initialAdvisorWindowState`, mounts `AdvisorChat` only after the first open, and keeps it mounted while visually hidden after closing.

- [ ] **Step 1: Write the failing advisor-window tests**

Create `frontend/lib/advisor-window.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { advisorWindowReducer, initialAdvisorWindowState } from "./advisor-window";

describe("advisorWindowReducer", () => {
  test("starts closed and records the first open", () => {
    expect(initialAdvisorWindowState).toEqual({ open: false, hasOpened: false });
    expect(advisorWindowReducer(initialAdvisorWindowState, { type: "open" })).toEqual({
      open: true,
      hasOpened: true,
    });
  });

  test("closes without forgetting that chat was mounted", () => {
    expect(
      advisorWindowReducer({ open: true, hasOpened: true }, { type: "close" }),
    ).toEqual({ open: false, hasOpened: true });
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npm test --workspace frontend -- lib/advisor-window.test.ts
```

Expected: FAIL because `frontend/lib/advisor-window.ts` does not exist.

- [ ] **Step 3: Implement the advisor-window reducer**

Create `frontend/lib/advisor-window.ts`:

```ts
export type AdvisorWindowState = {
  open: boolean;
  hasOpened: boolean;
};

export type AdvisorWindowAction = { type: "open" } | { type: "close" };

export const initialAdvisorWindowState: AdvisorWindowState = {
  open: false,
  hasOpened: false,
};

export function advisorWindowReducer(
  state: AdvisorWindowState,
  action: AdvisorWindowAction,
): AdvisorWindowState {
  if (action.type === "open") {
    return { open: true, hasOpened: true };
  }

  return { ...state, open: false };
}
```

- [ ] **Step 4: Run the reducer tests and verify GREEN**

Run:

```bash
npm test --workspace frontend -- lib/advisor-window.test.ts
```

Expected: 2 tests PASS.

- [ ] **Step 5: Implement the closed-by-default floating advisor**

Replace `frontend/components/dashboard-advisor.tsx` with:

```tsx
"use client";

import { Bot, MessageCircle, X } from "lucide-react";
import { useEffect, useReducer, useRef } from "react";

import { AdvisorChat } from "@/components/advisor-chat";
import { advisorWindowReducer, initialAdvisorWindowState } from "@/lib/advisor-window";

export function DashboardAdvisor() {
  const [state, dispatch] = useReducer(advisorWindowReducer, initialAdvisorWindowState);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!state.open) {
      return;
    }

    panelRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        dispatch({ type: "close" });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.open]);

  useEffect(() => {
    if (!state.open && state.hasOpened) {
      launcherRef.current?.focus();
    }
  }, [state.hasOpened, state.open]);

  return (
    <>
      {state.hasOpened ? (
        <aside
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-label="WealthLens Advisor"
          aria-hidden={!state.open}
          tabIndex={-1}
          className={`fixed bottom-24 right-4 z-40 flex h-[min(35rem,calc(100vh-7rem))] w-[calc(100vw-2rem)] max-w-96 origin-bottom-right flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] transition duration-200 sm:right-6 ${
            state.open
              ? "translate-y-0 scale-100 opacity-100"
              : "pointer-events-none invisible translate-y-3 scale-95 opacity-0"
          }`}
        >
          <div className="flex items-center justify-between bg-blue-600 px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-white/15">
                <Bot className="size-5" />
              </span>
              <div>
                <div className="font-semibold">WealthLens Advisor</div>
                <div className="text-xs text-blue-100">Ask about your synced finances</div>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close WealthLens Advisor"
              className="rounded-full p-2 text-blue-100 transition hover:bg-white/15 hover:text-white"
              onClick={() => dispatch({ type: "close" })}
            >
              <X className="size-5" />
            </button>
          </div>
          <AdvisorChat compact />
        </aside>
      ) : null}

      {!state.open ? (
        <button
          ref={launcherRef}
          type="button"
          aria-label="Open WealthLens Advisor"
          className="fixed bottom-5 right-4 z-30 flex size-14 items-center justify-center rounded-full border border-blue-500 bg-blue-600 text-white shadow-[0_18px_55px_rgba(37,99,235,0.32)] transition hover:scale-105 hover:bg-blue-700 sm:bottom-6 sm:right-6 sm:size-16"
          onClick={() => dispatch({ type: "open" })}
        >
          <MessageCircle className="size-6 sm:size-7" />
        </button>
      ) : null}
    </>
  );
}
```

- [ ] **Step 6: Compact the chat composer and message widths**

In `frontend/components/advisor-chat.tsx`:

1. Replace the existing message bubble `className` expression with:

```tsx
className={
  isAssistant
    ? `${compact ? "max-w-[85%]" : "max-w-2xl"} rounded-[24px] border border-slate-200 bg-slate-100 px-5 py-4 text-sm leading-7 text-slate-800`
    : `${compact ? "max-w-[85%]" : "max-w-2xl"} rounded-[24px] bg-blue-600 px-5 py-4 text-sm leading-7 text-white`
}
```

2. Add an accessible label and a compact placeholder to the input:

```tsx
aria-label="Advisor question"
placeholder={compact ? "Ask about your finances…" : "Ask if a purchase is safe, why spending changed, or how to save more"}
```

3. Change the composer container to stay horizontal in compact mode:

```tsx
<div className={compact
  ? "flex items-center gap-2 rounded-[24px] border border-slate-200 bg-slate-50 p-2"
  : "flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-2 sm:flex-row"
}>
```

4. Render the compact submit button as an icon button while retaining accessible text:

```tsx
<Button
  type="submit"
  disabled={isSending || !question.trim()}
  className={compact ? "size-11 shrink-0 p-0" : "gap-2"}
>
  <Send className="size-4" />
  <span className={compact ? "sr-only" : ""}>{isSending ? "Thinking" : "Send"}</span>
</Button>
```

- [ ] **Step 7: Verify floating-chat behavior**

Run:

```bash
npm test --workspace frontend
npm run lint:frontend
npm run build:frontend
```

Expected: all frontend tests pass; lint and build exit 0.

- [ ] **Step 8: Commit the floating advisor**

```bash
git add frontend/lib/advisor-window.ts frontend/lib/advisor-window.test.ts frontend/components/dashboard-advisor.tsx frontend/components/advisor-chat.tsx
git commit -m "feat(advisor): use floating chat window"
```

---

### Task 5: Integrated verification and responsive polish

**Files:**
- Modify only files from Tasks 1-4 if verification exposes a scoped regression.

**Interfaces:**
- Verifies the full user flow without adding another production interface.

- [ ] **Step 1: Run the complete automated suite**

Run each command and require exit code 0:

```bash
npm test --workspace frontend
npm run lint:frontend
npm run build:frontend
npm run typecheck:backend
npm run test:backend
npm run build:backend
npm run test:ai
git diff --check
```

Expected: 0 failures, 0 lint errors, successful frontend/backend builds, and no whitespace errors.

- [ ] **Step 2: Verify the account-refresh data boundary**

With a configured Plaid sandbox account:

1. Open Overview and confirm the saved figures appear before the refresh request finishes.
2. Confirm the card status changes from `Updating accounts…` to `Updated just now`.
3. Confirm the network response from `POST /api/plaid/sync` includes `refreshedAccountsCount` and `syncedAt`.
4. Confirm the subsequent Overview response uses the refreshed account balance.
5. Trigger a controlled backend-unavailable state and confirm existing figures remain visible with `Couldn’t refresh. Retry`.

- [ ] **Step 3: Verify the desktop visual behavior**

At a 1440×1000 viewport:

- Overview opens with no advisor window or backdrop.
- The launcher appears at bottom-right.
- The balance card shows available balance and the single-account row without a large empty region.
- Opening the launcher produces an approximately 380×560 floating card that does not cover half the page.
- Escape closes the card and returns focus to the launcher.
- Reopening preserves chat messages from the current page visit.

- [ ] **Step 4: Verify the mobile visual behavior**

At a 390×844 viewport:

- No horizontal page overflow is present.
- The chat fits within 1rem side margins and remains above the launcher.
- Header, message history, starter prompts, and composer remain usable.
- Overview remains interactive behind the non-modal chat.

- [ ] **Step 5: Commit verification-only fixes if any were required**

If verification changed tracked files:

```bash
git add backend/src/lib/plaid-account-sync.ts backend/src/modules/plaid/routes.ts backend/tests/plaid-account-sync.test.ts frontend/app/dashboard/page.tsx frontend/components/advisor-chat.tsx frontend/components/balance-card.tsx frontend/components/dashboard-advisor.tsx frontend/components/overview-refresh-controller.tsx frontend/lib/advisor-window.ts frontend/lib/overview-refresh.ts
git commit -m "fix(ui): resolve overview regressions"
```

If no tracked files changed, do not create an empty commit.
