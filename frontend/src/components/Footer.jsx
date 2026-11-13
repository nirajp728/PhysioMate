export default function Footer() {
  return (
    <footer className="border-t border-ink/8 bg-paper">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink">
                <span className="h-2 w-2 rounded-full bg-sun" />
              </span>
              <span className="text-base font-semibold tracking-tight">Motive</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-ink-soft">
              A wearable motion sensor and companion app for guided home recovery.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-3">
            <div>
              <p className="mb-3 text-ink-soft">Product</p>
              <ul className="space-y-2 text-ink/70">
                <li><a href="#how-it-works" className="hover:text-ink">How it works</a></li>
                <li><a href="#features" className="hover:text-ink">Features</a></li>
              </ul>
            </div>
            <div>
              <p className="mb-3 text-ink-soft">Company</p>
              <ul className="space-y-2 text-ink/70">
                <li><a href="#trust" className="hover:text-ink">Clinicians</a></li>
                <li><a href="#" className="hover:text-ink">Contact</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-ink/8 pt-6 text-xs text-ink/45 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Motive Health. For rehabilitation support, not a diagnostic device.</p>
        </div>
      </div>
    </footer>
  )
}
