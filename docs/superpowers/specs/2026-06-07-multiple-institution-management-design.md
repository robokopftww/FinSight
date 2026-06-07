# Multiple Institution Management Design

## Goal

Allow a FinSight user who already connected one institution to add more institutions and disconnect each institution independently.

## User Experience

- The dashboard connection panel always offers an action to open Plaid Link:
  - no connections: `Connect bank`
  - one or more connections: `Add another institution`
- The dashboard keeps a single `Sync` action that synchronizes every connected Plaid Item.
- Settings lists connected institutions individually with account count, last sync time, and a `Disconnect` action.
- Disconnect confirmation names the institution. Removing one institution leaves all other institutions and their data intact.

## Backend

- Extend `GET /api/plaid/status` with an `institutions` array containing the app-owned Plaid Item ID, institution name, account count, and last sync time.
- Add `DELETE /api/plaid/items/:itemId`.
- The delete route looks up the Plaid Item using both `itemId` and authenticated `userId`. A missing or foreign Item returns `404`.
- Delete the owned Plaid Item. Existing cascade relations remove only its accounts and their transactions.
- Keep the existing all-connections reset route for the broader data-reset workflow, but remove it from ordinary bank management UI.

## Testing

- Unit-test the owned-item lookup/delete helper with two users and multiple Items.
- Verify dashboard and Settings typecheck, lint, and production build.
- Verify the full backend suite.
