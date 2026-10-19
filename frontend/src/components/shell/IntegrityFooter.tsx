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
 *
 * Laid out as the design reference's site footer (footer.site, .fcols):
 * columns headed by eyebrows, a 1px top line, captions along the bottom.
 */
const LINK =
  'text-[15px] tracking-[0.03em] text-text-secondary transition-[color] duration-[180ms] ease-out hover:text-text-primary'

export default function IntegrityFooter() {
  return (
    <footer className="mt-24 border-t border-border-default">
      <div className="mx-auto max-w-[1280px] px-4 pb-8 pt-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="measure space-y-2 text-sm text-text-secondary">
            <p className="label mb-3">Integrity</p>
            <p>
              <strong className="font-normal text-text-primary">Guardrails.</strong> No subsurface
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

          <nav aria-label="Footer" className="grid content-start gap-2">
            <p className="label mb-1">Project</p>
            <Link href="/about" className={LINK}>
              About
            </Link>
            <Link href="/method" className={LINK}>
              Method &amp; evidence
            </Link>
          </nav>
        </div>

        <div className="mt-12 flex flex-wrap justify-between gap-x-6 gap-y-2 border-t border-border-default pt-6">
          <span className="t-caption">
            Decision support for the Ministry of Steel and MOIL Ltd · SIH26009
          </span>
          <span className="t-caption">Nakshatra&#8209;X</span>
        </div>
      </div>
    </footer>
  )
}
