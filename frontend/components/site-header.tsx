import Link from "next/link";

import { AuthControls } from "@/components/auth-controls";

const links = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "/demo", label: "Demo" },
];

export function SiteHeader() {
  const isClerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  return (
    <header className="sticky top-0 z-20 border-b border-white/6 bg-[rgba(6,10,18,0.7)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
        <Link href="/" className="flex items-center gap-3 text-sm font-semibold tracking-[0.24em] text-white uppercase">
          <span className="flex size-9 items-center justify-center rounded-2xl bg-[var(--color-accent)] text-slate-950">
            F
          </span>
          FinSight
        </Link>
        <nav className="hidden items-center gap-2 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm text-slate-300 transition hover:bg-white/6 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <AuthControls enabled={isClerkConfigured} />
      </div>
    </header>
  );
}
