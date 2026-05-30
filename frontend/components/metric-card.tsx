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

  return (
    <Panel className="p-5">
      <div className="text-sm text-slate-400">{label}</div>
      <div className="mt-4 text-3xl font-semibold text-white">{value}</div>
      <div className="mt-5 flex items-center gap-2 text-sm text-slate-300">
        <span className="flex size-8 items-center justify-center rounded-full bg-white/8">
          <Icon className="size-4" />
        </span>
        {delta}
      </div>
    </Panel>
  );
}
