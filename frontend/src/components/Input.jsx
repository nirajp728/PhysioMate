export default function Input({ label, id, className = '', ...rest }) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-sm text-ink-soft">{label}</span>
      <input
        id={id}
        className={`w-full rounded-xl border border-ink/12 bg-paper-raised px-4 py-3 text-[15px] text-ink placeholder:text-ink/35 outline-none transition-colors focus:border-ink/40 ${className}`}
        {...rest}
      />
    </label>
  )
}
