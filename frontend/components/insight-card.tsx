import { AlertTriangle, BadgeAlert, Sparkles } from "lucide-react";

import { Panel } from "@/components/ui/panel";

const severityStyles = {
  high: {
    icon: BadgeAlert,
    badge: "bg-rose-400/14 text-rose-200",
  },
  medium: {
    icon: AlertTriangle,
    badge: "bg-amber-300/14 text-amber-100",
  },
  low: {
    icon: Sparkles,
    badge: "bg-emerald-300/14 text-emerald-100",
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
        <div className="flex items-center gap-3 text-sm font-medium text-white">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-white/8">
            <Icon className="size-4" />
          </span>
          {title}
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${style.badge}`}>
          {severity}
        </span>
      </div>
      <p className="mt-4 text-sm leading-7 text-slate-300">{summary}</p>
    </Panel>
  );
}
