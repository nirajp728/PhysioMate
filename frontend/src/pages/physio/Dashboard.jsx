import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Card, { Stat } from '../../components/Card'
import EmptyState from '../../components/EmptyState'
import api from '../../lib/api'
import { connectSocket } from '../../lib/socket'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [patients, setPatients] = useState(null)

  const load = useCallback(() => {
    api.get('/physio/dashboard').then((r) => setStats(r.data))
    api.get('/physio/patients').then((r) => setPatients(r.data.patients))
  }, [])
  useEffect(load, [load])

  // "Live now" badges update the moment a patient starts or stops a session.
  useEffect(() => {
    const s = connectSocket()
    s.on('patient_live', ({ patient_id, live }) => {
      setPatients((list) => list && list.map((p) => (p.id === patient_id ? { ...p, live } : p)))
      api.get('/physio/dashboard').then((r) => setStats(r.data))
    })
    return () => s.disconnect()
  }, [])

  async function remove(id) {
    await api.delete(`/physio/patients/${id}`)
    load()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="My patients" value={stats?.assigned} />
        <Stat label="Live now" value={stats?.live_now} />
        <Stat label="Sessions, last 7 days" value={stats?.sessions_7d} />
        <Stat label="Average ROM, 7 days" value={stats?.avg_rom_7d} unit="°" />
      </div>

      {patients && patients.length === 0 && (
        <EmptyState title="No patients yet" body="Open “Find patients” to add the people you treat." />
      )}
      <div className="space-y-3">
        {patients?.map((p) => (
          <Card key={p.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${p.live ? 'bg-line-green' : 'bg-ink/20'}`} />
                <div>
                  <p className="font-medium">{p.username}</p>
                  <p className="text-sm text-ink-soft">
                    {p.live ? 'In a session now' : p.last_session ? `Last session ${new Date(p.last_session.started_at * 1000).toLocaleDateString()} · ROM ${Math.round(p.last_session.summary?.rom || 0)}°` : 'No sessions yet'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link to={`/app/patients/${p.id}/history`} className="rounded-pill border border-ink/15 px-4 py-2 text-sm">Sessions</Link>
                <Link
                  to={`/app/watch/${p.id}`}
                  className={`rounded-pill px-4 py-2 text-sm ${p.live ? 'bg-sun font-medium text-[#11141a]' : 'bg-ink text-paper'}`}
                >
                  {p.live ? 'Watch live' : 'Open live view'}
                </Link>
                <button onClick={() => remove(p.id)} className="text-xs text-ink-soft hover:text-coral">Remove</button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}