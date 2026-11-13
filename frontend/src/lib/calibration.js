export function percentile(values, p) {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const i = (s.length - 1) * p
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return s[lo] + (s[hi] - s[lo]) * (i - lo)
}

// Robust extremes: ignore the top/bottom 5% so one noisy sample cannot set the range.
export const robustMax = (v) => percentile(v, 0.95)
export const robustMin = (v) => percentile(v, 0.05)
export const midpoint = (max, min) => (max + min) / 2

// Normalised bird height 0 (bottom) .. 1 (top).
// Default: bending the elbow (smaller angle) lifts the bird. `invert` flips that.
export function birdHeight(angle, cal, invert = false) {
  const span = cal.max_angle - cal.min_angle
  if (span <= 0) return 0.5
  let n = (angle - cal.min_angle) / span
  n = Math.max(0, Math.min(1, n))
  return invert ? n : 1 - n
}
