import Link from "next/link";
import { ArrowRight, BadgeCheck, Bot, CalendarDays, CreditCard, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { SpendingBreakdownChart } from "@/components/charts/spending-breakdown-chart";
import { InsightCard } from "@/components/insight-card";
import { MetricCard } from "@/components/metric-card";
import { ScoreRing } from "@/components/score-ring";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

const demoOverview = {
  currentBalance: 8420,
  monthlySpending: 3125,
  monthlyIncome: 5400,
  savingsRate: 18.6,
  healthScore: 82,
  safeToSpend: 650,
  projectedBalance: 6340,
  riskProbability: 0.22,
};

const demoForecast = [
  { label: "Today", balance: 8420 },
  { label: "Day 7", balance: 7940 },
  { label: "Day 30", balance: 6340 },
  { label: "Day 90", balance: 5640 },
];

const demoSpending = [
  { category: "Food", amount: 840, fill: "#8ef0d1" },
  { category: "Bills", amount: 780, fill: "#58b8ff" },
  { category: "Shopping", amount: 670, fill: "#ffb65e" },
  { category: "Entertainment", amount: 543, fill: "#ff7b72" },
  { category: "Transportation", amount: 292, fill: "#d0a2ff" },
];

const demoTransactions = [
  { merchant: "Apple Payroll", description: "PAYROLL DEPOSIT", amount: 2700, category: "Income", date: "May 24" },
  { merchant: "Whole Foods", description: "WHOLEFDS BKLYN 01", amount: -86, category: "Food", date: "May 28" },
  { merchant: "Netflix", description: "NETFLIX.COM", amount: -15, category: "Subscription", date: "May 27" },
  { merchant: "Shell", description: "SHELL OIL 574112", amount: -43, category: "Transportation", date: "May 26" },
  { merchant: "Sweetgreen", description: "SWEETGREEN BROOKLYN", amount: -25, category: "Food", date: "May 25" },
];

const demoSubscriptions = [
  { name: "Netflix", monthlyCost: 15.49, yearlyCost: 186, opportunity: "Keep" },
  { name: "Spotify", monthlyCost: 10.99, yearlyCost: 132, opportunity: "Review" },
  { name: "Climbing Gym", monthlyCost: 49, yearlyCost: 588, opportunity: "Review" },
];

const demoInsights = [
  {
    title: "Restaurant spending is up 28%",
    summary: "Most of the increase came from weekend dining. Holding restaurant spend to $140/week keeps your forecast above target.",
    severity: "medium",
  },
  {
    title: "Cash-flow runway is stable",
    summary: "Your projected 30-day balance is $6,340 after recurring bills and expected income.",
    severity: "low",
  },
  {
    title: "Subscriptions could free $342 yearly",
    summary: "Spotify and the climbing gym are candidates for review based on cost and recent usage.",
    severity: "low",
  },
];

const weeklySpend = [
  { label: "Mon", amount: 108 },
  { label: "Tue", amount: 62 },
  { label: "Wed", amount: 184 },
  { label: "Thu", amount: 96 },
  { label: "Fri", amount: 270 },
  { label: "Sat", amount: 315 },
  { label: "Sun", amount: 213 },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatSignedCurrency(value: number) {
  const formatted = formatCurrency(Math.abs(value));
  return value < 0 ? `-${formatted}` : formatted;
}

export default function DemoPage() {
  const maxWeeklySpend = Math.max(...weeklySpend.map((day) => day.amount), 1);

  return (
    <AppShell currentPath="/demo" eyebrow="Recruiter-ready demo" title="Explore FinSight with polished sample data" demoMode>
      <Panel className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-accent)] text-slate-950">
              <Sparkles className="size-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-white">Demo Mode is using realistic sample finances</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
                This view skips sign-in and Plaid so recruiters can inspect the product immediately. The real app still uses Clerk,
                Plaid, PostgreSQL, Python analytics, and Gemini.
              </p>
            </div>
          </div>
          <Button asChild variant="secondary" className="h-12">
            <Link href="/dashboard">
              Open live app
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>
      </Panel>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Current balance" value={formatCurrency(demoOverview.currentBalance)} delta="Demo checking + savings" />
        <MetricCard label="Monthly spending" value={formatCurrency(demoOverview.monthlySpending)} delta="14% higher than last month" trend="down" />
        <MetricCard label="Monthly income" value={formatCurrency(demoOverview.monthlyIncome)} delta="Stable payroll cadence" />
        <MetricCard label="Savings rate" value={`${demoOverview.savingsRate}%`} delta="Trending toward 20% target" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
        <Panel className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">Cash flow forecast</h2>
              <p className="mt-2 text-sm text-slate-300">Projected balances across the next 7, 30, and 90 days.</p>
            </div>
            <span className="rounded-full bg-emerald-300/14 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
              Safe to spend {formatCurrency(demoOverview.safeToSpend)}
            </span>
          </div>
          <div className="mt-6">
            <CashFlowChart data={demoForecast} />
          </div>
        </Panel>

        <Panel className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">Spending mix</h2>
              <p className="mt-2 text-sm text-slate-300">Clean demo categories without Plaid sandbox transfer noise.</p>
            </div>
            <CreditCard className="size-5 text-[var(--color-accent)]" />
          </div>
          <SpendingBreakdownChart data={demoSpending} />
          <div className="grid gap-3 sm:grid-cols-2">
            {demoSpending.map((item) => (
              <div key={item.category} className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-sm">
                <div className="flex items-center gap-3 text-slate-200">
                  <span className="size-3 rounded-full" style={{ backgroundColor: item.fill }} />
                  {item.category}
                </div>
                <span className="font-medium text-white">{formatCurrency(item.amount)}</span>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Panel className="flex flex-col items-center justify-center p-8">
          <ScoreRing score={demoOverview.healthScore} />
          <div className="mt-5 grid w-full gap-3">
            <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Emergency runway</div>
              <div className="mt-2 text-2xl font-semibold text-white">81 days</div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Risk probability</div>
              <div className="mt-2 text-2xl font-semibold text-white">{Math.round(demoOverview.riskProbability * 100)}%</div>
            </div>
          </div>
        </Panel>

        <Panel className="p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-[var(--color-accent)] text-slate-950">
              <Bot className="size-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-white">Advisor preview</h2>
              <p className="mt-2 text-sm text-slate-300">What Gemini explains after Python calculates the numbers.</p>
            </div>
          </div>
          <div className="mt-6 space-y-4 rounded-[28px] border border-white/8 bg-[#091120] p-5">
            <div className="ml-auto max-w-xl rounded-3xl bg-[var(--color-accent)] px-4 py-3 text-sm text-slate-950">
              Can I afford a $400 monitor this month?
            </div>
            <div className="max-w-2xl rounded-3xl border border-white/8 bg-white/6 px-4 py-4 text-sm leading-7 text-slate-100">
              A $400 purchase is affordable based on your forecast. Your safe-to-spend buffer would move from $650 to $250,
              so FinSight would recommend keeping discretionary dining below $140 this week to protect your savings target.
            </div>
            <div className="inline-flex rounded-full bg-emerald-300/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">
              Gemini + Python analytics
            </div>
          </div>
        </Panel>
      </section>

      <Panel className="p-6">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-[var(--color-accent)] text-slate-950">
            <Sparkles className="size-5" />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-white">AI insight feed</h2>
            <p className="mt-2 text-sm text-slate-300">Grounded insight cards generated from the demo financial profile.</p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {demoInsights.map((insight) => (
            <InsightCard
              key={insight.title}
              title={insight.title}
              summary={insight.summary}
              severity={insight.severity as "high" | "medium" | "low"}
            />
          ))}
        </div>
      </Panel>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel className="p-6">
          <div className="flex items-center gap-3">
            <CalendarDays className="size-5 text-[var(--color-accent)]" />
            <h2 className="text-xl font-semibold text-white">Weekly report</h2>
          </div>
          <p className="mt-2 text-sm text-slate-300">May 24 - May 30</p>
          <div className="mt-6 flex h-56 items-end gap-3 border-b border-white/8 pb-4">
            {weeklySpend.map((day) => (
              <div key={day.label} className="flex min-w-0 flex-1 flex-col items-center gap-3">
                <div className="flex h-40 w-full items-end rounded-t-2xl bg-white/4">
                  <div
                    className="w-full rounded-t-2xl bg-[linear-gradient(180deg,var(--color-accent),rgba(142,240,209,0.18))]"
                    style={{ height: `${Math.max((day.amount / maxWeeklySpend) * 100, 8)}%` }}
                  />
                </div>
                <div className="text-xs font-medium text-slate-400">{day.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-[24px] border border-emerald-300/16 bg-emerald-300/8 p-4 text-sm leading-7 text-emerald-50">
            Spending increased 12% this week, led by food and weekend entertainment. Your forecast remains stable, but holding
            dining spend flat would keep the 30-day balance above $6,300.
          </div>
        </Panel>

        <Panel className="p-6">
          <div className="flex items-center gap-3">
            <RefreshCw className="size-5 text-[var(--color-accent)]" />
            <h2 className="text-xl font-semibold text-white">Subscriptions</h2>
          </div>
          <div className="mt-6 space-y-3">
            {demoSubscriptions.map((subscription) => (
              <div key={subscription.name} className="flex items-center justify-between rounded-[24px] border border-white/8 bg-white/4 px-4 py-4">
                <div>
                  <div className="font-medium text-white">{subscription.name}</div>
                  <div className="mt-1 text-sm text-slate-400">{subscription.opportunity}</div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-white">{formatCurrency(subscription.monthlyCost)}</div>
                  <div className="mt-1 text-sm text-slate-400">{formatCurrency(subscription.yearlyCost)} / year</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-[24px] border border-white/8 bg-white/4 p-4 text-sm text-slate-300">
            Review candidates could save about <span className="font-semibold text-white">$342/year</span>.
          </div>
        </Panel>
      </section>

      <Panel className="p-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="size-5 text-[var(--color-accent)]" />
          <h2 className="text-xl font-semibold text-white">Recent transactions</h2>
        </div>
        <div className="mt-6 overflow-hidden rounded-[24px] border border-white/8">
          {demoTransactions.map((transaction) => (
            <div key={`${transaction.date}-${transaction.description}`} className="grid gap-3 border-b border-white/8 px-4 py-4 text-sm last:border-b-0 md:grid-cols-[1fr_9rem_8rem_7rem] md:items-center">
              <div>
                <div className="font-medium text-white">{transaction.merchant}</div>
                <div className="mt-1 text-slate-500">{transaction.description}</div>
              </div>
              <div className="text-slate-300">{transaction.category}</div>
              <div className={transaction.amount < 0 ? "font-medium text-white" : "font-medium text-emerald-100"}>
                {formatSignedCurrency(transaction.amount)}
              </div>
              <div className="text-slate-400">{transaction.date}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <BadgeCheck className="mt-1 size-5 text-[var(--color-accent)]" />
            <div>
              <h2 className="text-xl font-semibold text-white">Ready for the live workflow</h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
                The protected app connects Clerk accounts, Plaid sandbox banks, PostgreSQL records, Python analytics, and Gemini
                explanations. Demo Mode exists so the product is instantly reviewable.
              </p>
            </div>
          </div>
          <Button asChild className="h-12">
            <Link href="/dashboard">
              Connect Plaid sandbox
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>
      </Panel>
    </AppShell>
  );
}
