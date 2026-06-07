"use client";

import { useSyncExternalStore } from "react";
import { Pie, PieChart, ResponsiveContainer } from "recharts";

export function ScoreRing({ score }: { score: number }) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const data = [
    { name: "score", value: score, fill: "#a7c3ff" },
    { name: "remaining", value: 100 - score, fill: "rgba(255,255,255,0.08)" },
  ];

  return (
    <div className="relative h-56 w-56">
      {mounted ? (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={72} outerRadius={92} stroke="none" startAngle={90} endAngle={-270} />
          </PieChart>
        </ResponsiveContainer>
      ) : null}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-5xl font-semibold text-white">{score}</div>
        <div className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-400">Health score</div>
      </div>
    </div>
  );
}
