from __future__ import annotations

from api.routes import extract_savings_goal, top_spending_category
from forecasting.service import build_forecast
from insights.service import generate_insights
from scoring.service import calculate_financial_health_score


def test_financial_health_score_caps_extreme_negative_savings_rate() -> None:
    score = calculate_financial_health_score(
        monthly_income=500,
        monthly_spending=2_000,
        current_balance=3_000,
        monthly_subscription_cost=50,
        transactions=[],
    )

    assert 0 <= score["score"] <= 100
    assert score["savingsRateLabel"] == "-100%+"
    assert score["savingsRateIsExtreme"] is True
    assert score["displaySavingsRate"] == -100


def test_forecast_projects_key_horizons_from_cash_flow() -> None:
    forecast = build_forecast(
        current_balance=1_200,
        monthly_income=3_000,
        monthly_spending=2_400,
        transactions=[],
    )

    assert forecast["projectedBalance"] == 1_800
    assert forecast["lowestProjectedBalance"] == 1_200
    assert forecast["lowBalanceRisk"] is False
    assert [point["label"] for point in forecast["keyPoints"]] == ["Today", "Day 7", "Day 30", "Day 90"]


def test_top_spending_category_ignores_transfer_noise_when_possible() -> None:
    transactions = [
        {"direction": "outflow", "category": "TRANSFER_OUT", "amount": 20_000},
        {"direction": "outflow", "category": "FOOD_AND_DRINK", "amount": 450},
        {"direction": "outflow", "category": "ENTERTAINMENT", "amount": 120},
    ]

    assert top_spending_category(transactions) == ("Food And Drink", 450)


def test_insights_include_real_spending_driver_instead_of_transfer_noise() -> None:
    insights = generate_insights(
        score={"savingsRate": 12},
        forecast={"lowBalanceRisk": False, "dailyDelta": -15},
        transactions=[
            {"direction": "outflow", "category": "TRANSFER_OUT", "amount": 10_000},
            {"direction": "outflow", "category": "TRANSPORTATION", "amount": 650},
        ],
    )

    insight_titles = [insight["title"] for insight in insights]
    assert "Transportation is driving recent spending" in insight_titles


def test_savings_goal_parser_extracts_amount_and_target_date() -> None:
    goal = extract_savings_goal("I want to save $5,000 by December 2030")

    assert goal is not None
    assert goal["amount"] == 5_000
    assert goal["target_date"] == "2030-12-31"
    assert goal["target_label"] == "Dec 31, 2030"
    assert goal["months_remaining"] > 1
