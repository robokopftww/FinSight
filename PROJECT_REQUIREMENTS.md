# FinSight Product Requirements

## Vision

FinSight is an AI financial copilot for college students, young professionals, and first-time budgeters who want proactive help managing money.

The product should feel like a modern startup SaaS platform, not a classroom prototype.

## Product Goals

- Help users understand where their money is going
- Predict future balance risk before a low-cash event occurs
- Surface savings opportunities from subscriptions and habits
- Turn raw bank data into grounded, useful financial guidance

## User Value

Examples of insight quality we are targeting:

- At your current spending rate, you may drop below $500 in 9 days.
- Restaurant spending increased 28% this month.
- Cancelling these subscriptions would save $340 per year.
- You are spending 19% more than users with similar income.

## MVP Features

- Clerk authentication
- Plaid sandbox account linking
- Financial overview dashboard
- Transaction search and recategorization
- Subscription detection and savings analysis
- Financial health score
- AI insights panel
- Financial advisor chat

## Technical Stack

### Frontend

- Next.js 15
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Recharts

### Backend

- Node.js
- TypeScript
- PostgreSQL
- Prisma ORM
- Redis

### AI Service

- Python
- FastAPI
- Pandas
- NumPy
- Scikit-Learn
- OpenAI or Gemini

### Integrations

- Clerk
- Plaid
- Neon PostgreSQL
- Vercel

## AI Principles

- AI is an enhancement layer, not the whole product
- Python performs analytics first
- LLMs explain analytics in human language
- Chat answers must use real balances, bills, transaction patterns, and forecasts

## High-Value AI Features

- Financial health scoring
- Safe-to-spend calculation
- Cash flow forecasting for 7, 30, and 90 days
- Spending spike and anomaly detection
- Weekly financial reports
- Transaction categorization fallback
- Goal planning recommendations

## Engineering Standards

- TypeScript strict mode
- Reusable UI primitives and domain components
- No duplicated business logic
- Mobile responsive experience
- Clear service boundaries between frontend, backend, and AI service
- Recruiter-friendly architecture and implementation choices
