# Landing Auth Overlay Design

## Goal

Show sign-in and sign-up as modal-style overlays above the WealthLens landing page instead of replacing the entire screen.

## Behavior

- `/sign-in` and `/sign-up` render the real landing page beneath the auth form.
- The landing page is visually blurred, dimmed, and non-interactive while auth is open.
- The Clerk form is centered above the backdrop and remains usable on mobile.
- A close icon returns to `/`.
- Clerk's sign-in/sign-up links continue switching between auth routes while preserving the same overlay experience.
- Direct links, refreshes, and protected-route redirects continue to work.

## Architecture

A reusable `AuthOverlayShell` component renders the landing page in an inert background layer, then renders a fixed modal layer containing Clerk. Auth routes pass their Clerk form into the shell. The overlay uses CSS backdrop blur and a dark translucent wash.

## Verification

Run frontend lint and build. Verify `/sign-in` and `/sign-up` directly, confirm the landing page remains visible behind the form, verify the close button returns home, and check desktop/mobile overflow and contrast.
