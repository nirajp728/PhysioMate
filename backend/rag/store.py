import numpy as np

from config import Config
from db import db


def add(collection, docs, vectors):
    for d, v in zip(docs, vectors):
        d["embedding"] = v
    if docs:
        db()[collection].insert_many(docs)


def search(collection, qvec, k, flt):
    """flt looks like {"patient_id": {"$eq": "..."}}. The filter is applied while searching,
    so other patients' chunks are never even candidates."""
    if Config.ATLAS_SEARCH:
        return list(db()[collection].aggregate([
            {"$vectorSearch": {"index": f"{collection}_index", "path": "embedding", "queryVector": qvec,
                               "numCandidates": 100, "limit": k, "filter": flt}},
            {"$addFields": {"score": {"$meta": "vectorSearchScore"}}},
            {"$project": {"embedding": 0}},
        ]))
    rows = list(db()[collection].find(flt))  # local fallback: cosine similarity in numpy
    if not rows:
        return []
    scores = np.array([r["embedding"] for r in rows]) @ np.array(qvec)
    out = []
    for i in np.argsort(-scores)[:k]:
        r = dict(rows[i])
        r.pop("embedding")
        r["score"] = float(scores[i])
        out.append(r)
    return out