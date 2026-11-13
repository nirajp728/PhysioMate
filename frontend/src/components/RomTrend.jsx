import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts'

export default function RomTrend({ rows }) {
  const data = [...rows].reverse().map((s) => ({
    day: new Date(s.started_at * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    rom: Math.round(s.summary?.rom || 0),
  }))
  return (
    <div style={{ height: 180 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="var(--color-ink)" strokeOpacity={0.12} vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => `${v}°`} />
          <Bar maxBarSize={44} dataKey="rom" fill="#3fae6b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
