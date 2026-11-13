import { useEffect, useRef, useState } from 'react'
import { bicepAngleFromAccel, forearmAngleFromAccel, elbowAngleFromAccel, rollFromAccel } from './imuMath'

const ZERO = { x: 0, y: 0, z: 0, gyro: { x: 0, y: 0, z: 0 }, tempC: 0 }
const HISTORY_MAX = 900 // about 3 minutes of chart points at 5 points per second

export function anglesFromRaw(imu1, imu2) {
  return {
    bicep: bicepAngleFromAccel(imu2),
    forearm: forearmAngleFromAccel(imu1),
    elbow: elbowAngleFromAccel(imu1, imu2),
  }
}

// A tiny store that lives outside React. Packets can arrive every few milliseconds, so they are
// written here and React only reads the latest value ~30 times a second (see useStreamView).
export function createStream() {
  const s = {
    latest: { t: 0, imu1: ZERO, imu2: ZERO, angles: { bicep: 0, forearm: 0, elbow: 180, bicepRoll: 0, forearmRoll: 0 } },
    roll: { bicep: 0, forearm: 0 },
    version: 0,
    history: [], // [{ t (seconds), elbow }]
    lastPush: 0,
    listeners: new Set(),
    push(imu1, imu2) {
      const angles = anglesFromRaw(imu1, imu2)
      s.roll.bicep = rollFromAccel(imu2, s.roll.bicep)
      s.roll.forearm = rollFromAccel(imu1, s.roll.forearm)
      angles.bicepRoll = s.roll.bicep
      angles.forearmRoll = s.roll.forearm
      const now = performance.now()
      s.latest = { t: Date.now(), imu1, imu2, angles }
      s.version += 1
      if (now - s.lastPush >= 200) {
        s.lastPush = now
        s.history.push({ t: Math.round(now / 100) / 10, elbow: Math.round(angles.elbow * 10) / 10 })
        if (s.history.length > HISTORY_MAX) s.history.shift()
      }
      s.listeners.forEach((fn) => fn(s.latest))
    },
    subscribe(fn) {
      s.listeners.add(fn)
      return () => s.listeners.delete(fn)
    },
    reset() {
      s.history = []
      s.version += 1
    },
  }
  return s
}

// Re-render at most `hz` times a second with the newest sample.
export function useStreamView(store, hz = 30) {
  const [view, setView] = useState(store.latest)
  const seen = useRef(-1)
  useEffect(() => {
    const id = setInterval(() => {
      if (store.version !== seen.current) {
        seen.current = store.version
        setView(store.latest)
      }
    }, 1000 / hz)
    return () => clearInterval(id)
  }, [store, hz])
  return view
}

// Chart data: refreshed about twice a second.
export function useHistory(store, ms = 500) {
  const [data, setData] = useState([])
  useEffect(() => {
    const id = setInterval(() => setData(store.history.slice()), ms)
    return () => clearInterval(id)
  }, [store, ms])
  return data
}
