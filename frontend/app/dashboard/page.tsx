import { Sparkles } from "lucide-react";
import { auth } from "@clerk/nextjs/server";

import { AppShell } from "@/components/app-shell";
import { BalanceCard } from "@/components/balance-card";
import { BalanceHistoryChart } from "@/components/charts/balance-history-chart";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { SpendingBreakdownChart } from "@/components/charts/spending-breakdown-chart";
import { CreditCardPaymentsCard } from "@/components/credit-card-payments-card";
import { DashboardAdvisor } from "@/components/dashboard-advisor";
import { InsightCard } from "@/components/insight-card";
import { MetricCard } from "@/components/metric-card";
import { OnboardingModal } from "@/components/onboarding-modal";
import { OverviewRefreshController } from "@/components/overview-refresh-controller";
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
      <OnboardingModal />
      <DashboardAdvisor />

      <section className="grid items-start gap-4 xl:grid-cols-2">
        <BalanceCard
          currentBalance={data.currentBalance}
          availableBalance={data.availableBalance}
          monthOverMonthChange={data.monthOverMonthChange}
          accountsBreakdown={data.accountsBreakdown}
          refreshStatus={<OverviewRefreshController />}
        />
        <CreditCardPaymentsCard
          totalOutstanding={data.creditCardBalance ?? 0}
          detailsAvailable={data.creditCardDetailsAvailable}
          cards={data.creditCards}
        />
      </section>

      <BalanceHistoryChart data={data.balanceTrend ?? []} />

      <section className="grid gap-4 md:grid-cols-2">
        <MetricCard
          label={data.incomeCard?.label ?? "Monthly income"}
          value={formatCurrency(data.incomeCard?.value ?? data.monthlyIncome)}
          delta={data.incomeCard?.subtitle ?? "Detected from inflows"}
          trend={(data.incomeCard?.value ?? data.monthlyIncome) >= 0 ? "up" : "down"}
        />
        <MetricCard
          label="Savings rate"
          value={formatSavingsRate(data)}
          delta={data.metricCopy?.savingsRate ?? "Income minus spending"}
          trend={data.savingsRate < 0 ? "down" : "up"}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="This month's spending"
          value={formatCurrency(data.spendingThisMonth ?? data.monthlySpending)}
          delta={(data.spendingThisMonth ?? 0) > (data.spendingAvgMonthly ?? 0) ? "Above your average" : "At or below average"}
          trend={(data.spendingThisMonth ?? 0) > (data.spendingAvgMonthly ?? 0) ? "down" : "up"}
        />
        <MetricCard
          label="This year (YTD)"
          value={formatCurrency(data.spendingYearToDate ?? 0)}
          delta={`Across ${data.monthsOfHistory ?? 0} month${(data.monthsOfHistory ?? 0) === 1 ? "" : "s"}`}
        />
        <MetricCard label="Average / month" value={formatCurrency(data.spendingAvgMonthly ?? 0)} delta="Baseline pace" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <Panel className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Cash flow forecast</h2>
              <p className="mt-2 text-sm text-slate-600">Projected balances across your next 7, 30, and 90 days.</p>
            </div>
            <span className="rounded-full bg-[var(--color-accent-soft-strong)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-text)]">
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
              <h2 className="text-xl font-semibold text-slate-950">Spending mix</h2>
              <p className="mt-2 text-sm text-slate-600">Where your money is concentrating this month.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              Recharts
            </span>
          </div>
          <SpendingBreakdownChart data={data.spendingBreakdown} />
          <div className="grid gap-3 sm:grid-cols-2">
            {data.spendingBreakdown.map((item: { category: string; amount: number; fill: string }) => (
              <div key={item.category} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <div className="flex items-center gap-3 text-slate-700">
                  <span className="size-3 rounded-full" style={{ backgroundColor: item.fill }} />
                  {item.category}
                </div>
                <span className="font-medium text-slate-950">{formatCurrency(item.amount)}</span>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section>
        <Panel className="p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-blue-600 text-white">
              <Sparkles className="size-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-slate-950">AI insight feed</h2>
              <p className="mt-2 text-sm text-slate-600">Analytics-first insights that explain the numbers without hand-waving.</p>
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
      </section>
    </AppShell>
  );
}
