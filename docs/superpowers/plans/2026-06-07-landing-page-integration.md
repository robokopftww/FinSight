# Landing Page Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the public WealthLens homepage with the supplied landing frontend as native Next.js code.

**Architecture:** Keep the integration local to `frontend/app/page.tsx`, `frontend/app/globals.css`, and the public hero video asset. Convert prototype globals and browser-Babel code into typed React JSX, use `lucide-react` icons, and retain real app links.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4 global CSS, lucide-react.

---

### Task 1: Port Landing Page

**Files:**
- Modify: `frontend/app/page.tsx`
- Modify: `frontend/app/globals.css`
- Create: `frontend/public/uploads/14968848_1920_1080_30fps.mp4`

- [ ] Replace the existing homepage with typed data arrays and section components based on the supplied `sections.jsx`.
- [ ] Add a production header with real app links and no tweak controls.
- [ ] Add the hero video background with CSS overlays and responsive fallbacks.
- [ ] Add landing-specific global classes prefixed with `wl-landing`.
- [ ] Run `npm run lint --workspace frontend`.
- [ ] Run `npm run build --workspace frontend`.
- [ ] Start `npm run dev --workspace frontend` and inspect `/` at desktop and mobile widths.
