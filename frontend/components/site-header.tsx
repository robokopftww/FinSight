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
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
        <Link href="/" className="flex items-center gap-3 text-sm font-semibold tracking-[0.24em] text-slate-950 uppercase">
          <span className="flex size-9 items-center justify-center rounded-2xl bg-blue-600 text-white">
            F
          </span>
          WealthLens
        </Link>
        <nav className="hidden items-center gap-2 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
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
