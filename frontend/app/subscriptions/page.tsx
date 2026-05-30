import { auth } from "@clerk/nextjs/server";

import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/ui/panel";
import { getSubscriptions } from "@/lib/api";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export default async function SubscriptionsPage() {
  const { getToken } = await auth();
  const response = await getSubscriptions(await getToken());
  const totalMonthly = response.data.reduce((total: number, item: { monthlyCost: number }) => total + item.monthlyCost, 0);
  const totalYearly = response.data.reduce((total: number, item: { yearlyCost: number }) => total + item.yearlyCost, 0);

  return (
    <AppShell currentPath="/subscriptions" eyebrow="Recurring spend" title="Track what keeps charging you every month">
      <section className="grid gap-4 lg:grid-cols-3">
        <Panel className="p-5">
          <div className="text-sm text-slate-400">Monthly subscription cost</div>
          <div className="mt-4 text-3xl font-semibold text-white">{formatCurrency(totalMonthly)}</div>
        </Panel>
        <Panel className="p-5">
          <div className="text-sm text-slate-400">Yearly subscription cost</div>
          <div className="mt-4 text-3xl font-semibold text-white">{formatCurrency(totalYearly)}</div>
        </Panel>
        <Panel className="p-5">
          <div className="text-sm text-slate-400">Savings opportunity</div>
          <div className="mt-4 text-3xl font-semibold text-white">$342</div>
        </Panel>
      </section>

      <Panel className="p-6">
        <div className="grid gap-4 lg:grid-cols-3">
          {response.data.map((item: { name?: string; merchantName?: string; monthlyCost: number; yearlyCost: number; opportunity: string; note?: string }) => (
            <div key={item.name ?? item.merchantName} className="rounded-[28px] border border-white/8 bg-white/4 p-5">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold text-white">{item.name ?? item.merchantName}</h2>
                <span
                  className={
                    item.opportunity === "Review"
                      ? "rounded-full bg-amber-300/14 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-100"
                      : "rounded-full bg-emerald-300/14 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100"
                  }
                >
                  {item.opportunity}
                </span>
              </div>
              <div className="mt-6 text-3xl font-semibold text-white">{formatCurrency(item.monthlyCost)}</div>
              <div className="mt-2 text-sm text-slate-400">{formatCurrency(item.yearlyCost)} yearly</div>
              <p className="mt-6 text-sm leading-7 text-slate-300">{item.note ?? "Recurring charge detected from historical transaction cadence."}</p>
            </div>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
