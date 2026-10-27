/**
 * Motion constants for GSAP, from the design reference (mapping §1.7):
 * "fast out, long settle". The same curves and durations tokens.css gives CSS.
 *
 * Used by the landing page only. Product routes animate nothing beyond CSS
 * colour feedback and the 180ms disclosures in DESIGN_SYSTEM.md section 7.
 */
import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

gsap.registerPlugin(CustomEase)

/** --ease-out: hovers, reveals. The default. */
export const EASE_OUT = CustomEase.create('nx-ease-out', '0.2,0.715,0.205,0.99')

/** Seconds, for GSAP: --dur-fast, --dur, --dur-slow. */
export const DUR = { fast: 0.18, standard: 0.36, slow: 0.7 } as const

/** Between items of one group. Short enough that a group is whole within 0.3s. */
export const STAGGER = 0.06
