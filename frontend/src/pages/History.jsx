import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { FileText, RefreshCw } from 'lucide-react'
import Card from '../components/Card'
import EmptyState from '../components/EmptyState'
import AngleSessionChart from '../components/RomTrend'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'

async function openReport(id) {
  const r = await api.get(`/sessions/${id}/report`, { responseType: 'blob' })
  window.open(URL.createObjectURL(r.data), '_blank')
}

// Patient: their own sessions. Physiotherapist: /app/patients/:pid/history for an assigned patient.
export default function History() {
  const { user } = useAuth()
  const { pid } = useParams()
  const patientId = pid || user.id
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api.get(`/patients/${patientId}/sessions`)
      .then((r) => setRows(r.data.sessions))
      .catch(() => setError('Could not load sessions.'))
  }, [patientId])
  useEffect(load, [load])
  // while a report is still being built (queue / Lambda), look again every few seconds
  const waiting = rows?.some((s) => s.report?.status === 'pending')
  useEffect(() => {
    if (!waiting) return undefined
    const t = setInterval(load, 4000)
    return () => clearInterval(t)
  }, [waiting, load])

  async function retry(id) {
    await api.post(`/sessions/${id}/report/retry`).catch(() => {})
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{pid ? 'Patient sessions' : 'My sessions'}</h1>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink"><RefreshCw size={14} /> Refresh</button>
      </div>
      {error && <p className="text-coral">{error}</p>}
      {rows && rows.length > 0 && (
        <Card title="Range of motion per session"><AngleSessionChart rows={rows} /></Card>
      )}
      {rows && rows.length === 0 && <EmptyState title="No sessions yet" body="Finished sessions and their one-page reports will appear here." />}
      <div className="space-y-3">
        {rows?.map((s) => (
          <Card key={s.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{new Date(s.started_at * 1000).toLocaleString()}</p>
                <p className="text-sm text-ink-soft">
                  ROM {s.summary?.rom?.toFixed?.(0) ?? '—'}° · {s.summary?.reps ?? 0} reps · score {s.summary?.score ?? 0}
                  {s.reason === 'timeout' && ' · ended by connection loss'}
                </p>
              </div>
              {s.report?.status === 'ready' ? (
                <button onClick={() => openReport(s.id)} className="flex items-center gap-2 rounded-pill bg-ink px-4 py-2 text-sm text-paper">
                  <FileText size={15} /> Open report
                </button>
              ) : (
                s.report?.status === 'failed' ? (
                  <button onClick={() => retry(s.id)} className="flex items-center gap-2 rounded-pill border border-ink/20 px-4 py-2 text-sm">
                    <RefreshCw size={14} /> Report failed, try again
                  </button>
                ) : (
                  <span className="text-sm text-ink-soft">Preparing report…</span>
                )
              )}
            </div>
            {s.tip && <p className="mt-3 rounded-xl bg-sun/30 px-4 py-2.5 text-sm">{s.tip}</p>}
          </Card>
        ))}
      </div>
    </div>
  )
}