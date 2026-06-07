import { describe, expect, it } from "vitest";

import { normalizeMonthlyPay, profileUpdateSchema } from "../src/lib/profile.js";

describe("normalizeMonthlyPay", () => {
  it("converts each pay frequency to a monthly amount", () => {
    expect(normalizeMonthlyPay(1000, "weekly")).toBeCloseTo((1000 * 52) / 12, 2);
    expect(normalizeMonthlyPay(1000, "biweekly")).toBeCloseTo((1000 * 26) / 12, 2);
    expect(normalizeMonthlyPay(1000, "semimonthly")).toBe(2000);
    expect(normalizeMonthlyPay(1000, "monthly")).toBe(1000);
    expect(normalizeMonthlyPay(12000, "annually")).toBe(1000);
  });

  it("returns 0 for missing or invalid input", () => {
    expect(normalizeMonthlyPay(null, "monthly")).toBe(0);
    expect(normalizeMonthlyPay(1000, null)).toBe(0);
    expect(normalizeMonthlyPay(1000, "fortnightly")).toBe(0);
  });
});

describe("profileUpdateSchema", () => {
  it("requires gross pay and pay frequency for employed users", () => {
    const result = profileUpdateSchema.safeParse({ employmentStatus: "employed" });

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.grossPay).toBeDefined();
    expect(result.error?.flatten().fieldErrors.payFrequency).toBeDefined();
  });

  it("accepts an unknown or unemployed profile without pay details", () => {
    expect(profileUpdateSchema.safeParse({ employmentStatus: "unknown" }).success).toBe(true);
    expect(profileUpdateSchema.safeParse({ employmentStatus: "unemployed" }).success).toBe(true);
  });
});
