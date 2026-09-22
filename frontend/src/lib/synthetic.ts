/**
 * Deterministic synthetic operational-data generator.
 *
 * Why this exists: MOIL's operational data (per-face production, equipment
 * downtime, blast records) is proprietary and not publicly available. Rather
 * than present invented numbers as observations, Nakshatra-X generates them
 * from an explicit, seeded model and labels every value `is_synthetic: true`.
 *
 * Two hard rules, both enforced by this module:
 *   1. No `Math.random`. Every draw comes from a seeded PRNG, so the same
 *      inputs always produce the same outputs (reproducibility) and a demo
 *      cannot silently change its numbers between two identical requests.
 *   2. Nothing here is ever labelled live. Callers must wrap these values with
 *      `synthetic()` from `./provenance`.
 */

/** Deterministic 32-bit string hash (FNV-1a). */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * mulberry32 — a small, fast, well-distributed seeded PRNG.
 * Returns a function producing uniform values in [0, 1).
 */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A reproducible generator bound to a named stream. */
export class SyntheticStream {
  readonly seedLabel: string
  private rng: () => number

  constructor(seedLabel: string) {
    this.seedLabel = seedLabel
    this.rng = seededRng(hashSeed(seedLabel))
  }

  /** Uniform in [0, 1). */
  uniform(): number {
    return this.rng()
  }

  /** Uniform in [min, max). */
  between(min: number, max: number): number {
    return min + this.rng() * (max - min)
  }

  /** Standard normal via Box-Muller (deterministic given the stream). */
  normal(mean = 0, sd = 1): number {
    const u1 = Math.max(this.rng(), Number.EPSILON)
    const u2 = this.rng()
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    return mean + z * sd
  }

  /** Normal draw clamped to [min, max] — used for bounded physical quantities. */
  boundedNormal(mean: number, sd: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, this.normal(mean, sd)))
  }

  /** Bernoulli trial. */
  chance(p: number): boolean {
    return this.rng() < p
  }
}

/**
 * Stable day bucket (UTC date string). Synthetic operational values are held
 * constant within an operating day so a judge refreshing the page sees a
 * consistent story, and change day-to-day rather than on every request.
 */
export function operatingDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/**
 * Build the canonical seed label for a mine-scoped synthetic stream.
 * Including the day bucket makes values stable per day and reproducible
 * for any given day.
 */
export function mineStream(
  mineId: string,
  channel: string,
  day: string = operatingDay()
): SyntheticStream {
  return new SyntheticStream(`nakshatra-x|${mineId}|${channel}|${day}`)
}

/** Rounding helper that keeps outputs presentable without hiding the model. */
export function round(value: number, dp = 1): number {
  const f = 10 ** dp
  return Math.round(value * f) / f
}

/**
 * Calibration anchors for the synthetic operational model.
 *
 * These are order-of-magnitude figures consistent with MOIL's publicly
 * reported scale (roughly 1.1–1.3 million tonnes of manganese ore per year
 * across ~10 underground/opencast mines). They are NOT MOIL's actual
 * operating figures and are not presented as such — they set the scale of the
 * synthetic model so the demo is physically plausible.
 *
 * Source for scale: MOIL Ltd. public annual production disclosures.
 */
export const SYNTHETIC_CALIBRATION = {
  note:
    'Synthetic operational model. Scale anchored to MOIL public annual production totals; per-mine daily values are generated, not observed.',
  /** Typical equipment availability for underground mining fleets. */
  equipment_availability_pct: { mean: 82, sd: 6, min: 55, max: 95 },
  /** Weekly unplanned downtime hours per mine fleet. */
  weekly_downtime_hours: { mean: 9, sd: 4, min: 0, max: 40 },
  /** Development blasts per week in an underground manganese mine. */
  blasts_per_week: { mean: 10, sd: 2.5, min: 3, max: 18 },
} as const
