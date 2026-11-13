"""One-page PDF session report: numbers -> matplotlib charts -> HTML template -> PDF.
Saved on local disk, or in a private S3 bucket when S3_BUCKET is set.
Built inside this process, or by an AWS Lambda (REPORT_LAMBDA) that runs generate_report() from lambda_report/handler.py."""
import json
import os
import time
from datetime import datetime

from db import db
from metrics import summary_text
from reports.builder import build_pdf


def _save(session_id, pdf, report_dir, bucket):
    key = f"reports/{session_id}.pdf"
    if bucket:
        import boto3
        boto3.client("s3").put_object(Bucket=bucket, Key=key, Body=pdf, ContentType="application/pdf",
                                      ServerSideEncryption="AES256")
        return {"status": "ready", "storage": "s3", "key": key}
    os.makedirs(report_dir, exist_ok=True)
    path = os.path.join(report_dir, f"{session_id}.pdf")
    with open(path, "wb") as f:
        f.write(pdf)
    return {"status": "ready", "storage": "local", "key": path}


def load(report):
    """Return the PDF bytes for a session's report dict, or None."""
    if not report or report.get("status") != "ready":
        return None
    if report["storage"] == "s3":
        import boto3
        return boto3.client("s3").get_object(Bucket=os.getenv("S3_BUCKET", ""), Key=report["key"])["Body"].read()
    with open(report["key"], "rb") as f:
        return f.read()


MAX_TRIES = 3  # Lambda retries an async invoke when the handler raises; after this many tries the report is marked failed


def generate_report(session_id, report_dir=None, bucket=None, raise_errors=False):
    from config import Config
    from pymongo import ReturnDocument
    report_dir = report_dir or Config.REPORT_DIR
    bucket = Config.S3_BUCKET if bucket is None else bucket
    s = db().sessions.find_one_and_update({"_id": session_id}, {"$inc": {"report_tries": 1}},
                                          return_document=ReturnDocument.AFTER)
    if not s or (s.get("report") or {}).get("status") == "ready":
        return  # unknown session, or a duplicate Lambda invoke: nothing to do
    try:
        patient = db().users.find_one({"_id": s["patient_id"]})
        prev = db().sessions.find_one({"patient_id": s["patient_id"], "status": "ended", "_id": {"$ne": session_id},
                                       "started_at": {"$lt": s["started_at"]}}, sort=[("started_at", -1)])
        m = s["summary"]
        pdf = build_pdf({
            "patient": patient["username"],
            "date": datetime.fromtimestamp(s["started_at"]).strftime("%d %b %Y, %H:%M"),
            "m": m,
            "series": s.get("series", []),
            "prev_rom": prev["summary"]["rom"] if prev else None,
            "text": summary_text(m, prev["summary"] if prev else None),
            "generated": datetime.now().strftime("%d %b %Y"),
        })
        report = _save(session_id, pdf, report_dir, bucket)
    except Exception as e:
        print(f"[reports] try {s['report_tries']} failed:", e)
        if raise_errors and s["report_tries"] < MAX_TRIES:
            raise  # let Lambda retry
        report = {"status": "failed", "error": str(e)[:200]}
    db().sessions.update_one({"_id": session_id}, {"$set": {"report": report, "report_at": time.time()}})


def add_tip(session_id):
    """Short tip + index the session for the assistant (needs the Gemini key, so it runs in the web process)."""
    try:
        from rag.coach import after_session
        after_session(session_id)
    except Exception as e:
        print("[rag] could not index session:", e)


def invoke_lambda(session_id):
    import boto3
    from config import Config
    try:
        boto3.client("lambda").invoke(FunctionName=Config.REPORT_LAMBDA, InvocationType="Event",
                                      Payload=json.dumps({"session_id": session_id}).encode())
    except Exception as e:  # could not even queue it: show "failed" so the user can press Retry
        print("[reports] could not invoke Lambda:", e)
        db().sessions.update_one({"_id": session_id}, {"$set": {"report": {"status": "failed", "error": "queue"}}})


def enqueue(session_id, background=True, tip=True):
    """Start building the report: in the Lambda when REPORT_LAMBDA is set, otherwise in this process."""
    from config import Config
    jobs = ([add_tip] if tip else []) + [invoke_lambda if Config.REPORT_LAMBDA else generate_report]

    def run():
        for job in jobs:
            job(session_id)

    if background:
        from extensions import socketio
        socketio.start_background_task(run)
    else:
        run()