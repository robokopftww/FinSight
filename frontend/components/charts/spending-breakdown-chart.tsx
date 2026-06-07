"use client";

import { useSyncExternalStore } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export function SpendingBreakdownChart({
  data,
}: {
  data: Array<{ category: string; amount: number; fill: string }>;
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
          <PieChart>
            <Pie data={data} dataKey="amount" innerRadius={70} outerRadius={102} paddingAngle={3} stroke="none">
              {data.map((entry) => (
                <Cell key={entry.category} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              cursor={false}
              contentStyle={{
                backgroundColor: "#0a1222",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16,
                color: "white",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}
