from rag.chunk import chunk_text


def test_chunks_respect_target_size():
    text = "Section 1\n\n" + ("Sentence one. " * 400) + "\n\nSection 2\n\n" + ("Sentence two. " * 400)
    chunks = chunk_text(text, target_tokens=200, overlap_tokens=40)
    assert len(chunks) >= 4
    for c in chunks:
        assert c.token_count <= 260
        assert c.text.strip() != ""


def test_chunks_carry_heading():
    text = "# Emergency Fund\n\nSave 3 to 6 months of expenses.\n\n# Credit Utilization\n\nStay under 30%."
    chunks = chunk_text(text, target_tokens=50, overlap_tokens=10)
    headings = {c.heading for c in chunks}
    assert "Emergency Fund" in headings
    assert "Credit Utilization" in headings
