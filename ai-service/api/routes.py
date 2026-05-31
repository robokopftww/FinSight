from __future__ import annotations

from fastapi import APIRouter
import re
from datetime import datetime, timedelta, timezone

from categorization.service import categorize_merchant
from forecasting.service import build_forecast
from insights.service import generate_insights
from schemas.analytics import AnalyticsRequest, ChatRequest
from scoring.service import calculate_financial_health_score

router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "finsight-ai-service"}


@router.post("/analytics/score")
def score(payload: AnalyticsRequest) -> dict:
    return calculate_financial_health_score(
        payload.monthly_income,
        payload.monthly_spending,
        payload.current_balance,
        payload.monthly_subscription_cost,
        [transaction.model_dump() for transaction in payload.transactions],
    )


@router.post("/analytics/forecast")
def forecast(payload: AnalyticsRequest) -> dict:
    return build_forecast(
        payload.current_balance,
        payload.monthly_income,
        payload.monthly_spending,
        [transaction.model_dump() for transaction in payload.transactions],
    )


@router.post("/analytics/insights")
def insights(payload: AnalyticsRequest) -> dict:
    transactions = [transaction.model_dump() for transaction in payload.transactions]
    score_data = calculate_financial_health_score(
        payload.monthly_income,
        payload.monthly_spending,
        payload.current_balance,
        payload.monthly_subscription_cost,
        transactions,
    )
    forecast_data = build_forecast(payload.current_balance, payload.monthly_income, payload.monthly_spending, transactions)
    return {"data": generate_insights(score_data, forecast_data, transactions)}


@router.post("/analytics/summary")
def analytics_summary(payload: AnalyticsRequest) -> dict:
    transactions = [transaction.model_dump() for transaction in payload.transactions]
    score_data = calculate_financial_health_score(
        payload.monthly_income,
        payload.monthly_spending,
        payload.current_balance,
        payload.monthly_subscription_cost,
        transactions,
    )
    forecast_data = build_forecast(payload.current_balance, payload.monthly_income, payload.monthly_spending, transactions)

    return {
        "score": score_data,
        "forecast": forecast_data,
        "insights": generate_insights(score_data, forecast_data, transactions),
        "modelVersion": "python-analytics-v1",
    }


@router.post("/analytics/report")
def weekly_report(payload: AnalyticsRequest) -> dict:
    transactions = [transaction.model_dump() for transaction in payload.transactions]
    forecast_data = build_forecast(payload.current_balance, payload.monthly_income, payload.monthly_spending, transactions)
    return build_weekly_report(payload, forecast_data, transactions)


@router.post("/analytics/chat")
def chat(payload: ChatRequest) -> dict:
    transactions = [transaction.model_dump() for transaction in payload.transactions]
    score_data = calculate_financial_health_score(
        payload.monthly_income,
        payload.monthly_spending,
        payload.current_balance,
        payload.monthly_subscription_cost,
        transactions,
    )
    forecast_data = build_forecast(payload.current_balance, payload.monthly_income, payload.monthly_spending, transactions)
    return build_advisor_response(payload.question, payload, score_data, forecast_data, transactions)


@router.post("/analytics/categorize")
def categorize(payload: dict) -> dict:
    return categorize_merchant(payload.get("merchantName", "Unknown"))


