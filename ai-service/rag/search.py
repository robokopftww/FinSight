from __future__ import annotations

from dataclasses import dataclass, field

from rag.embed import embed_text
from rag.store import ChunkHit, pgvector_search


@dataclass
class Source:
    n: int
    title: str
    publisher: str
    url: str
    snippet: str


@dataclass
class SearchResult:
    hits: list[ChunkHit] = field(default_factory=list)

    def to_sources(self, start_n: int) -> list[Source]:
        return [
            Source(
                n=start_n + i,
                title=h.title,
                publisher=h.publisher,
                url=h.url,
                snippet=_snippet(h.text),
            )
            for i, h in enumerate(self.hits)
        ]


def _snippet(text: str, max_chars: int = 140) -> str:
    text = " ".join(text.split())
    if len(text) <= max_chars:
        return text
    cut = text[:max_chars].rsplit(" ", 1)[0]
    return f"{cut}…"


def search_docs(query: str, k: int = 6) -> SearchResult:
    embedding = embed_text(query)
    hits = pgvector_search(embedding, k)
    return SearchResult(hits=hits)
