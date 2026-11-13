import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Card from '../../components/Card'
import LiveValues from '../../components/LiveValues'
import AngleChart from '../../components/AngleChart'
import ArmView from '../../components/ArmView'
import GameCanvas from '../../components/GameCanvas'
import { lazy, Suspense } from 'react'
import api from '../../lib/api'
import { connectSocket } from '../../lib/socket'
import { watchPatient } from '../../lib/rtc'
import { createStream, useStreamView } from '../../lib/streamStore'

const ImuBoards = lazy(() => import('../../three/ImuBoards'))

// Spectator view: the physiotherapist's browser receives raw IMU values and game snapshots straight from the
// patient's browser (WebRTC; the server only sets the link up), then works out the angles and draws the arm, boards and game itself.
export default function Watch() {
  const { pid } = useParams()
  const stream = useMemo(() => createStream(), [pid])
  const sample = useStreamView(stream)
  const gameRef = useRef({ bird: 0.5, score: 0, hits: 0, pipes: [] })
  const [patient, setPatient] = useState(null)
  const [live, setLive] = useState(false)
  const [link, setLink] = useState('connecting')
  const [direct, setDirect] = useState('') // state of the direct link to the patient's browser
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api.get('/physio/patients').then((r) => setPatient(r.data.patients.find((p) => p.id === pid) || null))
  }, [pid])

  useEffect(() => {
    const s = connectSocket()
    let close = null
    let retry = null
    let isLive = false

    // Call the patient's browser. If the link fails while the patient is live, try again in 3 seconds.
    const call = () => {
      close?.()
      close = watchPatient(s, pid, (m) => {
        if (m.k === 'imu' && m.imu1 && m.imu2) stream.push(m.imu1, m.imu2)
        else if (m.k === 'game') gameRef.current = { bird: m.bird, score: m.score, hits: m.hits, pipes: m.pipes || [] }
      }, (state) => {
        setDirect(state)
        if (state === 'failed' && isLive) { clearTimeout(retry); retry = setTimeout(call, 3000) }
      })
    }
    const hangUp = () => { clearTimeout(retry); close?.(); close = null; setDirect('') }

    const watch = () =>
      s.emit('watch', { patient_id: pid }, (res) => {
        setLink('connected')
        if (!res?.ok) return setMsg(res?.error || 'Cannot watch this patient.')
        isLive = res.live
        setLive(res.live)
        if (res.live) call()
      })
    s.on('connect', watch) // runs again after any reconnect
    s.on('disconnect', () => setLink('reconnecting'))
    s.on('connect_error', () => setLink('offline'))
    s.on('patient_live', (d) => {
      if (d.patient_id !== pid) return
      isLive = d.live
      setLive(d.live)
      if (d.live) { stream.reset(); call() } else hangUp()
    })
    s.on('watch_revoked', (d) => {
      if (d.patient_id !== pid) return
      isLive = false
      hangUp()
      setLive(false)
      setMsg('You are no longer assigned to this patient.')
    })
    s.on('session_ended', (d) => {
      if (d.patient_id !== pid) return
      isLive = false
      hangUp()
      setLive(false)
      setMsg('The session has ended. The report is being prepared.')
    })
    return () => {
      hangUp()
      s.emit('unwatch', { patient_id: pid })
      s.disconnect()
    }
  }, [pid, stream])

  const getState = useCallback(() => gameRef.current, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/app/dashboard" className="mb-1 inline-flex items-center gap-1 text-xs text-ink-soft hover:text-ink"><ArrowLeft size={13} /> Dashboard</Link>
          <h1 className="text-2xl font-semibold tracking-tight">{patient?.username || 'Patient'}</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className={`flex items-center gap-2 rounded-pill px-3 py-1.5 ${live ? 'bg-line-green/15 text-line-green' : 'bg-ink/8 text-ink-soft'}`}>
            <span className={`h-2 w-2 rounded-full ${live ? 'bg-line-green' : 'bg-ink/30'}`} />
            {live ? 'Live' : 'Not in a session'}
          </span>
          {link !== 'connected' && <span className="text-coral">{link}</span>}
          {live && direct && direct !== 'connected' && <span className="text-coral">direct link: {direct}</span>}
        </div>
      </div>
      {msg && <p className="rounded-xl bg-paper-raised px-4 py-3 text-sm text-ink-soft ring-1 ring-ink/8">{msg}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Game" className="space-y-3"><GameCanvas getState={getState} /></Card>
        <Card title="3D arm" flush className="h-[22rem]"><ArmView angles={sample.angles} /></Card>
        <Card title="Elbow angle"><AngleChart store={stream} calibration={patient?.calibration} /></Card>
        <Card title="IMU boards" flush className="h-64">
          <Suspense fallback={null}><ImuBoards sample={sample} /></Suspense>
        </Card>
      </div>
      <Card title="Live values"><LiveValues sample={sample} /></Card>
    </div>
  )
}