import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createStream } from '../lib/streamStore'
import { createRepCounter } from '../lib/reps'
import { SERVICE_UUID, NOTIFY_CHAR_UUID, parsePacket } from '../lib/bleConfig'

const BleContext = createContext(null)

const supported = typeof navigator !== 'undefined' && !!navigator.bluetooth

// Holds the patient's wearable connection. Whatever the source (Bluetooth, or the hidden developer
// sources), samples go into the same stream store, so the rest of the app does not care.
export function BleProvider({ children }) {
  const stream = useMemo(() => createStream(), [])
  const counter = useMemo(() => createRepCounter(stream), [stream])
  useEffect(() => counter.start(), [counter])
  const [enabled, setEnabled] = useState(false)
  const [devices, setDevices] = useState([]) // previously allowed devices
  const [selected, setSelected] = useState('')
  const [status, setStatus] = useState('off') // off | idle | connecting | connected | reconnecting | error
  const [error, setError] = useState('')
  const [source, setSource] = useState('ble') // ble | ws | fake
  const [devOpen, setDevOpen] = useState(false)

  const deviceRef = useRef(null)
  const charRef = useRef(null)
  const wsRef = useRef(null)
  const fakeRef = useRef(null)
  const wantRef = useRef(false) // user wants to stay connected (so we may auto-reconnect)
  const retryRef = useRef(0)

  const onSample = useCallback((s) => {
    if (s?.imu1 && s?.imu2) stream.push(s.imu1, s.imu2)
  }, [stream])

  const refreshDevices = useCallback(async () => {
    if (!supported || !navigator.bluetooth.getDevices) return
    try {
      setDevices(await navigator.bluetooth.getDevices())
    } catch {
      /* not allowed in this browser: only the chooser is available */
    }
  }, [])

  const teardownBle = useCallback(() => {
    const ch = charRef.current
    if (ch) {
      ch.removeEventListener('characteristicvaluechanged', ch._handler)
      ch.stopNotifications().catch(() => {})
    }
    charRef.current = null
    const d = deviceRef.current
    if (d?.gatt?.connected) d.gatt.disconnect()
  }, [])

  const connectGatt = useCallback(async (device) => {
    setStatus(retryRef.current ? 'reconnecting' : 'connecting')
    setError('')
    const server = await device.gatt.connect()
    const service = await server.getPrimaryService(SERVICE_UUID)
    const ch = await service.getCharacteristic(NOTIFY_CHAR_UUID)
    ch._handler = (e) => {
      const s = parsePacket(e.target.value)
      if (s) stream.push(s.imu1, s.imu2)
    }
    ch.addEventListener('characteristicvaluechanged', ch._handler)
    await ch.startNotifications()
    charRef.current = ch
    retryRef.current = 0
    setStatus('connected')
  }, [stream])

  const attach = useCallback(async (device) => {
    deviceRef.current = device
    wantRef.current = true
    setSource('ble')
    device.addEventListener('gattserverdisconnected', async () => {
      if (deviceRef.current !== device) return
      charRef.current = null
      if (!wantRef.current) return setStatus('idle')
      // Dropped link: try again a few times with growing waits.
      while (wantRef.current && retryRef.current < 5) {
        retryRef.current += 1
        setStatus('reconnecting')
        await new Promise((r) => setTimeout(r, 1000 * retryRef.current))
        try {
          await connectGatt(device)
          return
        } catch {
          /* try again */
        }
      }
      if (wantRef.current) {
        setStatus('error')
        setError('Lost the connection to the device. Pick it again to reconnect.')
      }
    })
    try {
      await connectGatt(device)
    } catch (e) {
      wantRef.current = false
      setStatus('error')
      setError(e.message || 'Could not connect.')
    }
  }, [connectGatt])

  // The dropdown. '__choose__' opens the browser's own device chooser (the only place a scan list appears).
  const select = useCallback(async (value) => {
    if (!supported) return
    setError('')
    try {
      if (value === '__choose__') {
        const device = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [SERVICE_UUID],
        })
        await refreshDevices()
        setSelected(device.id)
        await attach(device)
        return
      }
      const device = devices.find((d) => d.id === value)
      if (!device) return
      setSelected(value)
      await attach(device)
    } catch (e) {
      if (e.name !== 'NotFoundError') {
        // NotFoundError = user closed the chooser; not an error worth showing
        setStatus('error')
        setError(e.message || 'Bluetooth error.')
      }
    }
  }, [attach, devices, refreshDevices])

  const disconnect = useCallback(() => {
    wantRef.current = false
    retryRef.current = 0
    teardownBle()
    wsRef.current?.close()
    wsRef.current = null
    clearInterval(fakeRef.current)
    fakeRef.current = null
    setSelected('')
    setStatus(enabled ? 'idle' : 'off')
  }, [enabled, teardownBle])

  const toggle = useCallback(async (on) => {
    if (on) {
      if (!supported) {
        setError('This browser has no Web Bluetooth. Use Chrome or Edge on a computer, or Chrome on Android.')
        setStatus('error')
        return
      }
      const available = await navigator.bluetooth.getAvailability().catch(() => true)
      if (!available) {
        setError('Bluetooth is turned off or missing on this device. Turn it on in your system settings.')
        setStatus('error')
        return
      }
      setEnabled(true)
      setStatus('idle')
      setError('')
      refreshDevices()
    } else {
      wantRef.current = false
      teardownBle()
      wsRef.current?.close()
      clearInterval(fakeRef.current)
      setEnabled(false)
      setSelected('')
      setStatus('off')
    }
  }, [refreshDevices, teardownBle])

  // ---- hidden developer sources (Ctrl+Shift+D) --------------------------------------------
  const connectWs = useCallback((url) => {
    disconnect()
    setSource('ws')
    setStatus('connecting')
    const ws = new WebSocket(url)
    wsRef.current = ws
    ws.onopen = () => setStatus('connected')
    ws.onmessage = (e) => {
      try { onSample(JSON.parse(e.data)) } catch { /* ignore */ }
    }
    ws.onerror = () => { setStatus('error'); setError('WebSocket error') }
    ws.onclose = () => setStatus((s) => (s === 'connected' ? 'idle' : s))
  }, [disconnect, onSample])

  const startFake = useCallback(() => {
    disconnect()
    setSource('fake')
    setStatus('connected')
    const t0 = performance.now()
    fakeRef.current = setInterval(() => {
      const t = (performance.now() - t0) / 1000
      const elbow = 90 + 60 * Math.sin((2 * Math.PI * t) / 5)
      const f = ((90 - (180 - elbow)) * Math.PI) / 180
      onSample({
        imu2: { x: 0, y: 0, z: 1, gyro: { x: 0, y: 0, z: 0 }, tempC: 30 },
        imu1: { x: Math.sin(f), y: 0, z: Math.cos(f), gyro: { x: 0, y: 0, z: 0 }, tempC: 30 },
      })
    }, 40)
  }, [disconnect, onSample])

  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        setDevOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => () => {
    wantRef.current = false
    teardownBle()
    wsRef.current?.close()
    clearInterval(fakeRef.current)
  }, [teardownBle])

  const value = {
    supported, enabled, devices, selected, status, error, source,
    stream, counter, toggle, select, disconnect, refreshDevices,
    devOpen, setDevOpen, connectWs, startFake,
  }
  return <BleContext.Provider value={value}>{children}</BleContext.Provider>
}

export const useBle = () => useContext(BleContext)