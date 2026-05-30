from __future__ import annotations


def calculate_financial_health_score(monthly_income: float, monthly_spending: float) -> dict:
    savings_rate = max((monthly_income - monthly_spending) / monthly_income, 0) if monthly_income else 0
    spending_volatility = min(monthly_spending / monthly_income, 1) if monthly_income else 1
    subscription_burden = 0.034
    emergency_fund_days = 42

    score = round(
        (savings_rate * 45)
        + ((1 - spending_volatility) * 25)
        + ((1 - subscription_burden) * 10)
        + min(emergency_fund_days / 90, 1) * 20
    )
    score = max(0, min(score, 100))

    return {
        "score": score,
        "savingsRate": round(savings_rate * 100, 1),
        "spendingVolatility": round(spending_volatility * 100, 1),
        "subscriptionBurden": round(subscription_burden * 100, 1),
        "emergencyFundDays": emergency_fund_days,
    }
