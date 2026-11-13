"""Live sessions. The server does three jobs: it checks who may watch whom, it passes the WebRTC
connection set-up messages between a patient and the physiotherapists watching, and it records a low-rate
elbow series for the report. The live IMU and game data go straight from the patient's browser to each
physiotherapist's browser over WebRTC and never pass through the server."""
import time
import threading
import uuid

from flask import current_app, request
from flask_jwt_extended import decode_token
from flask_socketio import join_room, leave_room

import metrics
import reports
from db import db
from extensions import socketio

live = {}      # patient_id -> running session
clients = {}   # socket id -> {"id", "role"}
patient_sid = {}  # patient_id -> socket id of the ONE tab that is sending the session (for set-up messages)
watchers = {}     # patient_id -> socket ids of assigned physiotherapists who are watching
lock = threading.Lock()
cfg = {}
reaper_started = False


def init(app):
    cfg.update(HEARTBEAT_TIMEOUT=app.config["HEARTBEAT_TIMEOUT"], SERIES_HZ=app.config["SERIES_HZ"],
               REPORT_ASYNC=app.config["REPORT_ASYNC"])
    live.clear()
    clients.clear()
    patient_sid.clear()
    watchers.clear()


def is_live(patient_id):
    return patient_id in live


def latest_calibration(patient_id):
    c = db().calibrations.find_one({"patient_id": patient_id}, sort=[("created_at", -1)])
    return {"max_angle": c["max_angle"], "min_angle": c["min_angle"]} if c else None


def assigned_physios(patient_id):
    return [a["physio_id"] for a in db().assignments.find({"patient_id": patient_id})]


def tell_physios(patient_id, is_live_now, session_id):
    for pid in assigned_physios(patient_id):
        socketio.emit("patient_live", {"patient_id": patient_id, "live": is_live_now, "session_id": session_id},
                      to=f"physio:{pid}")


def end_session(patient_id, reason):
    with lock:
        s = live.pop(patient_id, None)
    if not s:
        return None
    duration = time.time() - s["started"]
    summary = metrics.compute(s["series"], latest_calibration(patient_id), s["game"], duration, cfg["SERIES_HZ"])
    db().sessions.update_one({"_id": s["session_id"]}, {"$set": {
        "ended_at": time.time(), "status": "ended", "reason": reason,
        "summary": summary, "series": s["series"], "report": {"status": "pending"}}})
    socketio.emit("session_ended", {"patient_id": patient_id, "session_id": s["session_id"], "reason": reason},
                  to=f"watch:{patient_id}")
    tell_physios(patient_id, False, s["session_id"])
    reports.enqueue(s["session_id"], background=cfg["REPORT_ASYNC"])  # Lambda, or a background task here
    return s["session_id"]


def reap_once(now=None):
    """Close sessions whose patient stopped sending anything (closed tab, lost Wi-Fi...)."""
    now = now or time.time()
    for pid, s in list(live.items()):
        if now - s["last_seen"] > cfg["HEARTBEAT_TIMEOUT"]:
            end_session(pid, "timeout")


def _reaper():
    while True:
        socketio.sleep(2)
        reap_once()


def _me():
    return clients.get(request.sid)


def disconnect_user(user_id):
    """Close every socket of a user (log out everywhere)."""
    for sid, c in list(clients.items()):
        if c["id"] == user_id:
            socketio.server.disconnect(sid, namespace="/")


@socketio.on("connect")
def on_connect(auth=None):
    # The browser sends the httpOnly cookie with the handshake. Origin is already checked against FRONTEND_ORIGINS.
    try:
        claims = decode_token(request.cookies.get(current_app.config["JWT_ACCESS_COOKIE_NAME"], ""))
    except Exception:
        return False  # reject
    user = db().users.find_one({"_id": claims["sub"]})
    if not user or user.get("token_version", 0) != claims.get("ver", 0):
        return False
    clients[request.sid] = {"id": user["_id"], "role": user["role"]}
    if user["role"] == "physiotherapist":
        join_room(f"physio:{user['_id']}")


@socketio.on("disconnect")
def on_disconnect(*_):
    me = clients.pop(request.sid, None)  # the session itself ends by timeout, so a short drop can resume
    if me and patient_sid.get(me["id"]) == request.sid:
        del patient_sid[me["id"]]
    for ids in watchers.values():
        ids.discard(request.sid)


# ---- patient side -------------------------------------------------------------

