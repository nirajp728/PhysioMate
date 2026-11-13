import base64
import hashlib
import hmac
import io
import time

from flask import Blueprint, current_app, jsonify, request, send_file
from flask_jwt_extended import get_jwt, get_jwt_identity
from pymongo.errors import DuplicateKeyError

import live
import analytics
import reports
from rag import agent, guard
from auth import public, roles_required
from db import db

bp = Blueprint("api", __name__, url_prefix="/api")

SESSION_LIST_FIELDS = {"series": 0}  # leave the long angle series out of list responses


def can_view(patient_id):
    """The patient themself, or a physiotherapist this patient is assigned to."""
    uid, role = get_jwt_identity(), get_jwt().get("role")
    if role == "patient":
        return uid == patient_id
    if role == "physiotherapist":
        return db().assignments.find_one({"physio_id": uid, "patient_id": patient_id}) is not None
    return False


def latest_calibration(patient_id):
    return db().calibrations.find_one({"patient_id": patient_id}, {"_id": 0, "patient_id": 0}, sort=[("created_at", -1)])


# ---- calibration (patient) ----------------------------------------------------

@bp.post("/calibration")
@roles_required("patient")
def save_calibration():
    d = request.get_json(silent=True) or {}
    try:
        hi, lo = float(d["max_angle"]), float(d["min_angle"])
    except (KeyError, TypeError, ValueError):
        return jsonify(message="max_angle and min_angle are required numbers."), 400
    if not (0 <= lo < hi <= 200) or hi - lo < 10:
        return jsonify(message="The range looks wrong: extension must be at least 10° above flexion."), 400
    db().calibrations.insert_one({"patient_id": get_jwt_identity(), "max_angle": round(hi, 1),
                                  "min_angle": round(lo, 1), "created_at": time.time()})
    return jsonify(max_angle=hi, min_angle=lo), 201


@bp.get("/calibration/latest")
@roles_required("patient")
def my_calibration():
    return jsonify(calibration=latest_calibration(get_jwt_identity()))


# ---- sessions -----------------------------------------------------------------

@bp.get("/patients/<pid>/sessions")
@roles_required("patient", "physiotherapist")
def patient_sessions(pid):
    if not can_view(pid):
        return jsonify(message="Not allowed."), 403
    rows = db().sessions.find({"patient_id": pid, "status": "ended"}, SESSION_LIST_FIELDS, sort=[("started_at", -1)], limit=50)
    return jsonify(sessions=[{**r, "id": r.pop("_id")} for r in rows])


@bp.get("/sessions/<sid>")
@roles_required("patient", "physiotherapist")
def one_session(sid):
    s = db().sessions.find_one({"_id": sid})
    if not s or not can_view(s["patient_id"]):
        return jsonify(message="Not found."), 404
    s["id"] = s.pop("_id")
    return jsonify(session=s)


@bp.get("/sessions/<sid>/report")
@roles_required("patient", "physiotherapist")
def session_report(sid):
    s = db().sessions.find_one({"_id": sid})
    if not s or not can_view(s["patient_id"]):
        return jsonify(message="Not found."), 404
    pdf = reports.load(s.get("report"))
    if pdf is None:
        return jsonify(message="Report is not ready yet.", report=s.get("report")), 404
    return send_file(io.BytesIO(pdf), mimetype="application/pdf", download_name=f"session-{sid[:8]}.pdf")


@bp.post("/sessions/<sid>/report/retry")
@roles_required("patient", "physiotherapist")
def retry_report(sid):
    s = db().sessions.find_one({"_id": sid})
    if not s or not can_view(s["patient_id"]):
        return jsonify(message="Not found."), 404
    if (s.get("report") or {}).get("status") != "failed":
        return jsonify(message="Only a failed report can be retried."), 409
    db().sessions.update_one({"_id": sid}, {"$set": {"report": {"status": "pending"}, "report_tries": 0}})
    reports.enqueue(sid, tip=False)
    return jsonify(message="Retrying."), 202


# ---- WebRTC -------------------------------------------------------------------

@bp.get("/rtc/ice")
@roles_required("patient", "physiotherapist")
def rtc_ice():
    """ICE servers for the browser. TURN credentials are made per request and expire (coturn "use-auth-secret"):
    username = "<expiry time>:<user id>", password = base64(HMAC-SHA1(secret, username))."""
    cfg = current_app.config
    servers = [{"urls": u} for u in cfg["STUN_URLS"]]
    if cfg["TURN_URLS"] and cfg["TURN_SECRET"]:
        user = f"{int(time.time()) + cfg['TURN_TTL']}:{get_jwt_identity()}"
        cred = base64.b64encode(hmac.new(cfg["TURN_SECRET"].encode(), user.encode(), hashlib.sha1).digest()).decode()
        servers.append({"urls": cfg["TURN_URLS"], "username": user, "credential": cred})
    return jsonify(ice_servers=servers, ttl=cfg["TURN_TTL"])


# ---- physiotherapist ----------------------------------------------------------

@bp.get("/physio/patients/available")
@roles_required("physiotherapist")
def available_patients():
    mine = {a["patient_id"] for a in db().assignments.find({"physio_id": get_jwt_identity()})}
    return jsonify(patients=[{**public(u), "assigned": u["_id"] in mine} for u in db().users.find({"role": "patient"})])


