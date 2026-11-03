'use client'

import { useEffect, useState } from 'react'
import { type MineRow, fetchMines } from '@/lib/console-api'
import type { MineInfo } from './types'

/**
 * The mine register, as the selectors read it: FastAPI's, through the
 * /api/v1/mines proxy, and nothing else.
 *
 * WHAT THIS REPLACED. /blending, /method and /mine-twin chose a mine from
 * `FALLBACK_MINES`, a register of one (Balaghat) typed into
 * mission-control/data.ts with a plan target and a current production figure.
 * MineTwinPanel kept a second copy as its default, the Track A map a third,
 * and the mine-twin route validated scenarios against the first. So these
 * pages offered one mine of ten, and with the service layer down they still
 * offered it, under a register that could not be read. `npm run
 * lint:mine-register` now fails if any file in src/ defines a mine.
 */

export type MineRegister =
  | { status: 'loading' }
  | { status: 'ok'; mines: MineInfo[] }
  | { status: 'unavailable'; reason: string }

const STATE_ABBREV: Record<string, string> = {
  'Madhya Pradesh': 'MP',
  Maharashtra: 'MH',
}

/** One register row, in the shape the selecting pages hold. */
export function mineInfoFromRow(row: MineRow): MineInfo {
  return {
    id: String(row.id),
    numericId: row.id,
    name: row.name,
    code: row.mine_code,
    state: STATE_ABBREV[row.state] ?? row.state,
    lat: row.latitude,
    lng: row.longitude,
  }
}

/**
 * Fetch the register once. While it loads, and when it cannot be read, there
 * is no mine to select: callers preselect nothing and say why.
 */
export function useMineRegister(): MineRegister {
  const [register, setRegister] = useState<MineRegister>({ status: 'loading' })
  useEffect(() => {
    let alive = true
    fetchMines().then((r) => {
      if (!alive) return
      if (!r.ok) setRegister({ status: 'unavailable', reason: r.error })
      else if (!r.data.length) setRegister({ status: 'unavailable', reason: 'The register returned no mines.' })
      else setRegister({ status: 'ok', mines: r.data.map(mineInfoFromRow) })
    })
    return () => {
      alive = false
    }
  }, [])
  return register
}

/**
 * The selected mine: the one chosen, else the register's first. Null whenever
 * there is no register, so nothing is preselected from anywhere else.
 */
export function selectedFrom(register: MineRegister, chosenId: string | null): MineInfo | null {
  if (register.status !== 'ok') return null
  return register.mines.find((m) => m.id === chosenId) ?? register.mines[0] ?? null
}
