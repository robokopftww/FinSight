export type BalanceHistoryPoint = {
  label: string;
  balance: number;
};

export type BalanceHistoryChange = {
  startBalance: number;
  endBalance: number;
  amount: number;
  percent: number | null;
  direction: "up" | "down";
};

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

export function calculateBalanceChange(points: BalanceHistoryPoint[]): BalanceHistoryChange | null {
  if (points.length < 2) {
    return null;
  }

  const startBalance = points[0].balance;
  const endBalance = points.at(-1)?.balance ?? startBalance;
  const amount = Math.round((endBalance - startBalance) * 100) / 100;

  return {
    startBalance,
    endBalance,
    amount,
    percent: startBalance === 0 ? null : roundToOneDecimal((amount / Math.abs(startBalance)) * 100),
    direction: amount >= 0 ? "up" : "down",
  };
}
