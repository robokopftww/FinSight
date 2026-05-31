from __future__ import annotations

from datetime import datetime, timezone

import numpy as np
import pandas as pd


def calculate_financial_health_score(
    monthly_income: float,
    monthly_spending: float,
    current_balance: float = 0,
    monthly_subscription_cost: float = 0,
    transactions: list[dict] | None = None,
) -> dict:
    raw_savings_rate = ((monthly_income - monthly_spending) / monthly_income) * 100 if monthly_income else 0
    positive_savings_rate = max(raw_savings_rate, 0)
    spending_volatility = _spending_volatility(transactions or [])
    subscription_burden = (monthly_subscription_cost / monthly_income) * 100 if monthly_income else 0
    emergency_fund_days = round((current_balance / monthly_spending) * 30) if monthly_spending else 90

    savings_component = min(positive_savings_rate / 30, 1)
    consistency_component = max(1 - spending_volatility, 0)
    subscription_component = max(1 - subscription_burden / 10, 0)
    runway_component = min(emergency_fund_days / 90, 1)

    score = round(
        (savings_component * 35)
        + (consistency_component * 25)
        + (runway_component * 25)
        + (subscription_component * 15)
    )
    score = max(0, min(score, 100))

    return {
        "score": score,
        "savingsRate": round(raw_savings_rate, 1),
        "savingsRateLabel": _format_percent(raw_savings_rate),
        "displaySavingsRate": min(max(raw_savings_rate, -100), 100),
        "savingsRateIsExtreme": abs(raw_savings_rate) > 100,
        "spendingVolatility": round(spending_volatility * 100, 1),
        "spendingConsistency": round(consistency_component * 100),
        "subscriptionBurden": round(subscription_burden, 1),
        "emergencyFundDays": emergency_fund_days,
        "factors": [
            {"label": "Savings rate", "value": round(savings_component * 100)},
            {"label": "Spending consistency", "value": round(consistency_component * 100)},
            {"label": "Emergency runway", "value": round(runway_component * 100)},
            {"label": "Subscription burden", "value": round(subscription_component * 100)},
        ],
        "recommendations": _recommendations(raw_savings_rate, emergency_fund_days, subscription_burden),
    }


def _spending_volatility(transactions: list[dict]) -> float:
    rows = []

    for transaction in transactions:
        if transaction.get("direction") != "outflow":
            continue

        try:
            parsed_date = datetime.fromisoformat(str(transaction.get("occurred_at")).replace("Z", "+00:00")).astimezone(timezone.utc)
        except ValueError:
            continue

        rows.append({"date": pd.Timestamp(parsed_date.date()), "amount": abs(float(transaction.get("amount", 0)))})

    if len(rows) < 3:
        return 0.35

    daily = pd.DataFrame(rows).groupby("date", as_index=False)["amount"].sum()
    mean = daily["amount"].mean()

    if mean == 0:
        return 0

    return float(min(np.std(daily["amount"]) / mean, 1))


def _format_percent(value: float) -> str:
    if value <= -100:
        return "-100%+"
    if value >= 100:
        return "100%+"
    return f"{round(value, 1)}%"


def _recommendations(savings_rate: float, emergency_fund_days: int, subscription_burden: float) -> list[str]:
    return [
        "Aim for a 20% savings rate by reducing flexible outflows or automating savings."
        if savings_rate < 20
        else "Your savings rate is healthy. Keep protecting that monthly margin.",
        "Build cash reserves until your emergency runway reaches at least 60 days."
        if emergency_fund_days < 60
        else "Your emergency runway is in a strong range for short-term shocks.",
        "Review recurring charges because subscriptions are taking a noticeable share of income."
        if subscription_burden > 5
        else "Subscription burden looks controlled based on recent income.",
    ]
