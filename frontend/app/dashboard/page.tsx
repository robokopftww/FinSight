import { ArrowRight, Bot, Sparkles } from "lucide-react";
import { auth } from "@clerk/nextjs/server";

import { AppShell } from "@/components/app-shell";
import { BankConnectionPanel } from "@/components/bank-connection-panel";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { SpendingBreakdownChart } from "@/components/charts/spending-breakdown-chart";
import { InsightCard } from "@/components/insight-card";
import { MetricCard } from "@/components/metric-card";
import { Panel } from "@/components/ui/panel";
import { getDashboardOverview } from "@/lib/api";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatSavingsRate(data: { savingsRate: number; savingsRateLabel?: string }) {
  return data.savingsRateLabel ?? `${data.savingsRate}%`;
}

export default async function DashboardPage() {
  const { getToken } = await auth();
  const data = await getDashboardOverview(await getToken());

  return (
    <AppShell currentPath="/dashboard" eyebrow="Financial overview" title="See your cash flow before it becomes a problem">
      <BankConnectionPanel />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Current balance" value={formatCurrency(data.currentBalance)} delta={data.metricCopy?.currentBalance ?? "Synced balance"} />
        <MetricCard
          label="Monthly spending"
          value={formatCurrency(data.monthlySpending)}
          delta={data.metricCopy?.monthlySpending ?? "Based on synced transactions"}
          trend="down"
        />
        <MetricCard label="Monthly income" value={formatCurrency(data.monthlyIncome)} delta={data.metricCopy?.monthlyIncome ?? "Detected from inflows"} />
        <MetricCard
          label="Savings rate"
          value={formatSavingsRate(data)}
          delta={data.metricCopy?.savingsRate ?? "Income minus spending"}
          trend={data.savingsRate < 0 ? "down" : "up"}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <Panel className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">Cash flow forecast</h2>
              <p className="mt-2 text-sm text-slate-300">Projected balances across your next 7, 30, and 90 days.</p>
            </div>
            <span className="rounded-full bg-emerald-300/14 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
              Safe to spend {formatCurrency(data.safeToSpend)}
            </span>
          </div>
          <div className="mt-6">
            <CashFlowChart data={data.forecast.map((item: { label?: string; day?: string; balance: number }) => ({ ...item, label: item.label ?? item.day ?? "" }))} />
          </div>
        </Panel>

        <Panel className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">Spending mix</h2>
              <p className="mt-2 text-sm text-slate-300">Where your money is concentrating this month.</p>
            </div>
            <span className="rounded-full bg-white/7 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              Recharts
            </span>
          </div>
          <SpendingBreakdownChart data={data.spendingBreakdown} />
          <div className="grid gap-3 sm:grid-cols-2">
            {data.spendingBreakdown.map((item: { category: string; amount: number; fill: string }) => (
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

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel className="p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-[var(--color-accent)] text-slate-950">
              <Sparkles className="size-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-white">AI insight feed</h2>
              <p className="mt-2 text-sm text-slate-300">Analytics-first insights that explain the numbers without hand-waving.</p>
            </div>
          </div>
          <div className="mt-6 space-y-4">
            {data.insightHighlights.map((insight: { title: string; summary: string; severity: string }) => (
              <InsightCard
                key={insight.title}
                title={insight.title}
                summary={insight.summary}
                severity={insight.severity as "high" | "medium" | "low"}
              />
            ))}
          </div>
        </Panel>

        <Panel className="p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-white/8 text-white">
              <Bot className="size-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-white">Advisor chat preview</h2>
              <p className="mt-2 text-sm text-slate-300">Grounded answers based on transactions, forecast, and savings behavior.</p>
            </div>
          </div>

          <div className="mt-6 space-y-4 rounded-[28px] border border-white/8 bg-[#091120] p-5">
            <div className="rounded-3xl bg-white/7 px-4 py-3 text-sm text-slate-200">
              Can I afford a $400 gaming monitor this month?
            </div>
            <div className="rounded-3xl bg-[var(--color-accent)]/16 px-4 py-4 text-sm leading-7 text-slate-100">
              Based on your projected balance of $1,240 after bills, a $400 purchase looks affordable, but it would cut your monthly savings rate from 18.6% to about 10.2%.
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2 text-sm text-slate-300">
            View full chat workflow
            <ArrowRight className="size-4" />
          </div>
        </Panel>
      </section>
    </AppShell>
  );
}
