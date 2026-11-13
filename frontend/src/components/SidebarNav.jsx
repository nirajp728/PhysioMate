import { NavLink, useNavigate } from 'react-router-dom'
import { Moon, Sun, Bluetooth, Gamepad2, History, MessageCircle, LayoutGrid, Users, LogOut, Shield, PanelLeftClose } from 'lucide-react'
import DevicePanel from './DevicePanel'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'

const MENUS = {
  patient: [
    { to: '/app/device', label: 'My device', icon: Bluetooth },
    { to: '/app/play', label: 'Play session', icon: Gamepad2 },
    { to: '/app/history', label: 'My sessions', icon: History },
    { to: '/app/chat', label: 'Ask about my reports', icon: MessageCircle },
  ],
  physiotherapist: [
    { to: '/app/dashboard', label: 'Dashboard', icon: LayoutGrid },
    { to: '/app/patients', label: 'Find patients', icon: Users },
    { to: '/app/chat', label: 'Ask about reports', icon: MessageCircle },
  ],
  admin: [{ to: '/app/admin', label: 'Admin dashboard', icon: Shield }],
}

export default function SidebarNav({ onClose }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { theme, setTheme, size, setSize } = usePrefs()
  const items = MENUS[user.role] || []

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-ink text-paper/90">
      <div className="flex items-center gap-2.5 px-6 pt-7 pb-8">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sun">
          <span className="h-2.5 w-2.5 rounded-full bg-ink" />
        </span>
        <span className="text-[17px] font-semibold tracking-tight text-paper">PhysioMate</span>
        <button onClick={onClose} aria-label="Close sidebar" className="ml-auto rounded-lg p-1.5 text-paper/60 hover:bg-paper/10 hover:text-paper">
          <PanelLeftClose size={18} />
        </button>
      </div>

      <nav className="flex-1 px-3.5">
        <p className="px-3 pb-2 text-xs text-paper/40">Menu</p>
        <ul className="space-y-1">
          {items.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    isActive ? 'bg-paper font-medium text-ink' : 'text-paper/70 hover:bg-paper/10 hover:text-paper'
                  }`
                }
              >
                <Icon size={17} strokeWidth={2} />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {user.role === 'patient' && (
        <div className="mx-3.5 mb-4 rounded-xl bg-paper/5 p-3.5">
          <DevicePanel />
        </div>
      )}

      <div className="mx-3.5 mb-3 flex items-center gap-2" role="group" aria-label="Display">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="rounded-lg bg-paper/10 p-2 text-paper/80 hover:bg-paper/20"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <div className="flex flex-1 overflow-hidden rounded-lg bg-paper/10">
          {[['normal', 'text-xs', 'Normal text'], ['large', 'text-sm', 'Large text'], ['xlarge', 'text-lg', 'Extra large text']].map(([k, cls, label]) => (
            <button
              key={k}
              onClick={() => setSize(k)}
              aria-label={label}
              aria-pressed={size === k}
              className={`flex-1 py-1.5 font-semibold ${cls} ${size === k ? 'bg-paper text-ink' : 'text-paper/70 hover:bg-paper/10'}`}
            >
              A
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-paper/10 px-5 py-4">
        <p className="truncate text-sm font-medium">{user.username}</p>
        <p className="text-xs capitalize text-paper/50">{user.role}</p>
        <button
          onClick={() => { logout(); navigate('/') }}
          className="mt-3 flex items-center gap-2 text-xs text-paper/60 hover:text-paper"
        >
          <LogOut size={14} /> Log out
        </button>
      </div>
    </aside>
  )
}