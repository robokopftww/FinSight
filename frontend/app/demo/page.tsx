import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { BalanceHistoryChart } from "@/components/charts/balance-history-chart";
import { InsightCard } from "@/components/insight-card";
import { MetricCard } from "@/components/metric-card";
import { Panel } from "@/components/ui/panel";

const balanceTrend = [
  { label: "Mar", balance: 118400 },
  { label: "Apr", balance: 122100 },
  { label: "May", balance: 124800 },
  { label: "Jun", balance: 131300 },
  { label: "Jul", balance: 137600 },
  { label: "Aug", balance: 142830 },
];

const spendingBreakdown = [
  { category: "Groceries", amount: 842.1, fill: "#2563eb" },
  { category: "Dining", amount: 514.63, fill: "#0ea5e9" },
  { category: "Transport", amount: 412.5, fill: "#8b5cf6" },
  { category: "Shopping", amount: 318.9, fill: "#ec4899" },
  { category: "Subscriptions", amount: 246.0, fill: "#f97316" },
  { category: "Entertainment", amount: 180.25, fill: "#22c55e" },
];

const renewals = [
  { name: "Netflix", note: "Renews Aug 26", monthlyCost: 15.99 },
  { name: "Spotify", note: "Renews Aug 28", monthlyCost: 10.99 },
  { name: "Adobe CC", note: "Renews Sep 02", monthlyCost: 54.99 },
  { name: "iCloud+", note: "Renews Sep 04", monthlyCost: 2.99 },
];

const creditCards = [
  { name: "Chase Sapphire", mask: "4821", due: "Sep 02", minimum: 45.0, statement: 812.34 },
  { name: "Amex Gold", mask: "1005", due: "Sep 08", minimum: 60.0, statement: 1240.5 },
  { name: "Apple Card", mask: "3391", due: "Sep 15", minimum: 25.0, statement: 318.16 },
];

const insights = [
  {
    title: "Overdraft risk on Chase Checking",
    summary: "Balance likely dips below $0 in 4 days at current burn.",
    severity: "high" as const,
  },
  {
    title: "Dining spend up 38% vs 3-month average",
    summary: "You've spent $514.63 on dining this month; typical is $370.",
    severity: "medium" as const,
  },
  {
    title: "Unused subscription: Hulu (44 days)",
    summary: "No activity since Jul 10 — cancel to save $17.99/mo.",
    severity: "low" as const,
  },
];

const suggestedPrompts = [
  "What's my top spending category?",
  "Am I on track this month?",
  "Which subscriptions did I forget?",
];

function fmt(value: number, opts: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", ...opts }).format(value);
}

export default function DemoPage() {
  const total = spendingBreakdown.reduce((s, d) => s + d.amount, 0);
  const max = Math.max(...spendingBreakdown.map((d) => d.amount));

  return (
    <AppShell
      currentPath="/demo"
      eyebrow="Overview"
      title="Good afternoon, Keshav"
      demoMode
    >
      <p className="-mt-4 text-sm text-slate-600">Here&rsquo;s how your money moved this month.</p>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Net Worth"
          value={fmt(142830.19, { maximumFractionDigits: 2 })}
          delta="+3.2%"
          tone="positive"
          points={[118400, 122100, 124800, 131300, 137600, 142830]}
        />
        <MetricCard
          label="Monthly Cash Flow"
          value={fmt(4218.72, { maximumFractionDigits: 2 })}
          delta="+12.4%"
          tone="positive"
          points={[3200, 3400, 3300, 3800, 4000, 4218]}
        />
        <MetricCard
          label="Health Score"
          value="82 / 100"
          delta="+4 pts"
          tone="accent"
          points={[70, 72, 74, 76, 78, 82]}
        />
        <MetricCard
          label="Credit Card Bills"
          value={fmt(
            creditCards.reduce((s, c) => s + c.minimum, 0),
            { maximumFractionDigits: 2 },
          )}
          delta={`${creditCards.length} cards`}
          tone="warning"
          points={[1380, 1360, 1420, 1300, 1250, 1204]}
          detailsLabel={`View ${creditCards.length} cards`}
          details={creditCards.map((c) => ({
            primary: `${c.name} ••${c.mask}`,
            secondary: `Due ${c.due} · min payment (statement ${fmt(c.statement, { maximumFractionDigits: 0 })})`,
            value: fmt(c.minimum, { maximumFractionDigits: 2 }),
          }))}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <BalanceHistoryChart data={balanceTrend} />
        <Panel className="flex flex-col gap-4 p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent-text)]">
              <Sparkles className="size-4" />
            </span>
            <div>
              <div className="text-base font-semibold text-slate-950">Ask WealthLens</div>
              <div className="text-[11px] text-slate-500">Grounded in your data</div>
            </div>
          </div>
          <div className="rounded-[12px] border border-slate-200 bg-[var(--background)] px-3.5 py-3 text-[13px] text-slate-500">
            Where did I overspend last week?
          </div>
          <div className="space-y-1.5">
            {suggestedPrompts.map((q) => (
              <Link
                key={q}
                href="/advisor"
                className="flex items-center gap-2 rounded-[10px] bg-[var(--background)] px-3 py-2 text-[12px] text-slate-800 transition hover:bg-slate-100"
              >
                <ChevronRight className="size-3.5 text-[var(--color-accent-text)]" />
                {q}
              </Link>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Spending by category</h2>
              <p className="mt-0.5 text-xs text-slate-500">August · {fmt(total, { maximumFractionDigits: 0 })} total</p>
            </div>
            <button type="button" className="text-xs font-semibold text-[var(--color-accent-text)] hover:underline">
              View all
            </button>
          </div>
          <div className="mt-5 space-y-4">
            {spendingBreakdown.map((row) => {
              const pct = Math.max(0.05, row.amount / max);
              return (
                <div key={row.category}>
                  <div className="mb-1.5 flex items-center justify-between text-[13px]">
                    <span className="font-medium text-slate-800">{row.category}</span>
                    <span className="font-mono tabular-nums text-slate-500">
                      {fmt(row.amount, { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--background)]">
                    <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, backgroundColor: row.fill }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Upcoming renewals</h2>
              <p className="mt-0.5 text-xs text-slate-500">Next 14 days · {renewals.length} charges</p>
            </div>
            <button type="button" className="text-xs font-semibold text-[var(--color-accent-text)] hover:underline">
              Manage
            </button>
          </div>
          <ul className="mt-5 space-y-2.5">
            {renewals.map((sub) => (
              <li key={sub.name} className="flex items-center gap-3 rounded-[12px] p-1.5">
                <span className="flex size-9 items-center justify-center rounded-[10px] bg-[var(--color-accent-soft)] text-sm font-semibold text-[var(--color-accent-text)]">
                  {sub.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-950">{sub.name}</div>
                  <div className="text-[11px] text-slate-500">{sub.note}</div>
                </div>
                <div className="font-mono text-sm font-semibold tabular-nums text-slate-950">
                  {fmt(sub.monthlyCost, { maximumFractionDigits: 2 })}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </section>

      <Panel className="p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Insights</h2>
            <p className="mt-0.5 text-xs text-slate-500">AI-generated · updated 4 min ago</p>
          </div>
          <button type="button" className="text-xs font-semibold text-[var(--color-accent-text)] hover:underline">
            Dismiss all
          </button>
        </div>
        <div className="mt-5 space-y-3">
          {insights.map((it) => (
            <InsightCard key={it.title} title={it.title} summary={it.summary} severity={it.severity} />
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