@bp.post("/physio/patients")
@roles_required("physiotherapist")
def add_patient():
    pid = (request.get_json(silent=True) or {}).get("patient_id")
    if not db().users.find_one({"_id": pid, "role": "patient"}):
        return jsonify(message="Patient not found."), 404
    try:
        db().assignments.insert_one({"physio_id": get_jwt_identity(), "patient_id": pid, "created_at": time.time()})
    except DuplicateKeyError:
        pass  # already added
    return jsonify(message="Added."), 201


@bp.delete("/physio/patients/<pid>")
@roles_required("physiotherapist")
def remove_patient(pid):
    db().assignments.delete_one({"physio_id": get_jwt_identity(), "patient_id": pid})
    live.revoke(get_jwt_identity(), pid)  # also closes a live link that is open right now
    return jsonify(message="Removed.")


@bp.get("/physio/patients")
@roles_required("physiotherapist")
def my_patients():
    out = []
    for a in db().assignments.find({"physio_id": get_jwt_identity()}):
        u = db().users.find_one({"_id": a["patient_id"]})
        if not u:
            continue
        last = db().sessions.find_one({"patient_id": u["_id"], "status": "ended"}, SESSION_LIST_FIELDS, sort=[("started_at", -1)])
        out.append({**public(u), "live": live.is_live(u["_id"]), "calibration": latest_calibration(u["_id"]),
                    "last_session": {**last, "id": last.pop("_id")} if last else None})
    return jsonify(patients=out)


@bp.get("/physio/dashboard")
@roles_required("physiotherapist")
def physio_dashboard():
    ids = [a["patient_id"] for a in db().assignments.find({"physio_id": get_jwt_identity()})]
    week = time.time() - 7 * 86400
    recent = list(db().sessions.find({"patient_id": {"$in": ids}, "status": "ended", "started_at": {"$gt": week}}, SESSION_LIST_FIELDS))
    roms = [r["summary"]["rom"] for r in recent if r["summary"]["rom"]]
    return jsonify(assigned=len(ids), live_now=sum(live.is_live(i) for i in ids), sessions_7d=len(recent),
                   avg_rom_7d=round(sum(roms) / len(roms), 1) if roms else None)


# ---- admin --------------------------------------------------------------------

@bp.get("/admin/users")
@roles_required("admin")
def admin_users():
    users = [public(u) for u in db().users.find()]
    pairs = [{"physio_id": a["physio_id"], "patient_id": a["patient_id"]} for a in db().assignments.find()]
    return jsonify(users=users, assignments=pairs)

@bp.get("/admin/analytics")
@roles_required("admin")
def admin_analytics():
    return jsonify(analytics.build(db(), live.is_live, current_app.config.get("ADHERENCE_TARGET", 3)))

@bp.post("/admin/assign")
@roles_required("admin")
def admin_assign():
    d = request.get_json(silent=True) or {}
    if not db().users.find_one({"_id": d.get("physio_id"), "role": "physiotherapist"}) \
            or not db().users.find_one({"_id": d.get("patient_id"), "role": "patient"}):
        return jsonify(message="Pick a physiotherapist and a patient."), 400
    try:
        db().assignments.insert_one({"physio_id": d["physio_id"], "patient_id": d["patient_id"], "created_at": time.time()})
    except DuplicateKeyError:
        pass
    return jsonify(message="Assigned."), 201


@bp.delete("/admin/assign")
@roles_required("admin")
def admin_unassign():
    d = request.get_json(silent=True) or {}
    db().assignments.delete_one({"physio_id": d.get("physio_id"), "patient_id": d.get("patient_id")})
    live.revoke(d.get("physio_id"), d.get("patient_id"))
    return jsonify(message="Removed.")


# ---- assistant ----------------------------------------------------------------

@bp.post("/chat")
@roles_required("patient", "physiotherapist")
def chat():
    d = request.get_json(silent=True) or {}
    q = (d.get("question") or "").strip()
    if not q or len(q) > 500:
        return jsonify(message="Ask a question (up to 500 characters)."), 400
    # the patient is decided here, never by the model: patients get themselves, physiotherapists a patient they are assigned to
    pid = get_jwt_identity() if get_jwt().get("role") == "patient" else d.get("patient_id")
    if not pid or not can_view(pid):
        return jsonify(message="Choose one of your patients."), 403
    pii = guard.scan(q)  # before anything reaches the model
    if pii["blocked"]:
        return jsonify(message=f"Your message seems to contain {' and '.join(pii['blocked'])}. It was not sent. Please remove it and ask again."), 400
    if not agent.configured():
        return jsonify(message="The assistant is not set up yet (add GEMINI_API_KEY)."), 503
    try:
        text, sources, used = agent.answer(pii["text"], pid)
    except Exception as e:
        print("[chat] failed:", e)
        return jsonify(message="The assistant could not answer right now."), 502
    notice = f"Hidden before answering: {', '.join(pii['redacted'])}." if pii["redacted"] else None
    return jsonify(answer=text, sources=sources, used=used, notice=notice)