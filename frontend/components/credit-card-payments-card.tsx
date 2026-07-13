import { CreditCard } from "lucide-react";

import { Panel } from "@/components/ui/panel";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

type CreditCardPaymentsCardProps = {
  totalOutstanding: number;
  detailsAvailable?: boolean;
  cards?: Array<{
    name: string;
    mask: string | null;
    outstandingBalance: number;
    statementBalance: number | null;
    minimumPayment: number | null;
    dueDate: string | null;
  }>;
};

export function CreditCardPaymentsCard({
  totalOutstanding,
  detailsAvailable = false,
  cards = [],
}: CreditCardPaymentsCardProps) {
  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-slate-500">Credit card payments due</div>
        <CreditCard className="size-5 text-red-600" />
      </div>
      <div className="mt-3 text-3xl font-semibold text-red-600">{formatCurrency(totalOutstanding)}</div>
      <div className="mt-2 text-xs text-slate-500">
        {detailsAvailable ? "Upcoming statement payments" : "Total outstanding · due dates require Plaid Liabilities"}
      </div>

      <div className="mt-5 space-y-3 border-t border-slate-200 pt-4">
        {cards.map((card) => (
          <div key={`${card.name}-${card.mask}`} className="flex items-start justify-between gap-3 text-xs">
            <div>
              <div className="text-slate-600">{card.name}{card.mask ? ` ·${card.mask}` : ""}</div>
              <div className="mt-1 text-slate-500">
                {card.dueDate && card.minimumPayment !== null
                  ? `${formatCurrency(card.minimumPayment)} minimum due ${card.dueDate}`
                  : "Payment details unavailable"}
              </div>
            </div>
            <span className="shrink-0 font-medium text-red-600">{formatCurrency(card.outstandingBalance)}</span>
          </div>
        ))}
        {cards.length === 0 ? <div className="text-xs text-slate-500">No credit cards connected.</div> : null}
      </div>
    </Panel>
  );
}
