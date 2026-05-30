export const overview = {
  currentBalance: 8420.12,
  monthlySpending: 3124.81,
  monthlyIncome: 5400,
  savingsRate: 18.6,
  healthScore: 82,
  safeToSpend: 650,
};

export const spendingBreakdown = [
  { category: "Food", amount: 840, fill: "#8ef0d1" },
  { category: "Shopping", amount: 670, fill: "#58b8ff" },
  { category: "Bills", amount: 780, fill: "#ffb65e" },
  { category: "Transportation", amount: 292, fill: "#ff7b72" },
  { category: "Entertainment", amount: 543, fill: "#d0a2ff" },
];

export const cashFlowForecast = [
  { label: "Today", balance: 8420 },
  { label: "Day 7", balance: 7940 },
  { label: "Day 14", balance: 7210 },
  { label: "Day 30", balance: 6340 },
  { label: "Day 60", balance: 5875 },
  { label: "Day 90", balance: 5640 },
];

export const insights = [
  {
    title: "Low-balance risk in 11 days",
    summary: "At your current spending rate, your available cash may slip below $500 before your next paycheck.",
    severity: "high",
  },
  {
    title: "Restaurant spending up 28%",
    summary: "Most of the increase came from Friday and Saturday purchases compared to your monthly average.",
    severity: "medium",
  },
  {
    title: "Subscriptions could free $342 yearly",
    summary: "Three recurring charges look active but underused based on recent transaction activity.",
    severity: "low",
  },
];

export const transactions = [
  {
    id: "txn_1",
    merchant: "Whole Foods",
    description: "WHOLEFDS BKLYN 01",
    amount: -86.14,
    category: "Food",
    date: "May 28",
    status: "Posted",
  },
  {
    id: "txn_2",
    merchant: "Apple Payroll",
    description: "PAYROLL DEPOSIT",
    amount: 2700,
    category: "Income",
    date: "May 24",
    status: "Posted",
  },
  {
    id: "txn_3",
    merchant: "Shell",
    description: "SHELL OIL 574112",
    amount: -42.8,
    category: "Transportation",
    date: "May 26",
    status: "Posted",
  },
  {
    id: "txn_4",
    merchant: "Netflix",
    description: "NETFLIX.COM",
    amount: -15.49,
    category: "Subscription",
    date: "May 27",
    status: "Recurring",
  },
  {
    id: "txn_5",
    merchant: "Sweetgreen",
    description: "SWEETGREEN BROOKLYN",
    amount: -24.9,
    category: "Food",
    date: "May 25",
    status: "Posted",
  },
];

export const subscriptions = [
  {
    name: "Netflix",
    monthlyCost: 15.49,
    yearlyCost: 185.88,
    opportunity: "Keep",
    note: "Steady weekly usage detected.",
  },
  {
    name: "Spotify",
    monthlyCost: 10.99,
    yearlyCost: 131.88,
    opportunity: "Review",
    note: "Recent activity is lower than your normal listening pattern.",
  },
  {
    name: "Climbing Gym",
    monthlyCost: 49,
    yearlyCost: 588,
    opportunity: "Review",
    note: "High annual cost relative to visit frequency.",
  },
];

export const healthFactors = [
  { label: "Savings rate", value: 78 },
  { label: "Spending consistency", value: 74 },
  { label: "Emergency runway", value: 68 },
  { label: "Subscription burden", value: 83 },
];

export const recommendations = [
  "Trim restaurant spend by $75 per month to lift your score into the upper 80s.",
  "Hold one paycheck untouched this cycle to extend emergency runway past 50 days.",
  "Review underused subscriptions to recover about $340 per year.",
];
