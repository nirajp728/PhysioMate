import re
import time
import uuid
from functools import wraps

from flask import Blueprint, jsonify, request
from flask_jwt_extended import (create_access_token, create_refresh_token, get_jwt, get_jwt_identity,
                                set_access_cookies, set_refresh_cookies, unset_jwt_cookies, verify_jwt_in_request)
from pymongo.errors import DuplicateKeyError
from werkzeug.security import check_password_hash, generate_password_hash

from db import db

bp = Blueprint("auth", __name__, url_prefix="/api/auth")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def public(u):
    return {"id": u["_id"], "username": u["username"], "email": u["email"], "role": u["role"]}


def roles_required(*roles):
    """Route decorator: valid JWT + one of the given roles."""

    def deco(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            if get_jwt().get("role") not in roles:
                return jsonify(message="Not allowed for your role."), 403
            return fn(*args, **kwargs)

        return wrapper

    return deco


def create_user(username, email, password, role, phone=""):
    user = {
        "_id": uuid.uuid4().hex,
        "username": username,
        "email": email,
        "phone": phone,
        "password_hash": generate_password_hash(password),
        "role": role,
        "created_at": time.time(),
    }
    db().users.insert_one(user)
    return user


@bp.post("/register")
def register():
    d = request.get_json(silent=True) or {}
    username = (d.get("username") or "").strip()
    email = (d.get("email") or "").strip().lower()
    password = d.get("password") or ""
    role = d.get("role") or "patient"

    if len(username) < 2:
        return jsonify(message="Username is too short."), 400
    if not EMAIL_RE.match(email):
        return jsonify(message="Enter a valid email."), 400
    if len(password) < 8:
        return jsonify(message="Password must be at least 8 characters."), 400
    if role not in ("patient", "physiotherapist"):  # admins are created by the server, not by sign-up
        return jsonify(message="Invalid role."), 400

    try:
        create_user(username, email, password, role, (d.get("phone") or "").strip())
    except DuplicateKeyError:
        return jsonify(message="An account with this email already exists."), 409
    return jsonify(message="Registered."), 201


def _claims(user):
    return {"role": user["role"], "ver": user.get("token_version", 0)}


@bp.post("/login")
def login():
    d = request.get_json(silent=True) or {}
    user = db().users.find_one({"email": (d.get("email") or "").strip().lower()})
    if not user or not check_password_hash(user["password_hash"], d.get("password") or ""):
        return jsonify(message="Wrong email or password."), 401
    resp = jsonify(user=public(user))  # no token in the body: it only travels in httpOnly cookies
    set_access_cookies(resp, create_access_token(identity=user["_id"], additional_claims=_claims(user)))
    set_refresh_cookies(resp, create_refresh_token(identity=user["_id"], additional_claims=_claims(user)))
    return resp


@bp.post("/refresh")
def refresh():
    verify_jwt_in_request(refresh=True)
    user = db().users.find_one({"_id": get_jwt_identity()})
    if not user:
        return jsonify(message="User not found."), 401
    resp = jsonify(user=public(user))
    set_access_cookies(resp, create_access_token(identity=user["_id"], additional_claims=_claims(user)))
    return resp


@bp.post("/logout")
def logout():
    resp = jsonify(message="Logged out.")
    unset_jwt_cookies(resp)
    return resp


@bp.post("/logout_all")
def logout_all():
    """Sign out every device: older tokens stop working and this user's open sockets are closed."""
    verify_jwt_in_request()
    uid = get_jwt_identity()
    db().users.update_one({"_id": uid}, {"$inc": {"token_version": 1}})
    import live
    live.disconnect_user(uid)
    resp = jsonify(message="Logged out everywhere.")
    unset_jwt_cookies(resp)
    return resp


@bp.get("/me")
def me():
    verify_jwt_in_request()
    user = db().users.find_one({"_id": get_jwt_identity()})
    if not user:
        return jsonify(message="User not found."), 404
    return jsonify(user=public(user))


def seed_admin(app):
    email, password = app.config["ADMIN_EMAIL"], app.config["ADMIN_PASSWORD"]
    if email and password and not db().users.find_one({"email": email.lower()}):
        create_user("admin", email.lower(), password, "admin")
        print(f"[auth] admin account created for {email}")