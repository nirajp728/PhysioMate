import { Link, useNavigate } from 'react-router-dom'
import Button from './Button'
import { useAuth, homeFor } from '../context/AuthContext'

export default function Navbar() {
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-30 border-b border-ink/8 bg-paper/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink">
            <span className="h-2.5 w-2.5 rounded-full bg-sun" />
          </span>
          <span className="text-[17px] font-semibold tracking-tight">Motive</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-ink-soft md:flex">
          <a href="#how-it-works" className="hover:text-ink">How it works</a>
          <a href="#features" className="hover:text-ink">Features</a>
          <a href="#trust" className="hover:text-ink">Clinicians</a>
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <Button variant="primary" onClick={() => navigate(homeFor(user.role))}>
              Go to dashboard
            </Button>
          ) : (
            <>
              <Link to="/login" className="hidden text-sm text-ink-soft hover:text-ink sm:block">
                Log in
              </Link>
              <Button variant="primary" onClick={() => navigate('/register')}>
                Get started
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}