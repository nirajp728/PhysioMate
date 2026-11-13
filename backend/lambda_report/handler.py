"""AWS Lambda entry point: builds one session's PDF report and stores it in S3.
Invoked asynchronously by the web server (reports.invoke_lambda) with {"session_id": "..."}.
If this raises, Lambda retries the call (twice by default); generate_report marks the report failed on the last try."""
import os

import db as database
from reports import generate_report


def handler(event, context):
    if not os.getenv("MONGO_URI") or not os.getenv("S3_BUCKET"):
        raise RuntimeError("MONGO_URI and S3_BUCKET must be set on the Lambda")
    database.init_db(os.environ["MONGO_URI"], os.getenv("MONGO_DB", "rehab"))
    generate_report(event["session_id"], raise_errors=True)
    return {"ok": True}