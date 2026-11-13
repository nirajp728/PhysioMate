import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine, Tooltip } from 'recharts'
import { useHistory } from '../lib/streamStore'

export default function AngleChart({ store, calibration, height = 180 }) {
  const data = useHistory(store)
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="var(--color-ink)" strokeOpacity={0.12} vertical={false} />
          <XAxis dataKey="t" hide />
          <YAxis domain={[0, 200]} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => `${v}°`} labelFormatter={() => ''} />
          {calibration && <ReferenceLine y={calibration.max_angle} stroke="#ff7a59" strokeDasharray="4 4" />}
          {calibration && <ReferenceLine y={calibration.min_angle} stroke="#ff7a59" strokeDasharray="4 4" />}
          <Line type="monotone" dataKey="elbow" stroke="#6e9bff" dot={false} strokeWidth={2} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
