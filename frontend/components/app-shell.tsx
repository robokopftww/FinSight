import type { ReactNode } from "react";
import Link from "next/link";
import { Bot, ChartNoAxesCombined, CreditCard, FileText, House, Landmark, Settings, ShieldCheck, Sparkles } from "lucide-react";

import { AppUserControls } from "@/components/app-user-controls";
import { UserSync } from "@/components/user-sync";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/demo", label: "Demo mode", icon: Sparkles },
  { href: "/dashboard", label: "Overview", icon: House },
  { href: "/transactions", label: "Transactions", icon: CreditCard },
  { href: "/subscriptions", label: "Subscriptions", icon: Bot },
  { href: "/financial-health", label: "Financial health", icon: ShieldCheck },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

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
      <div className="mx-auto grid min-h-screen max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[250px_minmax(0,1fr)] lg:px-8">
        <aside className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <Link href="/" className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.24em] text-slate-950">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-blue-600 text-white">
              <Landmark className="size-5" aria-hidden="true" />
            </span>
            WealthLens
          </Link>

          <div className="mt-10 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition",
                    currentPath === item.href
                      ? "border border-[var(--color-accent-border)] bg-[var(--color-accent-soft)] text-[var(--color-accent-text)]"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="mt-10 rounded-3xl border border-[var(--color-accent-border)] bg-[var(--color-accent-soft)] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-text)]">
              <ChartNoAxesCombined className="size-4" />
              Analyst mode
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Forecasts, health scoring, and advisor responses are designed to be powered by the Python analytics service.
            </p>
          </div>
        </aside>

        <main className="space-y-6">
          <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] lg:p-8">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{eyebrow}</div>
            <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950 lg:text-4xl">{title}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                  Modern financial intelligence grounded in real account behavior, forecast risk, and recommendation quality.
                </p>
              </div>
              {demoMode ? (
                <span className="rounded-full border border-[var(--color-accent-border)] bg-[var(--color-accent-soft)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-text)]">
                  Demo data
                </span>
              ) : isClerkConfigured ? (
                <AppUserControls />
              ) : null}
            </div>
          </section>
          {children}
        </main>
      </div>
    </div>
  );
}
