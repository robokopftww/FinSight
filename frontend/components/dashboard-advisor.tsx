"use client";

import { Bot, MessageCircle, X } from "lucide-react";
import { useEffect, useState } from "react";

import { AdvisorChat } from "@/components/advisor-chat";

export function DashboardAdvisor() {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      {open ? <button type="button" aria-label="Close WealthLens Advisor" className="fixed inset-0 z-40 cursor-default bg-black/45 backdrop-blur-[2px]" onClick={() => setOpen(false)} /> : null}
      <aside
        aria-label="WealthLens Advisor"
        aria-hidden={!open}
        className={`fixed inset-y-0 right-0 z-40 flex w-[min(100%,30rem)] flex-col border-l border-emerald-300/20 bg-[#091120] shadow-[-24px_0_80px_rgba(0,0,0,0.55)] transition-transform duration-300 ${open ? "translate-x-0" : "pointer-events-none translate-x-full"}`}
      >
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-[var(--color-accent)] text-slate-950">
              <Bot className="size-5" />
            </span>
            <div>
              <div className="font-semibold text-white">WealthLens Advisor</div>
              <div className="text-xs text-slate-400">Ask about your synced finances</div>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close WealthLens Advisor"
            className="rounded-full border border-white/8 p-2 text-slate-300 transition hover:bg-white/8 hover:text-white"
            onClick={() => setOpen(false)}
          >
            <X className="size-5" />
          </button>
        </div>
        <AdvisorChat compact />
      </aside>
      {!open ? (
        <button
          type="button"
          aria-label="Open WealthLens Advisor"
          className="fixed bottom-6 right-6 z-30 flex size-16 items-center justify-center rounded-full border border-emerald-200/30 bg-[var(--color-accent)] text-slate-950 shadow-[0_18px_60px_rgba(44,194,156,0.35)] transition hover:scale-105 hover:bg-[var(--color-accent-strong)]"
          onClick={() => setOpen(true)}
        >
          <MessageCircle className="size-7" />
          <span className="absolute right-0 top-0 size-4 rounded-full border-2 border-[#07111f] bg-rose-400" />
        </button>
      ) : null}
    </>
  );
}
