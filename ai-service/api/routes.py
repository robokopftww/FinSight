from fastapi import APIRouter

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
    return calculate_financial_health_score(payload.monthly_income, payload.monthly_spending)


@router.post("/analytics/forecast")
def forecast(payload: AnalyticsRequest) -> dict:
    return build_forecast(payload.current_balance, payload.monthly_income, payload.monthly_spending)


@router.post("/analytics/insights")
def insights(payload: AnalyticsRequest) -> dict:
    score_data = calculate_financial_health_score(payload.monthly_income, payload.monthly_spending)
    forecast_data = build_forecast(payload.current_balance, payload.monthly_income, payload.monthly_spending)
    return {"data": generate_insights(score_data, forecast_data)}


@router.post("/analytics/chat")
def chat(payload: ChatRequest) -> dict:
    score_data = calculate_financial_health_score(payload.monthly_income, payload.monthly_spending)
    forecast_data = build_forecast(payload.current_balance, payload.monthly_income, payload.monthly_spending)
    answer = (
        f"Based on a projected 30-day balance of ${forecast_data['projectedBalance']:.2f} "
        f"and a savings rate of {score_data['savingsRate']:.1f}%, "
        f"{payload.question.lower().rstrip('?')} looks manageable, but it would reduce your buffer if spending rises."
    )
    return {"answer": answer}


@router.post("/analytics/categorize")
def categorize(payload: dict) -> dict:
    return categorize_merchant(payload.get("merchantName", "Unknown"))
