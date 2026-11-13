// Backend address. Set VITE_API_URL in .env (no trailing slash).
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')
