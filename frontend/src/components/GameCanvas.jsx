import { useEffect, useRef } from 'react'
import { drawGame } from '../lib/game'

// Draws a game snapshot. `getState` is called every frame, so it can read a ref (no React re-render).
export default function GameCanvas({ getState }) {
  const ref = useRef(null)
  useEffect(() => {
    let raf
    const loop = () => {
      const c = ref.current
      if (c) {
        const ctx = c.getContext('2d')
        drawGame(ctx, c.width, c.height, getState())
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [getState])
  return <canvas ref={ref} width={800} height={450} className="aspect-video w-full rounded-xl ring-1 ring-ink/10" />
}
