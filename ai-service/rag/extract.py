from __future__ import annotations

import io

import pypdf
import trafilatura


def extract_pdf(data: bytes) -> str:
    reader = pypdf.PdfReader(io.BytesIO(data))
    return "\n\n".join((page.extract_text() or "") for page in reader.pages).strip()


def extract_html(data: bytes) -> str:
    text = trafilatura.extract(data.decode("utf-8", errors="ignore"), include_formatting=False)
    return (text or "").strip()


def extract(data: bytes, content_type: str) -> str:
    if "pdf" in content_type.lower():
        return extract_pdf(data)
    if "html" in content_type.lower() or "xml" in content_type.lower():
        return extract_html(data)
    return data.decode("utf-8", errors="ignore").strip()
