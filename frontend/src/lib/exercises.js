// Demonstration movements for the practice arm. Only the elbow moves; the upper arm stays still.
// "elbow" is the angle used everywhere in the app (180 = straight arm, smaller = more bent).
export const REPS = 10

export const EXERCISES = [
  {
    id: 'curl',
    name: 'Bicep curl',
    note: 'Bend the elbow to lift the hand, then lower it with control.',
    start: 170,
    phases: [
      { label: 'Curl up', dur: 2, to: 45 },
      { label: 'Lower', dur: 2, to: 170 },
    ],
  },
  {
    id: 'slow',
    name: 'Slow-lowering curl',
    note: 'Curl up at a normal pace, then take about 4 seconds to lower.',
    start: 165,
    phases: [
      { label: 'Curl up', dur: 2, to: 50 },
      { label: 'Pause', dur: 1, to: 50 },
      { label: 'Lower slowly', dur: 4, to: 165 },
    ],
  },
  {
    id: 'hold',
    name: 'Curl and hold at 90°',
    note: 'Bend to a right angle, hold for 5 seconds, then straighten.',
    start: 170,
    phases: [
      { label: 'Curl to 90°', dur: 2, to: 90 },
      { label: 'Hold', dur: 5, to: 90 },
      { label: 'Straighten', dur: 2, to: 170 },
    ],
  },
]

const ease = (t) => t * t * (3 - 2 * t)

// Elbow angle, phase name and rep number after `t` seconds. The movement repeats REPS times, then starts again.
export function poseAt(ex, t) {
  const cycle = ex.phases.reduce((s, p) => s + p.dur, 0)
  const rep = (Math.floor(t / cycle) % REPS) + 1
  let u = t % cycle
  let from = ex.start
  for (const p of ex.phases) {
    if (u < p.dur) return { elbow: from + (p.to - from) * ease(u / p.dur), label: p.label, rep }
    u -= p.dur
    from = p.to
  }
  return { elbow: ex.start, label: '', rep }
}

// Same convention as the live arm: upper arm fixed at 90, elbow = 180 - |forearm - bicep|.
export const anglesFor = (elbow) => ({ bicep: 90, forearm: elbow - 90, elbow })