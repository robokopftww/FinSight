from __future__ import annotations

import os
from dataclasses import dataclass

import psycopg

_MIN_SCORE = 0.35


@dataclass
class ChunkHit:
    id: str
    document_id: str
    heading: str | None
    text: str
    title: str
    url: str
    publisher: str
    score: float


def _vec_literal(embedding: list[float]) -> str:
    return "[" + ",".join(f"{v:.7f}" for v in embedding) + "]"


def pgvector_search(query_embedding: list[float], k: int) -> list[ChunkHit]:
    literal = _vec_literal(query_embedding)
    sql = """
        SELECT c.id, c."documentId", c.heading, c.text,
               d.title, d.url, d.publisher,
               1 - (c.embedding <=> %s::vector) AS score
        FROM "KbChunk" c
        JOIN "KbDocument" d ON d.id = c."documentId"
        ORDER BY c.embedding <=> %s::vector
        LIMIT %s
    """
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
        # The ivfflat index (lists=100) needs more than the default 1 probe to
        # find matches reliably while the KB has far fewer rows than lists;
        # sqrt(lists) is pgvector's standard recall/latency balance point.
        cur.execute("SET LOCAL ivfflat.probes = 10")
        cur.execute(sql, (literal, literal, k))
        rows = cur.fetchall()
    hits: list[ChunkHit] = []
    for row in rows:
        score = float(row[7])
        if score < _MIN_SCORE:
            continue
        hits.append(ChunkHit(
            id=row[0], document_id=row[1], heading=row[2], text=row[3],
            title=row[4], url=row[5], publisher=row[6], score=score,
        ))
    return hits
