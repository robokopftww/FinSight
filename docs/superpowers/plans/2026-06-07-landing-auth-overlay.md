# Landing Auth Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render Clerk authentication as a modal overlay above the real landing page.

**Architecture:** Add a reusable server-rendered auth overlay shell that composes the landing page background with a fixed blurred modal layer. Keep `/sign-in` and `/sign-up` as canonical routes so direct navigation and Clerk redirects remain reliable.

**Tech Stack:** Next.js App Router, React, Clerk, Tailwind CSS, lucide-react.

---

### Task 1: Add Auth Overlay Shell

**Files:**
- Create: `frontend/components/auth-overlay-shell.tsx`
- Modify: `frontend/app/page.tsx`

- [ ] Export the landing page component for reuse.
- [ ] Render it inert beneath a fixed blur/dim overlay.
- [ ] Add an accessible close link back to `/`.

### Task 2: Update Auth Routes

**Files:**
- Modify: `frontend/app/sign-in/[[...sign-in]]/page.tsx`
- Modify: `frontend/app/sign-up/[[...sign-up]]/page.tsx`

- [ ] Wrap Clerk sign-in and sign-up in the shared overlay shell.
- [ ] Preserve redirect and cross-auth route behavior.

### Task 3: Verify

- [ ] Run `npm run lint --workspace frontend`.
- [ ] Run `npm run build --workspace frontend`.
- [ ] Verify `/sign-in` and `/sign-up` at desktop and mobile widths.
