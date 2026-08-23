from __future__ import annotations

import os

import pytest

from rag.search import search_docs

pytestmark = pytest.mark.skipif(
    not os.getenv("OPENAI_API_KEY") or not os.getenv("DATABASE_URL"),
    reason="requires OPENAI_API_KEY and DATABASE_URL",
)


def test_search_returns_scored_hits(seeded_kb):
    result = search_docs("How big should an emergency fund be?", k=3)
    assert len(result.hits) <= 3
    assert all(0.0 <= h.score <= 1.0 for h in result.hits)
    # The fixture's chunk body text doesn't repeat the word "emergency" (only
    # its heading/title do), so check either field for the expected hit.
    assert any(
        "emergency" in h.text.lower() or "emergency" in (h.heading or "").lower()
        for h in result.hits
    )
