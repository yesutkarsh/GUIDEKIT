"""Text embedding service with OpenAI API integration and deterministic local fallback.

Embeddings are 1536-dimensional vectors (matching ``VECTOR(1536)`` in PostgreSQL).
When ``OPENAI_API_KEY`` is configured, the service calls OpenAI's
``text-embedding-3-small``. If the key is absent or an error occurs, it falls
back to a deterministic, L2-normalized 1536-dimensional semantic feature hash
computed over word and character n-grams. This ensures pgvector cosine similarity
searches work seamlessly offline and in smoke tests with zero API keys required.
"""

from __future__ import annotations

import hashlib
import logging
import math
import re
from typing import Sequence

import httpx

from app.core.config import settings

logger = logging.getLogger("guidekit.embeddings")

EMBEDDING_DIM = 1536
OPENAI_EMBEDDING_URL = "https://api.openai.com/v1/embeddings"
OPENAI_MODEL = "text-embedding-3-small"

# Tokenization regex: matches Unicode words/letters/numbers across Latin, Devanagari, etc.
_WORD_RE = re.compile(r"[\w]+", re.UNICODE)


def _hash_token(token: str, seed: int = 0) -> tuple[int, float]:
    """Hash a token into (index in [0, EMBEDDING_DIM), sign in {-1.0, +1.0})."""
    h = hashlib.sha256(f"{seed}:{token}".encode("utf-8")).digest()
    idx = int.from_bytes(h[:4], "big") % EMBEDDING_DIM
    sign = 1.0 if (h[4] & 1) == 0 else -1.0
    return idx, sign


def local_deterministic_embedding(text: str) -> list[float]:
    """Generate a deterministic, L2-normalized 1536-dim float vector from text.

    Uses signed feature hashing over:
    * word unigrams (weight 1.0)
    * word bigrams (weight 1.5)
    * character 3-grams (weight 0.4) — provides robustness for typos and non-Latin scripts.
    """
    cleaned = text.strip().lower()
    if not cleaned:
        # Zero vector or uniform unit vector
        val = 1.0 / math.sqrt(EMBEDDING_DIM)
        return [val] * EMBEDDING_DIM

    vec = [0.0] * EMBEDDING_DIM
    words = _WORD_RE.findall(cleaned)

    # 1. Word unigrams
    for w in words:
        idx, sign = _hash_token(w, seed=1)
        vec[idx] += sign * 1.0

    # 2. Word bigrams
    for i in range(len(words) - 1):
        bigram = f"{words[i]}_{words[i+1]}"
        idx, sign = _hash_token(bigram, seed=2)
        vec[idx] += sign * 1.5

    # 3. Character 3-grams (for subword/morphological overlap, e.g. Devanagari/Hindi)
    n = 3
    if len(cleaned) >= n:
        for i in range(len(cleaned) - n + 1):
            ngram = cleaned[i : i + n]
            idx, sign = _hash_token(ngram, seed=3)
            vec[idx] += sign * 0.4

    # L2-normalization
    norm_sq = sum(x * x for x in vec)
    if norm_sq > 0.0:
        inv_norm = 1.0 / math.sqrt(norm_sq)
        return [x * inv_norm for x in vec]

    val = 1.0 / math.sqrt(EMBEDDING_DIM)
    return [val] * EMBEDDING_DIM


async def embed_texts(texts: Sequence[str]) -> list[list[float]]:
    """Return 1536-dimensional embeddings for a batch of strings.

    If ``OPENAI_API_KEY`` is set, queries OpenAI. Otherwise (or on failure),
    generates deterministic local semantic hash vectors.
    """
    if not texts:
        return []

    api_key = settings.openai_api_key
    if api_key:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    OPENAI_EMBEDDING_URL,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": OPENAI_MODEL,
                        "input": list(texts),
                        "dimensions": EMBEDDING_DIM,
                    },
                )
                if res.status_code == 200:
                    data = res.json()
                    # Preserve exact input ordering
                    embeddings = [item["embedding"] for item in sorted(data["data"], key=lambda d: d["index"])]
                    return embeddings
                logger.warning(
                    "OpenAI embeddings call failed (%s %s); falling back to local deterministic embeddings",
                    res.status_code,
                    res.text[:200],
                )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Error contacting OpenAI embedding API: %s; falling back to local deterministic embeddings",
                exc,
            )

    # Local fallback
    return [local_deterministic_embedding(t) for t in texts]

