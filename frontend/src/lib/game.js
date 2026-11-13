// Flappy-style game in normalised units (x: 0..1 across, y: 0..1 up). The patient's browser runs
// the game and sends snapshots; the physiotherapist's browser just draws them with drawGame().
export const BIRD_X = 0.2
export const GAP = 0.34
export const PIPE_HALF_W = 0.04
export const SPEED = 0.22 // screen widths per second
export const SPAWN_EVERY = 2.4 // seconds
export const BIRD_R = 0.032 // fraction of canvas height

export function newGame() {
  return { t: 0, bird: 0.5, score: 0, hits: 0, pipes: [], sinceSpawn: SPAWN_EVERY - 1.2 }
}

export function stepGame(g, dt, birdY) {
  g.t += dt
  g.bird = birdY
  g.sinceSpawn += dt
  if (g.sinceSpawn >= SPAWN_EVERY) {
    g.sinceSpawn = 0
    g.pipes.push({ x: 1.1, gapY: 0.25 + Math.random() * 0.5, done: false, hit: false })
  }
  for (const p of g.pipes) {
    p.x -= SPEED * dt
    const overlap = Math.abs(p.x - BIRD_X) < PIPE_HALF_W + 0.012
    if (overlap && !p.hit && Math.abs(g.bird - p.gapY) > GAP / 2 - BIRD_R) {
      p.hit = true
      g.hits += 1
    }
    if (!p.done && p.x + PIPE_HALF_W < BIRD_X - 0.02) {
      p.done = true
      if (!p.hit) g.score += 1
    }
  }
  g.pipes = g.pipes.filter((p) => p.x > -0.2)
}

// Small payload for the socket.
export const snapshot = (g) => ({
  t: Math.round(g.t * 10) / 10,
  bird: Math.round(g.bird * 1000) / 1000,
  score: g.score,
  hits: g.hits,
  pipes: g.pipes.map((p) => [Math.round(p.x * 1000) / 1000, Math.round(p.gapY * 1000) / 1000, p.hit ? 1 : 0]),
})

export function drawGame(ctx, w, h, s) {
  ctx.fillStyle = '#eaf2dc'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#d6e4c4'
  ctx.fillRect(0, h * 0.94, w, h * 0.06)

  for (const [x, gapY, hit] of s.pipes || []) {
    const px = (x - PIPE_HALF_W) * w
    const pw = PIPE_HALF_W * 2 * w
    const top = (1 - gapY - GAP / 2) * h
    const bottom = (1 - gapY + GAP / 2) * h
    ctx.fillStyle = hit ? '#ff7a59' : '#3fae6b'
    ctx.fillRect(px, 0, pw, top)
    ctx.fillRect(px, bottom, pw, h - bottom)
  }

  const by = (1 - Math.min(0.95, Math.max(0.05, s.bird ?? 0.5))) * h
  ctx.fillStyle = '#fff25c'
  ctx.beginPath()
  ctx.arc(BIRD_X * w, by, BIRD_R * h, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#11141a'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.fillStyle = '#11141a'
  ctx.font = '600 22px system-ui, sans-serif'
  ctx.fillText(`Score ${s.score ?? 0}`, 16, 32)
  ctx.font = '14px system-ui, sans-serif'
  ctx.fillStyle = '#555'
  ctx.fillText(`Missed ${s.hits ?? 0}`, 16, 54)
}
