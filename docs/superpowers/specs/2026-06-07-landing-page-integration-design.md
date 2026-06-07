# Landing Page Integration Design

## Goal

Integrate the supplied WealthLens landing prototype into the existing app as the public `/` page only.

## Scope

- Replace `frontend/app/page.tsx` with a native Next.js/React version of the supplied landing page.
- Preserve existing product routes, dashboard pages, auth pages, backend integration, and app shell behavior.
- Exclude the prototype-only tweaks panel from production.
- Use the supplied hero video as a public asset when available.

## Architecture

The landing page remains a server component using typed data arrays and JSX sections in `frontend/app/page.tsx`. Styling is scoped through `wl-landing-*` class names added to `frontend/app/globals.css`, so dashboard components and shared UI styling are not altered.

Navigation uses real app destinations:

- Brand: `/`
- Feature anchors: `#features`, `#intelligence`, `#pricing`
- Demo CTA: `/demo`
- Sign-in: `/sign-in`
- Product CTAs: `/demo`, `/dashboard`, `/financial-health`

## Data And Components

Static marketing data from the supplied `sections.jsx` is converted into TypeScript arrays. Icons use `lucide-react` instead of prototype globals. The hero video renders as a muted, inline, auto-playing background with gradient and grid overlays; if it fails to load, the CSS background remains usable.

## Verification

Run frontend lint and build. Start the Next.js dev server and inspect `/` in browser at desktop and mobile widths for layout, link behavior, video rendering, text fit, and console/runtime errors.
