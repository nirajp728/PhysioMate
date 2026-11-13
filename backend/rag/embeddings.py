import numpy as np

from config import Config

_fake = None


def set_embedder(fn):
    """Tests plug in a fake embedder here."""
    global _fake
    _fake = fn


def available():
    return bool(_fake or Config.GEMINI_API_KEY)


def embed(texts, query=False):
    """Returns one unit-length vector per text."""
    if _fake:
        return _fake(texts)
    from google.genai import types
    from rag.llm import client

    res = client().models.embed_content(
        model=Config.EMBED_MODEL,
        contents=texts,
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_QUERY" if query else "RETRIEVAL_DOCUMENT",
            output_dimensionality=Config.EMBED_DIMS,
        ),
    )
    out = []
    for e in res.embeddings:  # vectors shorter than 3072 must be normalised by hand
        v = np.array(e.values, dtype=float)
        out.append((v / np.linalg.norm(v)).tolist())
    return out