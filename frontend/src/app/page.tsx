import Link from 'next/link'
import { Card, CardBody } from '@/components/ui/primitives'
import { loadLandingEvidence } from '@/lib/landing-evidence'

/**
 * Landing page.
 *
 * This is a server component and renders its content in the HTML. The previous
 * version mounted both of its children with `ssr: false` (audit A-6), so the
 * document contained an empty <main> and the first paint was a video poster.
 *
 * The previous hero asserted "LIVE SATELLITE TELEMETRY ACTIVE", "LIVE TELEMETRY
 * STREAM", "10 Active MOIL Mining Sites" and "ISRO MOSDAC / BHUVAN ACTIVE" as
 * hardcoded strings backed by nothing. Stage 1 removed all of it and left the
 * page with no numbers, which was honest but said less than the work supports.
 *
 * The numbers here are read from the backend at request time — the same
 * artifacts the console renders, so the two screens cannot disagree — and each
 * carries its model version and vintage. None is a literal in this file. If an
 * artifact cannot be read, the band says so and shows no figure.
 */

export const metadata = {
  title: 'Nakshatra-X — decision support for MOIL',
}

const TRACKS = [
  {
    name: 'Track A · Reserve prospectivity',
    horizon: 'Years',
    body:
      'Ranks where to prospect across the Central India manganese corridor, from surface geology ' +
      'and terrain. Scores carry a per-cell uncertainty from ordinary kriging and are validated ' +
      'leave-one-mine-out, so a score is never reported without the spread around it.',
  },
  {
    name: 'Track B · Production shortfall',
    horizon: 'Days to months',
    body:
      'Forecasts production against target per mine, with conformalised prediction intervals and ' +
      'a rolling-origin backtest against a seasonal-naive baseline. Recommended actions are ' +
      'checked against operating constraints before they are shown.',
  },
]

const LIMITS = [
  'No subsurface ore detection from satellite. The named inputs are surface and atmospheric only.',
  'No statutory UNFC reserve figures. Outputs are decision support for a qualified person.',
  'Constraints are enforced, never learned.',
  'Stale or missing sources are stated, never silently extrapolated.',
]

