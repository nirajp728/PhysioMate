import os
from dotenv import load_dotenv

load_dotenv()


def _list(name, default):
    return [x.strip() for x in os.getenv(name, default).split(",") if x.strip()]


class Config:
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-secret-change-me")
    # The JWT lives in httpOnly cookies, so page scripts (XSS) cannot read it.
    JWT_TOKEN_LOCATION = ["cookies"]
    JWT_ACCESS_TOKEN_EXPIRES = int(os.getenv("JWT_ACCESS_MINUTES", "30")) * 60   # short; renewed from the refresh cookie
    JWT_REFRESH_TOKEN_EXPIRES = int(os.getenv("JWT_REFRESH_DAYS", "7")) * 86400
    JWT_COOKIE_SECURE = os.getenv("COOKIE_SECURE", "") == "1"    # 1 in production (HTTPS only)
    JWT_COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "Lax")    # "None" (+ secure) only if the site and API are on different sites
    JWT_COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN") or None       # e.g. .example.com to share between app. and api.
    JWT_COOKIE_CSRF_PROTECT = False  # replaced by the X-Requested-With check in app.py
    JWT_REFRESH_COOKIE_PATH = "/api/auth/refresh"

    # empty MONGO_URI -> in-memory mongomock (handy for local dev, data lost on restart)
    MONGO_URI = os.getenv("MONGO_URI", "")
    MONGO_DB = os.getenv("MONGO_DB", "rehab")

    FRONTEND_ORIGINS = _list("FRONTEND_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")

    # "threading" works locally; use "gevent" in production
    ASYNC_MODE = os.getenv("ASYNC_MODE", "threading")

    # a live session with no message for this long is closed automatically
    HEARTBEAT_TIMEOUT = float(os.getenv("HEARTBEAT_TIMEOUT", "10"))
    SERIES_HZ = 5  # angle samples kept per second for the report

    REPORT_DIR = os.getenv("REPORT_DIR", "report_files")
    REPORT_ASYNC = True
    S3_BUCKET = os.getenv("S3_BUCKET", "")  # empty -> reports stay on local disk
    REPORT_LAMBDA = os.getenv("REPORT_LAMBDA", "")  # name of the report Lambda; empty -> built inside this process

    # WebRTC: STUN is free. TURN (your own coturn server) is only used when both values are set.
    STUN_URLS = _list("STUN_URLS", "stun:stun.l.google.com:19302")
    TURN_URLS = _list("TURN_URLS", "")        # e.g. turn:turn.example.com:3478?transport=udp,turns:turn.example.com:5349?transport=tcp
    TURN_SECRET = os.getenv("TURN_SECRET", "")  # same value as static-auth-secret in turnserver.conf
    TURN_TTL = int(os.getenv("TURN_TTL", "3600"))

    ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "")
    ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")

    # RAG / assistant (Gemini free tier). Check the exact model names in Google AI Studio.
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
    EMBED_MODEL = os.getenv("EMBED_MODEL", "gemini-embedding-001")
    EMBED_DIMS = int(os.getenv("EMBED_DIMS", "768"))
    ATLAS_SEARCH = os.getenv("ATLAS_SEARCH", "") == "1"  # 1 -> MongoDB Atlas $vectorSearch; else local numpy search
    ADHERENCE_TARGET = int(os.getenv("ADHERENCE_TARGET", "3"))  # sessions per week that count as following the plan