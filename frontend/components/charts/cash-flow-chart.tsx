"use client";

import { useSyncExternalStore } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function CashFlowChart({
  data,
}: {
  data: Array<{ label?: string; day?: string; balance: number }>;
}) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return (
    <div className="h-72 w-full">
      {mounted ? (
        <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 1, height: 1 }}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="cash-flow-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#dbe4f0" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
            <Tooltip
              cursor={false}
              contentStyle={{
                backgroundColor: "#ffffff",
                border: "1px solid #dbe4f0",
                borderRadius: 16,
                color: "#0f172a",
                boxShadow: "0 14px 36px rgba(15, 23, 42, 0.12)",
              }}
            />
            <Area type="monotone" dataKey="balance" stroke="#2563eb" strokeWidth={2.5} fill="url(#cash-flow-fill)" />
          </AreaChart>
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}