export default async function HomePage() {
  const evidence = await loadLandingEvidence()

  return (
    <main className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
      {/* Hero — typographic. No scroll-scrubbed video, no badges, no counters. */}
      <section className="border-b border-border-subtle py-16 sm:py-24">
        <p className="label">Ministry of Steel · MOIL Ltd · SIH26009</p>
        <h1 className="measure mt-4 text-3xl font-semibold tracking-tight">
          Where to prospect, and what production will fall short.
        </h1>
        <p className="measure mt-4 text-lg text-text-secondary">
          Nakshatra-X is a decision-support tool for manganese operations. It answers two questions
          on two different clocks, and it shows the uncertainty and the source behind every number
          it reports.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/console"
            className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-4 text-base font-medium text-surface-0 transition-colors duration-[120ms] ease-out hover:bg-accent/90"
          >
            Open the console
          </Link>
          <Link
            href="/method"
            className="inline-flex h-10 items-center justify-center rounded-md border border-border-interactive bg-surface-2 px-4 text-base font-medium text-text-primary transition-colors duration-[120ms] ease-out hover:bg-surface-3"
          >
            Method and evidence
          </Link>
        </div>
      </section>

      {/* Two tracks */}
      <section className="py-12 sm:py-16">
        <h2 className="label">Two tracks</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {TRACKS.map((t) => (
            <Card key={t.name}>
              <CardBody className="p-5">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-lg font-semibold">{t.name}</h3>
                  <span className="label shrink-0">{t.horizon}</span>
                </div>
                <p className="mt-3 text-sm text-text-secondary">{t.body}</p>
              </CardBody>
            </Card>
          ))}
        </div>
        <p className="measure mt-4 text-sm text-text-tertiary">
          The problem statement implies both but names neither. Keeping them separate matters:
          they run on different horizons, use different methods, and fail in different ways.
        </p>
      </section>

      {/* What the model actually scores — every figure read from an artifact */}
      <section className="border-t border-border-subtle py-12 sm:py-16">
        <h2 className="label">What it scores, measured</h2>
        <p className="measure mt-3 text-sm text-text-secondary">
          Held-out accuracy, not training accuracy. These are the figures the console shows for the
          same artifacts; nothing on this page is typed in.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {/* Track B — the pilot mine's rolling-origin backtest */}
          <Card>
            <CardBody className="p-5">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-base font-semibold">Track B · production shortfall</h3>
                <span className="label shrink-0">Held out</span>
              </div>
              {evidence.backtest.ok ? (
                <div
                  className="mt-4"
                  data-provenance="derived"
                  data-provenance-model={evidence.backtest.modelVersion}
                  data-provenance-vintage={evidence.backtest.computedAt ?? undefined}
                >
                  <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                    <span className="font-mono text-3xl tabular-nums text-text-primary">
                      {evidence.backtest.mapePct}%
                    </span>
                    <span className="text-sm text-text-secondary">
                      MAPE, against{' '}
                      <span className="font-mono tabular-nums">
                        {evidence.backtest.baselineMapePct}%
                      </span>{' '}
                      for the seasonal-naive baseline
                    </span>
                  </div>
                  <p className="measure mt-3 text-sm text-text-secondary">
                    Interval coverage{' '}
                    <span className="font-mono tabular-nums">{evidence.backtest.coverage80}</span>{' '}
                    against a nominal{' '}
                    <span className="font-mono tabular-nums">
                      {evidence.backtest.nominalCoverage}
                    </span>
                    .
                  </p>
                  <p className="measure mt-3 text-xs text-text-tertiary">
                    Rolling-origin backtest on the pilot mine,{' '}
                    <strong className="font-medium text-text-secondary">
                      {evidence.backtest.mineName}
                    </strong>{' '}
                    ({evidence.backtest.mineCode}) — the one mine whose backtest artifact is
                    committed, because a full run refits the model at every origin. Model{' '}
                    {evidence.backtest.modelVersion} vs {evidence.backtest.baselineVersion}. Trained
                    on synthetic operational data (PRD §8.2), so this describes the model&rsquo;s
                    behaviour on that dataset, not MOIL&rsquo;s operations.
                  </p>
                  <Link
                    href={`/console?mine=${evidence.backtest.mineId}&track=b`}
                    className="mt-3 inline-block text-sm text-accent hover:underline"
                  >
                    See {evidence.backtest.mineName}&rsquo;s backtest in the console &rarr;
                  </Link>
                </div>
              ) : (
                <p className="mt-4 text-sm text-text-tertiary">
                  {evidence.backtest.reason} No figure is shown in its place.
                </p>
              )}
            </CardBody>
          </Card>

          {/* Track A — leave-one-mine-out */}
          <Card>
            <CardBody className="p-5">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-base font-semibold">Track A · reserve prospectivity</h3>
                <span className="label shrink-0">Leave-one-mine-out</span>
              </div>
              {evidence.trackA.ok ? (
                <div
                  className="mt-4"
                  data-provenance="derived"
                  data-provenance-model={evidence.trackA.modelVersion}
                >
                  <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                    <span className="font-mono text-3xl tabular-nums text-text-primary">
                      {evidence.trackA.auc.toFixed(2)}
                    </span>
                    <span className="text-sm text-text-secondary">
                      AUC, 95% CI{' '}
                      <span className="font-mono tabular-nums">
                        {evidence.trackA.ci[0]}&ndash;{evidence.trackA.ci[1]}
                      </span>
                    </span>
                  </div>
                  <p className="measure mt-3 text-xs text-text-tertiary">
                    {evidence.trackA.validation}, over{' '}
                    <span className="font-mono tabular-nums">{evidence.trackA.nOutOfFold}</span>{' '}
                    out-of-fold points. Model {evidence.trackA.modelVersion}, trained on measured
                    Sentinel-2 band ratios and SRTM terrain. The interval is wide, and it is shown
                    because it is wide.
                  </p>
                  <Link
                    href="/method"
                    className="mt-3 inline-block text-sm text-accent hover:underline"
                  >
                    How this was validated &rarr;
                  </Link>
                </div>
              ) : (
                <p className="mt-4 text-sm text-text-tertiary">
                  {evidence.trackA.reason} No figure is shown in its place.
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </section>

      {/* Limits, stated up front */}
      <section className="border-t border-border-subtle py-12 sm:py-16">
        <h2 className="label">What this does not claim</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {LIMITS.map((l) => (
            <li
              key={l}
              className="border-l border-border-strong pl-4 text-sm text-text-secondary"
            >
              {l}
            </li>
          ))}
        </ul>
        <p className="measure mt-6 text-sm text-text-tertiary">
          Operational data is synthetic, generated to the published ingestion contract, because
          MOIL&rsquo;s records are proprietary. Synthetic values are labelled everywhere they appear
          and are never presented as live.
        </p>
      </section>
    </main>
  )
}