@socketio.on("session_start")
def on_session_start(data=None):
    global reaper_started
    me = _me()
    if not me or me["role"] != "patient":
        return {"ok": False, "error": "Only patients can start a session."}
    pid = me["id"]
    now = time.time()
    data = data if isinstance(data, dict) else {}
    tab = str(data.get("tab", ""))[:64]  # random id of this browser tab, so a reconnect of the same tab is recognised
    with lock:
        s = live.get(pid)
        if s:
            old = s["sender"]
            other_tab_live = old != request.sid and old in clients and s["tab"] != tab
            if other_tab_live and not data.get("takeover"):  # a second tab must not feed the same session
                return {"ok": False, "error": "busy"}
            if other_tab_live:
                socketio.emit("session_taken_over", {}, to=old)  # the old tab stops itself
            s.update(sender=request.sid, tab=tab, last_seen=now)
            patient_sid[pid] = request.sid
            tell_physios(pid, True, s["session_id"])  # the sending browser changed: watchers call it again
            return {"ok": True, "session_id": s["session_id"], "resumed": True}
        sid = uuid.uuid4().hex
        live[pid] = {"session_id": sid, "started": now, "last_seen": now, "series": [], "next_t": 0.0, "game": {},
                     "sender": request.sid, "tab": tab}
        patient_sid[pid] = request.sid
    db().sessions.insert_one({"_id": sid, "patient_id": pid, "started_at": now, "status": "live",
                              "game": (data or {}).get("game", "flappy")})
    tell_physios(pid, True, sid)
    if not reaper_started:
        reaper_started = True
        socketio.start_background_task(_reaper)
    return {"ok": True, "session_id": sid, "resumed": False}


def _running(me):
    """The patient's session, but only for the one socket that owns it (the sending tab)."""
    s = live.get(me["id"]) if me and me["role"] == "patient" else None
    return s if s and s["sender"] == request.sid else None


@socketio.on("imu")
def on_imu(data):
    me = _me()
    s = _running(me)
    if not s or not isinstance(data, dict):
        return
    now = time.time()
    s["last_seen"] = now
    t = now - s["started"]
    elbow = data.get("elbow")
    if isinstance(elbow, (int, float)) and t >= s["next_t"]:
        s["series"].append([round(t, 1), round(float(elbow), 1)])
        s["next_t"] = t + 1.0 / cfg["SERIES_HZ"]


@socketio.on("game_state")
def on_game_state(data):
    me = _me()
    s = _running(me)
    if not s or not isinstance(data, dict):
        return
    s["last_seen"] = time.time()
    s["game"] = {"score": data.get("score", 0)}


@socketio.on("heartbeat")
def on_heartbeat(*_):
    s = _running(_me())
    if s:
        s["last_seen"] = time.time()


@socketio.on("session_end")
def on_session_end(*_):
    me = _me()
    if not me or me["role"] != "patient" or not _running(me):
        return {"ok": False}
    return {"ok": True, "session_id": end_session(me["id"], "ended")}


# ---- physiotherapist side -----------------------------------------------------

@socketio.on("watch")
def on_watch(data):
    me = _me()
    pid = (data or {}).get("patient_id")
    if not me or me["role"] != "physiotherapist":
        return {"ok": False, "error": "Only physiotherapists can watch."}
    if not db().assignments.find_one({"physio_id": me["id"], "patient_id": pid}):
        return {"ok": False, "error": "This patient is not assigned to you."}
    join_room(f"watch:{pid}")  # only for "session ended" style notices
    watchers.setdefault(pid, set()).add(request.sid)
    s = live.get(pid)
    return {"ok": True, "live": bool(s), "session_id": s["session_id"] if s else None}


@socketio.on("unwatch")
def on_unwatch(data):
    pid = (data or {}).get("patient_id")
    leave_room(f"watch:{pid}")
    watchers.get(pid, set()).discard(request.sid)
    return {"ok": True}


def revoke(physio_id, patient_id):
    """The assignment was removed: cut that physiotherapist off at once (close their live link, stop set-up messages)."""
    for sid in list(watchers.get(patient_id, ())):
        if clients.get(sid, {}).get("id") != physio_id:
            continue
        watchers[patient_id].discard(sid)
        leave_room(f"watch:{patient_id}", sid=sid, namespace="/")
        if patient_id in patient_sid:
            socketio.emit("rtc_revoke", {"from": sid}, to=patient_sid[patient_id])
        socketio.emit("watch_revoked", {"patient_id": patient_id}, to=sid)


# ---- WebRTC set-up (offers, answers, network candidates) ----------------------

@socketio.on("rtc_signal")
def on_rtc_signal(msg):
    """Passes set-up messages only between a patient and a physiotherapist who is assigned and watching."""
    me, msg = _me(), msg if isinstance(msg, dict) else {}
    if not me or not isinstance(msg.get("data"), dict):
        return
    if me["role"] == "physiotherapist":
        pid = msg.get("patient_id")
        target = patient_sid.get(pid)
        assigned = db().assignments.find_one({"physio_id": me["id"], "patient_id": pid}) is not None  # checked again every time
        if target and assigned and request.sid in watchers.get(pid, ()):
            socketio.emit("rtc_signal", {"from": request.sid, "data": msg["data"]}, to=target)
    elif msg.get("to") in watchers.get(me["id"], ()):
        socketio.emit("rtc_signal", {"data": msg["data"]}, to=msg["to"])