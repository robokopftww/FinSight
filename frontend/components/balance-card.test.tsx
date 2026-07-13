import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { BalanceCard } from "./balance-card";

describe("BalanceCard", () => {
  test("shows available balance, one connected account, and refresh status", () => {
    const html = renderToStaticMarkup(
      <BalanceCard
        currentBalance={8824}
        availableBalance={8610}
        monthOverMonthChange={{ amount: -93, percent: -1.04 }}
        accountsBreakdown={[{ name: "Checking", mask: "1234", currentBalance: 8824 }]}
        refreshStatus={<span>Updated just now</span>}
      />,
    );

    expect(html).toContain("Available balance");
    expect(html).toContain("$8,610");
    expect(html).toContain("Checking ·1234");
    expect(html).toContain("Updated just now");
  });
});
