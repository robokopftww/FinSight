# Light Theme and Balance History Design

## Goal

Refresh WealthLens as a bright, resume-ready finance product by applying a cohesive light theme across the frontend, moving bank connection controls out of the dashboard, and giving historical balance movement a prominent dashboard visualization.

## Scope

This change covers the landing page, authentication surfaces, demo mode, authenticated application pages, shared UI components, and charts. It does not add true historical net-worth snapshots, new bank data, budgeting features, or a dark-mode toggle.

## Visual Direction

The application will use a white and soft-gray canvas with white cards, restrained shadows, dark navy text, and visible neutral borders. Saturated blue remains the main action and navigation color. Financial movement uses semantic color consistently:

- Green represents increases, income, healthy movement, and positive trends.
- Red represents decreases, spending, risk, and negative trends.
- Amber remains available for warnings and review states.
- Blue represents neutral product actions and informational analytics.

The theme should feel energetic without turning into a gradient-heavy or game-like interface. Numbers remain the visual focus. Contrast must remain readable on all cards, inputs, charts, overlays, and authentication screens.

Shared design tokens and primitives will establish the light palette. Existing hard-coded dark utilities will be replaced where required so every frontend route follows the same theme rather than relying on fragile global overrides.

## Dashboard Changes

The dashboard will no longer render `BankConnectionPanel`. The current balance, credit-card summary, income, savings, spending, forecast, spending mix, and insight feed remain.

The small six-bar balance strip inside the current-balance card will be removed. A new full-width `BalanceHistoryChart` panel will appear near the top of the dashboard, after the primary balance and credit-card cards and before secondary metrics. It will use the existing `balanceTrend` data returned by the dashboard API.

The chart will:

- Be titled **Balance over time**.
- Plot the existing six-month cash-balance series as a responsive Recharts area chart.
- Display formatted currency values in its tooltip and vertical scale.
- Show the total period change as a dollar amount and percentage.
- Render the change in green when the ending balance is at least the starting balance and red when it is lower.
- Use a bright blue line with a light blue area fill so the series remains neutral while the summary communicates direction.
- Show a clear empty state when fewer than two historical points are available.

The chart is intentionally described as cash balance history, not true net worth. The backend already reconstructs the six-month series from current depository balances and synced transactions; no schema or API calculation change is required.

## Settings Changes

`BankConnectionPanel` will move to the Settings page above the settings control center. It remains responsible for creating a Plaid Link session, adding another institution, and manually syncing transactions.

The existing Plaid section inside `SettingsControlCenter` will be reframed as **Connected institutions**. It will retain institution details and disconnect controls, while duplicate sync controls and redundant general connection status copy will be removed. This keeps setup actions and ongoing institution management together without showing bank configuration on every dashboard visit.

## Component Boundaries

- `globals.css` owns the application and landing-page color tokens and global light surfaces.
- Shared UI primitives such as `Panel` and `Button` own reusable light card and control styles.
- Existing feature components receive targeted color-class updates without unrelated structural refactoring.
- `BalanceCard` continues to summarize the current cash position and account breakdown but no longer renders historical bars.
- New `BalanceHistoryChart` owns chart rendering, period-change calculation, tooltip formatting, and its empty state.
- `DashboardPage` owns placement of the history panel and passes `balanceTrend` into it.
- `SettingsPage` owns placement of `BankConnectionPanel`.

## Data Flow

1. The dashboard requests `/api/dashboard/overview` as it does today.
2. The backend returns the existing `balanceTrend` array of `{ label, balance }` points.
3. `DashboardPage` passes the array to `BalanceHistoryChart`.
4. The chart derives start balance, end balance, dollar change, percentage change, and direction locally.
5. No financial records are created or modified by the chart.

## Error and Empty States

- A missing or one-point balance history displays an explanatory empty state instead of a misleading line.
- Zero starting balance displays a dollar change and omits an invalid percentage.
- Bank configuration errors remain contained within Settings.
- Existing Plaid, backend, and AI fallbacks remain unchanged.

## Testing and Verification

- Add focused tests for the balance-history change calculation, including positive, negative, zero-start, and insufficient-data cases.
- Run existing backend tests to ensure dashboard analytics behavior remains intact.
- Run frontend lint and production build.
- Visually inspect the landing page, authentication pages, demo, dashboard, transactions, subscriptions, financial health, reports, settings, advisor drawer, overlays, and responsive layouts in the light theme.
- Confirm financial gains use green and losses use red in metric cards and the new history summary.
- Confirm the dashboard no longer contains bank connection controls and Settings supports connect, sync, add institution, and disconnect workflows.

## Out of Scope

- Persisted balance or net-worth snapshots
- Investment and liability history
- New dashboard API endpoints
- Theme switching or dark-mode preference storage
- Plaid webhook or background-sync changes
- Unrelated dashboard feature additions
