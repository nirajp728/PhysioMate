"""Session numbers computed from the elbow-angle series. Pure functions, no database."""


def percentile(values, p):
    v = sorted(values)
    if not v:
        return 0.0
    k = (len(v) - 1) * p / 100
    lo, hi = int(k), min(int(k) + 1, len(v) - 1)
    return v[lo] + (v[hi] - v[lo]) * (k - lo)


def count_reps(angles, lo, hi):
    """One rep = the arm goes from extended (>= hi) down to flexed (<= lo) and back up to hi.
    Returns the range of motion of every completed rep."""
    roms, state, cmax, cmin = [], None, 0.0, 0.0
    for a in angles:
        if state is not None:
            cmax, cmin = max(cmax, a), min(cmin, a)
        if a >= hi:
            if state == "down":
                roms.append(cmax - cmin)
            if state != "up":
                cmax = cmin = a
            state = "up"
        elif a <= lo and state == "up":
            state = "down"
    return roms


def compute(series, calibration, game, duration_s, hz):
    """series = [[t_seconds, elbow_angle], ...]"""
    angles = [a for _, a in series]
    out = {
        "duration_s": round(duration_s, 1),
        "samples": len(angles),
        "max_angle": 0.0,
        "min_angle": 0.0,
        "rom": 0.0,
        "reps": 0,
        "rom_per_rep": [],
        "avg_rom": 0.0,
        "fatigue_pct": None,
        "coverage_pct": 0.0,
        "score": int((game or {}).get("score", 0)),
        "calibration": calibration,
    }
    if len(angles) < 5:
        return out

    mx, mn = percentile(angles, 99), percentile(angles, 1)  # percentiles ignore single noisy samples
    out.update(max_angle=round(mx, 1), min_angle=round(mn, 1), rom=round(mx - mn, 1))

    # rep thresholds: use the patient's calibrated range when we have it, else what was observed
    top, bottom = (calibration["max_angle"], calibration["min_angle"]) if calibration else (mx, mn)
    if top - bottom >= 10:
        roms = count_reps(angles, bottom + 0.25 * (top - bottom), bottom + 0.75 * (top - bottom))
        out["reps"] = len(roms)
        out["rom_per_rep"] = [round(r, 1) for r in roms]
        if roms:
            out["avg_rom"] = round(sum(roms) / len(roms), 1)
        if len(roms) >= 6:  # compare first third with last third
            n = len(roms) // 3
            first, last = sum(roms[:n]) / n, sum(roms[-n:]) / n
            out["fatigue_pct"] = round((first - last) / first * 100, 1) if first else None

    out["coverage_pct"] = round(min(100.0, len(angles) / max(duration_s * hz, 1) * 100), 1)
    return out


def summary_text(m, prev=None):
    """Plain-language summary for the report (no LLM needed)."""
    if m["reps"] == 0:
        return "Not enough completed repetitions were recorded in this session to report range-of-motion trends."
    parts = [f"{m['reps']} repetitions with an average range of motion of {m['avg_rom']:.0f}° per rep "
             f"(overall {m['min_angle']:.0f}° to {m['max_angle']:.0f}°)."]
    if m["fatigue_pct"] is not None:
        if m["fatigue_pct"] > 10:
            parts.append(f"Range of motion dropped by {m['fatigue_pct']:.0f}% from the start to the end of the session, which may indicate fatigue.")
        elif m["fatigue_pct"] < -10:
            parts.append(f"Range of motion improved by {-m['fatigue_pct']:.0f}% during the session.")
        else:
            parts.append("Range of motion stayed consistent through the session.")
    if prev and prev.get("rom"):
        d = m["rom"] - prev["rom"]
        parts.append(f"Overall range is {abs(d):.0f}° {'larger' if d >= 0 else 'smaller'} than the previous session.")
    return " ".join(parts)
