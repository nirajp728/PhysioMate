import axios from 'axios'
import { API_URL } from './config'

// The login lives in httpOnly cookies set by the server, so no token is stored or readable here.
// withCredentials makes the browser send the cookies; X-Requested-With is the server's CSRF check.
const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  headers: { 'X-Requested-With': 'rehab-web' },
})

// The access cookie is short-lived. Renew it from the refresh cookie (one renewal at a time, shared by all callers).
let renewing = null
export const renewSession = () => {
  renewing ||= api.post('/auth/refresh').finally(() => { renewing = null })
  return renewing
}

const NO_RENEW = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout']

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const { config, response } = err
    if (response?.status !== 401 || !config || config._retried || NO_RENEW.includes(config.url)) return Promise.reject(err)
    config._retried = true
    try {
      await renewSession()
      return api(config) // same request again with the new cookie
    } catch {
      if (!config.url.startsWith('/auth/')) window.location.assign('/login') // refresh cookie gone too: log in again
      return Promise.reject(err)
    }
  }
)

export const errMsg = (err, fallback = 'Something went wrong.') => err?.response?.data?.message || fallback

export default api