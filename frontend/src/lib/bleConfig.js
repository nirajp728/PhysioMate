// Your band's Bluetooth service and notify characteristic.
export const SERVICE_UUID = '7b7b0001-8f7b-4e7b-9b7b-123456789001'
export const NOTIFY_CHAR_UUID = '7b7b0002-8f7b-4e7b-9b7b-123456789002'

// 40-byte packet, 10 little-endian float32:
// [0..3] firmware angles: standing, laying, forearm, peakRom (ignored, we compute from accel)
// [4..6] IMU1 forearm accel (g), [7..9] IMU2 upper-arm accel (g)
export function parsePacket(dv) {
  if (dv.byteLength < 40) return null
  const f = (i) => dv.getFloat32(i * 4, true)
  const imu = (o) => ({ x: f(o), y: f(o + 1), z: f(o + 2), gyro: { x: 0, y: 0, z: 0 }, tempC: 0 })
  return { imu1: imu(4), imu2: imu(7) }
}