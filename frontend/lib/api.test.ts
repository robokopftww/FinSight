import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

type FetchLike = typeof fetch;

async function loadApi(baseUrl?: string) {
  vi.resetModules();
  if (baseUrl === undefined) {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
  } else {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", baseUrl);
  }
  return await import("./api");
}

function mockFetch(impl: FetchLike) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

function jsonResponse(body: unknown, init: Partial<Response> = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("api client", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getDashboardOverview", () => {
    test("returns mock fallback when NEXT_PUBLIC_API_BASE_URL is unset", async () => {
      const api = await loadApi(undefined);
      const spy = vi.fn();
      vi.stubGlobal("fetch", spy);

      const result = await api.getDashboardOverview();

      expect(spy).not.toHaveBeenCalled();
      expect(result.spendingBreakdown.length).toBeGreaterThan(0);
      expect(result.forecast.length).toBeGreaterThan(0);
    });

    test("returns fallback when backend responds non-ok", async () => {
      const api = await loadApi("http://api.test");
      mockFetch(async () => new Response("nope", { status: 500 }));

      const result = await api.getDashboardOverview("token-abc");

      expect(result.spendingBreakdown.length).toBeGreaterThan(0);
    });

    test("returns fallback when fetch throws", async () => {
      const api = await loadApi("http://api.test");
      mockFetch(async () => {
        throw new Error("network down");
      });

      const result = await api.getDashboardOverview();
      expect(result.insightHighlights.length).toBeGreaterThan(0);
    });

    test("returns backend JSON and forwards bearer token", async () => {
      const api = await loadApi("http://api.test");
      const spy = vi.fn(async (_url: string, init?: RequestInit) => {
        expect((init?.headers as Record<string, string>)?.Authorization).toBe("Bearer secret-token");
        return jsonResponse({
          currentBalance: 42,
          monthlySpending: 10,
          monthlyIncome: 20,
          savingsRate: 0.5,
          safeToSpend: 5,
          spendingBreakdown: [],
          forecast: [],
          insightHighlights: [],
        });
      });
      vi.stubGlobal("fetch", spy);

      const result = await api.getDashboardOverview("secret-token");

      expect(spy).toHaveBeenCalledWith(
        "http://api.test/api/dashboard/overview",
        expect.objectContaining({ cache: "no-store" }),
      );
      expect(result.currentBalance).toBe(42);
    });

    test("uses revalidate cache when no token is supplied", async () => {
      const api = await loadApi("http://api.test");
      const spy = vi.fn(async () =>
        jsonResponse({
          currentBalance: 0,
          monthlySpending: 0,
          monthlyIncome: 0,
          savingsRate: 0,
          safeToSpend: 0,
          spendingBreakdown: [],
          forecast: [],
          insightHighlights: [],
        }),
      );
      vi.stubGlobal("fetch", spy);

      await api.getDashboardOverview();

      const init = spy.mock.calls[0]?.[1] as RequestInit & { next?: { revalidate: number } };
      expect(init.next).toEqual({ revalidate: 30 });
      expect(init.headers).toBeUndefined();
    });
  });

  describe("updateProfile", () => {
    test("throws when NEXT_PUBLIC_API_BASE_URL is not configured", async () => {
      const api = await loadApi(undefined);
      await expect(api.updateProfile({ jobTitle: "eng" }, "tok")).rejects.toThrow(
        /API base URL/i,
      );
    });

    test("throws when backend responds non-ok", async () => {
      const api = await loadApi("http://api.test");
      mockFetch(async () => new Response("bad", { status: 400 }));

      await expect(api.updateProfile({ jobTitle: "eng" }, "tok")).rejects.toThrow(
        /Failed to update profile/,
      );
    });

    test("sends PATCH with JSON body + bearer token, returns parsed profile", async () => {
      const api = await loadApi("http://api.test");
      const spy = vi.fn(async (_url: string, init?: RequestInit) => {
        expect(init?.method).toBe("PATCH");
        expect((init?.headers as Record<string, string>)?.["Content-Type"]).toBe(
          "application/json",
        );
        expect((init?.headers as Record<string, string>)?.Authorization).toBe("Bearer tok");
        expect(JSON.parse(String(init?.body))).toEqual({ jobTitle: "engineer" });
        return jsonResponse({
          employmentStatus: "employed",
          jobTitle: "engineer",
          grossPay: null,
          payFrequency: null,
          onboardedAt: null,
        });
      });
      vi.stubGlobal("fetch", spy);

      const profile = await api.updateProfile({ jobTitle: "engineer" }, "tok");
      expect(profile.jobTitle).toBe("engineer");
      expect(profile.employmentStatus).toBe("employed");
    });
  });

  describe("getProfile", () => {
    test("returns unknown-employment fallback when API base URL unset", async () => {
      const api = await loadApi(undefined);
      const result = await api.getProfile();
      expect(result.employmentStatus).toBe("unknown");
      expect(result.jobTitle).toBeNull();
    });
  });
});
