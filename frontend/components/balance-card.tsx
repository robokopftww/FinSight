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
  accountsBreakdown?: Array<{ name: string; mask: string | null; currentBalance: number }>;
};

export function BalanceCard({
  currentBalance,
  monthOverMonthChange,
  accountsBreakdown = [],
}: BalanceCardProps) {
  const positive = (monthOverMonthChange?.amount ?? 0) >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;

  return (
    <Panel className="p-5">
      <div className="text-sm text-slate-400">Current balance</div>
      <div className="mt-3 flex flex-wrap items-baseline gap-3">
        <div className="text-3xl font-semibold text-white">{formatCurrency(currentBalance)}</div>
        {monthOverMonthChange ? (
          <div className={`flex items-center gap-1 text-sm ${positive ? "text-emerald-600" : "text-red-600"}`}>
            <Icon className="size-4" />
            {formatCurrency(Math.abs(monthOverMonthChange.amount))} ({monthOverMonthChange.percent}%)
          </div>
        ) : null}
      </div>

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
