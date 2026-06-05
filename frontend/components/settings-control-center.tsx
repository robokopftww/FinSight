"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { AlertTriangle, Database, Loader2, PlugZap, RefreshCw, ServerCog, ShieldCheck, Trash2, Unplug, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

type SettingsStatus = {
  user: {
    id: string;
    clerkId: string;
    email: string;
    name: string | null;
  };
  database: {
    connected: boolean;
    provider: string;
  };
  clerk: {
    configured: boolean;
  };
  plaid: {
    configured: boolean;
    environment?: "sandbox" | "development" | "production";
    connected: boolean;
    itemsCount: number;
    accountsCount: number;
    transactionsCount: number;
    institutions: string[];
    lastSyncedAt: string | null;
    latestTransactionAt: string | null;
  };
  ai: {
    online: boolean;
    service: string;
    analytics: string;
    llmProvider: string;
    llmModel: string;
    llmConfigured: boolean;
    fallbackMode: boolean;
  };
  data: {
    chatMessages: number;
  };
};

type ActionState = "idle" | "syncing" | "disconnecting" | "clearing" | "refreshing";

async function authenticatedFetch(path: string, token: string | null, init?: RequestInit) {
  if (!apiBaseUrl) {
    throw new Error("API base URL is not configured.");
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

function formatDate(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={
        active
          ? "rounded-full bg-emerald-300/14 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100"
          : "rounded-full bg-amber-300/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-100"
      }
    >
      {label}
    </span>
  );
}

function StatTile({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
      {detail ? <div className="mt-2 text-sm leading-6 text-slate-400">{detail}</div> : null}
    </div>
  );
}

export function SettingsControlCenter() {
  const { getToken, isSignedIn } = useAuth();
  const [status, setStatus] = useState<SettingsStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [action, setAction] = useState<ActionState>("idle");

  const refreshStatus = useCallback(async () => {
    if (!isSignedIn) {
      return;
    }

    setAction((current) => (current === "idle" ? "refreshing" : current));

    try {
      const token = await getToken();
      const response = await authenticatedFetch("/api/settings/status", token);

      if (!response.ok) {
        throw new Error("Unable to load settings status.");
      }

      setStatus((await response.json()) as SettingsStatus);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load settings status.");
    } finally {
      setAction((current) => (current === "refreshing" ? "idle" : current));
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refreshStatus();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [refreshStatus]);

  async function runAction(nextAction: ActionState, path: string, init: RequestInit, successMessage: string) {
    setAction(nextAction);
    setMessage(null);

    try {
      const token = await getToken();
      const response = await authenticatedFetch(path, token, init);

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Action failed.");
      }

      setMessage(successMessage);
      await refreshStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setAction("idle");
    }
  }

  async function syncTransactions() {
    await runAction(
      "syncing",
      "/api/plaid/sync",
      { method: "POST" },
      "Plaid sync finished. Dashboard, reports, and advisor context are ready to refresh.",
    );
  }

  async function disconnectPlaid() {
    if (!window.confirm("Disconnect Plaid and remove synced accounts, transactions, and detected subscriptions for this user?")) {
      return;
    }

    await runAction(
      "disconnecting",
      "/api/settings/plaid-connection",
      { method: "DELETE" },
      "Plaid connection removed for this user.",
    );
  }

  async function clearSandboxData() {
    if (!window.confirm("Clear all sandbox financial data, generated insights, forecasts, scores, subscriptions, and advisor history for this user?")) {
      return;
    }

    await runAction(
      "clearing",
      "/api/settings/sandbox-data",
      { method: "DELETE" },
      "Sandbox data cleared for this user.",
    );
  }

  const busy = action !== "idle";

  if (!status) {
    return (
      <Panel className="flex min-h-64 items-center justify-center p-8">
        <div className="flex items-center gap-3 text-slate-300">
          <Loader2 className="size-5 animate-spin" />
          Loading settings
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Connected accounts"
          value={status.plaid.accountsCount}
          detail={status.plaid.connected ? `Plaid ${status.plaid.environment ?? "sandbox"} active` : "No bank connected"}
        />
        <StatTile label="Transactions" value={status.plaid.transactionsCount} detail={`Latest: ${formatDate(status.plaid.latestTransactionAt)}`} />
        <StatTile label="Last sync" value={formatDate(status.plaid.lastSyncedAt)} detail={status.plaid.institutions.join(", ") || "No institution yet"} />
        <StatTile label="Advisor history" value={status.data.chatMessages} detail="Stored in PostgreSQL" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-accent)] text-slate-950">
                <PlugZap className="size-5" />
              </span>
              <div>
                <h2 className="text-xl font-semibold text-white">Plaid connection</h2>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  Manage synced Plaid banking data used by forecasts, health scoring, reports, and Gemini advisor context.
                </p>
              </div>
            </div>
            <StatusPill active={status.plaid.connected} label={status.plaid.connected ? "Connected" : "Disconnected"} />
          </div>

          <div className="mt-6 grid gap-3">
            <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Configuration</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusPill active={status.plaid.configured} label={status.plaid.configured ? "Plaid keys set" : "Missing Plaid keys"} />
                <StatusPill active={status.plaid.itemsCount > 0} label={`${status.plaid.itemsCount} item${status.plaid.itemsCount === 1 ? "" : "s"}`} />
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="button" onClick={syncTransactions} disabled={busy || !status.plaid.connected} className="gap-2">
                {action === "syncing" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                Sync transactions
              </Button>
              <Button type="button" variant="secondary" onClick={disconnectPlaid} disabled={busy || !status.plaid.connected} className="gap-2">
                {action === "disconnecting" ? <Loader2 className="size-4 animate-spin" /> : <Unplug className="size-4" />}
                Disconnect bank
              </Button>
            </div>
          </div>
        </Panel>

        <Panel className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/8 text-white">
                <ServerCog className="size-5" />
              </span>
              <div>
                <h2 className="text-xl font-semibold text-white">AI runtime</h2>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  Confirms the Python analytics service and Gemini explanation layer are reachable from the backend.
                </p>
              </div>
            </div>
            <StatusPill active={status.ai.online} label={status.ai.online ? "Online" : "Offline"} />
          </div>

          <div className="mt-6 grid gap-3">
            <StatTile label="Analytics engine" value={status.ai.analytics} detail={status.ai.service} />
            <StatTile label="LLM model" value={status.ai.llmModel} detail={status.ai.llmConfigured ? "Gemini key loaded in AI service" : "Using deterministic fallback"} />
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel className="p-6">
          <div className="flex gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/8 text-white">
              <UserRound className="size-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-white">Account</h2>
              <p className="mt-2 text-sm leading-7 text-slate-300">Clerk identity mapped to the app user stored in PostgreSQL.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            <StatTile label="Email" value={status.user.email} detail={status.user.name ?? "No profile name"} />
            <StatTile label="App user ID" value={status.user.id.slice(0, 12)} detail="Internal PostgreSQL user record" />
          </div>
        </Panel>

        <Panel className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-300/14 text-amber-100">
                <AlertTriangle className="size-5" />
              </span>
              <div>
                <h2 className="text-xl font-semibold text-white">Data reset</h2>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  Clear the current user’s synced Plaid records, generated analytics artifacts, and advisor chat history.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button type="button" variant="secondary" onClick={() => void refreshStatus()} disabled={busy} className="gap-2">
              {action === "refreshing" ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              Refresh status
            </Button>
            <Button type="button" variant="secondary" onClick={clearSandboxData} disabled={busy} className="gap-2 border-amber-300/20 text-amber-100 hover:bg-amber-300/10">
              {action === "clearing" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Clear financial data
            </Button>
          </div>
        </Panel>
      </section>

      <Panel className="p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-accent)]/16 text-emerald-100">
            <Database className="size-5" />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-white">System health</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusPill active={status.database.connected} label={`${status.database.provider} online`} />
              <StatusPill active={status.clerk.configured} label={status.clerk.configured ? "Clerk configured" : "Clerk missing"} />
              <StatusPill active={status.ai.llmConfigured} label={status.ai.llmConfigured ? "Gemini enabled" : "Gemini fallback"} />
              <StatusPill active={Boolean(apiBaseUrl)} label={apiBaseUrl ? "Frontend API set" : "Frontend API missing"} />
            </div>
          </div>
        </div>
      </Panel>

      {message ? (
        <div className="rounded-[24px] border border-white/8 bg-white/5 px-5 py-4 text-sm leading-7 text-slate-100">
          {message}
        </div>
      ) : null}
    </div>
  );
}
