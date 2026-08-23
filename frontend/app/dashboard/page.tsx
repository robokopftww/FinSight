import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { ChevronRight, Sparkles } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { BalanceHistoryChart } from "@/components/charts/balance-history-chart";
import { InsightCard } from "@/components/insight-card";
import { MetricCard, type MetricTone } from "@/components/metric-card";
import { OnboardingModal } from "@/components/onboarding-modal";
import { Panel } from "@/components/ui/panel";
import { getDashboardOverview, getSubscriptions } from "@/lib/api";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDelta(amount: number | undefined, percent?: number | null) {
  if (amount === undefined || amount === null) return undefined;
  if (percent === undefined || percent === null) {
    const sign = amount >= 0 ? "+" : "−";
    const dollars = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.abs(amount));
    return `${sign}$${dollars}`;
  }
  return percent >= 0 ? `+${percent}%` : `${percent}%`;
}

function sparklineFromTrend(trend?: Array<{ balance: number }>): number[] | undefined {
  if (!trend || trend.length < 2) return undefined;
  return trend.slice(-7).map((p) => p.balance);
}

const suggestedPrompts = [
  "What's my top spending category?",
  "Am I on track this month?",
  "Which subscriptions did I forget?",
];

export default async function DashboardPage() {
  const { getToken } = await auth();
  const token = await getToken();
  const [data, subs] = await Promise.all([
    getDashboardOverview(token),
    getSubscriptions(token),
  ]);

  const subscriptions = (subs.data ?? []).map((s) => ({
    name: s.name ?? s.merchantName ?? "Subscription",
    monthlyCost: s.monthlyCost ?? 0,
    note: s.note,
  }));

  const netWorth = data.currentBalance;
  const cashFlow = data.netCashFlow ?? data.monthlyIncome - data.monthlySpending;
  const healthScore = data.healthScore ?? 82;

  const creditCards = data.creditCards ?? [];
  const upcoming = creditCards.reduce(
    (sum, c) => sum + (c.minimumPayment ?? c.statementBalance ?? c.outstandingBalance ?? 0),
    0,
  );
  const creditCardDetails = creditCards.map((c) => {
    const amount = c.minimumPayment ?? c.statementBalance ?? c.outstandingBalance ?? 0;
    const due = c.dueDate
      ? new Date(c.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "No due date";
    const maskLabel = c.mask ? ` ••${c.mask}` : "";
    return {
      primary: `${c.name}${maskLabel}`,
      secondary: `Due ${due}${c.minimumPayment != null ? " · min payment" : ""}`,
      value: formatCurrency(amount),
    };
  });

  const netWorthTrend = sparklineFromTrend(data.balanceTrend);
  const cashFlowTrend = [10, 12, 11, 15, 16, 18, cashFlow > 0 ? 20 : 8];
  const scoreTrend = [healthScore - 12, healthScore - 8, healthScore - 5, healthScore - 3, healthScore - 1, healthScore];
  const billsTrend = [24, 22, 20, 22, 18, 16, 18];

  const cashFlowDelta = formatDelta(cashFlow, data.monthOverMonthChange?.percent);
  const netWorthDelta = formatDelta(data.monthOverMonthChange?.amount, data.monthOverMonthChange?.percent);

  const cashFlowTone: MetricTone = cashFlow >= 0 ? "positive" : "negative";
  const netWorthTone: MetricTone = (data.monthOverMonthChange?.amount ?? 0) >= 0 ? "positive" : "negative";

  return (
    <AppShell
      currentPath="/dashboard"
      eyebrow="Overview"
      title="Good afternoon — here's how your money moved"
    >
      <OnboardingModal />

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Net Worth"
          value={formatCurrency(netWorth)}
          delta={netWorthDelta}
          tone={netWorthTone}
          points={netWorthTrend}
        />
        <MetricCard
          label="Monthly Cash Flow"
          value={formatCurrency(cashFlow)}
          delta={cashFlowDelta}
          tone={cashFlowTone}
          points={cashFlowTrend}
        />
        <MetricCard
          label="Health Score"
          value={`${healthScore} / 100`}
          delta={healthScore >= 80 ? "+4 pts" : `${healthScore - 80} pts`}
          tone="accent"
          points={scoreTrend}
        />
        <MetricCard
          label="Credit Card Bills"
          value={formatCurrency(upcoming)}
          delta={
            creditCards.length
              ? `${creditCards.length} card${creditCards.length === 1 ? "" : "s"}`
              : "No cards"
          }
          tone="warning"
          points={billsTrend}
          detailsLabel={
            creditCards.length
              ? `View ${creditCards.length} card${creditCards.length === 1 ? "" : "s"}`
              : undefined
          }
          details={creditCardDetails.length ? creditCardDetails : undefined}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <BalanceHistoryChart data={data.balanceTrend ?? []} />
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
          <Link
            href="/advisor"
            className="rounded-[12px] border border-slate-200 bg-[var(--background)] px-3.5 py-3 text-[13px] text-slate-500"
          >
            Where did I overspend last week?
          </Link>
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
        <SpendingByCategory data={data.spendingBreakdown} />
        <UpcomingRenewals items={subscriptions.slice(0, 4)} />
      </section>

      <Panel className="p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Insights</h2>
            <p className="mt-0.5 text-xs text-slate-500">AI-generated · grounded in transactions</p>
          </div>
          <button type="button" className="text-xs font-semibold text-[var(--color-accent-text)] hover:underline">
            Dismiss all
          </button>
        </div>
        <div className="mt-5 space-y-3">
          {data.insightHighlights.map((insight) => (
            <InsightCard
              key={insight.title}
              title={insight.title}
              summary={insight.summary}
              severity={insight.severity as "high" | "medium" | "low"}
            />
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}

function SpendingByCategory({ data }: { data: Array<{ category: string; amount: number; fill: string }> }) {
  const total = data.reduce((s, d) => s + d.amount, 0);
  const max = Math.max(...data.map((d) => d.amount));
  return (
    <Panel className="p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Spending by category</h2>
          <p className="mt-0.5 text-xs text-slate-500">This month · {formatCurrency(total)} total</p>
        </div>
        <Link href="/transactions" className="text-xs font-semibold text-[var(--color-accent-text)] hover:underline">
          View all
        </Link>
      </div>
      <div className="mt-5 space-y-4">
        {data.slice(0, 6).map((row) => {
          const pct = Math.max(0.05, row.amount / Math.max(1, max));
          return (
            <div key={row.category}>
              <div className="mb-1.5 flex items-center justify-between text-[13px]">
                <span className="font-medium text-slate-800">{row.category}</span>
                <span className="font-mono tabular-nums text-slate-500">{formatCurrency(row.amount)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--background)]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct * 100}%`, backgroundColor: row.fill }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function UpcomingRenewals({
  items,
}: {
  items: Array<{ name: string; monthlyCost: number; note?: string }>;
}) {
  return (
    <Panel className="p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Upcoming renewals</h2>
          <p className="mt-0.5 text-xs text-slate-500">Next 14 days · {items.length} charges</p>
        </div>
        <Link href="/subscriptions" className="text-xs font-semibold text-[var(--color-accent-text)] hover:underline">
          Manage
        </Link>
      </div>
      <ul className="mt-5 space-y-2.5">
        {items.map((sub) => (
          <li key={sub.name} className="flex items-center gap-3 rounded-[12px] p-1.5">
            <span className="flex size-9 items-center justify-center rounded-[10px] bg-[var(--color-accent-soft)] text-sm font-semibold text-[var(--color-accent-text)]">
              {sub.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-950">{sub.name}</div>
              <div className="text-[11px] text-slate-500">{sub.note ?? "Auto-renews monthly"}</div>
            </div>
            <div className="font-mono text-sm font-semibold tabular-nums text-slate-950">
              {formatCurrency(sub.monthlyCost)}
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
