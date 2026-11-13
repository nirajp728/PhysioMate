import { Link } from 'react-router-dom'
import Card from '../../components/Card'
import LiveValues from '../../components/LiveValues'
import AngleChart from '../../components/AngleChart'
import ArmView from '../../components/ArmView'
import ExerciseDemo from '../../components/ExerciseDemo'
import Button from '../../components/Button'
import { useBle } from '../../context/BleContext'
import { useStreamView } from '../../lib/streamStore'
import RepCounter from '../../components/RepCounter'

export default function Device() {
  const { stream, status } = useBle()
  const sample = useStreamView(stream)
  const connected = status === 'connected'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My device</h1>
        <p className="mt-1 text-sm text-ink-soft">Turn Bluetooth on in the sidebar, pick your band, and move your arm to check the readings.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Live values"><LiveValues sample={sample} /></Card>
        <Card title="Elbow angle"><AngleChart store={stream} /></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Your arm (live)" flush className="h-96"><ArmView angles={sample.angles} /></Card>
        <ExerciseDemo />
      </div>
      
      <RepCounter />

      <Link to="/app/play"><Button variant="sun" disabled={!connected} className="w-full">Continue to calibration and game</Button></Link>
    </div>
  )
}