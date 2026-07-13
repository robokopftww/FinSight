# CLAUDE.md

Guidance for Claude Code working in this repo. Read `ARCHITECTURE.md` for the full system design; this file is the operating contract — where code goes, how to build it, and what not to break.

## What WealthLens Is

Three-service financial analytics product:

| Service | Path | Stack | Owns |
|---------|------|-------|------|
| **Frontend** | `frontend/` | Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, Clerk, Recharts | Product UI, auth pages, Plaid Link launch, charts, advisor chat |
| **Backend** | `backend/` | Fastify 5, TypeScript (ESM), Prisma 6, PostgreSQL, Plaid, Zod, ioredis | Trusted app layer: auth verify, Plaid sync, data orchestration, analytics routing |
| **AI service** | `ai-service/` | FastAPI, Python 3.11, pandas/numpy/scikit-learn, Gemini (`google-genai`) | Scoring, forecasting, insights, categorization, LLM grounding |

`frontend` and `backend` are npm workspaces (see root `package.json`). `ai-service` is a standalone Python venv.

## Hard Boundaries — Do Not Cross

- **Frontend talks only to the backend API.** Never call Plaid, PostgreSQL, Gemini, or the AI service directly from the frontend. All data goes through `frontend/lib/api.ts` → backend.
- **Backend is the only trusted layer.** Clerk session verification, Plaid access tokens, and DB writes live here. Never move secrets or token exchange into the frontend.
- **AI service computes facts, then grounds the LLM.** The analytics layer produces numbers first; Gemini only explains them. Never let the LLM invent figures — pass a compact context object of pre-computed facts.
- **The frontend never imports backend code and vice versa.** They share nothing but the HTTP contract.

## Where Code Goes

### Backend (`backend/src/`)
- `lib/` — shared services: `prisma.ts`, `plaid.ts`, `auth.ts`, `redis.ts`, `ai-service.ts`, `financial-analytics.ts` (TS fallback), `analytics-persistence.ts`, `profile.ts`, `mock-data.ts`. Put reusable logic here, not in routes.
- `modules/<domain>/routes.ts` — domain route handlers (e.g. `auth/`, `plaid/`). Register in `routes/index.ts`.
- `config/env.ts` — env access. Read env through here, not `process.env` scattered.
- `app.ts` — Fastify app assembly (plugins: cors, helmet, rate-limit, Clerk). `index.ts` — server bootstrap.
- New endpoint → add to a `modules/<domain>/routes.ts`, validate input with Zod, keep business logic in `lib/`, update the API surface list in `ARCHITECTURE.md`.

### AI service (`ai-service/`)
- One package per capability: `scoring/`, `forecasting/`, `insights/`, `categorization/`, `llm/` — each with a `service.py`.
- `schemas/` — Pydantic request/response models. `api/routes.py` — FastAPI routes wired in `main.py`.
- New analytics capability → new package + `service.py`, Pydantic schema in `schemas/`, route in `api/routes.py`, test in `tests/`.

### Frontend (`frontend/`)
- `app/<route>/page.tsx` — App Router pages. Dynamic Clerk routes under `sign-in/`, `sign-up/`.
- `components/` — feature components (kebab-case files). `components/ui/` — primitives (`button.tsx`, `panel.tsx`). `components/charts/` — Recharts wrappers.
- `lib/api.ts` — single source of backend calls. `lib/utils.ts`, `lib/clerk-*.ts`, `lib/mock-data.ts`.
- New page → `app/<route>/page.tsx`, compose existing components, fetch via `lib/api.ts`.

## Data Model

Prisma schema: `backend/prisma/schema.prisma`. Core models: `User` (Clerk-linked), `PlaidItem`, `Account`, `Transaction`, `Subscription`, `FinancialScore`, `Forecast`, `Insight`, `ChatHistory`.

- Schema change → edit `schema.prisma`, run `npm run db:migrate --workspace backend` (creates a migration), then `db:generate`. Never hand-edit files in `prisma/migrations/`.
- IDs are `cuid()`. Money is `Decimal(12,2)`. Enums (`InsightSeverity`, `InsightType`, `SubscriptionStatus`) live in the schema — extend there, not with raw strings.

## Fallback Strategy — Keep It Working

The app must degrade, never hard-fail, in local dev:
- Gemini key missing → AI service returns deterministic explanations.
- AI service offline → backend uses `lib/financial-analytics.ts` TS fallback.
- Plaid unconfigured → UI shows setup status, doesn't crash.
- Demo mode (`app/demo/`) is public — no Clerk, no Plaid.

Preserve every fallback when changing analytics or integration code.

## Commands

Run from repo root unless noted.

```bash
# Dev
npm run dev:frontend          # Next dev
npm run dev:backend           # Fastify (tsx watch)
npm run dev:ai                # FastAPI on :8000

# Backend DB
npm run db:generate --workspace backend
npm run db:migrate --workspace backend
npm run db:studio --workspace backend

# Verify (match CI before claiming done)
npm run lint:frontend
npm run build:frontend
npm run typecheck:backend
npm run test:backend          # vitest
npm run build:backend
npm run test:ai               # pytest (cd ai-service)
```

CI (`.github/workflows/ci.yml`) runs three jobs: frontend (lint + build), backend (prisma generate + typecheck + test + build), ai-service (pytest). **A change isn't done until the matching jobs pass locally.**

## Conventions

- **Backend is ESM** (`"type": "module"`) — use `import`, include extensions where required by the resolver.
- **Validate at the edge** with Zod in routes; trust validated data inward.
- **Tests:** backend → Vitest in `backend/tests/*.test.ts`; AI → pytest in `ai-service/tests/`. Add a test for new analytics logic and route payloads.
- **Frontend files** are kebab-case; components are typed React 19 function components.
- **Env:** never commit secrets. Reference `*.env.example` files; backend reads env via `config/env.ts`.
- Keep `ARCHITECTURE.md` API-surface and data-model sections in sync when you add endpoints or models.

## When Planning Work

Design specs and plans live in `docs/superpowers/specs/` and `docs/superpowers/plans/`. Check there for context on in-flight features before starting related work.
