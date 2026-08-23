from __future__ import annotations

import argparse
import os
import uuid

import psycopg

from rag.chunk import Chunk, chunk_text
from rag.embed import embed_texts
from rag.extract import extract
from rag.fetch import fetch_bytes
from rag.sources import SEED_SOURCES, Source

_EMBED_BATCH_SIZE = 100


def _vec(embedding: list[float]) -> str:
    return "[" + ",".join(f"{v:.7f}" for v in embedding) + "]"


def _batched(items: list, size: int) -> list[list]:
    return [items[i:i + size] for i in range(0, len(items), size)]


def _embed_chunks(chunks: list[Chunk]) -> list[list[float]]:
    """Embed chunk texts in batches of at most _EMBED_BATCH_SIZE per OpenAI call."""
    embeddings: list[list[float]] = []
    for batch in _batched([c.text for c in chunks], _EMBED_BATCH_SIZE):
        embeddings.extend(embed_texts(batch))
    return embeddings


def _upsert(conn: psycopg.Connection, source: Source, content: bytes,
            content_hash: str, content_type: str) -> tuple[str, int]:
    with conn.cursor() as cur:
        cur.execute('SELECT id, "contentHash" FROM "KbDocument" WHERE url = %s', (source.url,))
        existing = cur.fetchone()
        if existing and existing[1] == content_hash:
            return existing[0], 0
        if existing:
            doc_id = existing[0]
            cur.execute('DELETE FROM "KbChunk" WHERE "documentId" = %s', (doc_id,))
            cur.execute(
                'UPDATE "KbDocument" SET "contentHash" = %s, "fetchedAt" = NOW() WHERE id = %s',
                (content_hash, doc_id),
            )
        else:
            doc_id = "kbdoc_" + uuid.uuid4().hex[:16]
            cur.execute(
                """INSERT INTO "KbDocument" (id, source, title, url, publisher, "contentHash", "fetchedAt")
                   VALUES (%s, %s, %s, %s, %s, %s, NOW())""",
                (doc_id, source.kind, source.title, source.url, source.publisher, content_hash),
            )
        text = extract(content, content_type)
        if not text:
            return doc_id, 0
        chunks = chunk_text(text, target_tokens=500, overlap_tokens=80)
        if not chunks:
            return doc_id, 0
        embeddings = _embed_chunks(chunks)
        for chunk, embedding in zip(chunks, embeddings):
            chunk_id = "kbchunk_" + uuid.uuid4().hex[:16]
            cur.execute(
                """INSERT INTO "KbChunk" (id, "documentId", "order", heading, text, "tokenCount", embedding, "createdAt")
                   VALUES (%s, %s, %s, %s, %s, %s, %s::vector, NOW())""",
                (chunk_id, doc_id, chunk.order, chunk.heading, chunk.text, chunk.token_count, _vec(embedding)),
            )
        return doc_id, len(chunks)


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest WealthLens knowledge-base sources.")
    parser.add_argument("--only", help="substring filter over source URL")
    args = parser.parse_args()
    dsn = os.environ["DATABASE_URL"]
    total_chunks = 0
    with psycopg.connect(dsn, autocommit=False) as conn:
        for source in SEED_SOURCES:
            if args.only and args.only not in source.url:
                continue
            content_type = "application/pdf" if source.url.endswith(".pdf") else "text/html"
            content, content_hash = fetch_bytes(source.url)
            doc_id, added = _upsert(conn, source, content, content_hash, content_type)
            conn.commit()
            print(f"{source.publisher}: {source.title[:60]} → {doc_id} (+{added} chunks)")
            total_chunks += added
    print(f"Done. Added {total_chunks} chunks.")


if __name__ == "__main__":
    main()
