import { auth } from "@clerk/nextjs/server";
import { Activity, CalendarDays, FileText, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { InsightCard } from "@/components/insight-card";
import { Panel } from "@/components/ui/panel";
import { getWeeklyReport } from "@/lib/api";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value?: number) {
  if (value === undefined) {
    return "N/A";
  }

  return `${Math.round(value * 100)}%`;
}

export default async function ReportsPage() {
  const { getToken } = await auth();
  const report = await getWeeklyReport(await getToken());
  const maxSpend = Math.max(...report.weeklySpend.map((day) => day.amount), 1);

  return (
    <AppShell currentPath="/reports" eyebrow="Weekly report" title="See what changed before it compounds">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {report.cards.map((card) => (
          <Panel key={card.label} className="min-w-0 overflow-hidden p-5">
            <div className="text-sm text-slate-400">{card.label}</div>
            <div className="mt-4 break-words text-2xl font-semibold leading-tight text-white lg:text-3xl xl:text-2xl">
              {card.value}
            </div>
            <div className="mt-4 break-words text-sm leading-6 text-slate-300">{card.detail}</div>
          </Panel>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-[var(--color-accent)] text-slate-950">
                <CalendarDays className="size-5" />
              </span>
              <div>
                <h2 className="text-xl font-semibold text-white">Spending cadence</h2>
                <p className="mt-2 text-sm text-slate-300">{report.periodLabel}</p>
              </div>
            </div>
            <span className="rounded-full bg-white/7 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              {report.source ?? "analytics"}
            </span>
          </div>

          <div className="mt-8 flex h-72 items-end gap-3 border-b border-white/8 pb-4">
            {report.weeklySpend.map((day) => (
              <div key={day.label} className="flex min-w-0 flex-1 flex-col items-center gap-3">
                <div className="flex h-56 w-full items-end rounded-t-2xl bg-white/4">
                  <div
                    className="w-full rounded-t-2xl bg-[linear-gradient(180deg,var(--color-accent),rgba(142,240,209,0.18))]"
                    style={{ height: `${Math.max((day.amount / maxSpend) * 100, day.amount > 0 ? 8 : 0)}%` }}
                  />
                </div>
                <div className="text-xs font-medium text-slate-400">{day.label}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-white/8 text-white">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-white">Forecast context</h2>
              <p className="mt-2 text-sm text-slate-300">How the week affects your short-term runway.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Projected balance</div>
              <div className="mt-3 text-2xl font-semibold text-white">{formatCurrency(report.forecast?.projectedBalance ?? 0)}</div>
            </div>
            <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Safe to spend</div>
              <div className="mt-3 text-2xl font-semibold text-white">{formatCurrency(report.forecast?.safeToSpend ?? 0)}</div>
            </div>
            <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Risk probability</div>
              <div className="mt-3 text-2xl font-semibold text-white">{formatPercent(report.forecast?.riskProbability)}</div>
            </div>
          </div>
        </Panel>
      </section>

      <Panel className="p-6">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-[var(--color-accent)]/16 text-emerald-100">
            <FileText className="size-5" />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-white">AI weekly brief</h2>
            <p className="mt-2 text-sm text-slate-300">Generated from synced transactions and the Python forecast engine.</p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {report.insights.map((insight) => (
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
            <Activity className="size-5" />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-white">Next actions</h2>
            <p className="mt-2 text-sm text-slate-300">Keep this report useful by syncing after new transactions post.</p>
          </div>
        </div>
      </Panel>
    </AppShell>
  );
}
