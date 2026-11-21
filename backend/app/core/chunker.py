"""Document text extraction and semantic chunking service.

Supports:
- PDF text extraction with page tracking via pypdf.
- Clean semantic chunking along paragraphs, markdown headings, and sentence boundaries.
"""

from __future__ import annotations

import io
import re
from typing import Any


def extract_text_from_pdf(pdf_bytes: bytes) -> list[tuple[int, str]]:
    """Extract clean text from PDF bytes, returning a list of (page_number, page_text)."""
    try:
        import pypdf
    except ImportError:
        raise RuntimeError("pypdf is required to extract text from PDF files")

    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
    pages: list[tuple[int, str]] = []

    for idx, page in enumerate(reader.pages, start=1):
        try:
            txt = page.extract_text() or ""
        except Exception:
            txt = ""
        # Normalize whitespace
        clean_txt = re.sub(r"[ \t]+", " ", txt).strip()
        if clean_txt:
            pages.append((idx, clean_txt))

    return pages


def chunk_document_text(
    text: str,
    max_chars: int = 1600,
    overlap_chars: int = 200,
    page_number: int | None = None,
) -> list[dict[str, Any]]:
    """Split document text into coherent chunks along paragraph and sentence boundaries.

    Ensures words and sentences are never cut mid-stride while respecting max_chars.
    Returns a list of dicts with:
    - chunk_index (int)
    - content (str)
    - char_count (int)
    - meta (dict with page_number or section info)
    """
    clean_text = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not clean_text:
        return []

    # First, split into structural blocks (double newline or markdown headings)
    raw_blocks = re.split(r"(\n\s*\n|(?=^#{1,4}\s))", clean_text, flags=re.MULTILINE)
    blocks: list[str] = []
    for b in raw_blocks:
        b_clean = b.strip()
        if not b_clean:
            continue
        if len(b_clean) > max_chars:
            # Split long block into sentences
            sentences = re.split(r"(?<=[.!?])\s+", b_clean)
            cur = ""
            for s in sentences:
                if len(cur) + len(s) + 1 > max_chars and cur:
                    blocks.append(cur.strip())
                    cur = s
                else:
                    cur = f"{cur} {s}".strip() if cur else s
            if cur.strip():
                blocks.append(cur.strip())
        else:
            blocks.append(b_clean)

    chunks: list[dict[str, Any]] = []
    current_chunk = ""
    chunk_index = 0

    for block in blocks:
        # If adding block exceeds max_chars and current_chunk is non-empty, flush current_chunk
        if len(current_chunk) + len(block) + 2 > max_chars and current_chunk:
            meta: dict[str, Any] = {"char_count": len(current_chunk)}
            if page_number is not None:
                meta["page_number"] = page_number

            chunks.append({
                "chunk_index": chunk_index,
                "content": current_chunk.strip(),
                "char_count": len(current_chunk.strip()),
                "meta": meta,
            })
            chunk_index += 1

            # Compute overlap from the end of current_chunk
            if overlap_chars > 0 and len(current_chunk) > overlap_chars:
                overlap_text = current_chunk[-overlap_chars:].strip()
                # Find start of a word in overlap
                space_idx = overlap_text.find(" ")
                if space_idx != -1:
                    current_chunk = overlap_text[space_idx + 1:] + "\n\n" + block
                else:
                    current_chunk = block
            else:
                current_chunk = block
        else:
            if current_chunk:
                current_chunk += "\n\n" + block
            else:
                current_chunk = block

    if current_chunk.strip():
        meta = {"char_count": len(current_chunk.strip())}
        if page_number is not None:
            meta["page_number"] = page_number

        chunks.append({
            "chunk_index": chunk_index,
            "content": current_chunk.strip(),
            "char_count": len(current_chunk.strip()),
            "meta": meta,
        })

    return chunks
