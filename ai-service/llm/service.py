from __future__ import annotations

import logging
import os
from typing import Any


logger = logging.getLogger(__name__)

DEFAULT_MODEL = "gemini-2.5-flash"


def gemini_source() -> str:
    return f"gemini:{_model_name()}"


def llm_status() -> dict:
    return {
        "provider": "gemini",
        "model": _model_name(),
        "configured": bool(os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")),
    }


def refine_advisor_answer(
    *,
    question: str,
    draft_answer: str,
    decision: str,
    data_points: list[dict[str, str]],
    top_category: tuple[str, float] | None,
) -> tuple[str, str]:
    prompt = f"""
You are WealthLens, an AI financial copilot. Rewrite the draft answer into a clear,
professional response for a consumer finance dashboard.

Rules:
- Use only the numbers and facts provided below.
- Do not recalculate or invent balances, dates, rates, or categories.
- Keep the response to 2-4 sentences.
- Be concrete and helpful, but do not provide investment, tax, or legal advice.
- If the decision is caution, sound calm and practical.

User question:
{question}

Decision:
{decision}

Grounded data points:
{_format_data_points(data_points)}

Top spending category:
{top_category[0] + " $" + format(top_category[1], ",.0f") if top_category else "None"}

Draft answer:
{draft_answer}
""".strip()

    answer = _generate_text(prompt)

    if not answer:
        return draft_answer, "python-analytics-v1"

    return answer, gemini_source()


def build_weekly_summary(
    *,
    period_label: str,
    cards: list[dict[str, str]],
    insights: list[dict[str, str]],
    forecast: dict[str, Any],
) -> tuple[str | None, str]:
    prompt = f"""
You are WealthLens, an AI financial copilot. Write a weekly financial summary for
the user based only on these analytics.

Rules:
- 3 sentences maximum.
- Mention the most important spending change, the category or transaction that matters most,
  and whether short-term cash-flow risk looks stable or needs attention.
- Use only the provided numbers and labels.
- Do not provide investment, tax, or legal advice.

Report period:
{period_label}

Metric cards:
{_format_cards(cards)}

Insights:
{_format_insights(insights)}

Forecast:
Projected balance: {_format_currency(float(forecast.get("projectedBalance", 0)))}
Safe to spend: {_format_currency(float(forecast.get("safeToSpend", 0)))}
Risk probability: {round(float(forecast.get("riskProbability", 0)) * 100)}%
""".strip()

    summary = _generate_text(prompt)

    if not summary:
        return None, "python-analytics-v1"

    return summary, gemini_source()


def _generate_text(prompt: str) -> str | None:
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

    if not api_key:
        return None

    try:
        from google import genai

        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=_model_name(),
            contents=prompt,
        )
        text = getattr(response, "text", None)

        if not text:
            return None

        return " ".join(text.strip().split())
    except Exception:
        logger.exception("Gemini text generation failed; falling back to deterministic output")
        return None


def _model_name() -> str:
    return os.getenv("GEMINI_MODEL", DEFAULT_MODEL)


def _format_data_points(data_points: list[dict[str, str]]) -> str:
    return "\n".join(f"- {point['label']}: {point['value']}" for point in data_points)


def _format_cards(cards: list[dict[str, str]]) -> str:
    return "\n".join(f"- {card['label']}: {card['value']} ({card['detail']})" for card in cards)


def _format_insights(insights: list[dict[str, str]]) -> str:
    return "\n".join(f"- {insight['title']}: {insight['summary']}" for insight in insights)


def _format_currency(value: float) -> str:
    rounded = round(value)
    prefix = "-$" if rounded < 0 else "$"
    return f"{prefix}{abs(rounded):,}"
