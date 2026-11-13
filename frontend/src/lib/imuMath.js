// Mirrors the exact formulas in dual_lsm_v2.c so the frontend computes
// angles identically to the BeagleY-AI firmware, given raw accelerometer
// x/y/z values (in g) from each IMU.
//
// Mounting (per the IEEE paper + firmware comments):
//   IMU2 (0x6B) -> upper arm / bicep   -> bicep angle
//   IMU1 (0x6A) -> distal forearm      -> forearm angle
// The two sensors are mounted with their X-axes facing each other across
// the elbow (forearm IMU on the anterior forearm, bicep IMU mid-bicep) —
// confirmed from photos of the physical build.

const RAD_TO_DEG = 180 / Math.PI

function thetaCalculation(ax, _ay, az) {
  return Math.atan2(ax, az) * RAD_TO_DEG
}

export function bicepAngleFromAccel({ x, y, z }) {
  // +90 offset: raw 0° reading now maps to 90°
  return thetaCalculation(x, y, z) + 90
}

export function forearmAngleFromAccel({ x, y, z }) {
  // x/y swapped from before (was thetaCalculation(y, x, z))
  return thetaCalculation(x, -y, z) 
}

export function elbowAngleFromAccel(imu1Accel, imu2Accel) {
  const forearm = forearmAngleFromAccel(imu1Accel)
  const bicep = bicepAngleFromAccel(imu2Accel)
  return 180 - Math.abs(forearm - bicep)
}

export function vectorAngleBetween(v1, v2) {
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z
  const mag1 = Math.sqrt(v1.x ** 2 + v1.y ** 2 + v1.z ** 2)
  const mag2 = Math.sqrt(v2.x ** 2 + v2.y ** 2 + v2.z ** 2)
  let cosTheta = dot / (mag1 * mag2)
  cosTheta = Math.max(-1, Math.min(1, cosTheta))
  return Math.acos(cosTheta) * RAD_TO_DEG
}

export function degToRad(deg) {
  return (deg * Math.PI) / 180
}

// Roll about the limb's long axis (X, per the mounting note above), from gravity in the Y-Z plane.
// Near vertical (little gravity in Y-Z) roll can't be measured, so keep the previous value.
export function rollFromAccel({ y, z }, prev = 0) {
  return Math.hypot(y, z) < 0.25 ? prev : Math.atan2(y, z) * RAD_TO_DEG
}