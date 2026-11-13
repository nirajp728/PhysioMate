import os

from flask import Flask, jsonify, request
from flask_cors import CORS

import db as database
from config import Config
from extensions import jwt, socketio


def create_app(overrides=None):
    app = Flask(__name__)
    app.config.from_object(Config)
    app.config.update(overrides or {})

    CORS(app, origins=app.config["FRONTEND_ORIGINS"], supports_credentials=True)
    jwt.init_app(app)
    database.init_db(app.config["MONGO_URI"], app.config["MONGO_DB"])

    import live  # registers the socket events
    from api import bp as api_bp
    from auth import bp as auth_bp, seed_admin

    app.register_blueprint(auth_bp)
    app.register_blueprint(api_bp)
    live.init(app)
    socketio.init_app(app, cors_allowed_origins=app.config["FRONTEND_ORIGINS"],
                      async_mode=app.config["ASYNC_MODE"], max_http_buffer_size=100_000)
    seed_admin(app)
    from rag.knowledge import seed_if_possible
    seed_if_possible()

    @app.get("/api/health")
    def health():
        return jsonify(ok=True, live_sessions=len(live.live))

    @app.before_request
    def require_custom_header():
        # CSRF defence for cookie logins: a custom header cannot be added by another site's form or image tag,
        # and our CORS allow-list stops other sites from adding it with fetch.
        if request.path.startswith("/api/") and request.method not in ("GET", "HEAD", "OPTIONS"):
            if request.headers.get("X-Requested-With") != "rehab-web":
                return jsonify(message="Missing request header."), 403

    @jwt.token_in_blocklist_loader
    def revoked(_h, payload):  # "log out everywhere" bumps token_version, which kills every older token at once
        u = database.db().users.find_one({"_id": payload["sub"]}, {"token_version": 1})
        return not u or u.get("token_version", 0) != payload.get("ver", 0)

    @jwt.revoked_token_loader
    def revoked_msg(_h, _d):
        return jsonify(message="Session ended. Please log in again."), 401

    @jwt.unauthorized_loader
    def missing(_m):
        return jsonify(message="Please log in."), 401

    @jwt.expired_token_loader
    def expired(_h, _d):
        return jsonify(message="Session expired. Please log in again."), 401

    return app


if __name__ == "__main__":
    app = create_app()
    socketio.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "5000")), allow_unsafe_werkzeug=True)