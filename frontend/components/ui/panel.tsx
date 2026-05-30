import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type PanelProps = HTMLAttributes<HTMLDivElement>;

export function Panel({ className, ...props }: PanelProps) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] shadow-[0_18px_80px_rgba(0,0,0,0.25)] backdrop-blur",
        className,
      )}
      {...props}
    />
  );
}
