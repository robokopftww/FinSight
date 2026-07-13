import { describe, expect, test } from "vitest";

import { advisorWindowReducer, initialAdvisorWindowState } from "./advisor-window";

describe("advisorWindowReducer", () => {
  test("starts closed and records the first open", () => {
    expect(initialAdvisorWindowState).toEqual({ open: false, hasOpened: false });
    expect(advisorWindowReducer(initialAdvisorWindowState, { type: "open" })).toEqual({
      open: true,
      hasOpened: true,
    });
  });

  test("closes without forgetting that chat was mounted", () => {
    expect(
      advisorWindowReducer({ open: true, hasOpened: true }, { type: "close" }),
    ).toEqual({ open: false, hasOpened: true });
  });
});