def build_advisor_response(
    question: str,
    payload: ChatRequest,
    score_data: dict,
    forecast_data: dict,
    transactions: list[dict],
) -> dict:
    lower_question = question.lower()
    purchase_amount = extract_purchase_amount(question)
    top_category = top_spending_category(transactions)
    projected_balance = float(forecast_data["projectedBalance"])
    safe_to_spend = max(payload.current_balance - max(payload.monthly_spending * 0.5, 500), 0)

    if purchase_amount:
        remaining_safe = safe_to_spend - purchase_amount
        remaining_projection = projected_balance - purchase_amount
        affordable = remaining_safe >= 0 and projected_balance - purchase_amount >= 500
        decision = "affordable" if affordable else "caution"
        answer = (
            f"A {format_currency(purchase_amount)} purchase looks affordable right now. "
            f"After that purchase, your safe-to-spend buffer would be about {format_currency(remaining_safe)}, "
            f"and your projected 30-day balance would be {format_currency(remaining_projection)}."
            if affordable
            else f"I would be cautious about a {format_currency(purchase_amount)} purchase. "
            f"It would push your safe-to-spend buffer to about {format_currency(remaining_safe)}, "
            f"with a projected 30-day balance near {format_currency(remaining_projection)}."
        )
    elif "save" in lower_question or "saving" in lower_question:
        target_rate = max(20, score_data.get("savingsRate", 0))
        monthly_target = payload.monthly_income * 0.2 if payload.monthly_income else 0
        decision = "plan"
        answer = (
            f"Your current savings rate is {score_data['savingsRateLabel']}. "
            f"A strong next target is saving about {format_currency(monthly_target)} per month, or 20% of detected income. "
            f"Start with the largest flexible category first."
        )
        if top_category:
            answer += f" Recent synced data points to {top_category[0]} as the first place to inspect."
    elif "spend" in lower_question or "why" in lower_question:
        decision = "analysis"
        if top_category:
            answer = (
                f"Your recent spending is most concentrated in {top_category[0]}, totaling about ${top_category[1]:,.0f}. "
                f"Monthly spending is {format_currency(payload.monthly_spending)}, compared with {format_currency(payload.monthly_income)} in detected income."
            )
        else:
            answer = "I do not have enough categorized outflows yet to explain a spending spike. Sync more transactions and ask again."
    else:
        decision = "summary"
        answer = (
            f"Your financial health score is {score_data['score']}/100. "
            f"At the current pace, your projected 30-day balance is {format_currency(projected_balance)}, "
            f"with a safe-to-spend estimate around {format_currency(safe_to_spend)}."
        )

    data_points = (
        [
            {"label": "Current balance", "value": format_currency(payload.current_balance)},
            {"label": "Purchase amount", "value": format_currency(purchase_amount)},
            {"label": "After-purchase buffer", "value": format_currency(safe_to_spend - purchase_amount)},
            {"label": "After-purchase projection", "value": format_currency(projected_balance - purchase_amount)},
        ]
        if purchase_amount
        else [
            {"label": "Current balance", "value": format_currency(payload.current_balance)},
            {"label": "Projected 30-day balance", "value": format_currency(projected_balance)},
            {"label": "Safe to spend", "value": format_currency(safe_to_spend)},
            {"label": "Savings rate", "value": score_data["savingsRateLabel"]},
        ]
    )

    if top_category:
        data_points.append({"label": "Top spending category", "value": f"{top_category[0]} ({format_currency(top_category[1])})"})

    return {
        "answer": answer,
        "decision": decision,
        "dataPoints": data_points,
        "followUps": [
            "Can I afford a $400 purchase?",
            "Why did I spend so much this month?",
            "How can I save more money?",
        ],
        "source": "python-analytics-v1",
    }


def extract_purchase_amount(question: str) -> float | None:
    match = re.search(r"\$?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)", question)
    if not match:
        return None
    return float(match.group(1).replace(",", ""))


def top_spending_category(transactions: list[dict]) -> tuple[str, float] | None:
    totals: dict[str, float] = {}

    for transaction in transactions:
        if transaction.get("direction") != "outflow":
            continue
        category = display_category(transaction.get("category") or "Uncategorized")
        totals[category] = totals.get(category, 0) + abs(float(transaction.get("amount", 0)))

    if not totals:
        return None

    return max(totals.items(), key=lambda item: item[1])


def display_category(category: str) -> str:
    return " ".join(part.capitalize() for part in category.replace("_", " ").split())


def format_currency(value: float) -> str:
    rounded = round(value)
    prefix = "-$" if rounded < 0 else "$"
    return f"{prefix}{abs(rounded):,}"


def format_change_percent(value: float) -> str:
    if value >= 100:
        return "+100%+"
    if value <= -100:
        return "-100%+"
    return f"{value:+.1f}%"


