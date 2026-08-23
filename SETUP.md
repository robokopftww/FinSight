# WealthLens Local Setup

Use this guide when you have closed everything and want to boot the app again from scratch.

## 1. Open The Project

```bash
cd /Users/keshavtyagi/Documents/WealthLens
```

## 2. Install Dependencies

From the repo root:

```bash
npm install
```

Create the Python virtual environment once:

```bash
python3 -m venv ai-service/.venv
ai-service/.venv/bin/python -m pip install -r ai-service/requirements.txt
```

## 3. Create Env Files

```bash
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env
cp ai-service/.env.example ai-service/.env
```

Do not commit the real `.env` files.

## 4. Configure PostgreSQL

For Postgres.app, make sure the app is open and running. A typical local URL looks like:

```bash
DATABASE_URL=postgresql://keshavtyagi@localhost:5432/finsight
```

Put that value in `backend/.env`.

Then create the database if needed:

```bash
createdb finsight
```

Run Prisma:

```bash
cd backend
npm run db:generate
npm run db:migrate -- --name init
cd ..
```

## 5. Configure Clerk

Put Clerk keys in `frontend/.env.local`:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

Put Clerk keys in `backend/.env`:

```bash
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

In Clerk, set local URLs:

- Sign-in URL: `/sign-in`
- Sign-up URL: `/sign-up`
- After sign-in: `/dashboard`
- After sign-up: `/dashboard`

## 6. Configure Plaid

Put Plaid sandbox keys in `backend/.env`:

```bash
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox
```

Plaid sandbox is enough for the MVP. You do not need Plaid production access yet.

## 7. Configure the RAG advisor

Put your Anthropic and OpenAI keys in `ai-service/.env`:

```bash
ANTHROPIC_API_KEY=       # Claude Haiku 4.5 for the tool-calling loop
OPENAI_API_KEY=          # text-embedding-3-small (1536-dim) for chunk + query embeddings
DATABASE_URL=            # same Postgres as backend; must have the `vector` extension enabled
BACKEND_URL=http://127.0.0.1:4000   # ai-service calls backend for personal-data tools
```

Match `ADVISOR_TOOL_SECRET` in `backend/.env`:

```bash
ADVISOR_TOOL_SECRET=     # 32+ byte hex, generate with `openssl rand -hex 32`
AI_SERVICE_URL=http://127.0.0.1:8000
```

Enable pgvector on the database (once per DB):

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Seed the knowledge-base corpus (CFPB / IRS PDFs):

```bash
cd ai-service && python -m rag.ingest
```

WealthLens still runs without the Anthropic key. If it is missing, advisor replies fall back to a configured message; deterministic analytics keep working.

## 8. Start The App

Use three terminal windows from the repo root.

Terminal 1:

```bash
npm run dev:backend
```

Backend should run at `http://127.0.0.1:4000`.

Terminal 2:

```bash
npm run dev:ai
```

AI service should run at `http://127.0.0.1:8000`.

If port 8000 is already in use, the AI service is probably already running.

Terminal 3:

```bash
npm run dev:frontend
```

Frontend should run at `http://localhost:3000`.

If port 3000 is already in use, Next.js may choose `http://localhost:3001`. The terminal output will show the active URL.

## 9. Verify Everything

Open:

```text
http://localhost:3000
```

Useful routes:

- `/demo` - public demo mode
- `/dashboard` - financial overview
- `/transactions` - synced transaction table
- `/subscriptions` - recurring spend analysis
- `/financial-health` - score and recommendations
- `/advisor` - Claude Haiku + RAG advisor with inline citations
- `/reports` - weekly financial report
- `/settings` - service and data controls

Quick health checks:

```bash
curl http://127.0.0.1:4000/health
curl http://127.0.0.1:8000/health
```

Run local verification:

```bash
npm run lint:frontend
npm run build:frontend
npm run typecheck:backend
npm run build:backend
ai-service/.venv/bin/python -m pip install -r ai-service/requirements-dev.txt
ai-service/.venv/bin/python -m pytest ai-service/tests
```

## Common Fixes

### `npm error enoent Could not read package.json`

You are not in the project directory.

```bash
cd /Users/keshavtyagi/Documents/WealthLens
```

### `Port 3000 is in use`

Another frontend server is already running. Use the URL Next.js prints, or stop the old process.

### `Port 8000 is in use`

The AI service is already running. You can keep using it, or stop the process using that port.

### `Missing keys` on Plaid

Check `backend/.env` has:

```bash
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox
```

Then restart the backend.

### Advisor says `LOCAL FALLBACK` or "could not reach advisor service"

Either the Anthropic key is missing, the AI service is not running, the backend cannot reach the AI service, or the tool JWT is misconfigured. Check:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:4000/health
```

If the badge on the advisor page says `CLAUDE + RAG`, the RAG loop is active. Verify all four env pairs match:

- `ADVISOR_TOOL_SECRET` — identical string in `backend/.env` and used only by backend (ai-service does not need it).
- `AI_SERVICE_URL` in backend points at the FastAPI URL.
- `BACKEND_URL` in ai-service points at the Fastify URL.
- `DATABASE_URL` in both points at the same Postgres (with `vector` extension enabled).
