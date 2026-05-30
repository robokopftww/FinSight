import { Search, SlidersHorizontal } from "lucide-react";
import { auth } from "@clerk/nextjs/server";

import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/ui/panel";
import { getTransactions } from "@/lib/api";

function formatAmount(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

const filters = ["All", "Food", "Income", "Transportation", "Subscription"];

export default async function TransactionsPage() {
  const { getToken } = await auth();
  const response = await getTransactions(await getToken());

  return (
    <AppShell currentPath="/transactions" eyebrow="Transaction intelligence" title="Search, filter, and recategorize your activity">
      <Panel className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-3 rounded-full border border-white/8 bg-white/4 px-4 py-3">
            <Search className="size-4 text-slate-400" />
            <input
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
              placeholder="Search merchants, descriptions, or amounts"
              readOnly
            />
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/8 bg-white/4 px-4 py-3 text-sm text-slate-300">
            <SlidersHorizontal className="size-4" />
            Advanced filters
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {filters.map((filter, index) => (
            <span
              key={filter}
              className={index === 0 ? "rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950" : "rounded-full bg-white/6 px-4 py-2 text-sm text-slate-300"}
            >
              {filter}
            </span>
          ))}
        </div>

        <div className="mt-6 overflow-hidden rounded-[28px] border border-white/8">
          <div className="grid grid-cols-[1.6fr_1.2fr_0.7fr_0.7fr] gap-4 bg-white/6 px-5 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            <span>Merchant</span>
            <span>Category</span>
            <span className="text-right">Amount</span>
            <span className="text-right">Status</span>
          </div>
          {response.data.map((transaction: { id: string; merchant?: string; merchantName?: string; description: string; amount: number; category?: string; categoryPrimary?: string; status?: string; date?: string; occurredAt?: string }) => {
            const merchant = transaction.merchant ?? transaction.merchantName ?? transaction.description;
            const category = transaction.category ?? transaction.categoryPrimary ?? "Uncategorized";
            const status = transaction.status ?? "Posted";
            return (
              <div
                key={transaction.id}
                className="grid grid-cols-[1.6fr_1.2fr_0.7fr_0.7fr] gap-4 border-t border-white/8 px-5 py-5 text-sm"
              >
                <div>
                  <div className="font-medium text-white">{merchant}</div>
                  <div className="mt-1 text-slate-400">{transaction.description}</div>
                </div>
                <div className="text-slate-300">{category}</div>
                <div className={`text-right font-medium ${transaction.amount > 0 ? "text-emerald-300" : "text-white"}`}>
                  {formatAmount(transaction.amount)}
                </div>
                <div className="text-right text-slate-400">{status}</div>
              </div>
            );
          })}
        </div>
      </Panel>
    </AppShell>
  );
}
