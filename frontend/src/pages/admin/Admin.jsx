import { useCallback, useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Card, { Stat } from '../../components/Card'
import Button from '../../components/Button'
import api, { errMsg } from '../../lib/api'

const GRID = <CartesianGrid stroke="var(--color-ink)" strokeOpacity={0.12} vertical={false} />
const AXIS = { tick: { fontSize: 11, fill: 'var(--color-ink-soft)' }, tickLine: false, axisLine: false }
const TIP = { contentStyle: { background: 'var(--color-paper-raised)', border: 'none', borderRadius: 12, fontSize: 12, color: 'var(--color-ink)' } }

function Chart({ children, height = 200 }) {
  return <div style={{ height }}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>
}

export default function Admin() {
  const [an, setAn] = useState(null)
  const [err, setErr] = useState('')
  const [data, setData] = useState({ users: [], assignments: [] })
  const [physio, setPhysio] = useState('')
  const [patient, setPatient] = useState('')
  const [msg, setMsg] = useState('')

  const loadUsers = useCallback(() => api.get('/admin/users').then((r) => setData(r.data)), [])
  const loadAnalytics = useCallback(() => api.get('/admin/analytics').then((r) => { setAn(r.data); setErr('') }).catch((e) => setErr(errMsg(e))), [])
  useEffect(() => { loadUsers(); loadAnalytics() }, [loadUsers, loadAnalytics])

  const by = (role) => data.users.filter((u) => u.role === role)
  const name = (id) => data.users.find((u) => u.id === id)?.username || id

  async function assign() {
    try {
      await api.post('/admin/assign', { physio_id: physio, patient_id: patient })
      setMsg('')
      loadUsers(); loadAnalytics()
    } catch (e) { setMsg(errMsg(e)) }
  }
  async function unassign(a) {
    await api.delete('/admin/assign', { data: a })
    loadUsers(); loadAnalytics()
  }

  const sel = 'flex-1 rounded-xl border border-ink/12 bg-paper px-3 py-2.5 text-sm'
  const u = an?.users, p = an?.patients, s = an?.sessions
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin dashboard</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Adherence = patients with at least {an?.target_per_week ?? 3} finished sessions in the last 7 days.
          </p>
        </div>
        <Button variant="ghost" className="!px-4 !py-2" onClick={loadAnalytics}>Refresh</Button>
      </div>
      {err && <p className="text-sm text-coral">{err}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total users" value={u?.total} />
        <Stat label="Patients" value={u?.patients} />
        <Stat label="Physiotherapists" value={u?.physiotherapists} />
        <Stat label="New in 7 days" value={u?.new_7d} />
        <Stat label="Sessions (all time)" value={s?.total} />
        <Stat label="Sessions, last 7 days" value={s?.last_7d} />
        <Stat label="Adherence this week" value={an?.adherence_pct} unit="%" />
        <Stat label="Patients live now" value={p?.live_now} />
        <Stat label="Active patients (7d)" value={p?.active_7d} />
        <Stat label="Inactive patients (7d)" value={p?.inactive_7d} />
        <Stat label="Total reps" value={s?.reps} />
        <Stat label="Avg range of motion" value={s?.avg_rom} unit="°" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Sessions per day (last 30 days)">
          <Chart>
            <BarChart data={an?.daily || []}>
              {GRID}
              <XAxis dataKey="date" {...AXIS} interval={4} />
              <YAxis {...AXIS} allowDecimals={false} width={28} />
              <Tooltip {...TIP} cursor={{ fill: 'var(--color-ink)', fillOpacity: 0.06 }} />
              <Bar dataKey="sessions" fill="var(--color-line-blue)" radius={[4, 4, 0, 0]} maxBarSize={14} />
            </BarChart>
          </Chart>
        </Card>
        <Card title="Weekly adherence (%)">
          <Chart>
            <LineChart data={an?.weekly || []}>
              {GRID}
              <XAxis dataKey="label" {...AXIS} />
              <YAxis {...AXIS} domain={[0, 100]} width={28} />
              <Tooltip {...TIP} />
              <Line type="monotone" dataKey="adherence_pct" stroke="var(--color-line-green)" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </Chart>
        </Card>
        <Card title="Average range of motion per week (°)">
          <Chart>
            <LineChart data={an?.weekly || []}>
              {GRID}
              <XAxis dataKey="label" {...AXIS} />
              <YAxis {...AXIS} width={28} />
              <Tooltip {...TIP} />
              <Line type="monotone" dataKey="avg_rom" stroke="var(--color-line-blue)" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </Chart>
        </Card>
        <Card title="Patients needing a nudge">
          {!an?.lowest_adherence?.length && <p className="text-sm text-ink-soft">Everyone is on track.</p>}
          <ul className="divide-y divide-ink/8 text-sm">
            {an?.lowest_adherence?.map((r) => (
              <li key={r.username} className="flex items-center justify-between py-2">
                <span>{r.username} {!r.assigned && <span className="text-xs text-ink-soft">(no physio)</span>}</span>
                <span className="text-xs tabular-nums text-ink-soft">{r.sessions_7d} this week · last {r.last_session ? new Date(r.last_session * 1000).toLocaleDateString() : 'never'}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Reports">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Ready" value={an?.reports?.ready} />
            <Stat label="Pending" value={an?.reports?.pending} />
            <Stat label="Failed" value={an?.reports?.failed} />
          </div>
        </Card>
        <Card title="Patients per physiotherapist" className="lg:col-span-2">
          {!an?.physio_load?.length && <p className="text-sm text-ink-soft">No physiotherapists yet.</p>}
          <ul className="divide-y divide-ink/8 text-sm">
            {an?.physio_load?.map((r) => (
              <li key={r.username} className="flex justify-between py-2"><span>{r.username}</span><span className="tabular-nums text-ink-soft">{r.patients} patient{r.patients === 1 ? '' : 's'}</span></li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-soft">{p?.assigned ?? 0} patients assigned · {p?.unassigned ?? 0} waiting for a physiotherapist</p>
        </Card>
      </div>

      <h2 className="pt-2 text-lg font-semibold tracking-tight">Users & assignments</h2>
      <Card title="Assign a patient to a physiotherapist">
        <div className="flex flex-wrap gap-2">
          <select className={sel} value={physio} onChange={(e) => setPhysio(e.target.value)}>
            <option value="">Physiotherapist…</option>
            {by('physiotherapist').map((x) => <option key={x.id} value={x.id}>{x.username}</option>)}
          </select>
          <select className={sel} value={patient} onChange={(e) => setPatient(e.target.value)}>
            <option value="">Patient…</option>
            {by('patient').map((x) => <option key={x.id} value={x.id}>{x.username}</option>)}
          </select>
          <Button variant="sun" onClick={assign} disabled={!physio || !patient}>Assign</Button>
        </div>
        {msg && <p className="mt-2 text-sm text-coral">{msg}</p>}
      </Card>
      <Card title="Current assignments">
        {data.assignments.length === 0 && <p className="text-sm text-ink-soft">None yet.</p>}
        <ul className="divide-y divide-ink/8">
          {data.assignments.map((a) => (
            <li key={a.physio_id + a.patient_id} className="flex items-center justify-between py-2.5 text-sm">
              <span>{name(a.physio_id)} → {name(a.patient_id)}</span>
              <button onClick={() => unassign(a)} className="text-xs text-ink-soft hover:text-coral">Remove</button>
            </li>
          ))}
        </ul>
      </Card>
      <Card title={`All users (${data.users.length})`}>
        <ul className="divide-y divide-ink/8 text-sm">
          {data.users.map((x) => (
            <li key={x.id} className="flex justify-between py-2"><span>{x.username} <span className="text-ink-soft">{x.email}</span></span><span className="capitalize text-ink-soft">{x.role}</span></li>
          ))}
        </ul>
      </Card>
    </div>
  )
}