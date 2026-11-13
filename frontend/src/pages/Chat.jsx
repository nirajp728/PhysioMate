import { useEffect, useRef, useState } from 'react'
import Card from '../components/Card'
import Button from '../components/Button'
import api, { errMsg } from '../lib/api'
import { useAuth } from '../context/AuthContext'

export default function Chat() {
  const { user } = useAuth()
  const isPhysio = user.role === 'physiotherapist'
  const [patients, setPatients] = useState([])
  const [patientId, setPatientId] = useState('')
  const [q, setQ] = useState('')
  const [log, setLog] = useState([])
  const [busy, setBusy] = useState(false)
  const end = useRef(null)

  useEffect(() => {
    if (isPhysio) api.get('/physio/patients').then((r) => setPatients(r.data.patients))
  }, [isPhysio])

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth' }) // braces: an effect must not return a value
  }, [log])

  async function ask(e) {
    e.preventDefault()
    const question = q.trim()
    if (!question || (isPhysio && !patientId)) return
    setLog((l) => [...l, { who: 'you', text: question }])
    setQ('')
    setBusy(true)
    try {
      const { data } = await api.post('/chat', { question, patient_id: patientId || undefined })
      setLog((l) => [...l, { who: 'bot', text: data.answer, sources: data.sources, used: data.used, notice: data.notice }])
    } catch (err) {
      setLog((l) => [...l, { who: 'bot', text: errMsg(err) }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{isPhysio ? 'Ask about a patient' : 'Ask about my sessions'}</h1>

      {isPhysio && (
        <select
          value={patientId}
          onChange={(e) => { setPatientId(e.target.value); setLog([]) }}
          className="w-full rounded-xl border border-ink/12 bg-paper-raised px-4 py-3 text-sm outline-none"
        >
          <option value="">Choose a patient…</option>
          {patients.map((p) => <option key={p.id} value={p.id}>{p.username}</option>)}
        </select>
      )}

      <Card className="min-h-64 space-y-3">
        {log.length === 0 && (
          <p className="text-sm text-ink-soft">
            Try: “Compare every alternate session” or “What is a normal elbow range?”
          </p>
        )}
        {log.map((m, i) => (
          <div key={i} className={m.who === 'you' ? 'ml-auto max-w-[85%]' : 'max-w-[92%]'}>
            <p className={`rounded-2xl px-4 py-2.5 text-sm ${m.who === 'you' ? 'bg-ink text-paper' : 'bg-paper'}`}>{m.text}</p>
            {m.notice && <p className="mt-1 px-1 text-xs text-coral">{m.notice}</p>}
            {m.used && (m.used.sessions.length > 0 || m.used.knowledge_base) && (
              <p className="mt-1 px-1 text-xs text-ink-soft">
                Used: {[m.used.sessions.length > 0 && `session ${m.used.sessions.join(', ')}`, m.used.knowledge_base && 'verified guidance'].filter(Boolean).join(' + ')}
              </p>
            )}
            {m.sources?.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 px-1 text-xs text-ink-soft">
                {m.sources.map((s) => (
                  <li key={s.id}>
                    <span className="font-medium text-ink">[{s.id}]</span>{' '}
                    <a href={s.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">{s.citation}</a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {busy && <p className="text-sm text-ink-soft">Thinking…</p>}
        <div ref={end} />
      </Card>

      <form onSubmit={ask} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type a question…"
          maxLength={500}
          className="flex-1 rounded-xl border border-ink/12 bg-paper-raised px-4 py-3 text-sm outline-none"
        />
        <Button type="submit" variant="primary" disabled={busy || (isPhysio && !patientId)}>Send</Button>
      </form>
      <p className="text-xs text-ink-soft">
        This assistant describes your recorded data and shares general information. It does not diagnose or give treatment advice. Ask your physiotherapist about that.
      </p>
    </div>
  )
}