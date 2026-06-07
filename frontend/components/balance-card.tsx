import { ArrowDownRight, ArrowUpRight } from "lucide-react";

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
  monthOverMonthChange?: { amount: number; percent: number } | null;
  balanceTrend?: Array<{ label: string; balance: number }>;
  accountsBreakdown?: Array<{ name: string; mask: string | null; currentBalance: number }>;
};

export function BalanceCard({
  currentBalance,
  monthOverMonthChange,
  balanceTrend = [],
  accountsBreakdown = [],
}: BalanceCardProps) {
  const positive = (monthOverMonthChange?.amount ?? 0) >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  const balances = balanceTrend.map((point) => point.balance);
  const minBalance = Math.min(...balances, 0);
  const balanceRange = Math.max(Math.max(...balances, 1) - minBalance, 1);

  return (
    <Panel className="p-5">
      <div className="text-sm text-slate-400">Current balance</div>
      <div className="mt-3 flex flex-wrap items-baseline gap-3">
        <div className="text-3xl font-semibold text-white">{formatCurrency(currentBalance)}</div>
        {monthOverMonthChange ? (
          <div className={`flex items-center gap-1 text-sm ${positive ? "text-emerald-400" : "text-rose-400"}`}>
            <Icon className="size-4" />
            {formatCurrency(Math.abs(monthOverMonthChange.amount))} ({monthOverMonthChange.percent}%)
          </div>
        ) : null}
      </div>

      {balanceTrend.length > 0 ? (
        <div className="mt-5 flex h-16 items-end gap-2">
          {balanceTrend.map((point) => (
            <div key={point.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <div
                className="w-full rounded-t bg-emerald-400/70"
                style={{ height: `${Math.max(((point.balance - minBalance) / balanceRange) * 100, 5)}%` }}
              />
              <span className="text-[10px] text-slate-500">{point.label}</span>
            </div>
          ))}
        </div>
      ) : null}

      {accountsBreakdown.length > 1 ? (
        <div className="mt-5 space-y-2 border-t border-white/8 pt-4">
          {accountsBreakdown.map((account) => (
            <div key={`${account.name}-${account.mask}`} className="flex justify-between text-xs text-slate-400">
              <span>{account.name}{account.mask ? ` ·${account.mask}` : ""}</span>
              <span className="text-slate-200">{formatCurrency(account.currentBalance)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}
