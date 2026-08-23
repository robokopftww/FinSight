"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import {
  calculateBalanceChange,
  type BalanceHistoryPoint,
} from "@/lib/balance-history";

const RANGES = ["1M", "3M", "6M", "1Y", "All"] as const;
type Range = (typeof RANGES)[number];

const rangePoints: Record<Range, number | null> = {
  "1M": 1,
  "3M": 3,
  "6M": 6,
  "1Y": 12,
  All: null,
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatSignedCurrency(value: number) {
  return `${value >= 0 ? "+" : "-"}${formatCurrency(Math.abs(value))}`;
}

export function BalanceHistoryChart({ data }: { data: BalanceHistoryPoint[] }) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [range, setRange] = useState<Range>("6M");
  const visible = useMemo(() => {
    const take = rangePoints[range];
    if (take === null || take >= data.length) return data;
    return data.slice(-take);
  }, [data, range]);
  const change = calculateBalanceChange(visible);
  const positive = change?.direction === "up";
  const ChangeIcon = positive ? ArrowUpRight : ArrowDownRight;

  return (
    <Panel className="p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Balance over time</h2>
          <p className="mt-2 text-sm text-slate-600">
            Estimated cash balance across your synced activity.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex items-center rounded-[10px] border border-slate-200 bg-[var(--background)] p-0.5 text-xs">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={cn(
                  "rounded-[8px] px-3 py-1.5 font-medium transition",
                  r === range
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-950",
                )}
              >
                {r}
              </button>
            ))}
          </div>
          {change ? (
            <div className={`flex items-center gap-2 text-sm font-semibold ${positive ? "text-emerald-600" : "text-red-600"}`}>
              <span className={`flex size-9 items-center justify-center rounded-full ${positive ? "bg-emerald-50" : "bg-red-50"}`}>
                <ChangeIcon className="size-4" aria-hidden="true" />
              </span>
              <span>
                {formatSignedCurrency(change.amount)}
                {change.percent === null ? "" : ` (${change.percent >= 0 ? "+" : ""}${change.percent}%)`} over this period
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {change ? (
        <div className="mt-6 h-80 w-full">
          <ul className="sr-only" aria-label="Balance history values">
            {visible.map((point, index) => (
              <li key={`${point.label}-${index}`}>
                {point.label}: {formatCurrency(point.balance)}
              </li>
            ))}
          </ul>
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1, height: 1 }}>
              <AreaChart data={visible} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <defs>
                  <linearGradient id="balance-history-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#dbe4f0" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  tickFormatter={(value) => formatCompactCurrency(Number(value))}
                  width={84}
                />
                <Tooltip
                  cursor={{ stroke: "#93c5fd", strokeDasharray: "4 4" }}
                  formatter={(value) => [formatCompactCurrency(Number(value)), "Balance"]}
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #dbe4f0",
                    borderRadius: 16,
                    color: "#0f172a",
                    boxShadow: "0 14px 36px rgba(15, 23, 42, 0.12)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="#2563eb"
                  strokeWidth={3}
                  fill="url(#balance-history-fill)"
                  activeDot={{ r: 5, fill: "#2563eb", stroke: "#ffffff", strokeWidth: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : null}
        </div>
      ) : (
        <div className="mt-6 flex h-72 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm text-slate-500">
          Sync more transaction history to show how your balance changes over time.
        </div>
      )}
    </Panel>
  );
}
