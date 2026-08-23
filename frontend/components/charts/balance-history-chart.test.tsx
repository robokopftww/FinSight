import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { BalanceHistoryChart } from "./balance-history-chart";

afterEach(() => {
  cleanup();
});

describe("BalanceHistoryChart", () => {
  test("renders heading, positive change indicator, and screen-reader value list", () => {
    render(
      <BalanceHistoryChart
        data={[
          { label: "Jan", balance: 1_000 },
          { label: "Feb", balance: 1_200 },
          { label: "Mar", balance: 1_500 },
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /balance over time/i }),
    ).toBeDefined();

    expect(screen.getByText(/\+\$500 \(\+50%\) over this period/i)).toBeDefined();

    const srList = screen.getByRole("list", { name: /balance history values/i });
    const items = within(srList).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toContain("Jan");
    expect(items[0].textContent).toContain("$1,000");
    expect(items[2].textContent).toContain("$1,500");
  });

  test("renders negative change styling and label", () => {
    render(
      <BalanceHistoryChart
        data={[
          { label: "Jan", balance: 2_000 },
          { label: "Feb", balance: 1_500 },
        ]}
      />,
    );

    expect(screen.getByText(/-\$500 \(-25%\) over this period/i)).toBeDefined();
  });

  test("shows empty-state prompt when there is insufficient history", () => {
    render(<BalanceHistoryChart data={[{ label: "Jan", balance: 1_000 }]} />);

    expect(
      screen.getByText(/sync more transaction history/i),
    ).toBeDefined();
    expect(
      screen.queryByRole("list", { name: /balance history values/i }),
    ).toBeNull();
  });

  test("omits percentage when starting balance is zero", () => {
    render(
      <BalanceHistoryChart
        data={[
          { label: "Jan", balance: 0 },
          { label: "Feb", balance: 500 },
        ]}
      />,
    );

    expect(screen.getByText(/\+\$500 over this period/i)).toBeDefined();
    expect(screen.queryByText(/%/)).toBeNull();
  });
});
