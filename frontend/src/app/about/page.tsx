import { CheckCircle2 } from 'lucide-react'
import { PageNav } from '@/components/ui/primitives'

/**
 * The problem statement, and what this project is.
 *
 * Laid out on the design reference's narrative grammar: a section head
 * (eyebrow, heading, lead), a row of quiet facts, then rule cards
 * (docs/ui-redesign/design-system-mapping.md §2). The blurred colour glow, the
 * gradient-clipped headline and the status colours used as decoration are gone;
 * status colour means a data state in this product, and nothing here is one.
 *
 * The problem statement's wording is SIH 2026's and is quoted unchanged. The
 * one sentence of ours that changed: "Autonomous Space-Geological Decision
 * Support Platform" — nothing here acts on its own; every output is decision
 * support for a qualified person (the guardrails in the footer).
 */
export const metadata = { title: 'About · Nakshatra-X' }

const FACTS = [
  { label: 'Organisation', value: 'Ministry of Steel', detail: 'Govt. of India' },
  { label: 'Department', value: 'MOIL Ltd.', detail: 'Largest Producer in India' },
  { label: 'Category', value: 'Software', detail: 'AI/ML & Analytics' },
  { label: 'Theme', value: 'Space Technology', detail: 'ISRO MOSDAC / Bhuvan' },
]

const OBJECTIVES = [
  {
    title: 'Identify & Map Reserves',
    body: 'Identify and map manganese reserves more accurately using surface and sub-surface indicators.',
  },
  {
    title: 'Predict Shortfalls',
    body: 'Predict shortfalls in production by analysing constraints like equipment downtime, weather conditions, or blasting delays.',
  },
  {
    title: 'Suggest Corrective Actions',
    body: 'Suggest corrective actions such as adjusting mine schedules, optimizing blasting, or re-deploying equipment to ensure continuous ore availability.',
  },
]

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-[1200px] px-4 pb-8 pt-10 sm:px-6 lg:px-8">
      <header className="max-w-[880px]">
        <p className="label">About Nakshatra&#8209;X · SIH 2026 problem statement</p>
        <h1 className="mt-3 font-display text-4xl md:text-5xl">
          Using AI/ML and Space Technology to Identify Manganese Reserves and Overcome Production
          Shortfalls
        </h1>
        <p className="measure mt-5 text-xl leading-[1.35] tracking-[0.033em] text-text-secondary">
          A decision-support platform for the Ministry of Steel &amp; MOIL Ltd.
        </p>
      </header>

      {/* Facts, as the reference's hero meta: label over value, no cards. */}
      <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-8 border-y border-border-default py-8 md:grid-cols-4">
        {FACTS.map((f) => (
          <div key={f.label} className="grid content-start gap-1">
            <dt className="label">{f.label}</dt>
            <dd className="text-xl text-text-primary">{f.value}</dd>
            <dd className="text-sm text-text-secondary">{f.detail}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-16 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-12">
        <div>
          <p className="label">01 Background</p>
          <h2 className="t-h2-wrap mt-3">Background</h2>
        </div>
        <p className="measure text-lg text-text-secondary">
          <strong className="font-normal text-text-primary">MOIL Limited</strong> is the largest
          producer of Manganese Ore in India. To meet future demand, it is important to accurately
          identify available reserves and avoid production shortfalls. At present, reserve estimation
          and production planning are mainly based on manual surveys, drilling results, and
          production records. These methods are time-consuming and sometimes lead to a mismatch
          between expected and actual ore production.
        </p>
      </section>

      <section className="mt-16 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-12">
        <div>
          <p className="label">02 Detailed description</p>
          <h2 className="t-h2-wrap mt-3">Detailed Description</h2>
        </div>
        <div>
          <p className="measure text-lg text-text-secondary">
            The challenge is to develop an AI/ML-based solution that uses geological data, historical
            production, equipment performance, and satellite/space technology inputs (such as
            rainfall, soil moisture, vegetation index, and land temperature) to:
          </p>
          <ol className="mt-8 grid list-none gap-3 md:grid-cols-3">
            {OBJECTIVES.map((o, i) => (
              <li
                key={o.title}
                className="grid content-start gap-2 rounded-xl border border-border-default bg-surface-1 p-5"
              >
                <span className="font-mono text-xs text-text-tertiary">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="text-lg text-text-primary">{o.title}</h3>
                <p className="text-sm text-text-secondary">{o.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mt-16 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-12">
        <div>
          <p className="label">03 Expected solution</p>
          <h2 className="t-h2-wrap mt-3">Expected Solution</h2>
        </div>
        <div>
          <p className="measure text-lg text-text-secondary">
            The expected solution is a user-friendly dashboard that shows predicted reserves,
            production trends, possible risks of shortfall, and recommended corrective steps.
          </p>
          <p className="mt-6 flex items-start gap-3 rounded-xl bg-surface-2 p-5 text-base text-text-primary">
            <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-text-secondary" aria-hidden="true" />
            <span>
              This will help MOIL improve planning, reduce losses, and ensure steady ore supply to
              customers.
            </span>
          </p>
        </div>
      </section>

      <div className="mt-20">
        <PageNav
          links={[
            { href: '/', label: 'Home', detail: 'The two tracks, and what they are measured to do' },
            { href: '/console', label: 'Console', detail: 'Portfolio shortfall risk, and both tracks per mine' },
            { href: '/method', label: 'Method and evidence', detail: 'How both tracks are built and validated' },
          ]}
        />
        <p className="t-caption mt-6">Theme: Space Technology · made with love</p>
      </div>
    </main>
  )
}
