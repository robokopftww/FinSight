import { cn } from "@/lib/utils";
import { Panel } from "@/components/ui/panel";

export type MetricTone = "positive" | "negative" | "warning" | "accent";

const toneMap: Record<MetricTone, { chip: string; text: string; stroke: string }> = {
  positive: { chip: "bg-emerald-50", text: "text-emerald-700", stroke: "#059669" },
  negative: { chip: "bg-red-50", text: "text-red-700", stroke: "#dc2626" },
  warning: { chip: "bg-amber-50", text: "text-amber-700", stroke: "#d97706" },
  accent: { chip: "bg-[var(--color-accent-soft)]", text: "text-[var(--color-accent-text)]", stroke: "#2563eb" },
};

export function MetricCard({
  label,
  value,
  delta,
  tone,
  points,
  trend,
}: {
  label: string;
  value: string;
  delta?: string;
  tone?: MetricTone;
  points?: number[];
  trend?: "up" | "down";
}) {
  const resolvedTone: MetricTone = tone ?? (trend === "down" ? "negative" : "positive");
  const t = toneMap[resolvedTone];

  return (
    <Panel className="p-5">
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="font-mono text-[22px] font-semibold tabular-nums text-slate-950">{value}</div>
        {delta ? (
          <span className={cn("rounded-full px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums", t.chip, t.text)}>
            {delta}
          </span>
        ) : null}
      </div>
      {points && points.length > 1 ? (
        <div className="mt-3">
          <Sparkline points={points} color={t.stroke} />
        </div>
      ) : null}
    </Panel>
  );
}

function Sparkline({ points, color }: { points: number[]; color: string }) {
  const w = 240;
  const h = 36;
  const pad = 2;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(1, max - min);
  const stepX = (w - pad * 2) / (points.length - 1);
  const path = points
    .map((p, i) => {
      const x = pad + i * stepX;
      const y = pad + (1 - (p - min) / range) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-9 w-full" aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
