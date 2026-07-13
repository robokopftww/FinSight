import { ArrowDownRight, ArrowUpRight, Landmark } from "lucide-react";
import type { ReactNode } from "react";

import { Panel } from "@/components/ui/panel";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

type BalanceCardProps = {
  currentBalance: number;
  availableBalance?: number;
  monthOverMonthChange?: { amount: number; percent: number } | null;
  accountsBreakdown?: Array<{ name: string; mask: string | null; currentBalance: number }>;
  refreshStatus?: ReactNode;
};

export function BalanceCard({
  currentBalance,
  availableBalance,
  monthOverMonthChange,
  accountsBreakdown = [],
  refreshStatus,
}: BalanceCardProps) {
  const positive = (monthOverMonthChange?.amount ?? 0) >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;

  return (
    <Panel className="overflow-hidden">
      <div className="bg-gradient-to-br from-blue-50 via-white to-white p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-slate-500">Current balance</div>
          <span className="flex size-10 items-center justify-center rounded-2xl bg-blue-600 text-white">
            <Landmark className="size-5" />
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-baseline gap-3">
          <div className="text-4xl font-semibold tracking-tight text-slate-950">
            {formatCurrency(currentBalance)}
          </div>
          {monthOverMonthChange ? (
            <div className={`flex items-center gap-1 text-sm font-medium ${positive ? "text-emerald-600" : "text-red-600"}`}>
              <Icon className="size-4" />
              {formatCurrency(Math.abs(monthOverMonthChange.amount))} ({monthOverMonthChange.percent}%)
            </div>
          ) : null}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-blue-100 bg-white/80 p-3">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Available balance</div>
            <div className="mt-2 font-semibold text-slate-950">
              {formatCurrency(availableBalance ?? currentBalance)}
            </div>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-white/80 p-3">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Cash accounts</div>
            <div className="mt-2 font-semibold text-slate-950">{accountsBreakdown.length}</div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 px-6 py-4">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Connected cash</div>
        <div className="mt-3 space-y-2">
          {accountsBreakdown.map((account) => (
            <div key={`${account.name}-${account.mask}`} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-600">{account.name}{account.mask ? ` ·${account.mask}` : ""}</span>
              <span className="font-medium text-slate-950">{formatCurrency(account.currentBalance)}</span>
            </div>
          ))}
          {accountsBreakdown.length === 0 ? (
            <div className="text-sm text-slate-500">No cash accounts connected.</div>
          ) : null}
        </div>
        {refreshStatus ? <div className="mt-4 border-t border-slate-200 pt-3">{refreshStatus}</div> : null}
      </div>
    </Panel>
  );
}
