# Dashboard Advisor Drawer Design

## Goal

Make WealthLens Advisor an immediately visible dashboard chatbot instead of a separate application page.

## Interaction

- The advisor exists only on `/dashboard`.
- It opens automatically every time the dashboard is loaded.
- It appears as a full-height right-side drawer, approximately 480px wide on desktop.
- The drawer overlays the dashboard and does not resize dashboard content.
- Closing lasts for the current dashboard visit only.
- While closed, a bottom-right floating chat button reopens it.
- Backdrop click and Escape close the drawer.
- On mobile, the drawer occupies nearly the full viewport width.

## Chat Behavior

- Reuse the existing advisor chat API, history loading, saved messages, starter prompts, clear history, financial data-point cards, and source labels.
- History loads when the drawer mounts, so reopening does not restart the chat.
- The input remains pinned to the bottom while messages scroll.
- Starter prompts are compact chips inside the drawer rather than a separate desktop sidebar.

## Surface Cleanup

- Remove Advisor from the AppShell navigation.
- Delete the separate `/advisor` page.
- Remove the static advisor preview from the dashboard.
- Keep backend `/api/advisor/*` endpoints unchanged.

## Testing

- Frontend typecheck, lint, and production build.
- Verify the `/advisor` route is absent from the build output.
- Browser-check auto-open, close button, backdrop/Escape close, and floating-button reopen when an authenticated browser session is available.
