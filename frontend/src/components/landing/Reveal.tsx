'use client'

import { type ReactNode, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { DUR, EASE_OUT, STAGGER } from '@/lib/motion'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/**
 * A landing-page section that settles in once, as it is scrolled to.
 *
 * The items marked `data-reveal` rise 16px and fade in over the reference's
 * 700ms "long settle", 60ms apart, once. That is the whole effect.
 *
 * What it may never do (DESIGN_SYSTEM.md §7, tools/e2e-motion.js):
 *   - hide content. Everything is in the server-rendered HTML at full opacity;
 *     the start state is applied only when the trigger fires
 *     (`immediateRender: false`), and a section already on screen when the
 *     script runs is left alone, so nothing visible blinks out on hydration;
 *   - move layout. Opacity and transform only;
 *   - loop, scrub, pin or take over the scroll;
 *   - run under prefers-reduced-motion.
 * Figures inside are never animated as numbers: they fade with their card,
 * already at their value.
 */
export function Reveal({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const root = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const el = root.current
      if (!el) return
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // Already in view when the page became interactive: leave it be.
        if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return
        const items = gsap.utils.toArray<HTMLElement>('[data-reveal]', el)
        if (!items.length) return
        gsap.from(items, {
          opacity: 0,
          y: 16,
          duration: DUR.slow,
          ease: EASE_OUT,
          stagger: STAGGER,
          immediateRender: false,
          clearProps: 'opacity,transform',
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        })
      })
      return () => mm.revert()
    },
    { scope: root }
  )

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  )
}
