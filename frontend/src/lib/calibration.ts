/**
 * How the console talks about calibration, and about the figure it withdrew.
 *
 * Shared by the console's calibration panel and the landing page, so the two
 * cannot describe the same interval differently.
 */

/** The repo is public, so a write-up resolves for anyone reading the console. */
export const DOCS_BASE = 'https://github.com/Arjav1512/Nakshatra-x/blob/main/'

/**
 * A coverage figure's verdict, computed from its interval rather than written.
 *
 * It depends on whether the interval excludes nominal: a point estimate below
 * 0.80 whose interval still contains 0.80 is consistent with nominal at that
 * sample size, not miscalibrated.
 */
export function coverageVerdict(
  ci: [number, number],
  nominal: number
): { text: string; short: string; tone: 'caution' | 'neutral' } {
  const [lo, hi] = ci
  if (hi < nominal) {
    return {
      text: 'too narrow — real days fall outside the band more often than it claims',
      short: 'below nominal',
      tone: 'caution',
    }
  }
  if (lo > nominal) {
    return {
      text: 'too wide — the band is more cautious than it needs to be',
      short: 'above nominal',
      tone: 'neutral',
    }
  }
  return {
    text: 'consistent with nominal at this sample size',
    short: 'consistent with nominal',
    tone: 'neutral',
  }
}

/**
 * P(shortfall), withdrawn from the screen (docs/DECISIONS.md D-044).
 *
 * Hidden rather than labelled. The 14-day aggregation it is computed from
 * failed its sanity checks on every dataset D-043 measured — narrower than
 * independent days on some, saturated on others — so there is no direction a
 * reader could correct a labelled figure in. The API still serves it, so the
 * follow-up (D-045) compares against exactly what main computes; it comes back
 * to the console only after a fix passes its pre-registered test.
 */
export const P_SHORTFALL_WITHDRAWN = {
  title: 'Probability of shortfall: withdrawn while under validation',
  detail:
    'Not calibrated. The 14-day aggregation it is computed from failed its sanity ' +
    'checks on every dataset tested, and no fix has passed yet, so no figure is shown.',
  doc: 'docs/QUANTILE_CROSSING.md',
  linkText: 'What was found',
} as const
