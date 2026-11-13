# Frontend (Vite + React + Tailwind v4 plugin, JavaScript)

```
npm install
copy .env.example .env      # macOS/Linux: cp .env.example .env   (VITE_API_URL = backend address)
npm run dev                 # http://localhost:5173
```
Start the backend first (see ../backend/README.md). Register a patient and a physiotherapist, then assign
the patient (physiotherapist: "Find patients", or an admin account).

## Things you must do
1. **BLE UUIDs**: edit `src/lib/bleConfig.js`. The service and notify characteristic UUIDs are placeholders.
   The packet is expected as JSON, e.g. `{"imu1":{"x","y","z","gyro":{...},"tempC"},"imu2":{...}}`
   (pieces split across notifications are joined automatically). For a binary format, replace the parsing there.
2. **3D arm**: put your rigged model at `public/models/arm.glb`. Without it a simple built-in arm is shown.

## Bluetooth requirements
Web Bluetooth works in Chrome and Edge (desktop) and Chrome on Android, on HTTPS or localhost. Not Safari, not Firefox,
not iOS browsers. A web page cannot list nearby devices itself: the dropdown shows devices you have already allowed,
and "Choose another device…" opens the browser's own chooser. The toggle cannot switch the computer's Bluetooth on;
it enables the feature and tells you if Bluetooth is off.

## Hidden developer panel
`Ctrl+Shift+D` opens a panel with a WebSocket source (the old direct-to-device connection) and "Fake curl data",
which streams a simulated arm so you can test everything without hardware.

## How it works
Patient browser: BLE → `lib/streamStore.js` (outside React, so fast packets do not re-render everything) → game +
socket. Physiotherapist browser: socket → its own stream → angles, 3D arm, IMU boards, chart and the game drawn from snapshots.
Angle formulas are in `lib/imuMath.js`; calibration maths in `lib/calibration.js`; the game in `lib/game.js`.
The bird rises when the elbow bends; a checkbox on the game page flips that.
