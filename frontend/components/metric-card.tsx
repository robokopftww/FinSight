import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { Panel } from "@/components/ui/panel";

export function MetricCard({
  label,
  value,
  delta,
  trend = "up",
}: {
  label: string;
  value: string;
  delta: string;
  trend?: "up" | "down";
}) {
  const Icon = trend === "up" ? ArrowUpRight : ArrowDownRight;
  const trendColor = trend === "up" ? "text-emerald-600" : "text-red-600";
  const trendBackground = trend === "up" ? "bg-emerald-50" : "bg-red-50";

  return (
    <Panel className="p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-4 text-3xl font-semibold text-slate-950">{value}</div>
      <div className={`mt-5 flex items-center gap-2 text-sm font-medium ${trendColor}`}>
        <span className={`flex size-8 items-center justify-center rounded-full ${trendBackground}`}>
          <Icon className="size-4" />
        </span>
        {delta}
      </div>
    </Panel>
  );
}
