import { useSyncExternalStore } from 'react'
import Card from './Card'
import Button from './Button'
import { useBle } from '../context/BleContext'

const avg = (reps, k) => (reps.length ? Math.round(reps.reduce((t, r) => t + r[k], 0) / reps.length) : null)
const tone = (v) => (v >= 80 ? 'text-sage' : v >= 60 ? 'text-ink' : 'text-coral')

function Bar({ label, value }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-ink-soft"><span>{label}</span><span className="tabular-nums">{value ?? '—'}</span></div>
      <div className="mt-1 h-1.5 rounded-full bg-ink/10"><div className="h-full rounded-full bg-sun" style={{ width: `${value ?? 0}%` }} /></div>
    </div>
  )
}

// Counts curls from the live elbow angle and scores each one. Reset starts a fresh set.
export default function RepCounter() {
  const { counter } = useBle()
  const reps = useSyncExternalStore(counter.subscribe, counter.getSnapshot)
  const last = reps[reps.length - 1]
  const score = avg(reps, 'score')

  return (
    <Card title="Rep counter" right={<Button variant="ghost" className="!px-4 !py-1.5" onClick={counter.reset} disabled={!reps.length}>Reset</Button>}>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-paper px-3 py-3"><p className="text-xs text-ink-soft">Reps</p><p className="text-3xl font-semibold tabular-nums">{reps.length}</p></div>
        <div className="rounded-xl bg-paper px-3 py-3"><p className="text-xs text-ink-soft">Avg quality</p><p className={`text-3xl font-semibold tabular-nums ${score == null ? '' : tone(score)}`}>{score ?? '—'}</p></div>
        <div className="rounded-xl bg-paper px-3 py-3"><p className="text-xs text-ink-soft">Last rep</p><p className={`text-3xl font-semibold tabular-nums ${last ? tone(last.score) : ''}`}>{last?.score ?? '—'}</p></div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Bar label="Range" value={avg(reps, 'range')} />
        <Bar label="Smoothness" value={avg(reps, 'smoothness')} />
        <Bar label="Speed" value={avg(reps, 'speed')} />
      </div>
      {last ? (
        <p className="mt-3 text-xs text-ink-soft">Last: {last.rom}° bend in {last.seconds}s ({last.pace}){last.stops ? `, ${last.stops} hesitation${last.stops > 1 ? 's' : ''}` : ''}</p>
      ) : (
        <p className="mt-3 text-xs text-ink-soft">Do a full curl: straighten the arm, bend it, and straighten again. Each one is counted and scored.</p>
      )}
      {reps.length > 0 && (
        <ul className="mt-3 max-h-40 divide-y divide-ink/8 overflow-auto text-xs">
          {[...reps].reverse().map((r) => (
            <li key={r.n} className="flex justify-between py-1.5 tabular-nums">
              <span>#{r.n}</span><span>{r.rom}° · {r.seconds}s</span><span className={`font-medium ${tone(r.score)}`}>{r.score}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}