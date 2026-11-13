import { useEffect, useState } from 'react'
import Card from './Card'
import ArmView from './ArmView'
import { EXERCISES, REPS, poseAt, anglesFor } from '../lib/exercises'

export default function ExerciseDemo() {
  const [id, setId] = useState(EXERCISES[0].id)
  const ex = EXERCISES.find((e) => e.id === id)
  const [pose, setPose] = useState(() => poseAt(ex, 0))

  useEffect(() => {
    const t0 = performance.now()
    const timer = setInterval(() => setPose(poseAt(ex, (performance.now() - t0) / 1000)), 33)
    return () => clearInterval(timer)
  }, [ex])

  const select = (
    <select
      aria-label="Choose exercise"
      value={id}
      onChange={(e) => setId(e.target.value)}
      className="rounded-xl border border-ink/12 bg-paper px-3 py-1.5 text-sm outline-none"
    >
      {EXERCISES.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
    </select>
  )

  return (
    <Card title="Exercise demo" right={select} flush className="h-96">
      <div className="relative h-full">
        <ArmView angles={anglesFor(pose.elbow)} demo />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-paper-raised via-paper-raised/90 to-transparent px-5 pb-4 pt-8">
          <p className="text-sm font-medium">Rep {pose.rep} of {REPS} · {pose.label}</p>
          <p className="text-xs text-ink-soft">{ex.note} Demonstration only. Your physiotherapist sets your exercises.</p>
        </div>
      </div>
    </Card>
  )
}