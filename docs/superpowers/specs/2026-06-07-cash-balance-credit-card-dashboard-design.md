# Cash Balance and Credit Card Dashboard Design

## Goal

Make the dashboard distinguish spendable cash from credit-card debt and add a dedicated credit-card payments view.

## Account Classification

- Cash accounts are Plaid accounts with `type === "depository"`.
- Credit-card accounts are Plaid accounts with `type === "credit"`.
- Investments, loans, and other account types do not contribute to the cash balance.
- Classification uses Plaid account metadata, never account names.

## Dashboard Behavior

- `Current balance` becomes cash only.
- Its account breakdown contains only cash accounts.
- Balance trend, month-over-month change, forecast, safe-to-spend, emergency runway, and health-score cash input use the cash-only balance.
- Add a `Credit card payments due` card beside the cash balance.
- The card shows total outstanding credit balance and a per-card breakdown.
- Statement balance, minimum payment, and due date are shown when available. Until Plaid Liabilities syncing is implemented, the card clearly says those details are unavailable.

## Data Shape

The dashboard summary adds:

- `creditCardBalance`: total outstanding credit-card balance.
- `creditCards`: card name, mask, outstanding balance, statement balance, minimum payment, and due date.
- `creditCardDetailsAvailable`: whether Liabilities payment details are available.

## Testing

- Verify credit balances are excluded from cash.
- Verify non-depository assets are excluded from cash.
- Verify credit cards are identified by `type`.
- Verify credit-card totals and breakdown.
- Run full backend and frontend verification.
