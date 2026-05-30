"use client";

import { useCallback, useEffect, useState } from "react";
import { Landmark, Loader2, RefreshCcw, ShieldCheck, Unplug } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { usePlaidLink } from "react-plaid-link";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

type PlaidStatus = {
  configured: boolean;
  connected: boolean;
  itemsCount: number;
  accountsCount: number;
  transactionsCount: number;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

async function authenticatedFetch(path: string, token: string | null, init?: RequestInit) {
  if (!apiBaseUrl) {
    throw new Error("API base URL is not configured");
  }

  const headers = new Headers(init?.headers);

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
  });
}

export function BankConnectionPanel() {
  const { getToken, isSignedIn } = useAuth();
  const [status, setStatus] = useState<PlaidStatus | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (!isSignedIn) {
      return;
    }

    const token = await getToken();
    const response = await authenticatedFetch("/api/plaid/status", token);

    if (response.ok) {
      setStatus((await response.json()) as PlaidStatus);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refreshStatus();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [refreshStatus]);

  const plaid = usePlaidLink({
    token: linkToken,
    onSuccess: async (publicToken, metadata) => {
      setLoading(true);
      setMessage("Connecting your accounts...");

      try {
        const token = await getToken();
        const exchange = await authenticatedFetch("/api/plaid/exchange-public-token", token, {
          method: "POST",
          body: JSON.stringify({
            publicToken,
            institutionName: metadata.institution?.name,
          }),
        });

        if (!exchange.ok) {
          throw new Error("Unable to exchange Plaid token");
        }

        const sync = await authenticatedFetch("/api/plaid/sync", token, {
          method: "POST",
        });

        if (!sync.ok) {
          setMessage("Account connected. Transactions may need a minute before they are ready to sync.");
        } else {
          setMessage("Account connected and transactions synced.");
        }

        await refreshStatus();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to connect bank account");
      } finally {
        setLoading(false);
      }
    },
  });

  async function createLinkToken() {
    setLoading(true);
    setMessage(null);

    try {
      const token = await getToken();
      const response = await authenticatedFetch("/api/plaid/link-token", token, {
        method: "POST",
      });

      if (response.status === 501) {
        setMessage("Plaid sandbox keys are not configured yet. Add PLAID_CLIENT_ID and PLAID_SECRET in backend/.env.");
        await refreshStatus();
        return;
      }

      if (!response.ok) {
        throw new Error("Unable to create Plaid Link token");
      }

      const body = (await response.json()) as { linkToken: string };
      setLinkToken(body.linkToken);
      setMessage("Plaid Link is ready. Click Connect again to open it.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start Plaid Link");
    } finally {
      setLoading(false);
    }
  }

  async function syncTransactions() {
    setLoading(true);
    setMessage("Syncing latest transactions...");

    try {
      const token = await getToken();
      const response = await authenticatedFetch("/api/plaid/sync", token, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Unable to sync transactions right now");
      }

      const body = (await response.json()) as { addedCount: number; modifiedCount: number; removedCount: number };
      setMessage(`Synced ${body.addedCount} new, ${body.modifiedCount} updated, and ${body.removedCount} removed transactions.`);
      await refreshStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sync transactions");
    } finally {
      setLoading(false);
    }
  }

  if (!isSignedIn) {
    return null;
  }

  const connected = Boolean(status?.connected);
  const configured = status?.configured ?? false;

  return (
    <Panel className="p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-accent)] text-slate-950">
            {connected ? <ShieldCheck className="size-5" /> : <Landmark className="size-5" />}
          </span>
          <div>
            <h2 className="text-xl font-semibold text-white">
              {connected ? "Bank connection active" : "Connect your first bank account"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
              {connected
                ? "FinSight can now use synced accounts and transactions as the source for forecasts, scoring, and AI insights."
                : "Connect a Plaid sandbox account so FinSight can replace demo data with real account, balance, and transaction records."}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          {connected ? (
            <Button type="button" onClick={syncTransactions} disabled={loading}>
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCcw className="mr-2 size-4" />}
              Sync
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => {
                if (linkToken && plaid.ready) {
                  plaid.open();
                } else {
                  void createLinkToken();
                }
              }}
              disabled={loading}
            >
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Unplug className="mr-2 size-4" />}
              Connect bank
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Plaid sandbox</div>
          <div className="mt-2 text-lg font-semibold text-white">{configured ? "Configured" : "Missing keys"}</div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Accounts</div>
          <div className="mt-2 text-lg font-semibold text-white">{status?.accountsCount ?? 0}</div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Transactions</div>
          <div className="mt-2 text-lg font-semibold text-white">{status?.transactionsCount ?? 0}</div>
        </div>
      </div>

      {message ? (
        <div className="mt-5 rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-200">
          {message}
        </div>
      ) : null}
    </Panel>
  );
}
