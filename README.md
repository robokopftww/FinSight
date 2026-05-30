# FinSight

FinSight is an AI-powered financial copilot that helps users understand spending behavior, predict upcoming cash flow issues, and receive personalized recommendations before problems occur.

## Product Pillars

- Secure account aggregation with Plaid sandbox for MVP
- Modern fintech dashboard experience inspired by Stripe, Mercury, Ramp, and Robinhood
- Analytics-first AI stack where Python computes financial intelligence and the LLM explains it
- Production-minded monorepo structure with isolated frontend, backend, and AI service boundaries

## Repository Structure

```text
FinSight/
├── frontend/      # Next.js 15 marketing site and authenticated product UI
├── backend/       # Node.js + TypeScript API, data orchestration, Plaid, Redis, Prisma
├── ai-service/    # FastAPI analytics and LLM orchestration
├── README.md
├── PROJECT_REQUIREMENTS.md
└── ARCHITECTURE.md
```

## Core User Flows

1. A user signs in with Clerk.
2. The backend stores the user profile and Plaid-linked account metadata.
3. Transactions are synced, normalized, categorized, and cached.
4. The AI service computes forecasts, scores, anomalies, and grounded insight inputs.
5. FinSight renders dashboards, subscriptions, forecasts, and chat responses using those analytics.

## MVP Scope

- Landing page
- Authenticated dashboard
- Transactions explorer
- Subscription intelligence
- Financial health scoring
- Cash flow forecasting
- AI insights and advisor chat

## Delivery Approach

- Phase 1: architecture, repo scaffolding, base design system
- Phase 2: auth, backend, persistence, Plaid sandbox sync
- Phase 3: analytics engine and AI explanations
- Phase 4: polish, test coverage, deployment hardening

## Local Setup

See [SETUP.md](/Users/keshavtyagi/Documents/FinSight/SETUP.md) for the auth, PostgreSQL, Redis, Prisma, and Clerk setup flow.

See [ARCHITECTURE.md](/Users/keshavtyagi/Documents/FinSight/ARCHITECTURE.md) for the technical blueprint.
