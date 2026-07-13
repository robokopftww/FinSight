"use client";

import { Bot, MessageCircle, X } from "lucide-react";
import { useEffect, useReducer, useRef } from "react";

import { AdvisorChat } from "@/components/advisor-chat";
import { advisorWindowReducer, initialAdvisorWindowState } from "@/lib/advisor-window";

export function DashboardAdvisor() {
  const [state, dispatch] = useReducer(advisorWindowReducer, initialAdvisorWindowState);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!state.open) {
      return;
    }

    panelRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        dispatch({ type: "close" });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.open]);

  useEffect(() => {
    if (!state.open && state.hasOpened) {
      launcherRef.current?.focus();
    }
  }, [state.hasOpened, state.open]);

  return (
    <>
      {state.hasOpened ? (
        <aside
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-label="WealthLens Advisor"
          aria-hidden={!state.open}
          tabIndex={-1}
          className={`fixed bottom-24 right-4 z-40 flex h-[min(35rem,calc(100vh-7rem))] w-[calc(100vw-2rem)] max-w-96 origin-bottom-right flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] transition duration-200 sm:right-6 ${
            state.open
              ? "translate-y-0 scale-100 opacity-100"
              : "pointer-events-none invisible translate-y-3 scale-95 opacity-0"
          }`}
        >
          <div className="flex items-center justify-between bg-blue-600 px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-white/15">
                <Bot className="size-5" />
              </span>
              <div>
                <div className="font-semibold">WealthLens Advisor</div>
                <div className="text-xs text-blue-100">Ask about your synced finances</div>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close WealthLens Advisor"
              className="rounded-full p-2 text-blue-100 transition hover:bg-white/15 hover:text-white"
              onClick={() => dispatch({ type: "close" })}
            >
              <X className="size-5" />
            </button>
          </div>
          <AdvisorChat compact />
        </aside>
      ) : null}

      {!state.open ? (
        <button
          ref={launcherRef}
          type="button"
          aria-label="Open WealthLens Advisor"
          className="fixed bottom-5 right-4 z-30 flex size-14 items-center justify-center rounded-full border border-blue-500 bg-blue-600 text-white shadow-[0_18px_55px_rgba(37,99,235,0.32)] transition hover:scale-105 hover:bg-blue-700 sm:bottom-6 sm:right-6 sm:size-16"
          onClick={() => dispatch({ type: "open" })}
        >
          <MessageCircle className="size-6 sm:size-7" />
        </button>
      ) : null}
    </>
  );
}
