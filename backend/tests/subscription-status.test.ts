import { describe, expect, it } from "vitest";

import { parseSubscriptionStatus } from "../src/routes/index.js";

describe("parseSubscriptionStatus", () => {
  it("accepts valid statuses", () => {
    expect(parseSubscriptionStatus("active")).toBe("active");
    expect(parseSubscriptionStatus("paused")).toBe("paused");
    expect(parseSubscriptionStatus("cancelled")).toBe("cancelled");
  });
  it("rejects anything else", () => {
    expect(parseSubscriptionStatus("deleted")).toBeNull();
    expect(parseSubscriptionStatus(undefined)).toBeNull();
    expect(parseSubscriptionStatus(42)).toBeNull();
  });
});
