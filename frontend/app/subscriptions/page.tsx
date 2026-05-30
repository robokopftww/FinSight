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
  const totalMonthly =
    response.summary?.totalMonthly ?? response.data.reduce((total, item) => total + item.monthlyCost, 0);
  const totalYearly =
    response.summary?.totalYearly ?? response.data.reduce((total, item) => total + item.yearlyCost, 0);
  const reviewYearly =
    response.summary?.reviewYearly ??
    response.data
      .filter((item) => item.opportunity === "Review")
      .reduce((total, item) => total + item.yearlyCost, 0);

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
          <div className="mt-4 text-3xl font-semibold text-white">{formatCurrency(reviewYearly)}</div>
        </Panel>
      </section>

      <Panel className="p-6">
        {response.data.length ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {response.data.map((item) => (
              <div key={item.id ?? item.name ?? item.merchantName} className="rounded-[28px] border border-white/8 bg-white/4 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white">{item.name ?? item.merchantName}</h2>
                    <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                      {item.category ?? item.cadence ?? "Recurring"}
                    </div>
                  </div>
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
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-[20px] border border-white/8 bg-slate-950/20 p-3">
                    <div className="text-slate-500">Charges</div>
                    <div className="mt-1 font-medium text-white">{item.chargeCount ?? 2}</div>
                  </div>
                  <div className="rounded-[20px] border border-white/8 bg-slate-950/20 p-3">
                    <div className="text-slate-500">Confidence</div>
                    <div className="mt-1 font-medium text-white">{Math.round((item.confidence ?? 0.68) * 100)}%</div>
                  </div>
                </div>
                <p className="mt-6 text-sm leading-7 text-slate-300">
                  {item.note ?? "Recurring charge detected from historical transaction cadence."}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[28px] border border-white/8 bg-white/4 p-8 text-center">
            <h2 className="text-xl font-semibold text-white">No recurring charges detected yet</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-slate-300">
              Sync more Plaid transactions and FinSight will group repeated merchants by amount and cadence.
            </p>
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
