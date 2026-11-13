export default function Card({ title, right, children, className = '', flush = false }) {
  return (
    <section className={`rounded-card bg-paper-raised ring-1 ring-ink/8 ${flush ? 'flex flex-col overflow-hidden' : 'p-5'} ${className}`}>
      {(title || right) && (
        <div className={`flex items-center justify-between ${flush ? 'px-5 pt-4 pb-2' : 'mb-3'}`}>
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {right}
        </div>
      )}
      {flush ? <div className="min-h-0 flex-1">{children}</div> : children}
    </section>
  )
}

export function Stat({ label, value, unit = '' }) {
  return (
    <div className="rounded-xl bg-paper px-4 py-3">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">
        {value ?? '—'}
        {value != null && unit && <span className="ml-0.5 text-sm font-normal text-ink-soft">{unit}</span>}
      </p>
    </div>
  )
}
