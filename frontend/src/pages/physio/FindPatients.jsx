import { useCallback, useEffect, useState } from 'react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import api from '../../lib/api'

export default function FindPatients() {
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const load = useCallback(() => api.get('/physio/patients/available').then((r) => setRows(r.data.patients)), [])
  useEffect(() => { load() }, [load])

  async function add(id) {
    await api.post('/physio/patients', { patient_id: id })
    load()
  }
  const shown = rows.filter((p) => (p.username + p.email).toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Find patients</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name or email"
        className="w-full max-w-sm rounded-xl border border-ink/12 bg-paper-raised px-4 py-3 text-sm outline-none"
      />
      <div className="space-y-3">
        {shown.map((p) => (
          <Card key={p.id}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{p.username}</p>
                <p className="text-sm text-ink-soft">{p.email}</p>
              </div>
              {p.assigned ? <span className="text-sm text-line-green">Added</span> : <Button variant="sun" onClick={() => add(p.id)}>Add to my patients</Button>}
            </div>
          </Card>
        ))}
        {shown.length === 0 && <p className="text-sm text-ink-soft">No patients found.</p>}
      </div>
    </div>
  )
}
