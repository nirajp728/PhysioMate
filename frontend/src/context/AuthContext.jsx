import { createContext, useContext, useEffect, useState } from 'react'
import api, { errMsg } from '../lib/api'

const AuthContext = createContext(null)

export function homeFor(role) {
  return role === 'physiotherapist' ? '/app/dashboard' : role === 'admin' ? '/app/admin' : '/app/device'
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true) // asking the server who we are (the cookie is invisible to scripts)

  useEffect(() => {
    api.get('/auth/me')
      .then((r) => setUser(r.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  async function register(fields) {
    try {
      await api.post('/auth/register', fields)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: errMsg(err, 'Registration failed. Please try again.') }
    }
  }

  async function login(email, password) {
    try {
      const { data } = await api.post('/auth/login', { email, password })
      setUser(data.user)
      return { ok: true, user: data.user }
    } catch (err) {
      return { ok: false, error: errMsg(err, 'Login failed. Please try again.') }
    }
  }

  async function logout(everywhere = false) {
    try {
      await api.post(everywhere ? '/auth/logout_all' : '/auth/logout')
    } catch {
      /* the cookie is cleared by the server; if it could not be reached the user is still logged out below */
    }
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, loading, register, login, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)