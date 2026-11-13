const variants = {
  primary: 'bg-ink text-paper hover:bg-ink-soft',
  sun: 'bg-sun text-[#11141a] hover:brightness-95',
  ghost: 'bg-transparent text-ink border border-ink/15 hover:border-ink/40',
  outline: 'bg-transparent text-paper border border-paper/30 hover:border-paper/70',
}

export default function Button({
  children,
  variant = 'primary',
  className = '',
  type = 'button',
  ...rest
}) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-pill px-6 py-3 text-sm font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
