import { auth } from "@clerk/nextjs/server";

import { AppShell } from "@/components/app-shell";
import { ScoreRing } from "@/components/score-ring";
import { Panel } from "@/components/ui/panel";
import { getFinancialHealth, healthFactors } from "@/lib/api";

export default async function FinancialHealthPage() {
  const { getToken } = await auth();
  const data = await getFinancialHealth(await getToken());
  const factors = data.factors ?? healthFactors;
  const savingsRateLabel = data.savingsRateLabel ?? `${data.savingsRate}%`;

  return (
    <AppShell currentPath="/financial-health" eyebrow="Score and guidance" title="Quantify how strong your financial position really is">
      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel className="flex flex-col items-center justify-center p-8">
          <ScoreRing score={data.score} />
          <p className="mt-6 max-w-sm text-center text-sm leading-7 text-slate-300">
            {data.summary ??
              "WealthLens scores savings momentum, spending consistency, subscription burden, and cash runway to explain what is helping or hurting your money habits."}
          </p>
        </Panel>

        <Panel className="p-6">
          <h2 className="text-xl font-semibold text-white">Score factors</h2>
          <div className="mt-6 space-y-5">
            {factors.map((factor: { label: string; value: number }) => (
              <div key={factor.label}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-slate-300">{factor.label}</span>
                  <span className="font-medium text-white">{factor.value}/100</span>
                </div>
                <div className="h-3 rounded-full bg-white/7">
                  <div
                    className="h-3 rounded-full bg-[var(--color-accent)]"
                    style={{ width: `${Math.min(Math.max(factor.value, 0), 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
              <div className="text-sm text-slate-400">Savings rate</div>
              <div className="mt-3 text-2xl font-semibold text-white">{savingsRateLabel}</div>
            </div>
            <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
              <div className="text-sm text-slate-400">Emergency runway</div>
              <div className="mt-3 text-2xl font-semibold text-white">{data.emergencyFundDays} days</div>
            </div>
            <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
              <div className="text-sm text-slate-400">Subscription burden</div>
              <div className="mt-3 text-2xl font-semibold text-white">{data.subscriptionBurden}%</div>
            </div>
          </div>
        </Panel>
      </section>

      <Panel className="p-6">
        <h2 className="text-xl font-semibold text-white">Recommendations to lift your score</h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {data.recommendations.map((recommendation: string) => (
            <div key={recommendation} className="rounded-[28px] border border-white/8 bg-white/4 p-5 text-sm leading-7 text-slate-200">
              {recommendation}
            </div>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
