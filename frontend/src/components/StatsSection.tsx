'use client'

import { useRef, useEffect, useState } from 'react'
import { motion, useInView, animate } from 'framer-motion'
import { MINES, TOTAL_MONTHLY_TARGET, } from '@/app/lib/mines'

const STATS = [
  { label: 'Active Mines', value: MINES.length, suffix: '' },
  { label: 'States Covered', value: 2, suffix: '' },
  { label: 'Monthly Target', value: TOTAL_MONTHLY_TARGET, suffix: 't' },
  { label: 'Reserve Accuracy', value: 96.4, suffix: '%', decimals: 1 },
]

function AnimatedNumber({
  value,
  suffix = '',
  decimals = 0,
}: {
  value: number
  suffix?: string
  decimals?: number
}) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  useEffect(() => {
    if (!isInView) return
    const controls = animate(0, value, {
      duration: 2,
      ease: 'easeOut',
      onUpdate(v: number) {
        setDisplay(
          decimals > 0 ? parseFloat(v.toFixed(decimals)) : Math.round(v)
        )
      },
    })
    return () => controls.stop()
  }, [isInView, value, decimals])

  return (
    <span ref={ref} className="stat-number">
      {display.toLocaleString()}
      {suffix}
    </span>
  )
}

export default function StatsSection() {
  const sectionRef = useRef(null)
  const isInView = useInView(sectionRef, { once: true, margin: '-80px' })

  return (
    <section ref={sectionRef} className="stats-section">
      <motion.div
        className="stats-container"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 0.8 }}
      >
        {STATS.map((stat, i) => (
          <motion.div
            key={i}
            className="stat-item"
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: i * 0.15 }}
          >
            <AnimatedNumber
              value={stat.value}
              suffix={stat.suffix}
              decimals={stat.decimals || 0}
            />
            <span className="stat-label">{stat.label}</span>
          </motion.div>
        ))}
      </motion.div>
    </section>
  )
}
