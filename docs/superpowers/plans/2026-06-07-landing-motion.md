# Landing Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one-shot hero video playback and one-shot viewport reveal animations to the landing page.

**Architecture:** Use a focused client component with one `IntersectionObserver`. Mark revealable server-rendered elements with data attributes and implement the visual states in scoped landing CSS.

**Tech Stack:** Next.js App Router, React, TypeScript, CSS, IntersectionObserver.

---

### Task 1: Add Landing Motion

**Files:**
- Create: `frontend/components/landing-effects.tsx`
- Modify: `frontend/app/page.tsx`
- Modify: `frontend/app/globals.css`

- [ ] Remove the hero video's `loop` attribute.
- [ ] Add a client-side observer that reveals marked elements once.
- [ ] Mark all below-hero panels and cards with reveal data attributes and stagger values.
- [ ] Add initial, visible, and reduced-motion CSS states.
- [ ] Run `npm run lint --workspace frontend`.
- [ ] Run `npm run build --workspace frontend`.
- [ ] Verify video and scroll behavior at desktop and mobile widths.
