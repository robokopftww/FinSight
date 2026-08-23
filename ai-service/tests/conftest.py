from __future__ import annotations

import os
import uuid

import psycopg
import pytest

from rag.embed import embed_texts

_FIXTURE_TEXTS = [
    ("Emergency fund basics",
     "Aim for 3 to 6 months of essential expenses in a high-yield savings account."),
    ("Credit utilization",
     "Keep revolving balances under 30% of your credit limit to protect your score."),
    ("Subscription discipline",
     "Cancel any subscription you have not used in 30 days to reclaim discretionary income."),
]


def _vec(embedding: list[float]) -> str:
    return "[" + ",".join(f"{v:.7f}" for v in embedding) + "]"


@pytest.fixture(scope="session")
def seeded_kb():
    if not os.getenv("OPENAI_API_KEY") or not os.getenv("DATABASE_URL"):
        pytest.skip("requires OPENAI_API_KEY and DATABASE_URL")
    conn = psycopg.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    doc_ids: list[str] = []
    embeddings = embed_texts([t for _, t in _FIXTURE_TEXTS])
    with conn.cursor() as cur:
        for (title, text), embedding in zip(_FIXTURE_TEXTS, embeddings):
            doc_id = "kbdoc_test_" + uuid.uuid4().hex[:12]
            chunk_id = "kbchunk_test_" + uuid.uuid4().hex[:12]
            cur.execute(
                """INSERT INTO "KbDocument" (id, source, title, url, publisher, "contentHash", "fetchedAt")
                   VALUES (%s, 'GOV', %s, %s, 'TEST', 'seed', NOW())""",
                (doc_id, title, f"https://example.test/{doc_id}"),
            )
            cur.execute(
                """INSERT INTO "KbChunk" (id, "documentId", "order", heading, text, "tokenCount", embedding, "createdAt")
                   VALUES (%s, %s, 0, %s, %s, %s, %s::vector, NOW())""",
                (chunk_id, doc_id, title, text, len(text.split()), _vec(embedding)),
            )
            doc_ids.append(doc_id)
    yield doc_ids
    with conn.cursor() as cur:
        cur.execute('DELETE FROM "KbDocument" WHERE id = ANY(%s)', (doc_ids,))
    conn.close()