def build_weekly_report(payload: AnalyticsRequest, forecast_data: dict, transactions: list[dict]) -> dict:
    dated_transactions = []

    for transaction in transactions:
        try:
            occurred_at = datetime.fromisoformat(str(transaction.get("occurred_at")).replace("Z", "+00:00")).astimezone(timezone.utc)
        except ValueError:
            continue

        dated_transactions.append({**transaction, "occurred_at_date": occurred_at.date()})

    if not dated_transactions:
        return {
            "periodLabel": "No synced transactions",
            "cards": [
                {"label": "This week spending", "value": "$0", "detail": "Sync transactions to generate a report."},
                {"label": "Change vs last week", "value": "0%", "detail": "No comparison data yet."},
                {"label": "Top category", "value": "None", "detail": "No categorized outflows yet."},
                {"label": "Largest transaction", "value": "$0", "detail": "No posted transactions yet."},
            ],
            "insights": [
                {
                    "title": "Weekly report is waiting for data",
                    "summary": "Connect and sync a Plaid sandbox account to generate spending comparisons and forecast commentary.",
                    "severity": "low",
                }
            ],
            "weeklySpend": [],
            "source": "python-analytics-v1",
        }

    latest = max(transaction["occurred_at_date"] for transaction in dated_transactions)
    current_start = latest - timedelta(days=6)
    previous_start = latest - timedelta(days=13)
    previous_end = latest - timedelta(days=7)

    current_week = [
        transaction
        for transaction in dated_transactions
        if current_start <= transaction["occurred_at_date"] <= latest
    ]
    previous_week = [
        transaction
        for transaction in dated_transactions
        if previous_start <= transaction["occurred_at_date"] <= previous_end
    ]

    current_outflows = [transaction for transaction in current_week if transaction.get("direction") == "outflow"]
    previous_outflows = [transaction for transaction in previous_week if transaction.get("direction") == "outflow"]
    current_spending = sum(abs(float(transaction.get("amount", 0))) for transaction in current_outflows)
    previous_spending = sum(abs(float(transaction.get("amount", 0))) for transaction in previous_outflows)
    change_amount = current_spending - previous_spending
    change_percent = ((change_amount / previous_spending) * 100) if previous_spending else (100 if current_spending else 0)
    top_category = top_report_category(current_outflows)
    largest_transaction = max(current_outflows, key=lambda transaction: abs(float(transaction.get("amount", 0))), default=None)
    projected_balance = float(forecast_data["projectedBalance"])
    safe_to_spend = max(payload.current_balance - max(payload.monthly_spending * 0.5, 500), 0)
    daily_spend = []

    for offset in range(7):
        day = current_start + timedelta(days=offset)
        total = sum(
            abs(float(transaction.get("amount", 0)))
            for transaction in current_outflows
            if transaction["occurred_at_date"] == day
        )
        daily_spend.append({"label": day.strftime("%a"), "amount": round(total, 2)})

    direction_word = "increased" if change_amount > 0 else "decreased" if change_amount < 0 else "held steady"
    largest_name = largest_transaction.get("merchant_name") or largest_transaction.get("description") if largest_transaction else "No transaction"
    largest_amount = abs(float(largest_transaction.get("amount", 0))) if largest_transaction else 0

    insights = [
        {
            "title": f"Spending {direction_word} this week",
            "summary": (
                f"Weekly outflows were {format_currency(current_spending)}, "
                f"{format_currency(abs(change_amount))} {'above' if change_amount > 0 else 'below' if change_amount < 0 else 'from'} last week."
            ),
            "severity": "medium" if change_amount > 0 else "low",
        },
        {
            "title": f"{top_category[0]} led spending" if top_category else "No top category yet",
            "summary": (
                f"{top_category[0]} accounted for {format_currency(top_category[1])} in the current report window."
                if top_category
                else "There were no posted outflows in the current report window."
            ),
            "severity": "medium" if top_category and top_category[1] > 500 else "low",
        },
        {
            "title": "Cash-flow forecast remains above risk floor" if projected_balance >= 500 else "Forecast risk needs attention",
            "summary": (
                f"Your projected 30-day balance is {format_currency(projected_balance)} with safe-to-spend around {format_currency(safe_to_spend)}."
            ),
            "severity": "low" if projected_balance >= 500 else "high",
        },
    ]

    return {
        "periodLabel": f"{current_start.strftime('%b %-d')} - {latest.strftime('%b %-d')}",
        "cards": [
            {
                "label": "This week spending",
                "value": format_currency(current_spending),
                "detail": f"{len(current_outflows)} outflow transactions analyzed.",
            },
            {
                "label": "Change vs last week",
                "value": format_change_percent(change_percent),
                "detail": f"{format_currency(abs(change_amount))} {('higher' if change_amount > 0 else 'lower' if change_amount < 0 else 'unchanged')}.",
            },
            {
                "label": "Top category",
                "value": top_category[0] if top_category else "None",
                "detail": format_currency(top_category[1]) if top_category else "No outflows this week.",
            },
            {
                "label": "Largest transaction",
                "value": format_currency(largest_amount),
                "detail": str(largest_name),
            },
        ],
        "insights": insights,
        "weeklySpend": daily_spend,
        "forecast": {
            "projectedBalance": projected_balance,
            "safeToSpend": safe_to_spend,
            "riskProbability": forecast_data["riskProbability"],
        },
        "source": "python-analytics-v1",
    }


def top_report_category(transactions: list[dict]) -> tuple[str, float] | None:
    ignored = {"TRANSFER_OUT", "TRANSFER_IN", "LOAN_PAYMENTS"}
    flexible = [transaction for transaction in transactions if transaction.get("category") not in ignored]
    candidates = flexible if flexible else transactions
    totals: dict[str, float] = {}

    for transaction in candidates:
        category = display_category(transaction.get("category") or "Uncategorized")
        totals[category] = totals.get(category, 0) + abs(float(transaction.get("amount", 0)))

    if not totals:
        return None

    return max(totals.items(), key=lambda item: item[1])
