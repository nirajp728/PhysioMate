const f = (v, d = 2) => (typeof v === 'number' ? v.toFixed(d) : '—')

function ImuRow({ title, imu }) {
  return (
    <div className="rounded-xl bg-paper p-3">
      <p className="mb-2 text-xs font-medium text-ink-soft">{title}</p>
      <div className="grid grid-cols-3 gap-2 text-sm tabular-nums">
        {['x', 'y', 'z'].map((k) => (
          <div key={k}><span className="text-ink-soft">a{k} </span>{f(imu?.[k], 3)}</div>
        ))}
        {['x', 'y', 'z'].map((k) => (
          <div key={k}><span className="text-ink-soft">g{k} </span>{f(imu?.gyro?.[k], 1)}</div>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-soft">{f(imu?.tempC, 1)} °C</p>
    </div>
  )
}

// Raw sensor values + the angles derived from them.
export default function LiveValues({ sample }) {
  const a = sample.angles
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {[['Elbow', a.elbow], ['Bicep', a.bicep-90], ['Forearm', a.forearm]].map(([l, v]) => (
          <div key={l} className="rounded-xl bg-ink px-4 py-3 text-paper">
            <p className="text-xs text-paper/60">{l}</p>
            <p className="text-2xl font-semibold tabular-nums">{f(v, 1)}°</p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <ImuRow title="IMU 1 · forearm (0x6A)" imu={sample.imu1} />
        <ImuRow title="IMU 2 · bicep (0x6B)" imu={sample.imu2} />
      </div>
    </div>
  )
}
