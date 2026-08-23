import os
from unittest.mock import MagicMock, patch

# answer_question() short-circuits with a fallback message when
# ANTHROPIC_API_KEY is unset; the Anthropic client itself is mocked below via
# `_client`, so a placeholder value is enough to exercise the tool-calling
# loop without a real key (CI runs this suite with no key configured).
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")

from rag.answer import answer_question
from rag.search import SearchResult
from rag.store import ChunkHit
from schemas.rag import RagRequest, ToolContext


def _hit(text: str) -> ChunkHit:
    return ChunkHit(
        id="c", document_id="d", heading="H", text=text,
        title="Doc", url="https://example.test/a", publisher="TEST", score=0.9,
    )


def _fake_message(text: str = "", tool_uses=None):
    msg = MagicMock()
    msg.stop_reason = "tool_use" if tool_uses else "end_turn"
    content = []
    if tool_uses:
        for name, args, use_id in tool_uses:
            block = MagicMock()
            block.type = "tool_use"
            block.name = name
            block.input = args
            block.id = use_id
            content.append(block)
    if text:
        block = MagicMock()
        block.type = "text"
        block.text = text
        content.append(block)
    msg.content = content
    return msg


def test_answer_uses_search_and_returns_sources():
    req = RagRequest(
        question="How big should my emergency fund be?",
        toolContext=ToolContext(userId="u_1", plaidReady=False, now="2026-08-23T00:00:00Z"),
        history=[],
    )
    fake_client = MagicMock()
    fake_client.messages.create.side_effect = [
        _fake_message(tool_uses=[("searchDocs", {"query": "emergency fund"}, "u1")]),
        _fake_message(text="Aim for 3–6 months of expenses [1]."),
    ]
    with patch("rag.answer._client", return_value=fake_client), \
         patch("rag.answer.search_docs",
               return_value=SearchResult(hits=[_hit("Aim for 3 to 6 months")])):
        resp = answer_question(req, tool_jwt="jwt.stub")
    assert "3–6 months" in resp.answer
    assert resp.sources and resp.sources[0].n == 1
    assert resp.toolTrace[0].name == "searchDocs"


def test_answer_terminates_on_max_iters():
    req = RagRequest(
        question="loop",
        toolContext=ToolContext(userId="u_1", plaidReady=False, now="2026-08-23T00:00:00Z"),
        history=[],
    )
    fake_client = MagicMock()
    fake_client.messages.create.side_effect = [
        _fake_message(tool_uses=[("searchDocs", {"query": "x"}, f"u{i}")]) for i in range(10)
    ]
    with patch("rag.answer._client", return_value=fake_client), \
         patch("rag.answer.search_docs", return_value=SearchResult(hits=[])):
        resp = answer_question(req, tool_jwt="jwt.stub")
    assert fake_client.messages.create.call_count == 8
    assert isinstance(resp.answer, str)
