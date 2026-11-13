"""What the workers may touch. Everything here is tied to ONE patient_id chosen by the server."""
import math
import re
from collections import Counter
from datetime import datetime

from db import db
from rag import store
from rag.embeddings import embed

# The session schema the planner is allowed to ask for: name -> (path in the session document, meaning).
# Long angle series is deliberately not available.
FIELDS = {
    "date": ("started_at", "when the session started"),
    "duration_s": ("summary.duration_s", "session length in seconds"),
    "rom": ("summary.rom", "overall range of motion in degrees (highest minus lowest angle)"),
    "max_angle": ("summary.max_angle", "highest elbow angle reached, degrees"),
    "min_angle": ("summary.min_angle", "lowest elbow angle reached, degrees"),
    "reps": ("summary.reps", "number of completed repetitions"),
    "avg_rom": ("summary.avg_rom", "average range of motion per repetition, degrees"),
    "rom_per_rep": ("summary.rom_per_rep", "list: range of motion of each repetition, in order"),
    "fatigue_pct": ("summary.fatigue_pct", "percent drop in range from the first third to the last third (null if under 6 reps)"),
    "coverage_pct": ("summary.coverage_pct", "percent of expected sensor data that was received"),
    "score": ("summary.score", "game score"),
    "calibration_max": ("summary.calibration.max_angle", "the patient's calibrated maximum angle at that time"),
    "calibration_min": ("summary.calibration.min_angle", "the patient's calibrated minimum angle at that time"),
    "tip": ("tip", "the short coaching tip written after the session"),
    "reason": ("reason", "how the session ended: ended (patient pressed End) or timeout (connection lost)"),
}
MAX_SESSIONS = 30


def _day(ts):
    return datetime.fromtimestamp(ts).strftime("%d %b %Y %H:%M")


def _get(doc, path):
    for k in path.split("."):
        doc = doc.get(k) if isinstance(doc, dict) else None
    return doc


def list_sessions(patient_id):
    """Numbers, ids and dates only. No values. Number 1 is the oldest session."""
    rows = list(db().sessions.find({"patient_id": patient_id, "status": "ended"}, {"started_at": 1},
                                   sort=[("started_at", -1)], limit=200))[::-1]
    return [{"n": i + 1, "session_id": r["_id"], "date": _day(r["started_at"])} for i, r in enumerate(rows)]


def fetch_sessions(patient_id, requests):
    """requests = [{"session_numbers": [1, 3], "fields": ["rom", "reps"]}]. Reads only those fields of those
    sessions, and only if they belong to patient_id."""
    index = {s["n"]: s["session_id"] for s in list_sessions(patient_id)}
    want = {}
    for r in requests:
        for n in r["session_numbers"]:
            if n in index:
                want.setdefault(n, set()).update(r["fields"])
    ids = {index[n]: n for n in sorted(want)[:MAX_SESSIONS]}
    proj = {"started_at": 1}
    proj.update({FIELDS[f][0]: 1 for fs in want.values() for f in fs})
    out = []
    for d in db().sessions.find({"_id": {"$in": list(ids)}, "patient_id": patient_id, "status": "ended"}, proj):
        n = ids[d["_id"]]
        row = {"n": n, "date": _day(d["started_at"])}
        for f in sorted(want[n] - {"date"}):
            row[f] = _get(d, FIELDS[f][0])
        out.append(row)
    return sorted(out, key=lambda r: r["n"])


# ---- knowledge base: vector search + keyword search, merged with reciprocal rank fusion ----------

def _tok(text):
    return re.findall(r"[a-z0-9]+", text.lower())


def hybrid_search(query, k=3, pool=6):
    """Meaning-based hits and keyword hits are each ranked, then merged (rank fusion). With only a few dozen
    documents this is cheap; it protects against both 'same idea, different words' and exact-term questions."""
    vec = store.search("guidance", embed([query], True)[0], pool, {"doc_type": {"$eq": "guidance"}})
    docs = list(db().guidance.find({"doc_type": "guidance"}, {"embedding": 0}))
    df = Counter(w for d in docs for w in set(_tok(d["text"])))
    q = set(_tok(query))

    def keyword_score(d):
        words = set(_tok(d["text"] + " " + d["kind"]))
        return sum(math.log(1 + len(docs) / df[w]) for w in q & words if df[w])

    lex = [d for d in sorted(docs, key=keyword_score, reverse=True) if keyword_score(d) > 0][:pool]
    score = {}
    for ranking in (vec, lex):
        for rank, d in enumerate(ranking):
            score[d["_id"]] = score.get(d["_id"], 0) + 1 / (60 + rank)
    by_id = {d["_id"]: d for d in vec + lex}
    return [by_id[i] for i in sorted(score, key=score.get, reverse=True)[:k]]