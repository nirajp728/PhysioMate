import { useState } from 'react'
import { useBle } from '../context/BleContext'
import { useAuth } from '../context/AuthContext'

// Hidden developer tools. Open with Ctrl+Shift+D. Not linked anywhere in the interface.
export default function DevPanel() {
  const { devOpen, setDevOpen, connectWs, startFake, disconnect, status, source } = useBle()
  const { user } = useAuth()
  const [url, setUrl] = useState('ws://192.168.1.50:81')
  if (!devOpen || user?.role !== 'patient') return null // only patients have a wearable
  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-2xl bg-ink p-4 text-paper shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">Developer sources</p>
        <button onClick={() => setDevOpen(false)} className="text-xs text-paper/60 hover:text-paper">close</button>
      </div>
      <p className="mb-3 text-xs text-paper/60">Now: {source} · {status}</p>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="w-full rounded-lg bg-paper/10 px-3 py-2 text-sm outline-none"
        placeholder="ws://host:port"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button onClick={() => connectWs(url)} className="rounded-pill bg-sun px-3 py-1.5 text-xs font-medium text-[#11141a]">Connect WebSocket</button>
        <button onClick={startFake} className="rounded-pill bg-paper/15 px-3 py-1.5 text-xs">Fake curl data</button>
        <button onClick={disconnect} className="rounded-pill bg-paper/15 px-3 py-1.5 text-xs">Stop</button>
      </div>
    </div>
  )
}