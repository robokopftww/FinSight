"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { AlertTriangle, BriefcaseBusiness, Database, Loader2, PlugZap, RefreshCw, ServerCog, ShieldCheck, Trash2, Unplug, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { getProfile, updateProfile, type UserProfile } from "@/lib/api";

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
    institutionConnections: Array<{
      id: string;
      name: string;
      accountsCount: number;
      lastSyncedAt: string | null;
    }>;
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
const payFrequencies: Array<NonNullable<UserProfile["payFrequency"]>> = [
  "weekly",
  "biweekly",
  "semimonthly",
  "monthly",
  "annually",
];
const profileInputClass = "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--color-accent-border)]";

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
          ? "rounded-full bg-[var(--color-accent-soft-strong)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-accent-text)]"
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

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

  useEffect(() => {
    if (!isSignedIn) {
      return;
    }

    void (async () => {
      setProfile(await getProfile(await getToken()));
    })();
  }, [getToken, isSignedIn]);

  async function saveProfile() {
    if (!profile) {
      return;
    }

    setProfileSaving(true);
    setMessage(null);
    try {
      const updated = await updateProfile(profile, await getToken());
      setProfile(updated);
      setMessage("Employment profile saved. Your dashboard metrics will use the updated values.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save employment profile.");
    } finally {
      setProfileSaving(false);
    }
  }

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

  async function disconnectInstitution(institution: SettingsStatus["plaid"]["institutionConnections"][number]) {
    if (!window.confirm(`Disconnect ${institution.name} and remove its synced accounts and transactions?`)) {
      return;
    }

    await runAction(
      "disconnecting",
      `/api/plaid/items/${institution.id}`,
      { method: "DELETE" },
      `${institution.name} disconnected. Other institutions remain connected.`,
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
            </div>

            <div className="space-y-3">
              {status.plaid.institutionConnections.map((institution) => (
                <div key={institution.id} className="flex flex-col gap-3 rounded-[24px] border border-white/8 bg-white/4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium text-white">{institution.name}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {institution.accountsCount} account{institution.accountsCount === 1 ? "" : "s"} · Last synced {formatDate(institution.lastSyncedAt)}
                    </div>
                  </div>
                  <Button type="button" variant="secondary" onClick={() => void disconnectInstitution(institution)} disabled={busy} className="gap-2">
                    {action === "disconnecting" ? <Loader2 className="size-4 animate-spin" /> : <Unplug className="size-4" />}
                    Disconnect
                  </Button>
                </div>
              ))}
              {status.plaid.institutionConnections.length === 0 ? (
                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4 text-sm text-slate-400">
                  No institutions connected yet. Add one from the dashboard.
                </div>
              ) : null}
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
        <div className="flex gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-accent)]/16 text-[var(--color-accent-text)]">
            <BriefcaseBusiness className="size-5" />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-white">Employment profile</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              Declare pay details to show monthly income. Without them, the dashboard shows transaction-based surplus.
            </p>
          </div>
        </div>

        {profile ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-300">
              <span>Employment status</span>
              <select
                className={profileInputClass}
                value={profile.employmentStatus}
                onChange={(event) => {
                  const employmentStatus = event.target.value as UserProfile["employmentStatus"];
                  setProfile({
                    ...profile,
                    employmentStatus,
                    ...(employmentStatus === "employed" ? {} : { jobTitle: null, grossPay: null, payFrequency: null }),
                  });
                }}
              >
                <option value="employed">Employed</option>
                <option value="unemployed">Unemployed</option>
                <option value="unknown">Prefer not to say</option>
              </select>
            </label>

            {profile.employmentStatus === "employed" ? (
              <>
                <label className="space-y-2 text-sm text-slate-300">
                  <span>Job title</span>
                  <input className={profileInputClass} value={profile.jobTitle ?? ""} onChange={(event) => setProfile({ ...profile, jobTitle: event.target.value || null })} />
                </label>
                <label className="space-y-2 text-sm text-slate-300">
                  <span>Gross pay per period</span>
                  <input className={profileInputClass} min="0" type="number" value={profile.grossPay ?? ""} onChange={(event) => setProfile({ ...profile, grossPay: event.target.value ? Number(event.target.value) : null })} />
                </label>
                <label className="space-y-2 text-sm text-slate-300">
                  <span>Pay frequency</span>
                  <select className={profileInputClass} value={profile.payFrequency ?? "monthly"} onChange={(event) => setProfile({ ...profile, payFrequency: event.target.value as NonNullable<UserProfile["payFrequency"]> })}>
                    {payFrequencies.map((frequency) => <option key={frequency} value={frequency}>{frequency}</option>)}
                  </select>
                </label>
              </>
            ) : null}

            <div className="flex items-end">
              <Button type="button" onClick={() => void saveProfile()} disabled={profileSaving || (profile.employmentStatus === "employed" && (!profile.grossPay || !profile.payFrequency))} className="gap-2">
                {profileSaving ? <Loader2 className="size-4 animate-spin" /> : <BriefcaseBusiness className="size-4" />}
                Save employment profile
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-6 flex items-center gap-3 text-sm text-slate-400">
            <Loader2 className="size-4 animate-spin" />
            Loading employment profile
          </div>
        )}
      </Panel>

      <Panel className="p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-accent)]/16 text-[var(--color-accent-text)]">
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
