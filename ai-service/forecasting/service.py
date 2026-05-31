from __future__ import annotations

from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression


def build_forecast(
    current_balance: float,
    monthly_income: float,
    monthly_spending: float,
    transactions: list[dict] | None = None,
) -> dict:
    daily_delta = _estimate_daily_delta(monthly_income, monthly_spending, transactions or [])
    frame = pd.DataFrame({"day": list(range(0, 91))})
    frame["projectedBalance"] = current_balance + frame["day"] * daily_delta

    lowest_projected_balance = round(frame["projectedBalance"].min(), 2)
    projected_balance = round(frame.loc[frame["day"] == 30, "projectedBalance"].iloc[0], 2)
    risk_probability = _risk_probability(lowest_projected_balance, current_balance, daily_delta)
    key_points = frame[frame["day"].isin([0, 7, 30, 90])].copy()
    key_points["label"] = key_points["day"].map({0: "Today", 7: "Day 7", 30: "Day 30", 90: "Day 90"})

    return {
        "horizonDays": 30,
        "projectedBalance": float(projected_balance),
        "lowestProjectedBalance": float(lowest_projected_balance),
        "lowBalanceRisk": bool(lowest_projected_balance < 500),
        "riskProbability": float(risk_probability),
        "dailyDelta": round(daily_delta, 2),
        "keyPoints": [
            {"label": row["label"], "balance": round(row["projectedBalance"], 2)}
            for row in key_points.to_dict(orient="records")
        ],
        "series": [
            {"day": int(row["day"]), "balance": round(row["projectedBalance"], 2)}
            for row in frame.to_dict(orient="records")
        ],
    }


def _estimate_daily_delta(monthly_income: float, monthly_spending: float, transactions: list[dict]) -> float:
    fallback_delta = (monthly_income - monthly_spending) / 30
    frame = _transactions_frame(transactions)

    if frame.empty or frame["date"].nunique() < 3:
        return fallback_delta

    daily = frame.groupby("date", as_index=False)["signed_amount"].sum().sort_values("date")
    daily["index"] = (daily["date"] - daily["date"].min()).dt.days

    if daily["index"].nunique() < 3:
        return fallback_delta

    model = LinearRegression()
    model.fit(daily[["index"]], daily["signed_amount"])
    regression_delta = float(model.predict(pd.DataFrame({"index": [daily["index"].max() + 1]}))[0])
    observed_delta = float(daily["signed_amount"].tail(14).mean())

    # Blend model output with simple observed cash flow so small sandbox samples stay stable.
    return round(float(np.mean([fallback_delta, observed_delta, regression_delta])), 2)


def _risk_probability(lowest_balance: float, current_balance: float, daily_delta: float) -> float:
    if lowest_balance < 0:
        return 0.91
    if lowest_balance < 250:
        return 0.78
    if lowest_balance < 500:
        return 0.64
    if daily_delta < 0 and current_balance > 0:
        drawdown_ratio = min(abs(daily_delta) * 30 / current_balance, 1)
        return round(0.18 + drawdown_ratio * 0.32, 2)
    return 0.18


def _transactions_frame(transactions: list[dict]) -> pd.DataFrame:
    rows = []

    for transaction in transactions:
        amount = float(transaction.get("amount", 0))
        direction = transaction.get("direction")
        signed_amount = amount if direction == "inflow" or amount > 0 else -abs(amount)
        occurred_at = transaction.get("occurred_at")

        try:
            parsed_date = datetime.fromisoformat(str(occurred_at).replace("Z", "+00:00")).astimezone(timezone.utc)
        except ValueError:
            parsed_date = datetime.now(timezone.utc)

        rows.append(
            {
                "date": pd.Timestamp(parsed_date.date()),
                "signed_amount": signed_amount,
            }
        )

    if not rows:
        return pd.DataFrame(columns=["date", "signed_amount"])

    frame = pd.DataFrame(rows)
    latest = frame["date"].max()
    cutoff = latest - timedelta(days=90)
    return frame[frame["date"] >= cutoff]
