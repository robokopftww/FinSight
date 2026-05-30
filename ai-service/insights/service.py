from __future__ import annotations


def generate_insights(score: dict, forecast: dict) -> list[dict]:
    insights = []

    if forecast["lowBalanceRisk"]:
        insights.append(
            {
                "title": "Potential low-balance event",
                "summary": "Current cash flow suggests your balance may fall below $500 before the next paycheck.",
                "severity": "high",
            }
        )

    if score["savingsRate"] < 20:
        insights.append(
            {
                "title": "Savings rate can improve",
                "summary": "Increasing monthly savings by even 5% would strengthen your financial health score.",
                "severity": "medium",
            }
        )

    if not insights:
        insights.append(
            {
                "title": "Financial momentum is stable",
                "summary": "Your current spending pace keeps you within a healthy short-term balance range.",
                "severity": "low",
            }
        )

    return insights
