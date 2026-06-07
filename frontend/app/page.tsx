import Link from "next/link";
import { ArrowRight, ChartSpline, CircleDollarSign, CreditCard, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { insights, overview, spendingBreakdown, subscriptions } from "@/lib/api";

const features = [
  {
    icon: ChartSpline,
    title: "Spending intelligence",
    description: "Spot category spikes, behavior drift, and merchant-level patterns before they snowball.",
  },
  {
    icon: TrendingUp,
    title: "Cash flow forecasting",
    description: "Project 7, 30, and 90 day balances with risk signals for low-cash moments.",
  },
  {
    icon: CreditCard,
    title: "Subscription detection",
    description: "Surface recurring charges, annualized burden, and low-value subscriptions worth cutting.",
  },
  {
    icon: ShieldCheck,
    title: "Financial health scoring",
    description: "Combine savings rate, stability, runway, and burden into one clear score.",
  },
];

const testimonials = [
  {
    name: "Avery Chen",
    role: "Product designer",
    quote: "WealthLens feels like having a calm, numbers-first financial analyst in my pocket.",
  },
  {
    name: "Jordan Patel",
    role: "Early career engineer",
    quote: "The forecast and safe-to-spend numbers changed how I make purchases week to week.",
  },
  {
    name: "Maya Brooks",
    role: "Consulting analyst",
    quote: "It catches recurring spend and subtle habit creep without feeling preachy.",
  },
];

const pricingTiers = [
  {
    name: "Starter",
    price: "$0",
    blurb: "For individual users exploring cash flow awareness.",
  },
  {
    name: "Growth",
    price: "$12",
    blurb: "For proactive users who want deeper insights, forecasting, and advisor chat.",
  },
  {
    name: "Plus",
    price: "$24",
    blurb: "For premium analytics, multi-account views, and advanced planning workflows.",
  },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function Home() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(44,194,156,0.2),transparent_24%),radial-gradient(circle_at_top_right,rgba(76,125,255,0.18),transparent_22%),#07111f] text-white">
      <SiteHeader />

      <main>
        <section className="mx-auto max-w-7xl px-6 pb-20 pt-14 lg:px-8 lg:pt-20">
          <div className="grid gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">
                <Sparkles className="size-4 text-[var(--color-accent)]" />
                AI Financial Copilot
              </div>
              <h1 className="mt-8 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-tight text-white lg:text-7xl">
                Predict spending before it becomes a problem.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                WealthLens connects your accounts, models your cash flow, and turns financial behavior into grounded, useful advice before the risk hits.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild className="h-12">
                  <Link href="/demo">
                    Open product demo
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button asChild variant="secondary" className="h-12">
                  <Link href="#pricing">View pricing</Link>
                </Button>
              </div>
            </div>

            <Panel className="overflow-hidden p-6 lg:p-8">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[28px] border border-white/8 bg-white/5 p-5">
                  <div className="text-sm text-slate-400">Current balance</div>
                  <div className="mt-4 text-3xl font-semibold text-white">{formatCurrency(overview.currentBalance)}</div>
                  <div className="mt-6 rounded-full bg-emerald-300/14 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
                    Safe to spend {formatCurrency(overview.safeToSpend)}
                  </div>
                </div>
                <div className="rounded-[28px] border border-white/8 bg-white/5 p-5">
                  <div className="text-sm text-slate-400">Health score</div>
                  <div className="mt-4 flex items-end gap-3">
                    <div className="text-4xl font-semibold text-white">{overview.healthScore}</div>
                    <div className="pb-2 text-sm text-slate-400">out of 100</div>
                  </div>
                  <div className="mt-6 text-sm text-slate-300">Savings rate is holding at {overview.savingsRate}% this month.</div>
                </div>
              </div>

              <div className="mt-4 rounded-[28px] border border-white/8 bg-[#091120] p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Insight preview</div>
                <div className="mt-4 space-y-3">
                  {insights.map((insight) => (
                    <div key={insight.title} className="rounded-2xl border border-white/8 bg-white/4 p-4">
                      <div className="font-medium text-white">{insight.title}</div>
                      <div className="mt-2 text-sm leading-6 text-slate-300">{insight.summary}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          </div>
        </section>

        <section id="features" className="border-t border-white/6 bg-black/12">
          <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
            <div className="max-w-2xl">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Features</div>
              <h2 className="mt-4 text-4xl font-semibold tracking-tight text-white">A full financial analyst layer over your daily money data.</h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <Panel key={feature.title} className="p-5">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-white/8">
                      <Icon className="size-5 text-[var(--color-accent)]" />
                    </span>
                    <h3 className="mt-6 text-xl font-semibold text-white">{feature.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-300">{feature.description}</p>
                  </Panel>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
            <Panel className="p-6">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Subscription intelligence</div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">Recurring spend, annualized and easy to challenge.</h2>
              <div className="mt-8 space-y-4">
                {subscriptions.map((subscription) => (
                  <div key={subscription.name} className="flex items-center justify-between rounded-[24px] border border-white/8 bg-white/4 px-4 py-4">
                    <div>
                      <div className="font-medium text-white">{subscription.name}</div>
                      <div className="mt-1 text-sm text-slate-400">{subscription.note}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-white">{formatCurrency(subscription.monthlyCost)}</div>
                      <div className="mt-1 text-sm text-slate-400">{formatCurrency(subscription.yearlyCost)} yearly</div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel className="p-6">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Spending mix</div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">See where spending pressure is actually forming.</h2>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {spendingBreakdown.map((item) => (
                  <div key={item.category} className="rounded-[24px] border border-white/8 bg-white/4 p-5">
                    <div className="flex items-center gap-3 text-sm text-slate-300">
                      <span className="size-3 rounded-full" style={{ backgroundColor: item.fill }} />
                      {item.category}
                    </div>
                    <div className="mt-5 text-3xl font-semibold text-white">{formatCurrency(item.amount)}</div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </section>

        <section className="border-t border-white/6 bg-black/12">
          <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Testimonials</div>
                <h2 className="mt-4 text-4xl font-semibold tracking-tight text-white">Built for people who want clarity without spreadsheet fatigue.</h2>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/8 bg-white/5 px-4 py-2 text-sm text-slate-300">
                <CircleDollarSign className="size-4 text-[var(--color-accent)]" />
                Mock user stories for MVP positioning
              </div>
            </div>
            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {testimonials.map((testimonial) => (
                <Panel key={testimonial.name} className="p-6">
                  <p className="text-base leading-8 text-slate-100">{testimonial.quote}</p>
                  <div className="mt-8">
                    <div className="font-medium text-white">{testimonial.name}</div>
                    <div className="mt-1 text-sm text-slate-400">{testimonial.role}</div>
                  </div>
                </Panel>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Pricing</div>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-white">Simple plans for a product that earns trust with numbers.</h2>
          </div>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {pricingTiers.map((tier, index) => (
              <Panel key={tier.name} className={index === 1 ? "border-emerald-300/18 p-6" : "p-6"}>
                <div className="text-sm font-medium text-slate-300">{tier.name}</div>
                <div className="mt-4 flex items-end gap-2">
                  <div className="text-5xl font-semibold text-white">{tier.price}</div>
                  <div className="pb-2 text-sm text-slate-400">/ month</div>
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-300">{tier.blurb}</p>
                <Button className="mt-8 h-12 w-full" variant={index === 1 ? "primary" : "secondary"}>
                  {index === 1 ? "Start Growth" : "Choose plan"}
                </Button>
              </Panel>
            ))}
          </div>
        </section>

        <section className="pb-20">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <Panel className="overflow-hidden p-8 lg:p-10">
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Get started</div>
                  <h2 className="mt-4 text-4xl font-semibold tracking-tight text-white">Move from reactive budgeting to proactive financial control.</h2>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
                    Connect your accounts, sync transaction history, and let WealthLens explain what is changing before it becomes expensive.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                  <Button asChild className="h-12">
                    <Link href="/demo">
                      Explore dashboard
                      <ArrowRight className="ml-2 size-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" className="h-12">
                    <Link href="/demo">View health score</Link>
                  </Button>
                </div>
              </div>
            </Panel>
          </div>
        </section>
      </main>
    </div>
  );
}
