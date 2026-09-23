/**
 * Sequential colormap — cividis.
 *
 * THIS IS THE ONE FILE PERMITTED TO CONTAIN COLOUR LITERALS outside
 * `src/app/tokens.css`. A colormap is data, not theme: these nine stops are a
 * published, peer-reviewed artefact rather than a design choice, so they are
 * reproduced verbatim instead of being expressed as tokens.
 *
 * Sampled from matplotlib 3.11.2 at nine equal stops.
 *
 * Why cividis (see docs/DECISIONS.md D-027):
 *   - Perceptually uniform: equal steps in the data read as equal steps in
 *     colour, so the eye does not invent structure the data lacks.
 *   - Optimised for colour vision deficiency — viewers with and without CVD
 *     interpret it near-identically.
 *   - Relative luminance increases strictly across every stop, so it survives
 *     greyscale and print.
 *
 * Never use a rainbow or jet ramp. Their bright bands read as high values
 * regardless of where they fall in the data.
 */

export const CIVIDIS = [
  '#00224E',
  '#1A386F',
  '#434E6C',
  '#61656F',
  '#7D7C78',
  '#9B9476',
  '#BCAE6C',
  '#DEC958',
  '#FEE838',
] as const

/** Relative luminance of each stop, for the contrast decision below. */
const LUMINANCE = [0.0169, 0.042, 0.0772, 0.13, 0.2013, 0.2946, 0.4205, 0.5801, 0.7907]

function clamp01(t: number): number {
  if (Number.isNaN(t)) return 0
  return Math.min(1, Math.max(0, t))
}

/**
 * Colour for a normalised value in [0, 1]. Nearest stop — deliberately not
 * interpolated, so a rendered colour is always one of the nine published values
 * and a legend can enumerate them exactly.
 */
export function cividis(t: number): string {
  const i = Math.round(clamp01(t) * (CIVIDIS.length - 1))
  return CIVIDIS[i]
}

/**
 * Text colour that meets contrast against `cividis(t)` as a background.
 * The ramp crosses from dark to light, so the readable foreground flips.
 */
export function cividisContrastText(t: number): string {
  const i = Math.round(clamp01(t) * (CIVIDIS.length - 1))
  return LUMINANCE[i] > 0.23 ? 'var(--color-surface-0)' : 'var(--color-text-primary)'
}
