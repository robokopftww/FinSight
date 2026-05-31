# FinSight Local Setup

## 1. Install Dependencies

From the repo root:

```bash
npm install
```

## 2. Start PostgreSQL and Redis

If Docker is installed:

```bash
docker compose up -d
```

If Docker is not installed, use Neon, Postgres.app, Supabase, or a local PostgreSQL install, then update `backend/.env`:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

## 3. Create Database Tables

```bash
cd backend
npm run db:generate
npm run db:migrate -- --name init
```

## 4. Configure Clerk

Create a Clerk application and copy the keys into both env files.

`frontend/.env.local`:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

`backend/.env`:

```bash
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

## 5. Run The App

Terminal 1:

```bash
npm run dev:backend
```

Terminal 2:

```bash
npm run dev:frontend
```

Terminal 3:

```bash
python3 -m venv ai-service/.venv
ai-service/.venv/bin/python -m pip install -r ai-service/requirements.txt
npm run dev:ai
```

Open `http://localhost:3000`.

When Clerk keys are present, `/dashboard`, `/transactions`, `/subscriptions`, and `/financial-health` require sign-in. After a user signs up, the frontend calls `POST /api/auth/sync-user`, and the backend upserts that Clerk user into PostgreSQL.

The backend calls the Python AI service at `AI_SERVICE_URL`, which defaults to `http://127.0.0.1:8000`. If the Python service is not running, FinSight falls back to the TypeScript analytics engine so the app still loads.
