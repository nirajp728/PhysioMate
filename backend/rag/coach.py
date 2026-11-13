"""After each session, write a short rule-based tip. Rules on purpose: no model, no cost, nothing invented.
(Session numbers are NOT embedded: the assistant reads them from the database.)"""
from db import db


def tip(m, prev=None):
    if not m["reps"]:
        return "No complete repetitions were counted. Check the band fit and try a few slow, full curls."
    if prev and prev.get("rom"):
        d = m["rom"] - prev["rom"]
        first = f"Your range grew by {d:.0f}°" if d >= 3 else f"Your range was {-d:.0f}° smaller than last time" if d <= -3 else "Your range was about the same as last time"
    else:
        first = f"Good start: your range was {m['rom']:.0f}°"
    f = m["fatigue_pct"]
    if f is not None and f > 10:
        second = ", but it dropped toward the end. Shorter sets with a rest may help."
    elif f is not None and f < -10:
        second = ", and you improved as the session went on."
    else:
        second = ", and it stayed steady through the session."
    extra = " Some data was missed, so keep the band snug." if m["coverage_pct"] < 80 else ""
    return first + second + extra + " Follow your physiotherapist's plan."


def after_session(session_id):
    s = db().sessions.find_one({"_id": session_id})
    prev = db().sessions.find_one({"patient_id": s["patient_id"], "status": "ended", "_id": {"$ne": session_id},
                                   "started_at": {"$lt": s["started_at"]}}, sort=[("started_at", -1)])
    db().sessions.update_one({"_id": session_id}, {"$set": {"tip": tip(s["summary"], prev["summary"] if prev else None)}})