"""Numbers for the admin dashboard: a few small queries, then plain Python."""
import time

DAY = 86400
WEEKS = 8  # how far back the weekly charts go


def _day(ts):
    return time.strftime("%d %b", time.gmtime(ts))


def build(db, is_live, target, now=None):
    """target = sessions per week that count as "following the plan"."""
    now = now or time.time()
    users = list(db.users.find({}, {"username": 1, "role": 1, "created_at": 1}))
    patients = [u for u in users if u["role"] == "patient"]
    physios = [u for u in users if u["role"] == "physiotherapist"]
    pairs = list(db.assignments.find())
    assigned = {a["patient_id"] for a in pairs}

    sessions = list(db.sessions.find({"status": "ended", "started_at": {"$gt": now - WEEKS * 7 * DAY}}, {"series": 0}))
    for s in sessions:
        s["week"] = int((now - s["started_at"]) // (7 * DAY))  # 0 = the last 7 days
        s["summary"] = s.get("summary") or {}

    # sessions per day, last 30 days (oldest first)
    per_day = {}
    for s in sessions:
        d = int((now - s["started_at"]) // DAY)
        if d < 30:
            per_day[d] = per_day.get(d, 0) + 1
    daily = [{"date": _day(now - d * DAY), "sessions": per_day.get(d, 0)} for d in range(29, -1, -1)]

    # weekly: sessions, patients who did at least one, patients who met the target, average range of motion
    weekly = []
    for w in range(WEEKS - 1, -1, -1):
        rows = [s for s in sessions if s["week"] == w]
        counts = {}
        for s in rows:
            counts[s["patient_id"]] = counts.get(s["patient_id"], 0) + 1
        roms = [s["summary"]["rom"] for s in rows if s["summary"].get("rom")]
        weekly.append({
            "label": "This week" if w == 0 else f"{w}w ago",
            "sessions": len(rows),
            "active": len(counts),
            "adherent": sum(c >= target for c in counts.values()),
            "adherence_pct": round(100 * sum(c >= target for c in counts.values()) / len(patients), 1) if patients else 0,
            "avg_rom": round(sum(roms) / len(roms), 1) if roms else None,
        })

    this_week = {}
    last_seen = {}
    for s in sessions:
        last_seen[s["patient_id"]] = max(last_seen.get(s["patient_id"], 0), s["started_at"])
        if s["week"] == 0:
            this_week[s["patient_id"]] = this_week.get(s["patient_id"], 0) + 1
    patient_rows = sorted(
        ({"username": p["username"], "sessions_7d": this_week.get(p["_id"], 0), "last_session": last_seen.get(p["_id"]),
          "assigned": p["_id"] in assigned} for p in patients),
        key=lambda r: (r["sessions_7d"], r["last_session"] or 0))

    load = {}
    for a in pairs:
        load[a["physio_id"]] = load.get(a["physio_id"], 0) + 1

    roms = [s["summary"]["rom"] for s in sessions if s["summary"].get("rom")]
    scores = [s["summary"]["score"] for s in sessions if s["summary"].get("score")]
    reports = {"ready": 0, "pending": 0, "failed": 0}
    for s in sessions:
        st = (s.get("report") or {}).get("status")
        if st in reports:
            reports[st] += 1

    return {
        "target_per_week": target,
        "users": {
            "total": len(users), "patients": len(patients), "physiotherapists": len(physios),
            "admins": len(users) - len(patients) - len(physios),
            "new_7d": sum(u.get("created_at", 0) > now - 7 * DAY for u in users),
            "new_30d": sum(u.get("created_at", 0) > now - 30 * DAY for u in users),
        },
        "patients": {
            "assigned": sum(p["_id"] in assigned for p in patients),
            "unassigned": sum(p["_id"] not in assigned for p in patients),
            "live_now": sum(bool(is_live(p["_id"])) for p in patients),
            "active_7d": len(this_week),
            "inactive_7d": len(patients) - len(this_week),
        },
        "sessions": {
            "total": db.sessions.count_documents({"status": "ended"}),
            "last_7d": sum(s["week"] == 0 for s in sessions),
            "last_30d": sum(now - s["started_at"] < 30 * DAY for s in sessions),
            "reps": sum(s["summary"].get("reps", 0) for s in sessions),
            "minutes": round(sum(s["summary"].get("duration_s", 0) for s in sessions) / 60),
            "avg_rom": round(sum(roms) / len(roms), 1) if roms else None,
            "avg_score": round(sum(scores) / len(scores)) if scores else None,
        },
        "adherence_pct": weekly[-1]["adherence_pct"],
        "reports": reports,
        "daily": daily,
        "weekly": weekly,
        "lowest_adherence": patient_rows[:8],
        "physio_load": sorted(({"username": p["username"], "patients": load.get(p["_id"], 0)} for p in physios),
                              key=lambda r: -r["patients"]),
    }