import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Input from '../components/Input'
import Button from '../components/Button'
import { useAuth, homeFor } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(form.email, form.password)
    setLoading(false)
    if (result.ok) navigate(homeFor(result.user.role))
    else setError(result.error)
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <AuthAside
        title="Pick up where your last session left off."
        body="Your range-of-motion history, exercise plan, and clinic notes are all here."
      />

      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-3 inline-flex items-center gap-1.5 text-xs text-ink-soft hover:text-ink">
            ← Back to home
          </Link>

          <Link to="/" className="mb-10 mt-3 inline-flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink">
              <span className="h-2.5 w-2.5 rounded-full bg-sun" />
            </span>
            <span className="text-[17px] font-semibold tracking-tight">Motive</span>
          </Link>

          <h1 className="text-2xl font-semibold tracking-tight text-ink">Log in</h1>
          <p className="mt-2 text-sm text-ink-soft">Welcome back. Enter your details to continue.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <Input
              id="email"
              label="Email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
            />
            <Input
              id="password"
              label="Password"
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
            />

            {error && <p className="text-sm text-coral">{error}</p>}

            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              {loading ? 'Logging in…' : 'Log in'}
            </Button>
          </form>

          <p className="mt-6 text-sm text-ink-soft">
            Not registered yet?{' '}
            <Link to="/register" className="font-medium text-ink underline underline-offset-2">
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export function AuthAside({ title, body }) {
  return (
    <div className="relative hidden flex-col justify-between overflow-hidden bg-ink px-12 py-14 text-paper md:flex">
      <Link to="/" className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sun">
          <span className="h-2.5 w-2.5 rounded-full bg-ink" />
        </span>
        <span className="text-[17px] font-semibold tracking-tight">Motive</span>
      </Link>

      <div className="max-w-sm">
        <h2 className="text-3xl font-semibold leading-tight tracking-tight">{title}</h2>
        <p className="mt-4 text-[15px] leading-relaxed text-paper/60">{body}</p>
      </div>

      <div className="flex gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-sun" />
        <span className="h-1.5 w-1.5 rounded-full bg-paper/25" />
        <span className="h-1.5 w-1.5 rounded-full bg-paper/25" />
      </div>

      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-sage/20" />
    </div>
  )
}