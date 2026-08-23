from __future__ import annotations

from dataclasses import dataclass
import re

import tiktoken

_ENCODER = tiktoken.get_encoding("cl100k_base")
_HEADING_RE = re.compile(r"^\s*(#+)\s+(.+?)\s*$", re.MULTILINE)


@dataclass
class Chunk:
    order: int
    heading: str | None
    text: str
    token_count: int


def _split_by_heading(text: str) -> list[tuple[str | None, str]]:
    matches = list(_HEADING_RE.finditer(text))
    if not matches:
        return [(None, text.strip())]
    sections: list[tuple[str | None, str]] = []
    for i, m in enumerate(matches):
        heading = m.group(2).strip()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[start:end].strip()
        if body:
            sections.append((heading, body))
    return sections


def chunk_text(text: str, target_tokens: int = 500, overlap_tokens: int = 80) -> list[Chunk]:
    if target_tokens <= overlap_tokens:
        raise ValueError("target_tokens must exceed overlap_tokens")
    sections = _split_by_heading(text)
    out: list[Chunk] = []
    order = 0
    for heading, body in sections:
        tokens = _ENCODER.encode(body)
        if not tokens:
            continue
        step = target_tokens - overlap_tokens
        for start in range(0, len(tokens), step):
            slice_tokens = tokens[start:start + target_tokens]
            if not slice_tokens:
                break
            piece = _ENCODER.decode(slice_tokens).strip()
            if piece:
                out.append(Chunk(order=order, heading=heading, text=piece, token_count=len(slice_tokens)))
                order += 1
            if start + target_tokens >= len(tokens):
                break
    return out
