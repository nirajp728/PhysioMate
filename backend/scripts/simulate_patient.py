"""Pretend to be a patient playing the game, so you can test the physiotherapist view without a device.

  python scripts/simulate_patient.py --email p@x.com --password secret123 --seconds 60
  add --ghost to vanish without ending the session (tests the timeout)
Requires: pip install -r requirements-dev.txt   (the patient account must already exist)
"""
import argparse
import math
import random
import time

import requests
import socketio

ap = argparse.ArgumentParser()
ap.add_argument("--url", default="http://localhost:5000")
ap.add_argument("--email", required=True)
ap.add_argument("--password", required=True)
ap.add_argument("--seconds", type=float, default=60)
ap.add_argument("--hz", type=float, default=25)
ap.add_argument("--ghost", action="store_true")
a = ap.parse_args()

login = requests.post(f"{a.url}/api/auth/login", json={"email": a.email, "password": a.password},
                      headers={"X-Requested-With": "rehab-web"})
login.raise_for_status()
cookie = "; ".join(f"{k}={v}" for k, v in login.cookies.items())  # the login cookie, as a browser would send it
sio = socketio.Client()
sio.connect(a.url, headers={"Cookie": cookie})
res = sio.call("session_start", {"game": "flappy"})
print("session:", res)


def sample(elbow, t):
    """Raw values that the frontend's angle formulas turn back into `elbow` (upper arm fixed at 90 deg)."""
    f = math.radians(90 - (180 - elbow))  # forearm tilt: atan2(x, z)
    n = lambda: random.gauss(0, 0.004)
    return {"t": t,
            "imu2": {"x": n(), "y": 0.0, "z": 1.0, "gyro": {"x": 0, "y": 0, "z": 0}, "tempC": 30.1},
            "imu1": {"x": math.sin(f) + n(), "y": 0.0, "z": math.cos(f), "gyro": {"x": 0, "y": 0, "z": 0}, "tempC": 30.4}}


start = time.time()
last_hb = 0
score = 0
while time.time() - start < a.seconds:
    t = time.time() - start
    elbow = 90 + 60 * math.sin(2 * math.pi * t / 5)  # one curl every 5 s, between 30 and 150 degrees
    s = sample(elbow, int(time.time() * 1000))
    sio.emit("imu", {**s, "elbow": elbow})
    score = int(t / 2.5)
    sio.emit("game_state", {"bird": (elbow - 30) / 120, "score": score, "pipes": [], "t": s["t"]})
    if t - last_hb > 3:
        sio.emit("heartbeat")
        last_hb = t
    time.sleep(1 / a.hz)

if not a.ghost:
    print("end:", sio.call("session_end"))
sio.disconnect()
