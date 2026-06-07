"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

type Status = "active" | "paused" | "cancelled" | "dismissed";

export function SubscriptionActions({ id, status }: { id?: string; status?: Status }) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  if (!id) {
    return null;
  }

  const current: Status = status ?? "active";

  async function update(next: Status) {
    if (!apiBaseUrl) {
      return;
    }
    setPending(true);
    try {
      const token = await getToken();
      await fetch(`${apiBaseUrl}/api/subscriptions/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: next }),
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
        {current}
      </span>
      {current !== "cancelled" ? (
        <Button variant="ghost" disabled={pending} onClick={() => update("cancelled")}>
          Cancel
        </Button>
      ) : null}
      {current === "active" ? (
        <Button variant="ghost" disabled={pending} onClick={() => update("paused")}>
          Pause
        </Button>
      ) : null}
      {current !== "active" ? (
        <Button variant="ghost" disabled={pending} onClick={() => update("active")}>
          Reactivate
        </Button>
      ) : null}
      <Button
        variant="ghost"
        disabled={pending}
        onClick={() => update("dismissed")}
        title="Not a subscription? Remove it from this list."
      >
        Remove
      </Button>
    </div>
  );
}
