import { useNavigate } from 'react-router-dom'
import { Activity, Timer, Waypoints, ShieldCheck } from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import Button from '../components/Button'

const steps = [
  {
    n: '01',
    title: 'Wear the band',
    body: 'Strap the sensor over the joint your therapist wants tracked — knee, shoulder, or wrist. It reads motion, not just steps.',
  },
  {
    n: '02',
    title: 'Move through your set',
    body: 'Follow the exercise your clinic assigned. The band measures range, tempo, and steadiness in real time.',
  },
  {
    n: '03',
    title: 'Your therapist adjusts the plan',
    body: 'Session data syncs automatically, so your next appointment starts from what actually happened at home.',
  },
]

const features = [
  {
    icon: Activity,
    title: 'Range-of-motion tracking',
    body: 'Sub-degree accuracy on flexion and extension, logged against your baseline every session.',
    big: true,
  },
  {
    icon: Timer,
    title: 'Rep timing',
    body: 'Flags rushed or uneven reps before they become bad habits.',
  },
  {
    icon: Waypoints,
    title: 'Clinic sync',
    body: 'Your physiotherapist sees the same data you do, updated after every session.',
  },
  {
    icon: ShieldCheck,
    title: '11-day battery',
    body: 'Wear it through a full rehab cycle without thinking about charging.',
  },
]

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-paper">
      <Navbar />

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-16 md:grid-cols-2 md:items-center md:pt-24">
        <div>
          <h1 className="max-w-md text-[44px] font-semibold leading-[1.08] tracking-tight text-ink sm:text-[54px]">
            Recovery your therapist can actually see.
          </h1>
          <p className="mt-5 max-w-sm text-[17px] leading-relaxed text-ink-soft">
            PhysioMate is a wearable motion sensor that turns your home exercises into
            data your physiotherapist reads before your next visit.
          </p>
          <div className="mt-8 flex items-center gap-4">
            <Button variant="sun" onClick={() => navigate('/register')}>
              Get your band
            </Button>
            <a href="#how-it-works" className="text-sm text-ink-soft hover:text-ink">
              See how it works
            </a>
          </div>

          <dl className="mt-14 grid max-w-sm grid-cols-3 gap-6 border-t border-ink/10 pt-6">
            <div>
              <dt className="text-2xl font-semibold text-ink">0.5°</dt>
              <dd className="mt-1 text-xs text-ink-soft">motion accuracy</dd>
            </div>
            <div>
              <dt className="text-2xl font-semibold text-ink">11d</dt>
              <dd className="mt-1 text-xs text-ink-soft">battery life</dd>
            </div>
            <div>
              <dt className="text-2xl font-semibold text-ink">40+</dt>
              <dd className="mt-1 text-xs text-ink-soft">partner clinics</dd>
            </div>
          </dl>
        </div>

        <div className="relative flex items-center justify-center">
          <HeroBand />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-ink/8 bg-paper-raised/60 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="max-w-md text-3xl font-semibold tracking-tight text-ink">
            Three steps between you and your next milestone.
          </h2>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="border-t border-ink/15 pt-5">
                <span className="text-sm text-ink/40">{s.n}</span>
                <h3 className="mt-3 text-lg font-medium text-ink">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="max-w-md text-3xl font-semibold tracking-tight text-ink">
            Built for the exercises that are easy to fake.
          </h2>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {features.map((f, i) => (
              <div
                key={f.title}
                className={`rounded-card border border-ink/10 p-7 ${
                  f.big ? 'md:col-span-2 md:row-span-2 bg-ink text-paper' : 'bg-paper-raised'
                }`}
              >
                <f.icon size={20} className={f.big ? 'text-sun' : 'text-sage-deep'} />
                <h3 className={`mt-4 text-lg font-medium ${f.big ? 'text-paper' : 'text-ink'}`}>
                  {f.title}
                </h3>
                <p className={`mt-2 text-[15px] leading-relaxed ${f.big ? 'text-paper/70' : 'text-ink-soft'}`}>
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust / CTA */}
      <section id="trust" className="border-t border-ink/8 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="rounded-card bg-sage/25 px-8 py-14 text-center sm:px-16">
            <h2 className="mx-auto max-w-lg text-3xl font-semibold tracking-tight text-ink">
              Your physiotherapist is already reading data like this.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[15px] text-ink-soft">
              Ask your clinic if they're a PhysioMate partner, or start on your own and bring
              your session history to your next appointment.
            </p>
            <div className="mt-8 flex justify-center">
              <Button variant="primary" onClick={() => navigate('/register')}>
                Create your account
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

function HeroBand() {
  return (
    <svg viewBox="0 0 420 420" className="w-full max-w-md" role="img" aria-label="PhysioMate wearable band motion visualization">
      <defs>
        <linearGradient id="bandGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1c202a" />
          <stop offset="100%" stopColor="#11141a" />
        </linearGradient>
      </defs>

      {/* backdrop disc */}
      <circle cx="210" cy="210" r="190" fill="#bfd2af" opacity="0.28" />
      <circle cx="210" cy="210" r="150" fill="#f7f4ec" opacity="0.6" />

      {/* band */}
      <g>
        <rect x="90" y="150" width="240" height="120" rx="60" fill="url(#bandGrad)" />
        <rect x="90" y="150" width="240" height="120" rx="60" fill="none" stroke="#fff25c" strokeWidth="2" opacity="0.5" />

        {/* waveform */}
        <path
          d="M115 210 L150 210 L165 175 L185 245 L205 190 L225 230 L245 210 L305 210"
          fill="none"
          stroke="#fff25c"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <animate
            attributeName="d"
            dur="2.4s"
            repeatCount="indefinite"
            values="
              M115 210 L150 210 L165 175 L185 245 L205 190 L225 230 L245 210 L305 210;
              M115 210 L150 210 L165 195 L185 220 L205 170 L225 245 L245 210 L305 210;
              M115 210 L150 210 L165 175 L185 245 L205 190 L225 230 L245 210 L305 210"
          />
        </path>

        {/* pulse dot */}
        <circle cx="205" cy="210" r="5" fill="#fff25c">
          <animate attributeName="r" values="4;7;4" dur="1.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;0.5;1" dur="1.6s" repeatCount="indefinite" />
        </circle>
      </g>

      {/* orbit accent */}
      <circle cx="210" cy="210" r="150" fill="none" stroke="#11141a" strokeOpacity="0.12" strokeWidth="1" strokeDasharray="2 8" />
    </svg>
  )
}
