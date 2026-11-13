# Backend (Flask)

Flask + Flask-SocketIO + JWT. Roles: patient, physiotherapist, admin. Live data is relayed from the
patient's browser to the physiotherapists assigned to that patient. Ended sessions get a one-page PDF report.

## Run locally
```
python -m venv venv
venv\Scripts\activate            # Windows   (macOS/Linux: source venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env           # macOS/Linux: cp .env.example .env   then edit JWT_SECRET_KEY
python app.py                    # http://localhost:5000
```
With `MONGO_URI` empty, an in-memory database is used (data disappears on restart). Put a MongoDB URI there to keep data.
An admin account is created at startup when `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set.

**WeasyPrint on Windows** needs the GTK/Pango libraries. If they are missing the report is drawn with
matplotlib instead (same page, slightly plainer), so nothing breaks. Install the GTK runtime to get the HTML version.

## Test and simulate
```
pip install -r requirements-dev.txt
pytest tests                                     # 6 tests: auth, roles, live relay, ghost sessions, reports
python scripts/simulate_patient.py --email p@x.com --password secret123 --seconds 60
```
`--ghost` vanishes without ending the session, to test the timeout (`HEARTBEAT_TIMEOUT`, default 10 s).

## Socket protocol (JWT sent in the handshake: `auth={"token": ...}`)
| Who | Event | Meaning |
|---|---|---|
| patient → server | `session_start` | start (or resume after reconnect) a session |
| patient → server | `imu`, `game_state`, `heartbeat` | raw IMU values, game snapshot, keep-alive |
| patient → server | `session_end` | finish; report generation starts |
| physio → server | `watch` / `unwatch` `{patient_id}` | join/leave a patient's live room (only if assigned) |
| server → physio | `imu`, `game_state`, `patient_live`, `session_ended` | live relay and status |

## REST (all under /api, Bearer token)
`/auth/register|login|me`, `/calibration`, `/calibration/latest`, `/patients/<id>/sessions`, `/sessions/<id>`,
`/sessions/<id>/report`, `/physio/*`, `/admin/*`, `/chat` (placeholder until RAG is added).

## Production notes
Use `ASYNC_MODE=gevent` (add gevent) with a single worker process, or a message queue if you scale out.
Set `S3_BUCKET` to store reports in S3 (credentials via an IAM role). Deployment files are not included.
