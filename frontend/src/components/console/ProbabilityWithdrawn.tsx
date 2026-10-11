import { DOCS_BASE, P_SHORTFALL_WITHDRAWN as W } from '@/lib/calibration'

/**
 * Where P(shortfall) used to be: what happened to it, and no number.
 *
 * Hidden rather than labelled (docs/DECISIONS.md D-044). The slot says so in
 * words, so someone who has seen an earlier screen, or reads the PRD's B-6,
 * finds out why the figure is missing instead of wondering whether it failed
 * to load.
 */
export function ProbabilityWithdrawn({ variant }: { variant: 'note' | 'line' }) {
  const link = (
    <a
      href={`${DOCS_BASE}${W.doc}`}
      target="_blank"
      rel="noopener noreferrer"
      className="underline decoration-dotted underline-offset-2 hover:text-text-primary"
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

  /*
   * Under the expected shortfall, as an annotation of it.
   *
   * It was a fourth tile, the same size as the figures beside it, with a
   * dashed border and 11-12 px text — the shape of a tile that failed to load
   * (POLISH_AUDIT.md issue 2). The space P left is now a stated decision
   * attached to the number it would have qualified.
   */
  return (
    <div className="border-t border-border-default pt-3 text-sm leading-snug" data-testid="p-withdrawn">
      <p className="text-text-secondary">
        <span className="text-text-primary">{W.title}.</span> {W.detail} {link}.
      </p>
    </div>
  )
}
