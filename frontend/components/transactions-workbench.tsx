"use client";

import { useAuth } from "@clerk/nextjs";
import { ArrowDownLeft, ArrowUpRight, Search, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import type { TransactionCategoryOption, TransactionRow, TransactionsResponse } from "@/lib/api";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

const defaultCategories: TransactionCategoryOption[] = [
  { raw: "FOOD_AND_DRINK", label: "Food And Drink" },
  { raw: "GENERAL_MERCHANDISE", label: "Shopping" },
  { raw: "TRANSPORTATION", label: "Transportation" },
  { raw: "RENT_AND_UTILITIES", label: "Rent And Utilities" },
  { raw: "ENTERTAINMENT", label: "Entertainment" },
  { raw: "TRAVEL", label: "Travel" },
  { raw: "INCOME", label: "Income" },
  { raw: "UNCATEGORIZED", label: "Uncategorized" },
];

function formatAmount(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function normalizeLabel(value?: string) {
  return value?.toLowerCase().replace(/\s+/g, " ").trim() ?? "";
}

function mergeCategories(categories?: TransactionCategoryOption[]) {
  const byRaw = new Map<string, TransactionCategoryOption>();

  for (const category of [...(categories ?? []), ...defaultCategories]) {
    byRaw.set(category.raw, category);
  }

  return [...byRaw.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function TransactionsWorkbench({
  initialTransactions,
  categories,
  summary,
}: {
  initialTransactions: TransactionRow[];
  categories?: TransactionCategoryOption[];
  summary?: TransactionsResponse["summary"];
}) {
  const { getToken } = useAuth();
  const [transactions, setTransactions] = useState(initialTransactions);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [direction, setDirection] = useState("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const categoryOptions = mergeCategories(categories);
  const searchValue = normalizeLabel(search);
  const visibleTransactions = transactions.filter((transaction) => {
    const merchant = transaction.merchant ?? transaction.merchantName ?? "";
    const categoryMatch = category === "all" || transaction.categoryRaw === category;
    const directionMatch = direction === "all" || transaction.direction === direction;
    const searchMatch =
      !searchValue ||
      normalizeLabel(merchant).includes(searchValue) ||
      normalizeLabel(transaction.description).includes(searchValue) ||
      normalizeLabel(transaction.category).includes(searchValue) ||
      String(Math.abs(transaction.amount)).includes(searchValue);

    return categoryMatch && directionMatch && searchMatch;
  });
  const visibleIncome = visibleTransactions
    .filter((transaction) => transaction.amount > 0)
    .reduce((total, transaction) => total + transaction.amount, 0);
  const visibleSpending = visibleTransactions
    .filter((transaction) => transaction.amount < 0)
    .reduce((total, transaction) => total + Math.abs(transaction.amount), 0);

  async function updateCategory(transactionId: string, nextCategoryRaw: string) {
    const nextCategory = categoryOptions.find((option) => option.raw === nextCategoryRaw);
    const previousTransactions = transactions;

    setSavingId(transactionId);
    setMessage(null);
    setTransactions((currentTransactions) =>
      currentTransactions.map((transaction) =>
        transaction.id === transactionId
          ? {
              ...transaction,
              category: nextCategory?.label ?? nextCategoryRaw,
              categoryPrimary: nextCategory?.label ?? nextCategoryRaw,
              categoryRaw: nextCategoryRaw,
            }
          : transaction,
      ),
    );

    try {
      if (!apiBaseUrl) {
        throw new Error("Backend URL is not configured.");
      }

      const token = await getToken();
      const response = await fetch(`${apiBaseUrl}/api/transactions/${transactionId}/category`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ categoryPrimary: nextCategoryRaw }),
      });

      if (!response.ok) {
        throw new Error("Unable to save category.");
      }

      setMessage("Category saved.");
    } catch {
      setTransactions(previousTransactions);
      setMessage("Category update failed. Check that the backend is running.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-[24px] border border-white/8 bg-white/4 p-5">
          <div className="text-sm text-slate-400">Loaded transactions</div>
          <div className="mt-3 text-2xl font-semibold text-white">{summary?.count ?? transactions.length}</div>
        </div>
        <div className="rounded-[24px] border border-white/8 bg-white/4 p-5">
          <div className="text-sm text-slate-400">Visible results</div>
          <div className="mt-3 text-2xl font-semibold text-white">{visibleTransactions.length}</div>
        </div>
        <div className="rounded-[24px] border border-white/8 bg-white/4 p-5">
          <div className="text-sm text-slate-400">Visible spending</div>
          <div className="mt-3 text-2xl font-semibold text-white">{formatAmount(visibleSpending)}</div>
        </div>
        <div className="rounded-[24px] border border-white/8 bg-white/4 p-5">
          <div className="text-sm text-slate-400">Visible income</div>
          <div className="mt-3 text-2xl font-semibold text-white">{formatAmount(visibleIncome)}</div>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 items-center gap-3 rounded-full border border-white/8 bg-white/4 px-4 py-3">
          <Search className="size-4 text-slate-400" />
          <input
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            placeholder="Search merchants, descriptions, categories, or amounts"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:w-[30rem]">
          <label className="flex items-center gap-2 rounded-full border border-white/8 bg-white/4 px-4 py-3 text-sm text-slate-300">
            <SlidersHorizontal className="size-4" />
            <select
              className="w-full bg-transparent text-sm text-white outline-none"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option className="bg-slate-950" value="all">
                All categories
              </option>
              {categoryOptions.map((option) => (
                <option key={option.raw} className="bg-slate-950" value={option.raw}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="rounded-full border border-white/8 bg-white/4 px-4 py-3">
            <select
              className="w-full bg-transparent text-sm text-white outline-none"
              value={direction}
              onChange={(event) => setDirection(event.target.value)}
            >
              <option className="bg-slate-950" value="all">
                All money flow
              </option>
              <option className="bg-slate-950" value="outflow">
                Spending only
              </option>
              <option className="bg-slate-950" value="inflow">
                Income only
              </option>
            </select>
          </label>
        </div>
      </div>

      {message ? <div className="rounded-full bg-white/6 px-4 py-3 text-sm text-slate-300">{message}</div> : null}

      <div className="overflow-hidden rounded-[28px] border border-white/8">
        <div className="hidden grid-cols-[1.5fr_1.15fr_0.6fr_0.55fr] gap-4 bg-white/6 px-5 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 md:grid">
          <span>Merchant</span>
          <span>Category</span>
          <span className="text-right">Amount</span>
          <span className="text-right">Status</span>
        </div>
        {visibleTransactions.map((transaction) => {
          const merchant = transaction.merchant ?? transaction.merchantName ?? transaction.description;
          const transactionDirection = transaction.amount > 0 ? "Income" : "Spending";

          return (
            <div
              key={transaction.id}
              className="grid gap-4 border-t border-white/8 px-5 py-5 text-sm md:grid-cols-[1.5fr_1.15fr_0.6fr_0.55fr]"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/8 text-slate-200">
                    {transaction.amount > 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-white">{merchant}</div>
                    <div className="mt-1 truncate text-slate-400">{transaction.description}</div>
                  </div>
                </div>
              </div>
              <div>
                <select
                  className="w-full rounded-full border border-white/8 bg-white/4 px-4 py-2 text-sm text-white outline-none transition focus:border-[var(--color-accent)]"
                  value={transaction.categoryRaw ?? "UNCATEGORIZED"}
                  disabled={savingId === transaction.id}
                  onChange={(event) => {
                    void updateCategory(transaction.id, event.target.value);
                  }}
                >
                  {categoryOptions.map((option) => (
                    <option key={option.raw} className="bg-slate-950" value={option.raw}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={`font-medium md:text-right ${transaction.amount > 0 ? "text-emerald-300" : "text-white"}`}>
                {formatAmount(transaction.amount)}
              </div>
              <div className="text-slate-400 md:text-right">
                <div>{transaction.status ?? "Posted"}</div>
                <div className="mt-1 text-xs">{transaction.date ?? transactionDirection}</div>
              </div>
            </div>
          );
        })}
        {visibleTransactions.length === 0 ? (
          <div className="border-t border-white/8 px-5 py-10 text-center text-sm text-slate-400">
            No transactions match the current search and filters.
          </div>
        ) : null}
      </div>
    </div>
  );
}
