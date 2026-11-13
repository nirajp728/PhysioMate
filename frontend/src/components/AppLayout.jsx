import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { PanelLeftOpen } from 'lucide-react'
import SidebarNav from './SidebarNav'
import { useApplyPrefs } from '../context/PrefsContext'

export default function AppLayout() {
  const [open, setOpen] = useState(true)
  useApplyPrefs()
  return (
    <div className="flex h-screen bg-paper">
      {/* Outer box animates its width (page makes room); inner box slides out to the left. */}
      <div className={`shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out ${open ? 'w-60' : 'w-0'}`}>
        <div className={`keep-light h-screen w-60 transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : '-translate-x-full'}`}>
          <SidebarNav onClose={() => setOpen(false)} />
        </div>
      </div>
      <main className="flex-1 overflow-y-auto">
        {!open && (
          <button
            onClick={() => setOpen(true)}
            aria-label="Open sidebar"
            className="fixed left-4 top-4 z-10 rounded-xl bg-ink p-2.5 text-paper shadow-lg hover:bg-ink/90"
          >
            <PanelLeftOpen size={18} />
          </button>
        )}
        <div className={`mx-auto max-w-6xl px-8 pb-8 transition-[padding] duration-300 ${open ? 'pt-8' : 'pt-16'}`}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}