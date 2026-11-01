'use client'

import { useId } from 'react'
import { EmptyState } from '@/components/ui/primitives'
import type { MineRegister } from './mine-register'
import type { MineInfo } from './types'

/**
 * Which mine a calculator page works on, chosen from FastAPI's register.
 *
 * Replaces `MineSwitcher`, a row of segmented buttons fed by a hardcoded
 * register of one. With the real register there are ten mines, which a button
 * row wraps onto as many lines as the viewport demands, so its height was
 * unknowable while the register loaded. A select is one height at every width,
 * so the placeholder holds exactly its space. /production uses the same
 * control.
 *
 * Three states, and only the third offers a mine:
 *   - loading: a placeholder of the select's height, with no mine in it;
 *   - unavailable: says the register could not be read, and what that costs
 *     this page. No mine is preselected, from anywhere;
 *   - ok: the register's mines, as it served them.
 */
export function RegisterMineSelect({
  register,
  selected,
  onSelect,
  withoutRegister,
}: {
  register: MineRegister
  selected: MineInfo | null
  onSelect: (mine: MineInfo) => void
  /** What this page cannot show without a mine, for the unavailable state. */
  withoutRegister: string
}) {
  const id = useId()

  if (register.status === 'unavailable') {
    return (
      <EmptyState
        title="Mine register unavailable"
        detail={`${register.reason} No mine is selected, because the register is the only list of mines this system has. ${withoutRegister}`}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border-default bg-surface-1 p-4 lg:flex-row lg:items-center lg:gap-5">
      <label htmlFor={id} className="label shrink-0">
        Mine
      </label>
      {register.status === 'loading' ? (
        <div className="h-[46px] w-full max-w-sm rounded-md bg-surface-2" role="status">
          <span className="sr-only">Loading the mine register</span>
        </div>
      ) : (
        <select
          id={id}
          value={selected?.id ?? ''}
          onChange={(e) => {
            const m = register.mines.find((x) => x.id === e.target.value)
            if (m) onSelect(m)
          }}
          className="h-[46px] w-full max-w-sm rounded-md border border-border-interactive bg-surface-0 px-3.5 text-base tracking-[0.02em] text-text-primary transition-[border-color] duration-[180ms] ease-out hover:border-text-primary focus:border-text-primary"
        >
          {register.mines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} — {m.code}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
