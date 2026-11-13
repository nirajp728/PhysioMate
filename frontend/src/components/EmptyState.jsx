export default function EmptyState({ title, body }) {
  return (
    <div className="rounded-card border border-dashed border-ink/15 bg-paper-raised/60 px-6 py-12 text-center">
      <p className="font-medium text-ink">{title}</p>
      {body && <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-soft">{body}</p>}
    </div>
  )
}
