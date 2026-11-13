import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Input from '../components/Input'
import PhoneInput from '../components/PhoneInput'
import Button from '../components/Button'
import { AuthAside } from './Login'
import { useAuth } from '../context/AuthContext'
import countries from '../data/countries'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [country, setCountry] = useState(countries[0])
  const [form, setForm] = useState({ username: '', email: '', phone: '', password: '', role: 'patient' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.username || !form.email || !form.password) {
      setError('Fill in all required fields.')
      return
    }
    setError('')
    setLoading(true)
    const result = await register({
      username: form.username,
      email: form.email,
      phone: `${country.dial} ${form.phone}`,
      password: form.password,
      role: form.role,
    })
    setLoading(false)
    if (result.ok) navigate('/login')
    else setError(result.error)
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <AuthAside
        title="Every rep you do at home shows up in your next appointment."
        body="Set up your account once, then pair your band from the dashboard."
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

          <h1 className="text-2xl font-semibold tracking-tight text-ink">Create your account</h1>
          <p className="mt-2 text-sm text-ink-soft">Takes less than a minute.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <span className="mb-1.5 block text-sm text-ink-soft">I am a</span>
              <div className="grid grid-cols-2 gap-2">
                {[['patient', 'Patient'], ['physiotherapist', 'Physiotherapist']].map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setForm({ ...form, role: v })}
                    className={`rounded-xl border px-4 py-3 text-sm ${form.role === v ? 'border-ink bg-ink text-paper' : 'border-ink/12 bg-paper-raised text-ink-soft'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <Input
              id="username"
              label="Username"
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="jordan_recovers"
            />
            <Input
              id="email"
              label="Email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
            />
            <PhoneInput
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v })}
              country={country}
              onCountryChange={setCountry}
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
              {loading ? 'Creating account…' : 'Register'}
            </Button>
          </form>

          <p className="mt-6 text-sm text-ink-soft">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-ink underline underline-offset-2">
              Login here
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}