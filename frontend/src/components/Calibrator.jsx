import { useEffect, useRef, useState } from 'react'
import Button from './Button'
import api, { errMsg } from '../lib/api'
import { robustMax, robustMin, midpoint } from '../lib/calibration'
import { useStreamView } from '../lib/streamStore'

// Two recordings: hold the arm at its most extended, then at its most bent.
// Each recording uses robust percentiles so one noisy sample does not set the range.
const STEPS = [
  { key: 'max', title: 'Step 1 of 2: biggest angle', hint: 'Straighten your arm as far as is comfortable and hold it still. Press Record, wait about 3 seconds, then Stop.' },
  { key: 'min', title: 'Step 2 of 2: smallest angle', hint: 'Bend your elbow as far as is comfortable and hold it still. Press Record, wait about 3 seconds, then Stop.' },
]

export default function Calibrator({ store, onSaved }) {
  const view = useStreamView(store, 20)
  const [step, setStep] = useState(0)
  const [recording, setRecording] = useState(false)
  const [result, setResult] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const buf = useRef([])
  const timer = useRef(null)

  useEffect(() => () => clearInterval(timer.current), [])

  function start() {
    buf.current = []
    setRecording(true)
    setError('')
    timer.current = setInterval(() => buf.current.push(store.latest.angles.elbow), 50)
  }

  function stop() {
    clearInterval(timer.current)
    setRecording(false)
    if (buf.current.length < 20) return setError('Too short. Hold the position a little longer.')
    const key = STEPS[step].key
    setResult((r) => ({ ...r, [key]: Math.round((key === 'max' ? robustMax(buf.current) : robustMin(buf.current)) * 10) / 10 }))
    setStep(step + 1)
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      await api.post('/calibration', { max_angle: result.max, min_angle: result.min })
      onSaved({ max_angle: result.max, min_angle: result.min })
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  if (step >= 2) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          {[['Biggest angle', result.max], ['Middle', midpoint(result.max, result.min)], ['Smallest angle', result.min]].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-paper px-3 py-4">
              <p className="text-xs text-ink-soft">{l}</p>
              <p className="text-2xl font-semibold tabular-nums">{v.toFixed(1)}°</p>
            </div>
          ))}
        </div>
        {error && <p className="text-sm text-coral">{error}</p>}
        <div className="flex gap-2">
          <Button variant="sun" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save and continue'}</Button>
          <Button variant="ghost" onClick={() => { setStep(0); setResult({}) }}>Start over</Button>
        </div>
      </div>
    )
  }

  const s = STEPS[step]
  return (
    <div className="space-y-4">
      <div>
        <p className="font-medium">{s.title}</p>
        <p className="mt-1 text-sm text-ink-soft">{s.hint}</p>
      </div>
      <p className="text-4xl font-semibold tabular-nums">{view.angles.elbow.toFixed(1)}°</p>
      {error && <p className="text-sm text-coral">{error}</p>}
      {recording ? (
        <Button variant="primary" onClick={stop}>● Stop</Button>
      ) : (
        <Button variant="sun" onClick={start}>Record</Button>
      )}
    </div>
  )
}
