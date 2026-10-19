/**
 * Shared chart styling. Every chart sits in a DATA_WELL (components/ui/
 * primitives.tsx), a .chrome-dark scope, so these resolve to the well's dark
 * tokens. Series colours are the data roles in tokens.css ("Data"), chosen by
 * what a series is, never by its position.
 */
import type { CSSProperties } from 'react'

/** Axis ticks: --p-ui-text on the well, 9.01:1. */
export const AXIS_TICK = { fontSize: 12, fill: 'var(--color-data-axis)' } as const

export const GRID_STROKE = 'var(--color-data-grid)'

/** Tooltip: one step darker than the well, with its strong line. */
export const TOOLTIP_STYLE: CSSProperties = {
  background: 'var(--color-surface-0)',
  border: '1px solid var(--color-border-strong)',
  borderRadius: 8,
  fontSize: 13,
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--color-text-primary)',
}

export const TOOLTIP_LABEL_STYLE: CSSProperties = { color: 'var(--color-text-secondary)' }

/** The hover column behind a bar: Recharts' default is a light grey block. */
export const BAR_CURSOR = { fill: 'var(--color-data-grid)' } as const

/** The hover rule on a line chart. */
export const LINE_CURSOR = { stroke: 'var(--color-border-strong)' } as const
