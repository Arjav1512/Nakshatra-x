import Link from 'next/link'

/**
 * The integrity footer, promoted from /console to the application shell.
 *
 * docs/design/IA.md section 7: this is not optional. It states the four
 * guardrails and discloses that operational data is synthetic, so no screen in
 * the product can present numbers without that context.
 *
 * The wording is carried over verbatim from DecisionConsole. Every sentence
 * here is a claim about data provenance; the redesign restyles it and must
 * never reword it.
 */
export default function IntegrityFooter() {
  return (
    <footer className="mt-16 border-t border-border-subtle bg-surface-1">
      <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="measure space-y-2 text-xs text-text-tertiary">
          <p>
            <strong className="font-medium text-text-secondary">Guardrails.</strong> No subsurface
            ore detection from satellite — the named inputs are surface and atmospheric only. No
            statutory UNFC reserve figures — outputs are decision support for a qualified person.
            Constraints are enforced, never learned. Stale or missing sources are stated, never
            silently extrapolated.
          </p>
          <p>
            Operational data is synthetic, generated to the published ingestion contract, because
            MOIL&rsquo;s records are proprietary (PRD §8.2). Weather is measured live.
          </p>
        </div>

        <nav
          aria-label="Footer"
          className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border-subtle pt-6 text-xs"
        >
          <Link
            href="/about"
            className="text-text-secondary transition-colors duration-[120ms] ease-out hover:text-text-primary"
          >
            About
          </Link>
          <Link
            href="/evaluator"
            className="text-text-secondary transition-colors duration-[120ms] ease-out hover:text-text-primary"
          >
            Method &amp; evidence
          </Link>
          <span className="text-text-tertiary">
            Decision support for the Ministry of Steel and MOIL Ltd · SIH26009
          </span>
        </nav>
      </div>
    </footer>
  )
}
