from __future__ import annotations

import pandas as pd


def build_forecast(current_balance: float, monthly_income: float, monthly_spending: float) -> dict:
    daily_delta = (monthly_income - monthly_spending) / 30 if monthly_income else 0
    frame = pd.DataFrame({"day": list(range(1, 31))})
    frame["projectedBalance"] = current_balance + frame["day"] * daily_delta

    lowest_projected_balance = round(frame["projectedBalance"].min(), 2)
    projected_balance = round(frame["projectedBalance"].iloc[-1], 2)

    return {
        "horizonDays": 30,
        "projectedBalance": projected_balance,
        "lowestProjectedBalance": lowest_projected_balance,
        "lowBalanceRisk": lowest_projected_balance < 500,
        "riskProbability": 0.71 if lowest_projected_balance < 500 else 0.29,
        "series": frame.to_dict(orient="records"),
    }
