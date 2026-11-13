import { Component, lazy, Suspense, useEffect, useState } from 'react'

const ArmScene = lazy(() => import('../three/ArmScene'))
const SimpleArm = lazy(() => import('../three/SimpleArm'))

class Boundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

// The dev server answers a missing file with index.html, so check the content type too.
function useHasModel() {
  const [has, setHas] = useState(null)
  useEffect(() => {
    fetch('/models/arm.glb', { method: 'HEAD' })
      .then((r) => setHas(r.ok && !(r.headers.get('content-type') || '').includes('text/html')))
      .catch(() => setHas(false))
  }, [])
  return has
}

export default function ArmView({ angles, demo = false }) {
  const has = useHasModel()
  const simple = <SimpleArm bicepAngle={angles.bicep} forearmAngle={angles.forearm} />
  return (
    <div className="h-full w-full">
      <Suspense fallback={<div className="grid h-full place-items-center text-sm text-ink-soft">Loading 3D…</div>}>
        {has === null ? null : has ? (
          <Boundary fallback={simple}>
            <ArmScene bicepAngle={angles.bicep} forearmAngle={angles.forearm} bicepRoll={angles.bicepRoll} forearmRoll={angles.forearmRoll} demo={demo} />
          </Boundary>
        ) : simple}
      </Suspense>
    </div>
  )
}