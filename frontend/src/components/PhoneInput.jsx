import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import countries from '../data/countries'

export default function PhoneInput({ value, onChange, country, onCountryChange }) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    function onClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div>
      <span className="mb-1.5 block text-sm text-ink-soft">Phone number</span>
      <div className="flex overflow-visible rounded-xl border border-ink/12 bg-paper-raised focus-within:border-ink/40" ref={boxRef}>
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex h-full items-center gap-1.5 border-r border-ink/12 px-3.5 py-3 text-sm"
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <span className="text-base leading-none">{country.flag}</span>
            <span className="text-ink-soft">{country.dial}</span>
            <ChevronDown size={14} className="text-ink/40" />
          </button>
          {open && (
            <ul
              role="listbox"
              className="scroll-thin absolute left-0 top-[calc(100%+6px)] z-20 max-h-64 w-64 overflow-y-auto rounded-xl border border-ink/10 bg-paper-raised py-1.5 shadow-[0_12px_32px_rgba(17,20,26,0.14)]"
            >
              {countries.map((c) => (
                <li key={c.code}>
                  <button
                    type="button"
                    onClick={() => {
                      onCountryChange(c)
                      setOpen(false)
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm hover:bg-sage/25"
                  >
                    <span className="text-base leading-none">{c.flag}</span>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-ink/45">{c.dial}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <input
          type="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="98765 43210"
          className="w-full rounded-r-xl bg-transparent px-4 py-3 text-[15px] outline-none placeholder:text-ink/35"
        />
      </div>
    </div>
  )
}
