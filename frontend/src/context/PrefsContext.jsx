import { createContext, useContext, useEffect, useMemo, useState } from 'react'

// Display preferences: light/dark and text size. Saved in this browser only.
export const SIZES = { normal: 100, large: 118, xlarge: 135 } // html font-size in percent
export const SCENE = {
  light: { bg: '#f7f4ec', cell: '#cfc8b8', section: '#b5ad9a' },
  dark: { bg: '#0f1217', cell: '#2a303b', section: '#3b4350' },
}

const KEY = 'motive-prefs'
function load() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY))
    return {
      theme: p?.theme === 'dark' ? 'dark' : p?.theme === 'light' ? 'light' : matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      size: SIZES[p?.size] ? p.size : 'normal',
    }
  } catch {
    return { theme: 'light', size: 'normal' }
  }
}

const PrefsContext = createContext(null)

export function PrefsProvider({ children }) {
  const [prefs, setPrefs] = useState(load)
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(prefs)) } catch { /* private mode: just not saved */ }
  }, [prefs])
  const value = useMemo(() => ({
    ...prefs,
    scene: SCENE[prefs.theme],
    setTheme: (theme) => setPrefs((p) => ({ ...p, theme })),
    setSize: (size) => setPrefs((p) => ({ ...p, size })),
  }), [prefs])
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
}

export const usePrefs = () => useContext(PrefsContext)

// Applies the prefs to <html>. Only the signed-in app uses it, so Landing/Login/Register stay as designed.
export function useApplyPrefs() {
  const { theme, size } = usePrefs()
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.style.fontSize = `${SIZES[size]}%`
    return () => { root.classList.remove('dark'); root.style.fontSize = '' }
  }, [theme, size])
}