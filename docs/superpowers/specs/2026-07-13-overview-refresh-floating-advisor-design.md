# Overview Refresh and Floating Advisor Design

## Goal

Make the authenticated Overview feel current and intentionally composed: refresh financial data in the background whenever the page opens, replace the oversized empty balance card with useful account context, and convert the advisor from an automatic half-page drawer into a closed-by-default floating chatbox.

## Current Problems and Root Cause

- The frontend already requests authenticated Overview data with `cache: "no-store"`, so the stale balance is not caused by the Next.js data cache.
- `POST /api/plaid/sync` updates transactions and analytics snapshots, but it does not call Plaid's accounts endpoint or update stored account balances. Overview therefore recomputes from fresh transactions and stale `Account.currentBalance` values.
- `DashboardAdvisor` initializes `open` to `true`, mounts the advisor immediately, adds a full-screen backdrop, and renders a right-side drawer up to 30rem wide.
- `BalanceCard` only shows the headline amount and optional account rows when more than one account exists. In the two-column row it stretches to match the neighboring credit-card card, leaving a large blank area for users with one account.

## Approved Experience

### Background Overview Refresh

Overview renders the server-provided snapshot immediately. A small client refresh controller then starts one background refresh for that page visit:

1. Show a subtle `Updating accounts…` status without blocking the dashboard.
2. Call the existing authenticated `POST /api/plaid/sync` endpoint.
3. The backend fetches current Plaid account data for every connected item, updates stored account balances and metadata, syncs transactions, and regenerates analytics from the refreshed records.
4. When the request succeeds, refresh the current Next.js route so all server-rendered Overview values update together.
5. Replace the status with `Updated just now`.

The refresh must not run in a render loop. It runs once when the Overview client controller mounts. Navigating away and reopening Overview starts another background refresh.

If no Plaid item is connected, the endpoint returns successfully without work and the current empty/demo state remains usable. If refresh fails, keep the existing snapshot visible and show a quiet `Couldn’t refresh` state with a retry action; do not replace financial values with demo data or an error screen.

### Backend Refresh Boundary

Keep refresh orchestration in the backend rather than making the browser call multiple Plaid operations. Extract a focused sync service used by the existing Settings sync action and the Overview background refresh. For each owned Plaid item, the service:

- calls `accountsGet` and upserts the latest current and available balances;
- syncs added, modified, and removed transactions using the stored cursor;
- updates item and account sync timestamps;
- persists the analytics snapshot only after account and transaction records are current.

The response includes transaction counts, refreshed account count, and completion time. Plaid authentication errors retain the existing user-safe messages.

### Balance Card Composition

The balance card remains a summary rather than becoming another chart. It contains:

- current balance as the visual anchor;
- signed month-over-month movement in green or red;
- available balance as a secondary metric;
- a visible connected-account list even when there is only one account;
- masked account identifiers and individual balances;
- the Overview refresh status near the card footer.

Use a compact internal grid and subtle blue-tinted accent surface so the space feels intentional. Avoid decorative data that is not already available from the Overview response. The card should fit its content and must not create a large empty white region merely to match the neighboring card.

### Floating Advisor

The advisor starts closed on every new Overview mount. Its closed state is a circular blue launcher fixed to the bottom-right with the accessible label `Open WealthLens Advisor`.

Opening it displays a floating chat window:

- desktop target width: 24rem (approximately 380px);
- desktop target height: 35rem, capped to the available viewport;
- placement: bottom-right above the launcher with a 1.5rem page margin;
- appearance: rounded white card, visible border, strong soft shadow, compact blue header;
- no page-wide backdrop and no dimming of Overview;
- close button and Escape key return to the launcher;
- mobile width: viewport minus 2rem, with height capped below the page header and launcher.

The chat UI keeps history, starter prompts, clear-history action, messages, and composer. It does not load history until the user opens it for the first time. After first open, hiding and reopening the box preserves its local conversation state for the current page visit.

## Component Boundaries

- `OverviewRefreshController`: owns the once-per-mount background refresh state, calls the refresh endpoint, and triggers `router.refresh()` after success.
- `BalanceCard`: remains presentational and receives available balance plus refresh status through props.
- `DashboardAdvisor`: owns open/closed/has-opened state, keyboard dismissal, launcher, and floating-window positioning.
- `AdvisorChat`: continues to own chat history and message operations; compact styling is adjusted for the smaller floating window.
- Backend Plaid sync service: owns account refresh, transaction synchronization, timestamp updates, and analytics persistence so routes do not duplicate financial synchronization logic.

## Data and State Flow

```text
Open Overview
  -> render saved server snapshot
  -> OverviewRefreshController mounts
  -> POST /api/plaid/sync with the authenticated user
  -> backend refreshes Plaid accounts
  -> backend syncs transactions
  -> backend persists updated analytics
  -> frontend router.refresh()
  -> server Overview fetch reads updated database values
  -> dashboard cards and charts rerender together
```

Chat state is independent of Overview refresh state. Opening or closing the advisor never triggers financial synchronization or a route refresh.

## Accessibility and Responsive Behavior

- Refresh status uses text, not color alone, and is exposed through a polite live region.
- The launcher and close buttons have explicit accessible labels.
- The floating window has a dialog-style label but is non-modal because the page remains interactive.
- Escape closes only the chat window.
- Keyboard focus moves into the chat when it opens and returns to the launcher when it closes.
- The chat never exceeds the viewport width or height at mobile breakpoints.

## Testing and Verification

- Backend unit/integration tests prove account balances are updated during sync and analytics are computed after refreshed balances are stored.
- Frontend tests cover the refresh-state reducer/helper: idle, refreshing, success, and failure/retry behavior.
- Component behavior tests or focused browser verification confirm the advisor is closed initially, opens from the launcher, has no backdrop, closes with Escape, and retains state after reopening.
- Dashboard verification confirms one account still renders an account row and the balance card no longer stretches into a large empty region.
- Run frontend tests, lint, and production build; backend tests, typecheck, and build; AI tests; and desktop/mobile browser checks.

## Scope Limits

- No real-time sockets, polling loop, scheduled background job, or persistent chat-open preference.
- No new dashboard analytics widgets beyond the balance-card details already supported by current data.
- No redesign of Transactions, Reports, Settings, or Financial Health.
- No change to the advisor API or AI prompt behavior.
