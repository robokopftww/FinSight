// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: {
    getToken: vi.fn(),
    isLoaded: false,
    isSignedIn: false,
  },
  routerRefresh: vi.fn(),
}));

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.routerRefresh }),
}));

let OverviewRefreshController: typeof import("./overview-refresh-controller").OverviewRefreshController;

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test");
  ({ OverviewRefreshController } = await import("./overview-refresh-controller"));
});

beforeEach(() => {
  mocks.auth.getToken.mockReset();
  mocks.auth.isLoaded = false;
  mocks.auth.isSignedIn = false;
  mocks.routerRefresh.mockReset();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("OverviewRefreshController", () => {
  test("waits for Clerk to load and confirm a signed-in user", async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));
    mocks.auth.getToken.mockResolvedValue("test-token");
    const { rerender } = render(<OverviewRefreshController />);

    expect(fetchMock).not.toHaveBeenCalled();

    mocks.auth.isLoaded = true;
    rerender(<OverviewRefreshController />);
    expect(fetchMock).not.toHaveBeenCalled();

    mocks.auth.isSignedIn = true;
    rerender(<OverviewRefreshController />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  test("sends one authorized request across a rerender and refreshes after success", async () => {
    mocks.auth.isLoaded = true;
    mocks.auth.isSignedIn = true;
    mocks.auth.getToken.mockResolvedValue("test-token");
    const fetchMock = vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));
    const { rerender } = render(<OverviewRefreshController />);

    await screen.findByText("Updated just now");
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/api/plaid/sync", {
      method: "POST",
      headers: { Authorization: "Bearer test-token" },
    });
    expect(mocks.routerRefresh).toHaveBeenCalledTimes(1);

    rerender(<OverviewRefreshController />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(mocks.routerRefresh).toHaveBeenCalledTimes(1);
  });

  test("offers retry only after failure and refreshes after the retry succeeds", async () => {
    mocks.auth.isLoaded = true;
    mocks.auth.isSignedIn = true;
    mocks.auth.getToken.mockResolvedValue("test-token");
    const fetchMock = vi
      .mocked(fetch)
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    render(<OverviewRefreshController />);

    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
    const retry = await screen.findByRole("button", { name: /retry/i });
    expect(mocks.routerRefresh).not.toHaveBeenCalled();

    fireEvent.click(retry);

    await screen.findByText("Updated just now");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mocks.routerRefresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  });
});
