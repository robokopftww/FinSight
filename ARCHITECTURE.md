# FinSight Architecture

FinSight is a three-service financial analytics product. The frontend handles product experience, the backend owns auth-aware data orchestration, and the Python service owns forecasting, scoring, anomaly detection, and LLM grounding.

## High-Level System

```mermaid
flowchart TD
    Browser["Browser"] --> Frontend["Frontend: Next.js App Router"]
    Frontend --> Clerk["Clerk"]
    Frontend --> Backend["Backend: Fastify + TypeScript"]
    Backend --> Prisma["Prisma ORM"]
    Prisma --> Postgres[("PostgreSQL")]
    Backend --> Plaid["Plaid Sandbox"]
    Backend --> AI["AI Service: FastAPI"]
    AI --> Analytics["Pandas + NumPy + Scikit-learn"]
    AI --> Gemini["Gemini LLM"]
```

## Service Boundaries

### Frontend

The frontend is responsible for the user-facing product:

- Landing page and public demo mode
- Clerk sign-in and sign-up pages
- Authenticated app shell and sidebar navigation
- Dashboard, transactions, subscriptions, health, advisor, reports, and settings pages
- Plaid Link launch flow
- Recharts visualizations
- Advisor chat interface and report presentation

The frontend talks only to the backend API. It does not call Plaid, PostgreSQL, or Gemini directly.

### Backend

The backend is the trusted application layer:

- Verifies Clerk sessions
- Upserts Clerk users into PostgreSQL
- Creates Plaid Link tokens
- Exchanges Plaid public tokens for access tokens
- Syncs Plaid accounts, balances, and transactions
- Normalizes financial records into Prisma models
- Routes analytics requests to the Python service
- Persists advisor chat history
- Provides settings controls for sandbox cleanup and Plaid disconnect
- Falls back to TypeScript analytics if the Python service is unavailable

### AI Service

The Python service owns analytics and AI composition:

- Financial health scoring
- Cash-flow forecasting
- Safe-to-spend calculation
- Weekly report metrics
- Goal planning calculations
- Advisor context generation
- Transaction categorization suggestions
- Gemini prompt construction and response generation

Gemini is used after the analytics layer has computed grounded facts. If `GEMINI_API_KEY` is missing, the service returns deterministic analytics explanations.

## Data Flow

### Plaid Connection

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Plaid
    participant Postgres

    User->>Frontend: Click Connect bank
    Frontend->>Backend: POST /api/plaid/link-token
    Backend->>Plaid: Create Link token
    Plaid-->>Backend: link_token
    Backend-->>Frontend: link_token
    User->>Plaid: Complete Plaid Link
    Plaid-->>Frontend: public_token
    Frontend->>Backend: POST /api/plaid/exchange-public-token
    Backend->>Plaid: Exchange public token
    Backend->>Postgres: Store Plaid item and accounts
```

### Transaction Sync

```mermaid
sequenceDiagram
    participant Frontend
    participant Backend
    participant Plaid
    participant Postgres

    Frontend->>Backend: POST /api/plaid/sync
    Backend->>Plaid: Fetch accounts and transactions
    Backend->>Backend: Normalize amounts, direction, categories
    Backend->>Postgres: Upsert accounts and transactions
    Backend-->>Frontend: Sync summary
```

### Advisor Chat

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant AI
    participant Gemini
    participant Postgres

    User->>Frontend: Ask financial question
    Frontend->>Backend: POST /api/advisor/chat
    Backend->>Postgres: Load synced financial context
    Backend->>AI: POST /analytics/chat
    AI->>AI: Calculate affordability, risk, goal, or spending context
    AI->>Gemini: Generate grounded explanation when configured
    Gemini-->>AI: Explanation
    AI-->>Backend: Answer + facts + source label
    Backend->>Postgres: Save chat history
    Backend-->>Frontend: Advisor response
```

## Data Model

Core Prisma models:

- `User` - Clerk-linked application user
- `PlaidItem` - Plaid item and encrypted access-token boundary for MVP
- `Account` - Plaid account metadata and balances
- `Transaction` - normalized transaction history
- `Subscription` - recurring merchant estimates
- `FinancialScore` - score snapshots and factors
- `Forecast` - forecast snapshots by horizon
- `Insight` - generated insight cards
- `ChatHistory` - persisted advisor conversation history

## Backend API Surface

Auth:

- `POST /api/auth/sync-user`
- `GET /api/auth/me`

Plaid:

- `GET /api/plaid/status`
- `POST /api/plaid/link-token`
- `POST /api/plaid/exchange-public-token`
- `POST /api/plaid/sync`

Product:

- `GET /api/dashboard/overview`
- `GET /api/transactions`
- `PATCH /api/transactions/:id/category`
- `GET /api/subscriptions`
- `GET /api/financial-health`
- `GET /api/forecast`
- `GET /api/reports/weekly`

Advisor:

- `POST /api/advisor/chat`
- `GET /api/advisor/history`
- `DELETE /api/advisor/history`

Settings:

- `GET /api/settings/status`
- `DELETE /api/settings/plaid-connection`
- `DELETE /api/settings/sandbox-data`

## AI Service API Surface

- `GET /health`
- `POST /analytics/score`
- `POST /analytics/forecast`
- `POST /analytics/insights`
- `POST /analytics/summary`
- `POST /analytics/report`
- `POST /analytics/chat`
- `POST /analytics/categorize`

## Analytics Strategy

### Financial Health

The score combines:

- Savings rate
- Spending volatility
- Subscription burden
- Emergency fund runway
- Forecast risk

### Forecasting

The forecast engine starts with deterministic time-series baselines using recent transaction behavior, balance data, and projected outflows. This keeps the MVP understandable and testable while leaving room for more advanced models later.

### Advisor Logic

Advisor questions are routed through analytics first:

- Purchase affordability questions use safe-to-spend and projected balances.
- Goal questions calculate target amount, deadline, monthly requirement, surplus, and gap.
- Risk questions identify top category pressure, low-balance risk, and spending imbalance.
- General questions summarize the current financial snapshot.

The LLM receives only a compact context object with calculated facts and is instructed to explain those facts, not invent new numbers.

## Fallback Strategy

FinSight is designed to keep working during local development:

- If Gemini is missing, Python returns deterministic local explanations.
- If the AI service is offline, the backend uses TypeScript analytics fallbacks.
- If Plaid is not configured, the UI shows setup status instead of failing silently.
- Demo mode is public and does not require Clerk or Plaid.

## Deployment Shape

Recommended MVP deployment:

- Frontend: Vercel
- PostgreSQL: Neon
- Redis: Upstash or optional off for MVP
- Backend API: Render, Railway, Fly.io, or a container host
- AI service: Render, Railway, Fly.io, or a container host
- Auth: Clerk
- Financial data: Plaid sandbox first, production later

See `DEPLOYMENT.md` for the deployment checklist.
