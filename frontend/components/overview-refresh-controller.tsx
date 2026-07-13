"use client";

import { useAuth } from "@clerk/nextjs";
import { CheckCircle2, Loader2, RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef } from "react";

import {
  initialOverviewRefreshState,
  overviewRefreshReducer,
} from "@/lib/overview-refresh";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

export function OverviewRefreshController() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const started = useRef(false);
  const [state, dispatch] = useReducer(overviewRefreshReducer, initialOverviewRefreshState);

  const refreshOverview = useCallback(async () => {
    dispatch({ type: "start" });

    try {
      if (!apiBaseUrl) {
        throw new Error("API unavailable");
      }

      const token = await getToken();
      const response = await fetch(`${apiBaseUrl}/api/plaid/sync`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) {
        throw new Error("Refresh failed");
      }

      dispatch({ type: "succeed" });
      router.refresh();
    } catch {
      dispatch({ type: "fail", message: "Couldn’t refresh" });
    }
  }, [getToken, router]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || started.current) {
      return;
    }

    started.current = true;
    void refreshOverview();
  }, [isLoaded, isSignedIn, refreshOverview]);

  return (
    <div className="flex min-h-8 items-center text-xs" aria-live="polite">
      {state.status === "refreshing" ? (
        <span className="inline-flex items-center gap-2 text-slate-500">
          <Loader2 className="size-3.5 animate-spin" />
          Updating accounts…
        </span>
      ) : null}
      {state.status === "success" ? (
        <span className="inline-flex items-center gap-2 text-emerald-700">
          <CheckCircle2 className="size-3.5" />
          Updated just now
        </span>
      ) : null}
      {state.status === "error" ? (
        <button
          type="button"
          className="inline-flex items-center gap-2 text-amber-700 transition hover:text-amber-800"
          onClick={() => void refreshOverview()}
        >
          <RefreshCcw className="size-3.5" />
          {state.message}. Retry
        </button>
      ) : null}
    </div>
  );
}
