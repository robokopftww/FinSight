from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Source:
    url: str
    title: str
    publisher: str
    kind: str  # "GOV" | "COMMERCIAL"


SEED_SOURCES: list[Source] = [
    # Original brief URL (cfpb_building_your_savings.pdf) 404s; substituted
    # with CFPB's "Building your savings? Start with small goals." booklet,
    # which lives under the same files.consumerfinance.gov host.
    Source(
        url="https://files.consumerfinance.gov/f/documents/cfpb_ymyg-savings-booklet.pdf",
        title="CFPB · Building your savings",
        publisher="CFPB",
        kind="GOV",
    ),
    # Original brief URL (cfpb_your-money-your-goals_toolkit_english.pdf)
    # 404s; substituted with the current YMYG financial empowerment toolkit.
    Source(
        url="https://files.consumerfinance.gov/f/documents/cfpb_your-money-your-goals_financial-empowerment_toolkit.pdf",
        title="CFPB · Your Money Your Goals — toolkit",
        publisher="CFPB",
        kind="GOV",
    ),
    # Original brief URL (...focus-on-people-with-disabilities_toolkit.pdf)
    # 404s; substituted with the current filename (drops "_toolkit" suffix).
    Source(
        url="https://files.consumerfinance.gov/f/documents/cfpb_ymyg_focus-on-people-with-disabilities.pdf",
        title="CFPB · YMYG — focus on people with disabilities",
        publisher="CFPB",
        kind="GOV",
    ),
]
