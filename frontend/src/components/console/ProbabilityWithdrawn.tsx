import { DOCS_BASE, P_SHORTFALL_WITHDRAWN as W } from '@/lib/calibration'

/**
 * Where P(shortfall) used to be: what happened to it, and no number.
 *
 * Hidden rather than labelled (docs/DECISIONS.md D-044). The slot says so in
 * words, so someone who has seen an earlier screen, or reads the PRD's B-6,
 * finds out why the figure is missing instead of wondering whether it failed
 * to load.
 */
export function ProbabilityWithdrawn({ variant }: { variant: 'tile' | 'line' }) {
  const link = (
    <a
      href={`${DOCS_BASE}${W.doc}`}
      target="_blank"
      rel="noopener noreferrer"
      className="underline decoration-dotted underline-offset-2 hover:text-text-secondary"
    >
      {W.linkText}
    </a>
  )

  if (variant === 'line') {
    return (
      <p className="measure text-xs text-text-tertiary" data-testid="p-withdrawn">
        {W.title}. {W.detail} {link}.
      </p>
    )
  }

  return (
    <div
      className="rounded-md border border-dashed border-border-default bg-surface-1 p-3"
      data-testid="p-withdrawn"
    >
      <span className="label">Probability of shortfall</span>
      <p className="mt-1 text-sm text-text-secondary">Withdrawn while under validation</p>
      <p className="mt-1 text-xs leading-snug text-text-tertiary">
        {W.detail} {link}.
      </p>
    </div>
  )
}
