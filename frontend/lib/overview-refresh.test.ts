import { describe, expect, test } from "vitest";

import { initialOverviewRefreshState, overviewRefreshReducer } from "./overview-refresh";

describe("overviewRefreshReducer", () => {
  test("moves from idle to refreshing and success", () => {
    const refreshing = overviewRefreshReducer(initialOverviewRefreshState, { type: "start" });
    expect(refreshing).toEqual({ status: "refreshing" });
    expect(overviewRefreshReducer(refreshing, { type: "succeed" })).toEqual({ status: "success" });
  });

  test("stores a retryable failure and clears it on retry", () => {
    const failed = overviewRefreshReducer(initialOverviewRefreshState, {
      type: "fail",
      message: "Couldn’t refresh",
    });
    expect(failed).toEqual({ status: "error", message: "Couldn’t refresh" });
    expect(overviewRefreshReducer(failed, { type: "start" })).toEqual({ status: "refreshing" });
  });
});
