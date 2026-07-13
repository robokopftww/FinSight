import type { ReactNode } from "react";
import Link from "next/link";
import { X } from "lucide-react";

import Home from "@/app/page";

export function AuthOverlayShell({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--background)]">
      <div className="pointer-events-none absolute inset-0 h-screen overflow-hidden" aria-hidden="true" inert>
        <div className="origin-top scale-[1.01] blur-[3px] saturate-75">
          <Home />
        </div>
      </div>

      <main className="fixed inset-0 z-50 flex min-h-screen items-center justify-center overflow-y-auto bg-slate-1002 px-4 py-8 backdrop-blur-md sm:px-6">
        <div className="relative w-full max-w-md">
          <Link
            href="/"
            aria-label={`Close ${label}`}
            className="absolute -right-2 -top-12 z-10 flex size-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 shadow-lg transition hover:bg-slate-100 hover:text-slate-950 sm:-right-12 sm:top-0"
          >
            <X className="size-5" aria-hidden="true" />
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
