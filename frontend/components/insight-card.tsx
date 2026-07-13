import { AlertTriangle, BadgeAlert, Sparkles } from "lucide-react";

import { Panel } from "@/components/ui/panel";

const severityStyles = {
  high: {
    icon: BadgeAlert,
    badge: "bg-red-50 text-red-700",
  },
  medium: {
    icon: AlertTriangle,
    badge: "bg-amber-300/14 text-amber-700",
  },
  low: {
    icon: Sparkles,
    badge: "bg-emerald-50 text-emerald-700",
  },
};

export function InsightCard({
  title,
  summary,
  severity,
}: {
  title: string;
  summary: string;
  severity: "high" | "medium" | "low";
}) {
  const style = severityStyles[severity];
  const Icon = style.icon;

  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-sm font-medium text-slate-950">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-slate-100">
            <Icon className="size-4" />
          </span>
          {title}
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${style.badge}`}>
          {severity}
        </span>
      </div>
      <p className="mt-4 text-sm leading-7 text-slate-600">{summary}</p>
    </Panel>
  );
}
