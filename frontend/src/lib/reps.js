// Counts curls from the elbow angle (180° = straight, smaller = more bent) and scores each one.
// One rep = the arm leaves its top position, bends, and comes back to the top.
// Quality (0-100) = 40% range + 30% smoothness + 30% speed.
export const TARGET_ROM = 120    // degrees of bend that earns the full range score
const START_DROP = 20            // dropping this far below the top starts a rep
const END_NEAR = 15              // coming back within this of the top ends it
const MIN_ROM = 40               // smaller movements are not counted as reps
const HESITATE = 5               // moving this far against the direction of travel = a hesitation
const GOOD_SECONDS = [2, 6]      // a good rep takes 2 to 6 seconds
const SMOOTHING = 0.35           // how much each new reading counts (lower = smoother)
const GAP_SECONDS = 1            // a longer pause in the data restarts detection
const MAX_SECONDS = 30           // a rep that never finishes is dropped

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))

// How many times the arm hesitated or jerked backwards while moving one way.
function hesitations(angles, dir) {
  let ref = angles[0], n = 0
  for (const a of angles) {
    const move = dir * (a - ref)                // > 0 means still moving the right way
    if (move > 0) ref = a
    else if (move < -HESITATE) { n += 1; ref = a } // slid back
  }
  return n
}

function scoreRep(trace, top, min, seconds, n) {
  const low = trace.reduce((best, p, i) => (p[1] < trace[best][1] ? i : best), 0)
  const down = trace.slice(0, low + 1).map((p) => p[1])
  const up = trace.slice(low).map((p) => p[1])
  const stops = hesitations(down, -1) + hesitations(up, 1)

  const range = clamp(((top - min) / TARGET_ROM) * 100)
  const smoothness = clamp(100 - 25 * stops)
  const [fast, slow] = GOOD_SECONDS
  const speed = seconds < fast ? (seconds / fast) * 100 : seconds > slow ? (slow / seconds) * 100 : 100
  return {
    n,
    rom: Math.round((top - min) * 10) / 10,
    seconds: Math.round(seconds * 10) / 10,
    range: Math.round(range),
    smoothness: Math.round(smoothness),
    speed: Math.round(speed),
    pace: seconds < fast ? 'too fast' : seconds > slow ? 'too slow' : 'good',
    stops,
    score: Math.round(0.4 * range + 0.3 * smoothness + 0.3 * speed),
  }
}

// Follows the live stream for as long as the app is open; `reps` is replaced (never edited) on every
// change, so React can read it directly with useSyncExternalStore.
export function createRepCounter(stream) {
  let reps = []
  const listeners = new Set()
  let s // detection state

  const restart = () => { s = { phase: 'up', smooth: null, last: 0, top: 0, topT: 0, min: 0, trace: [] } }
  const emit = () => listeners.forEach((fn) => fn())
  restart()

  function push(t, raw) {
    if (!Number.isFinite(raw)) return
    if (s.smooth !== null && t - s.last > GAP_SECONDS) restart()
    s.smooth = s.smooth === null ? raw : s.smooth + SMOOTHING * (raw - s.smooth)
    s.last = t
    const a = s.smooth

    if (s.phase === 'up') {
      if (!s.trace.length || a >= s.top) {
        s.top = a; s.topT = t; s.trace = [[t, a]]
      } else {
        s.trace.push([t, a])
        if (s.trace.length > 3000) s.trace.splice(0, 1500)
        if (a < s.top - START_DROP) { s.phase = 'down'; s.min = a }
      }
      return
    }

    s.trace.push([t, a])
    s.min = Math.min(s.min, a)
    if (a >= s.top - END_NEAR) {            // back at the top: the rep is over
      const rom = s.top - s.min
      if (rom >= MIN_ROM) {
        reps = [...reps, scoreRep(s.trace, s.top, s.min, t - s.topT, reps.length + 1)]
        emit()
      }
      s.phase = 'up'; s.top = a; s.topT = t; s.trace = [[t, a]]
    } else if (t - s.topT > MAX_SECONDS) {
      s.phase = 'up'; s.top = a; s.topT = t; s.trace = [[t, a]]
    }
  }

  return {
    // called once by the provider; returns the cleanup function
    start: () => stream.subscribe((sample) => push(sample.t / 1000, sample.angles.elbow)),
    push,
    reset() { reps = []; restart(); emit() },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
    getSnapshot: () => reps,
  }
}