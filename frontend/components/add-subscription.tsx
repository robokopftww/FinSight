"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { TransactionRow } from "@/lib/api";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

type Mode = "transaction" | "manual";

type Candidate = {
  transactionId: string;
  merchant: string;
  amount: number;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export function AddSubscription({ transactions }: { transactions: TransactionRow[] }) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("transaction");
  const [search, setSearch] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [monthlyCost, setMonthlyCost] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build a deduped list of merchants from spending transactions. The most
  // recent transaction per merchant carries the id we POST to derive cost.
  const candidates = useMemo<Candidate[]>(() => {
    const byMerchant = new Map<string, Candidate>();
    for (const tx of transactions) {
      if (tx.direction === "inflow") {
        continue;
      }
      const merchant = (tx.merchant ?? tx.merchantName ?? tx.description ?? "").trim();
      if (!merchant || byMerchant.has(merchant)) {
        continue;
      }
      byMerchant.set(merchant, {
        transactionId: tx.id,
        merchant,
        amount: Math.abs(tx.amount),
      });
    }
    return [...byMerchant.values()];
  }, [transactions]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = query
      ? candidates.filter((candidate) => candidate.merchant.toLowerCase().includes(query))
      : candidates;
    return list.slice(0, 50);
  }, [candidates, search]);

  function reset() {
    setOpen(false);
    setMode("transaction");
    setSearch("");
    setMerchantName("");
    setMonthlyCost("");
    setError(null);
  }

  async function submit(payload: Record<string, unknown>) {
    if (!apiBaseUrl) {
      setError("API is not configured.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const token = await getToken();
      const response = await fetch(`${apiBaseUrl}/api/subscriptions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Unable to add subscription");
      }
      reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to add subscription");
    } finally {
      setPending(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--color-accent-border)]";

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Add subscription
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[var(--color-surface)] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Add a subscription</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Pick a merchant from your transactions, or enter one manually.
            </p>
          </div>
          <Button variant="ghost" onClick={reset} disabled={pending}>
            Close
          </Button>
        </div>

        <div className="mt-5 flex gap-2">
          <Button variant={mode === "transaction" ? "primary" : "secondary"} onClick={() => setMode("transaction")}>
            From a transaction
          </Button>
          <Button variant={mode === "manual" ? "primary" : "secondary"} onClick={() => setMode("manual")}>
            Manual entry
          </Button>
        </div>

        {mode === "transaction" ? (
          <div className="mt-5 space-y-3">
            <input
              className={inputClass}
              placeholder="Search merchants..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {filtered.length ? (
                filtered.map((candidate) => (
                  <button
                    key={candidate.transactionId}
                    type="button"
                    disabled={pending}
                    onClick={() => void submit({ transactionId: candidate.transactionId })}
                    className="flex w-full items-center justify-between gap-4 rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-left transition hover:bg-white/8 disabled:opacity-50"
                  >
                    <span className="text-sm font-medium text-white">{candidate.merchant}</span>
                    <span className="text-sm text-slate-400">{formatCurrency(candidate.amount)}</span>
                  </button>
                ))
              ) : (
                <p className="px-1 py-4 text-sm text-slate-400">No matching transactions.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <input
              className={inputClass}
              placeholder="Merchant name"
              value={merchantName}
              onChange={(event) => setMerchantName(event.target.value)}
            />
            <input
              className={inputClass}
              placeholder="Monthly cost"
              type="number"
              min="0"
              step="0.01"
              value={monthlyCost}
              onChange={(event) => setMonthlyCost(event.target.value)}
            />
            <Button
              onClick={() =>
                void submit({ merchantName: merchantName.trim(), monthlyCost: Number(monthlyCost) })
              }
              disabled={pending || !merchantName.trim() || !(Number(monthlyCost) > 0)}
            >
              {pending ? "Adding..." : "Add subscription"}
            </Button>
          </div>
        )}

        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
      </div>
    </div>
  );
}
