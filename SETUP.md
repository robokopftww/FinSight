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

Open `http://localhost:3000`.

When Clerk keys are present, `/dashboard`, `/transactions`, `/subscriptions`, and `/financial-health` require sign-in. After a user signs up, the frontend calls `POST /api/auth/sync-user`, and the backend upserts that Clerk user into PostgreSQL.
