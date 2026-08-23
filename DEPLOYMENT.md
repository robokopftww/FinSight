# WealthLens Deployment Checklist

This is the practical path to move WealthLens from local development to a public MVP.

## Recommended Hosting

- Frontend: Vercel
- PostgreSQL: Neon
- Backend API: Render, Railway, or Fly.io
- AI service: Render, Railway, or Fly.io
- Redis: Upstash, optional for the current MVP
- Auth: Clerk
- Banking data: Plaid sandbox

## Free Render Option

If Render asks for a card before creating a second Web Service, run the backend and AI service together in one free Render Web Service.

Use these settings:

```bash
Root Directory:
Build Command: bash scripts/render-combined-build.sh
Start Command: bash scripts/render-combined-start.sh
```

Leave Root Directory blank so Render builds from the repo root.

Set:

```bash
NODE_ENV=production
DATABASE_URL=
FRONTEND_URL=https://your-vercel-domain.vercel.app
CLERK_SECRET_KEY=
CLERK_PUBLISHABLE_KEY=
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
ADVISOR_TOOL_SECRET=
PYTHON_VERSION=3.11.9
```

Do not set `AI_SERVICE_URL` in this combined setup. The start script points the backend to the internal Python service automatically.

The public Render URL will be the backend API URL. The Python service runs privately inside the same instance.

## 1. Prepare GitHub

Make sure the repo is pushed and `.env` files are not committed. GitHub Actions will run the frontend, backend, and AI service checks after each push.

```bash
git status
git add .
git commit -m "Prepare WealthLens MVP for deployment"
git push
```

## 2. Create Production-Like Services

Create:

- A Neon PostgreSQL database
- A Clerk application for the deployed frontend URL
- A Plaid sandbox app
- An Anthropic API key (Claude Haiku 4.5)
- An OpenAI API key (`text-embedding-3-small`)
- A 32+ byte hex `ADVISOR_TOOL_SECRET` shared between backend and (only) backend
- A backend hosting service
- An AI service hosting service
- A Vercel project for `frontend`

## 3. Backend Environment

Set these in the backend host:

```bash
PORT=4000
NODE_ENV=production
DATABASE_URL=
REDIS_URL=
FRONTEND_URL=https://your-vercel-domain.vercel.app
CLERK_SECRET_KEY=
CLERK_PUBLISHABLE_KEY=
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox
AI_SERVICE_URL=https://your-ai-service-host
ADVISOR_TOOL_SECRET=       # 32+ byte hex, generate with `openssl rand -hex 32`
```

Before first deploy, enable pgvector on the Neon database (Neon SQL editor):

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Build and start commands:

```bash
npm install
npm run build --workspace backend
npm run start --workspace backend
```

Before first deploy, run Prisma migrations against Neon:

```bash
cd backend
npx prisma migrate deploy
```

## 4. AI Service Environment

Set these in the AI service host:

```bash
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
DATABASE_URL=              # same Neon URL the backend uses
BACKEND_URL=https://your-backend-host
```

Seed the corpus once after the pgvector migration lands (from a shell with `DATABASE_URL` + `OPENAI_API_KEY` set):

```bash
cd ai-service && python -m rag.ingest
```

Install and start commands:

```bash
pip install -r ai-service/requirements.txt
cd ai-service
uvicorn main:app --host 0.0.0.0 --port $PORT
```

Confirm:

```bash
curl https://your-ai-service-host/health
```

## 5. Frontend Environment

Set these in Vercel:

```bash
NEXT_PUBLIC_API_BASE_URL=https://your-backend-host
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard
```

Vercel settings:

- Root directory: `frontend`
- Build command: `npm run build`
- Output: Next.js default

## 6. Clerk URLs

In Clerk, add the deployed URLs:

- Sign-in URL: `/sign-in`
- Sign-up URL: `/sign-up`
- After sign-in URL: `/dashboard`
- After sign-up URL: `/dashboard`
- Allowed origins: frontend Vercel domain

## 7. Plaid URLs

For sandbox, keep `PLAID_ENV=sandbox`.

When moving beyond sandbox:

- Request Plaid production access
- Complete Plaid compliance steps
- Add production redirect and allowed origins
- Re-review token handling and data deletion flows

## 8. Smoke Test

After deploy:

- Open landing page.
- Open `/demo` without signing in.
- Sign up with Clerk.
- Connect Plaid sandbox.
- Sync transactions.
- Open dashboard, transactions, subscriptions, health, reports, advisor, and settings.
- Ask advisor: `Can I spend $1,000?`
- Ask advisor: `I want to save $5,000 by December 31, 2026.`
- Confirm `/settings` shows backend, database, Plaid, and AI status.

## 9. Next Production Hardening

- Add CI for lint, typecheck, and build.
- Add backend API tests.
- Add analytics unit tests.
- Encrypt Plaid access tokens before storing them.
- Add Plaid webhooks for background sync.
- Add rate limiting to advisor endpoints.
- Add structured logs and error tracking.
- Add account deletion and data export flows.
