import type { ReactNode } from "react";
import Link from "next/link";
import {
  Bell,
  Bot,
  CreditCard,
  FileText,
  House,
  Plus,
  Repeat,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { AppUserControls } from "@/components/app-user-controls";
import { UserSync } from "@/components/user-sync";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/demo", label: "Demo mode", icon: Sparkles },
  { href: "/dashboard", label: "Overview", icon: House },
  { href: "/transactions", label: "Transactions", icon: CreditCard },
  { href: "/subscriptions", label: "Subscriptions", icon: Repeat },
  { href: "/financial-health", label: "Financial health", icon: ShieldCheck },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/advisor", label: "Advisor", icon: Bot },
  { href: "/settings", label: "Settings", icon: Settings },
];

const ranges = ["1M", "3M", "6M", "1Y", "All"] as const;

export function AppShell({
  children,
  currentPath,
  title,
  eyebrow,
  demoMode = false,
}: {
  children: ReactNode;
  currentPath: string;
  title: string;
  eyebrow: string;
  demoMode?: boolean;
}) {
  const isClerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.10),transparent_28%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.08),transparent_24%),var(--background)] text-slate-950">
      {isClerkConfigured && !demoMode ? <UserSync /> : null}
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
          <Link
            href="/"
            className="flex items-center gap-2.5 px-5 pt-6 pb-6 text-base font-bold tracking-tight text-slate-950"
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-[var(--color-accent)]" aria-hidden="true" />
            WealthLens
          </Link>
          <nav className="flex-1 space-y-1 px-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = currentPath === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm transition",
                    active
                      ? "bg-[var(--color-accent-soft)] font-semibold text-[var(--color-accent-text)]"
                      : "font-medium text-slate-700 hover:bg-slate-50",
                  )}
                >
                  <Icon className={cn("size-4", active ? "text-[var(--color-accent-text)]" : "text-slate-500")} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="p-3">
            <div className="rounded-[14px] border border-slate-200 bg-slate-50/70 p-3 text-xs leading-5 text-slate-600">
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                <Sparkles className="size-3" /> Grounded in your data
              </div>
              Analytics service replies with real numbers when connected.
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-[72px] items-center gap-3 border-b border-slate-200 bg-white px-8">
            <label className="flex h-9 w-full max-w-[320px] items-center gap-2.5 rounded-[10px] border border-slate-200 bg-[var(--background)] px-3.5 text-[13px] text-slate-500">
              <Search className="size-3.5" />
              <input
                type="search"
                placeholder="Search transactions, categories…"
                className="w-full bg-transparent outline-none placeholder:text-slate-400"
              />
            </label>
            <div className="flex-1" />
            <div className="flex items-center rounded-[10px] border border-slate-200 bg-[var(--background)] p-0.5 text-xs">
              {ranges.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={cn(
                    "rounded-[8px] px-3 py-1.5 font-medium transition",
                    r === "6M"
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500 hover:text-slate-950",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-[var(--color-accent)] px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[var(--color-accent-strong)]"
            >
              <Plus className="size-3.5" /> Connect bank
            </button>
            <button
              type="button"
              aria-label="Notifications"
              className="flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:text-slate-950"
            >
              <Bell className="size-4" />
            </button>
            {demoMode ? (
              <span className="rounded-full border border-[var(--color-accent-border)] bg-[var(--color-accent-soft)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent-text)]">
                Demo
              </span>
            ) : isClerkConfigured ? (
              <AppUserControls />
            ) : (
              <div className="size-9 rounded-full border border-slate-200 bg-[var(--color-accent-soft)]" />
            )}
          </header>

          <main className="flex-1 px-8 py-8">
            <div className="mb-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {eyebrow}
              </div>
              <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-slate-950">
                {title}
              </h1>
            </div>
            <div className="space-y-5">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
