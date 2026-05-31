from __future__ import annotations

from collections import defaultdict


def generate_insights(score: dict, forecast: dict, transactions: list[dict] | None = None) -> list[dict]:
    insights = []
    transactions = transactions or []

    if forecast["lowBalanceRisk"]:
        insights.append(
            {
                "title": "Potential low-balance event",
                "summary": f"Current cash flow suggests your balance may fall to ${forecast['lowestProjectedBalance']:,.0f} within the next 90 days.",
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

    top_category = _top_spending_category(transactions)
    if top_category:
        category, amount = top_category
        insights.append(
            {
                "title": f"{category} is driving recent spending",
                "summary": f"Synced transactions show ${amount:,.0f} in recent {category.lower()} outflows.",
                "severity": "medium" if amount > 500 else "low",
            }
        )

    if forecast.get("dailyDelta", 0) < 0:
        insights.append(
            {
                "title": "Cash flow trend is negative",
                "summary": f"Your modeled balance is moving by about ${forecast['dailyDelta']:,.0f} per day at the current pace.",
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


def _top_spending_category(transactions: list[dict]) -> tuple[str, float] | None:
    totals: defaultdict[str, float] = defaultdict(float)

    for transaction in transactions:
        if transaction.get("direction") != "outflow":
            continue

        category = _display_category(transaction.get("category") or "Uncategorized")
        totals[category] += abs(float(transaction.get("amount", 0)))

    if not totals:
        return None

    return max(totals.items(), key=lambda item: item[1])


def _display_category(category: str) -> str:
    return " ".join(part.capitalize() for part in category.replace("_", " ").split())
