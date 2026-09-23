import Link from 'next/link'

/**
 * 404. There was no not-found.tsx at all before this, so an unknown URL fell
 * back to the framework default — unstyled, and outside the app shell.
 */
export const metadata = { title: 'Not found — Nakshatra-X' }

const DESTINATIONS = [
  { href: '/console', label: 'Console', detail: 'Portfolio shortfall risk, and both tracks per mine' },
  { href: '/production', label: 'Production', detail: 'Track B operational detail' },
  { href: '/method', label: 'Method', detail: 'Guardrails, backtest and model provenance' },
]

export default function NotFound() {
  return (
    <main className="mx-auto min-h-[60vh] max-w-[1280px] px-4 py-16 sm:px-6 lg:px-8">
      <p className="label">404</p>
      <h1 className="mt-3 text-2xl">That page does not exist</h1>
      <p className="measure mt-3 text-base text-text-secondary">
        The address may be mistyped, or it may point at a screen that has been merged into another
        one. Several older routes now redirect to their replacements.
      </p>

      <ul className="mt-8 grid list-none gap-3 sm:grid-cols-3">
        {DESTINATIONS.map((d) => (
          <li key={d.href}>
            <Link
              href={d.href}
              className="block h-full rounded-md border border-border-default bg-surface-2 p-4 transition-colors duration-[120ms] ease-out hover:bg-surface-3"
            >
              <span className="font-medium text-text-primary">{d.label}</span>
              <span className="mt-1 block text-sm text-text-secondary">{d.detail}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
