# FinSight Local Setup

Use this guide when you have closed everything and want to boot the app again from scratch.

## 1. Open The Project

```bash
cd /Users/keshavtyagi/Documents/FinSight
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

## 7. Configure Gemini

Put your Google AI Studio key in `ai-service/.env`:

```bash
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
```

FinSight still runs without Gemini. If the key is missing, advisor chat and reports fall back to deterministic Python analytics.

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
- `/advisor` - Gemini + Python advisor
- `/reports` - weekly financial report
- `/settings` - service and data controls

Quick health checks:

```bash
curl http://127.0.0.1:4000/health
curl http://127.0.0.1:8000/health
```

## Common Fixes

### `npm error enoent Could not read package.json`

You are not in the project directory.

```bash
cd /Users/keshavtyagi/Documents/FinSight
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

### Advisor says `LOCAL FALLBACK`

Either Gemini is not configured, the AI service is not running, or Gemini returned an error. Check:

```bash
curl http://127.0.0.1:8000/health
```

If the badge says `GEMINI + PYTHON ANALYTICS`, Gemini is active.
