const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const dashboardOverview = {
  currentBalance: 8420.12,
  availableBalance: 7910.45,
  monthlySpending: 3124.81,
  monthlyIncome: 5400,
  savingsRate: 18.6,
  healthScore: 82,
  safeToSpend: 650,
  riskProbability: 0.29,
  insightHighlights: [
    {
      id: "insight-1",
      title: "Low balance risk is rising",
      summary: "At your current spending pace, your balance could fall below $500 in 11 days.",
      severity: "high",
    },
    {
      id: "insight-2",
      title: "Restaurant spending is accelerating",
      summary: "Dining spend is up 28% month over month, mainly from weekend purchases.",
      severity: "medium",
    },
    {
      id: "insight-3",
      title: "Subscriptions worth reviewing",
      summary: "Canceling lower-use subscriptions would free up an estimated $342 per year.",
      severity: "low",
    },
  ],
  spendingBreakdown: [
    { category: "Food", amount: 840, fill: "#78e8c8" },
    { category: "Shopping", amount: 670, fill: "#47a8ff" },
    { category: "Bills", amount: 780, fill: "#f9a03f" },
    { category: "Transport", amount: 292, fill: "#f25f5c" },
    { category: "Entertainment", amount: 543, fill: "#b58cff" },
  ],
  forecast: days.map((day, index) => ({
    day,
    balance: 8420 - index * 215 + (index % 2 === 0 ? 60 : -40),
  })),
};

export const transactions = [
  {
    id: "txn_1",
    merchantName: "Whole Foods",
    description: "WHOLEFDS BKLYN 01",
    amount: 86.14,
    categoryPrimary: "Food",
    occurredAt: "2026-05-28T18:24:00.000Z",
    pending: false,
  },
  {
    id: "txn_2",
    merchantName: "Netflix",
    description: "NETFLIX.COM",
    amount: 15.49,
    categoryPrimary: "Subscription",
    occurredAt: "2026-05-27T09:13:00.000Z",
    pending: false,
  },
  {
    id: "txn_3",
    merchantName: "Shell",
    description: "SHELL OIL 574112",
    amount: 42.8,
    categoryPrimary: "Transportation",
    occurredAt: "2026-05-26T08:02:00.000Z",
    pending: false,
  },
  {
    id: "txn_4",
    merchantName: "Apple Payroll",
    description: "PAYROLL DEPOSIT",
    amount: 2700,
    categoryPrimary: "Income",
    occurredAt: "2026-05-24T12:00:00.000Z",
    pending: false,
  },
];

export const subscriptions = [
  {
    id: "sub_1",
    merchantName: "Netflix",
    monthlyCost: 15.49,
    yearlyCost: 185.88,
    confidence: 0.98,
    status: "active",
  },
  {
    id: "sub_2",
    merchantName: "Spotify",
    monthlyCost: 10.99,
    yearlyCost: 131.88,
    confidence: 0.97,
    status: "active",
  },
  {
    id: "sub_3",
    merchantName: "Climbing Gym",
    monthlyCost: 49,
    yearlyCost: 588,
    confidence: 0.9,
    status: "active",
  },
];

export const financialHealth = {
  score: 82,
  savingsRate: 18.6,
  spendingConsistency: 74,
  emergencyFundDays: 42,
  subscriptionBurden: 3.4,
  recommendations: [
    "Reduce restaurant spend by $75 per month to improve savings momentum.",
    "Review unused subscriptions to reduce annual spend by approximately $340.",
    "Keep at least one paycheck untouched this month to extend emergency runway.",
  ],
};

export const chatResponse = {
  answer:
    "Based on your projected post-bill balance of $1,240, a $400 purchase appears affordable, but it would reduce your monthly savings rate from 18.6% to roughly 10.2%.",
};
