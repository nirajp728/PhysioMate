import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Calibrator from '../../components/Calibrator'
import GameCanvas from '../../components/GameCanvas'
import EmptyState from '../../components/EmptyState'
import { useBle } from '../../context/BleContext'
import api from '../../lib/api'
import { connectSocket } from '../../lib/socket'
import { servePatient } from '../../lib/rtc'
import { birdHeight } from '../../lib/calibration'
import { newGame, stepGame, snapshot } from '../../lib/game'

export default function Play() {
  const { stream, status } = useBle()
  const [cal, setCal] = useState(undefined) // undefined = loading, null = none saved
  const [recal, setRecal] = useState(false)
  const [phase, setPhase] = useState('ready') // ready | playing | ended
  const [invert, setInvert] = useState(false)
  const [net, setNet] = useState('')
  const [final, setFinal] = useState(null)
  const [notice, setNotice] = useState('')

  const game = useRef(newGame())
  const sock = useRef(null)
  const tab = useRef(crypto.randomUUID()) // tells the server which browser tab is sending
  const loop = useRef(null)
  const invertRef = useRef(invert)
  const calRef = useRef(null)
  invertRef.current = invert
  calRef.current = cal

  useEffect(() => {
    api.get('/calibration/latest').then((r) => setCal(r.data.calibration || null)).catch(() => setCal(null))
  }, [])

  const stop = useCallback((endSession = true) => {
    cancelAnimationFrame(loop.current)
    sock.current?._unsub?.()
    Object.values(sock.current?._timers || {}).forEach(clearInterval)
    sock.current?._rtc?.close()
    if (endSession) sock.current?.emit('session_end')
    sock.current?.disconnect()
    sock.current = null
  }, [])

  useEffect(() => () => stop(), [stop])

  function begin() {
    setNotice('')
    game.current = newGame()
    stream.reset()
    const s = connectSocket()
    sock.current = s
    const startSession = () => s.emit('session_start', { game: 'flappy', tab: tab.current }, (res) => setNet(res?.ok ? 'live' : res?.error || 'error'))
    s.on('connect', startSession) // also runs after a reconnect: the server resumes the same session
    // Another tab of this account took the session over: stop here WITHOUT ending the session.
    s.on('session_taken_over', () => {
      stop(false)
      setPhase('ready')
      setNotice('This session is now running in another tab, so it was stopped here.')
    })
    s.on('disconnect', () => setNet('reconnecting'))
    s.on('connect_error', () => setNet('offline'))

    // Live values go straight to the watching physiotherapists (WebRTC), 25 times a second.
    // The server only gets a light copy for the report: the elbow angle 5 times a second, the score once a second.
    const rtc = servePatient(s)
    let lastLive = 0
    let lastRecord = 0
    const unsub = stream.subscribe((sample) => {
      const now = performance.now()
      if (now - lastLive >= 40) {
        lastLive = now
        rtc.send({ k: 'imu', imu1: sample.imu1, imu2: sample.imu2 })
      }
      if (now - lastRecord >= 200 && s.connected) {
        lastRecord = now
        s.volatile.emit('imu', { elbow: Math.round(sample.angles.elbow * 10) / 10 })
      }
    })
    s._timers = {
      hb: setInterval(() => s.emit('heartbeat'), 3000),
      live: setInterval(() => rtc.send({ k: 'game', ...snapshot(game.current) }), 100),
      score: setInterval(() => s.connected && s.volatile.emit('game_state', { score: game.current.score }), 1000),
    }
    s._rtc = rtc
    s._unsub = unsub

    let last = performance.now()
    let smooth = 0.5
    const tick = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const target = birdHeight(stream.latest.angles.elbow, calRef.current, invertRef.current)
      smooth += (target - smooth) * 0.35
      stepGame(game.current, dt, smooth)
      loop.current = requestAnimationFrame(tick)
    }
    loop.current = requestAnimationFrame(tick)
    setPhase('playing')
  }

  function end() {
    setFinal({ score: game.current.score, hits: game.current.hits })
    stop()
    setPhase('ended')
  }

  // The session is already running in another tab: make this tab the one that sends.
  function takeOver() {
    sock.current?.emit('session_start', { game: 'flappy', tab: tab.current, takeover: true }, (res) => setNet(res?.ok ? 'live' : res?.error || 'error'))
  }

  function leave() {
    stop(false) // never end the other tab's session
    setPhase('ready')
  }

  const getState = useCallback(() => snapshot(game.current), [])

  if (status !== 'connected') {
    return (
      <EmptyState
        title="Connect your device first"
        body="The game is controlled by your arm, so the band needs to be connected."
      />
    )
  }

  if (phase === 'ended') {
    return (
      <Card title="Session finished">
        <p className="text-lg">Score {final?.score}, missed {final?.hits}.</p>
        <p className="mt-1 text-sm text-ink-soft">Your report is being prepared. It usually takes a few seconds.</p>
        <div className="mt-4 flex gap-2">
          <Link to="/app/history"><Button variant="sun">See my reports</Button></Link>
          <Button variant="ghost" onClick={() => { setPhase('ready') }}>Play again</Button>
        </div>
      </Card>
    )
  }

  if (cal === undefined) return <p className="text-sm text-ink-soft">Loading…</p>

  if (phase === 'ready' && (!cal || recal)) {
    return (
      <div className="mx-auto max-w-xl">
        <Card title="Calibration">
          <Calibrator store={stream} onSaved={(c) => { setCal(c); setRecal(false) }} />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Game</h1>
        {phase === 'playing' && (
          <span className="text-xs text-ink-soft">Sharing with your physiotherapist: {net || '…'}</span>
        )}
      </div>

      {notice && <p className="rounded-xl bg-sun/30 px-4 py-2.5 text-sm">{notice}</p>}
      {net === 'busy' && phase === 'playing' && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-coral/10 px-4 py-3 text-sm">
          <span>This session is already running in another tab. Nothing here is being recorded or shared.</span>
          <Button variant="sun" onClick={takeOver}>Use this tab</Button>
          <Button variant="ghost" onClick={leave}>Close this one</Button>
        </div>
      )}
      <Card className="space-y-4">
        <GameCanvas getState={getState} />
        {phase === 'ready' ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="sun" onClick={begin}>Start session</Button>
            <Button variant="ghost" onClick={() => setRecal(true)}>Calibrate again</Button>
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} />
              Straightening the arm lifts the bird instead
            </label>
            <span className="text-xs text-ink-soft">
              Range {cal.min_angle.toFixed(0)}° – {cal.max_angle.toFixed(0)}°
            </span>
          </div>
        ) : (
          <Button variant="primary" onClick={end}>End session</Button>
        )}
      </Card>
    </div>
  )
}