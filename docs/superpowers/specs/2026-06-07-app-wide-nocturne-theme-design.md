# App-Wide Nocturne Theme Design

## Goal

Apply the landing page's Nocturne color palette across every WealthLens page without changing layouts, spacing, shapes, or workflows.

## Palette

- Base background: `#070d1a`
- Elevated dark surface: `#0a1222`
- Primary accent: `#a7c3ff`
- Primary hover: `#8fb0ff`
- Accent text: `#dbe6ff`
- Accent border: translucent periwinkle
- Body text and muted text remain white/slate for readability.
- Warning and error states remain amber and rose.

## Implementation

Global CSS variables become the source of truth for backgrounds, accents, accent-soft surfaces, borders, and text. Shared components use those variables. Existing hardcoded mint and emerald utility classes are replaced with arbitrary Tailwind values backed by semantic CSS variables.

Charts and decorative data colors switch their primary mint series to periwinkle while retaining contrasting category colors. Auth pages, dialogs, the advisor drawer, and app shell use the same midnight surfaces.

## Verification

Run frontend lint and build. Inspect the landing page, demo, dashboard, transactions, subscriptions, financial health, reports, settings, and auth screens at desktop and mobile widths. Confirm no mint/emerald theme remnants remain except semantically independent data colors if intentionally retained.
