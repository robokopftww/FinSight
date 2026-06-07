import Link from "next/link";
import {
  ArrowRight,
  ChartSpline,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  Landmark,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

type Subscription = {
  name: string;
  monthlyCost: number;
  yearlyCost: number;
  note: string;
};

type SpendingCategory = {
  category: string;
  amount: number;
  fill: string;
};

type Testimonial = {
  name: string;
  role: string;
  quote: string;
};

type PricingTier = {
  name: string;
  price: string;
  blurb: string;
  cta: string;
  featured?: boolean;
};

const features: Feature[] = [
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

const subscriptions: Subscription[] = [
  {
    name: "Netflix",
    monthlyCost: 15.49,
    yearlyCost: 185.88,
    note: "Steady weekly usage detected.",
  },
  {
    name: "Spotify",
    monthlyCost: 10.99,
    yearlyCost: 131.88,
    note: "Recent activity is lower than your normal listening pattern.",
  },
  {
    name: "Climbing Gym",
    monthlyCost: 49,
    yearlyCost: 588,
    note: "High annual cost relative to visit frequency.",
  },
];

const spendingBreakdown: SpendingCategory[] = [
  { category: "Food", amount: 840, fill: "#8ef0d1" },
  { category: "Shopping", amount: 670, fill: "#58b8ff" },
  { category: "Bills", amount: 780, fill: "#ffb65e" },
  { category: "Transportation", amount: 292, fill: "#ff7b72" },
  { category: "Entertainment", amount: 543, fill: "#d0a2ff" },
];

const testimonials: Testimonial[] = [
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

const pricingTiers: PricingTier[] = [
  {
    name: "Starter",
    price: "$0",
    blurb: "For individual users exploring cash flow awareness.",
    cta: "Choose plan",
  },
  {
    name: "Growth",
    price: "$12",
    blurb: "For proactive users who want deeper insights, forecasting, and advisor chat.",
    cta: "Start Growth",
    featured: true,
  },
  {
    name: "Plus",
    price: "$24",
    blurb: "For premium analytics, multi-account views, and advanced planning workflows.",
    cta: "Choose plan",
  },
];

const usd0 = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const usd2 = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

function LandingButton({
  href,
  children,
  variant = "primary",
  size = "default",
  block = false,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "default" | "large";
  block?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "wl-landing-btn",
        `wl-landing-btn-${variant}`,
        size === "large" ? "wl-landing-btn-lg" : "",
        block ? "wl-landing-btn-block" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Link>
  );
}

function Brand() {
  return (
    <Link href="/" className="wl-landing-brand" aria-label="WealthLens home">
      <span className="wl-landing-brand-mark">
        <Landmark size={20} aria-hidden="true" />
      </span>
      <span className="wl-landing-brand-word">WealthLens</span>
    </Link>
  );
}

function Header() {
  return (
    <header className="wl-landing-header">
      <div className="wl-landing-header-inner">
        <Brand />
        <nav className="wl-landing-nav" aria-label="Landing page">
          <Link href="#features">Features</Link>
          <Link href="#intelligence">Intelligence</Link>
          <Link href="#pricing">Pricing</Link>
          <Link href="/demo">Demo</Link>
        </nav>
        <div className="wl-landing-header-cta">
          <LandingButton href="/sign-in" variant="ghost">
            Sign in
          </LandingButton>
          <LandingButton href="/demo">Get started</LandingButton>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="wl-landing-hero" id="top">
      <div className="wl-landing-video-layer" aria-hidden="true">
        <video src="/uploads/14968848_1920_1080_30fps.mp4" muted playsInline autoPlay loop preload="metadata" />
        <div className="wl-landing-video-wash" />
        <div className="wl-landing-brand-glow" />
        <div className="wl-landing-grain" />
      </div>

      <div className="wl-landing-hero-content">
        <div className="wl-landing-badge wl-landing-fade-rise">
          <Sparkles size={14} aria-hidden="true" />
          AI Financial Copilot
        </div>
        <h1 className="wl-landing-headline wl-landing-fade-rise wl-landing-d1">
          Predict spending before it becomes <span>a problem.</span>
        </h1>
        <p className="wl-landing-desc wl-landing-fade-rise wl-landing-d2">
          WealthLens connects your accounts, models your cash flow, and turns financial behavior into grounded, useful
          advice before the risk hits.
        </p>
        <div className="wl-landing-cta-row wl-landing-fade-rise wl-landing-d3">
          <LandingButton href="/demo" size="large">
            Open product demo <ArrowRight className="wl-landing-arrow" size={16} aria-hidden="true" />
          </LandingButton>
          <LandingButton href="#pricing" variant="secondary" size="large">
            View pricing
          </LandingButton>
        </div>

        <div className="wl-landing-metrics wl-landing-fade-rise wl-landing-d4">
          <div className="wl-landing-metric">
            <div className="wl-landing-label">Current balance</div>
            <div className="wl-landing-value">$8,420</div>
            <div className="wl-landing-pill">Safe to spend $650</div>
          </div>
          <div className="wl-landing-metric">
            <div className="wl-landing-label">Health score</div>
            <div className="wl-landing-value">
              82<span> / 100</span>
            </div>
            <div className="wl-landing-sub">
              <span className="wl-landing-dot" /> Savings rate holding at 18.6%
            </div>
          </div>
          <div className="wl-landing-metric">
            <div className="wl-landing-label">Forecast signal</div>
            <div className="wl-landing-value">11 days</div>
            <div className="wl-landing-sub">
              <span className="wl-landing-dot wl-landing-dot-warning" /> Low-balance risk detected early
            </div>
          </div>
        </div>

        <Link className="wl-landing-scroll-cue wl-landing-fade-rise wl-landing-d4" href="#features">
          Explore
          <ChevronDown size={18} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="wl-landing-section wl-landing-section-alt">
      <div className="wl-landing-wrap">
        <div className="wl-landing-section-head">
          <div className="wl-landing-overline">Features</div>
          <h2 className="wl-landing-section-title">A full financial analyst layer over your daily money data.</h2>
        </div>
        <div className="wl-landing-feature-grid">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="wl-landing-panel wl-landing-feature">
                <span className="wl-landing-feature-icon">
                  <Icon size={22} aria-hidden="true" />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Intelligence() {
  return (
    <section id="intelligence" className="wl-landing-section">
      <div className="wl-landing-wrap">
        <div className="wl-landing-two-up">
          <article className="wl-landing-panel wl-landing-intelligence-card">
            <div className="wl-landing-overline">Subscription intelligence</div>
            <h2 className="wl-landing-card-title">Recurring spend, annualized and easy to challenge.</h2>
            <div className="wl-landing-subscription-list">
              {subscriptions.map((subscription) => (
                <div key={subscription.name} className="wl-landing-sub-row">
                  <div>
                    <div className="wl-landing-sub-name">{subscription.name}</div>
                    <div className="wl-landing-sub-note">{subscription.note}</div>
                  </div>
                  <div>
                    <div className="wl-landing-sub-cost">{usd2(subscription.monthlyCost)}</div>
                    <div className="wl-landing-sub-year">{usd2(subscription.yearlyCost)} yearly</div>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="wl-landing-panel wl-landing-intelligence-card">
            <div className="wl-landing-overline">Spending mix</div>
            <h2 className="wl-landing-card-title">See where spending pressure is actually forming.</h2>
            <div className="wl-landing-mix-grid">
              {spendingBreakdown.map((item) => (
                <div key={item.category} className="wl-landing-mix">
                  <div className="wl-landing-mix-cat">
                    <span className="wl-landing-swatch" style={{ background: item.fill }} />
                    {item.category}
                  </div>
                  <div className="wl-landing-mix-amount">{usd0(item.amount)}</div>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="wl-landing-section wl-landing-section-alt">
      <div className="wl-landing-wrap">
        <div className="wl-landing-testimonial-top">
          <div className="wl-landing-section-head">
            <div className="wl-landing-overline">Testimonials</div>
            <h2 className="wl-landing-section-title">Built for people who want clarity without spreadsheet fatigue.</h2>
          </div>
          <div className="wl-landing-chip">
            <CircleDollarSign size={16} aria-hidden="true" />
            Mock user stories for MVP positioning
          </div>
        </div>
        <div className="wl-landing-testimonial-grid">
          {testimonials.map((testimonial) => (
            <article key={testimonial.name} className="wl-landing-panel wl-landing-testimonial-card">
              <p>{testimonial.quote}</p>
              <div>
                <div className="wl-landing-testimonial-name">{testimonial.name}</div>
                <div className="wl-landing-testimonial-role">{testimonial.role}</div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="wl-landing-section">
      <div className="wl-landing-wrap">
        <div className="wl-landing-price-head">
          <div className="wl-landing-overline">Pricing</div>
          <h2 className="wl-landing-section-title">Simple plans for a product that earns trust with numbers.</h2>
        </div>
        <div className="wl-landing-price-grid">
          {pricingTiers.map((tier) => (
            <article
              key={tier.name}
              className={`wl-landing-panel wl-landing-tier${tier.featured ? " wl-landing-tier-featured" : ""}`}
            >
              <div className="wl-landing-tier-name">
                {tier.name}
                {tier.featured ? <span>Popular</span> : null}
              </div>
              <div className="wl-landing-price">
                <span>{tier.price}</span>
                <span>/ month</span>
              </div>
              <p>{tier.blurb}</p>
              <LandingButton href="/demo" variant={tier.featured ? "primary" : "secondary"} block>
                {tier.cta}
              </LandingButton>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function GetStarted() {
  return (
    <section id="demo" className="wl-landing-section wl-landing-getstarted">
      <div className="wl-landing-wrap">
        <div className="wl-landing-panel">
          <div className="wl-landing-getstarted-grid">
            <div>
              <div className="wl-landing-overline">Get started</div>
              <h2>Move from reactive budgeting to proactive financial control.</h2>
              <p>
                Connect your accounts, sync transaction history, and let WealthLens explain what is changing before it
                becomes expensive.
              </p>
            </div>
            <div className="wl-landing-actions">
              <LandingButton href="/dashboard" size="large">
                Explore dashboard <ArrowRight className="wl-landing-arrow" size={16} aria-hidden="true" />
              </LandingButton>
              <LandingButton href="/financial-health" variant="secondary" size="large">
                View health score
              </LandingButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="wl-landing-footer">
      <div className="wl-landing-footer-inner">
        <Brand />
        <div className="wl-landing-footer-links">
          <Link href="#features">Features</Link>
          <Link href="#intelligence">Intelligence</Link>
          <Link href="#pricing">Pricing</Link>
          <Link href="/demo">Demo</Link>
          <Link href="/settings">Privacy</Link>
        </div>
        <div className="wl-landing-copy">2026 WealthLens / AI financial copilot</div>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <div className="wl-landing">
      <Header />
      <main>
        <Hero />
        <Features />
        <Intelligence />
        <Testimonials />
        <Pricing />
        <GetStarted />
      </main>
      <Footer />
    </div>
  );
}
