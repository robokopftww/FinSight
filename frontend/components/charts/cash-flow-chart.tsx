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
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="cash-flow-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8ef0d1" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#8ef0d1" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
            <Tooltip
              cursor={false}
              contentStyle={{
                backgroundColor: "#08111d",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16,
                color: "white",
              }}
            />
            <Area type="monotone" dataKey="balance" stroke="#8ef0d1" strokeWidth={2.5} fill="url(#cash-flow-fill)" />
          </AreaChart>
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}
