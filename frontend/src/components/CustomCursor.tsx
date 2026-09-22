'use client'

import { useEffect, useRef, useState } from 'react'

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const mouseRef = useRef({ x: 0, y: 0 })
  const ringPosRef = useRef({ x: 0, y: 0 })
  const [visible, setVisible] = useState(false)
  const activeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const dot = dotRef.current
    const ring = ringRef.current
    if (!dot || !ring) return

    mouseRef.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    ringPosRef.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 }

    const ringEl: HTMLDivElement = ring
    const dotEl: HTMLDivElement = dot

    function triggerActive() {
      ringEl.classList.add('active')
      if (activeTimeoutRef.current) clearTimeout(activeTimeoutRef.current)
      activeTimeoutRef.current = setTimeout(
        () => ringEl.classList.remove('active'),
        160
      )
    }

    function onMouseMove(e: MouseEvent) {
      mouseRef.current = { x: e.clientX, y: e.clientY }
      setVisible(true)
      triggerActive()
    }

    function onMouseLeave() {
      setVisible(false)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseleave', onMouseLeave)
    window.addEventListener('scroll', triggerActive, { passive: true })

    let rafId: number
    function animate() {
      const { x: mx, y: my } = mouseRef.current
      ringPosRef.current.x += (mx - ringPosRef.current.x) * 0.16
      ringPosRef.current.y += (my - ringPosRef.current.y) * 0.16

      dotEl.style.transform = `translate3d(${mx}px, ${my}px, 0) translate(-50%, -50%)`
      ringEl.style.transform = `translate3d(${ringPosRef.current.x}px, ${ringPosRef.current.y}px, 0) translate(-50%, -50%)`

      rafId = requestAnimationFrame(animate)
    }
    rafId = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
      window.removeEventListener('scroll', triggerActive)
      cancelAnimationFrame(rafId)
      if (activeTimeoutRef.current) clearTimeout(activeTimeoutRef.current)
    }
  }, [])

  return (
    <>
      <div
        ref={dotRef}
        className="cursor-dot"
        style={{ opacity: visible ? 1 : 0 }}
      />
      <div
        ref={ringRef}
        className="cursor-ring"
        style={{ opacity: visible ? 1 : 0 }}
      />
    </>
  )
}
