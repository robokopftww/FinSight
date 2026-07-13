import { describe, expect, test } from "vitest";

import { calculateBalanceChange } from "./balance-history";

describe("calculateBalanceChange", () => {
  test("returns a positive dollar and percentage change", () => {
    expect(
      calculateBalanceChange([
        { label: "Jan", balance: 1_000 },
        { label: "Jun", balance: 1_250 },
      ]),
    ).toEqual({
      startBalance: 1_000,
      endBalance: 1_250,
      amount: 250,
      percent: 25,
      direction: "up",
    });
  });

  test("returns a negative change", () => {
    expect(
      calculateBalanceChange([
        { label: "Jan", balance: 2_000 },
        { label: "Jun", balance: 1_500 },
      ]),
    ).toEqual({
      startBalance: 2_000,
      endBalance: 1_500,
      amount: -500,
      percent: -25,
      direction: "down",
    });
  });

  test("omits percentage when the period starts at zero", () => {
    expect(
      calculateBalanceChange([
        { label: "Jan", balance: 0 },
        { label: "Jun", balance: 500 },
      ])?.percent,
    ).toBeNull();
  });

  test("returns null without two historical points", () => {
    expect(calculateBalanceChange([])).toBeNull();
    expect(calculateBalanceChange([{ label: "Jun", balance: 500 }])).toBeNull();
  });
});
