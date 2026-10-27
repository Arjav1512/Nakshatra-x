/**
 * Nakshatra-X UI primitives.
 *
 * These replace the three parallel component vocabularies the audit found
 * (components/ui, components/nakshatra/ui.tsx, and bespoke markup inside
 * mission-control). Every primitive draws from tokens only — no primitive
 * declares a colour, and none of them animate beyond the motion inventory in
 * docs/design/DESIGN_SYSTEM.md section 7.4.
 *
 * Each one is the design reference's component of the same job, mapped in
 * docs/ui-redesign/design-system-mapping.md §2 and §4.6: .btn, .tag, .seg,
 * .switch, .field/.input, .sec-head, .mcard.
 */
import clsx from 'clsx'
import Link from 'next/link'
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

/* -------------------------------------------------------------------------- */
/* Button — reference .btn                                                     */
/* -------------------------------------------------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'accent'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

/**
 * One regular weight and +0.044em tracking, as the reference's interface role.
 * Colour changes and the press scale run 180ms on the reference's ease-out;
 * the scale is a press response, not a hover effect, and transforms nothing
 * around the button.
 */
const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-normal tracking-[0.044em] ' +
  'transition-[background-color,color,scale] duration-[180ms] ease-out active:scale-[.97] ' +
  'disabled:opacity-35 disabled:cursor-not-allowed disabled:pointer-events-none'

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  // The reference's primary is the inverse pair: ink fill, paper label.
  primary: 'bg-inverse-bg text-inverse-fg hover:bg-inverse-hover',
  secondary: 'bg-surface-2 text-text-primary hover:bg-surface-3',
  // Reference ghost hovers to --tint (2%), which is invisible on --bg; one
  // surface step instead (mapping §5).
  ghost: 'bg-transparent text-text-primary hover:bg-surface-2',
  // Mint with ink: the one accent per view. Never more than one on a screen.
  accent: 'bg-highlight text-highlight-fg hover:bg-highlight/80',
}

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 rounded-sm px-3 text-[14px]',
  md: 'h-[42px] rounded-md px-4 text-base',
  lg: 'h-[50px] rounded-md px-[22px] text-base',
  icon: 'h-[42px] w-[42px] rounded-full p-0',
}

/** Class string for a link that looks like a button (Next <Link>, <a>). */
export function buttonClass(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'md',
  extra?: string
) {
  return clsx(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], extra)
}

export function Button({
  variant = 'secondary',
  size = 'sm',
  pill = false,
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  pill?: boolean
}) {
  return (
    <button
      type={type}
      className={clsx(
        BUTTON_BASE,
        BUTTON_VARIANT[variant],
        BUTTON_SIZE[size],
        pill && 'rounded-pill px-6',
        className
      )}
      {...props}
    />
  )
}

/**
 * Text roll (reference .slide): the label rolls up to an identical copy on
 * hover. Landing-page calls to action only. The copy is aria-hidden, so it is
 * announced once; reduced motion turns the roll off.
 */
export function RollLabel({ children }: { children: string }) {
  return (
    <span className="slide">
      <span>{children}</span>
      <span aria-hidden="true">{children}</span>
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Card — reference .mcard / .rule: flat, a tone step and a 1px line           */
/* -------------------------------------------------------------------------- */

export function Card({
  className,
  interactive = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={clsx(
        'rounded-xl border border-border-default bg-surface-1',
        interactive &&
          'transition-[background-color,border-color] duration-[180ms] ease-out hover:bg-surface-2 ' +
            'focus-within:border-border-interactive',
        className
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('border-b border-border-subtle px-4 py-3', className)} {...props} />
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('px-4 py-3', className)} {...props} />
}

/* -------------------------------------------------------------------------- */
/* Status                                                                      */
/* -------------------------------------------------------------------------- */

export type Status = 'nominal' | 'caution' | 'critical' | 'unknown'

const STATUS_COLOR: Record<Status, string> = {
  nominal: 'bg-status-nominal',
  caution: 'bg-status-caution',
  critical: 'bg-status-critical',
  unknown: 'bg-status-unknown',
}

/**
 * Colour is never the only channel. Each status carries a distinct SHAPE as
 * well as a hue, and callers must supply a text label alongside. That pairing
 * — not the choice of hue — is what makes the palette safe for colour vision
 * deficiency, and it survives greyscale.
 *
 *   nominal  circle    caution  triangle    critical  square    unknown  ring
 */
const STATUS_SHAPE: Record<Status, string> = {
  nominal: 'rounded-full',
  caution: '[clip-path:polygon(50%_0,100%_100%,0_100%)]',
  critical: 'rounded-[1px]',
  unknown: 'rounded-full border border-status-unknown bg-transparent',
}

export function StatusDot({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={clsx('inline-block h-2.5 w-2.5 shrink-0', STATUS_COLOR[status], STATUS_SHAPE[status], className)}
    />
  )
}

/** A status with its mandatory text label. Prefer this over a bare StatusDot. */
export function StatusLabel({
  status,
  children,
  className,
}: {
  status: Status
  children: ReactNode
  className?: string
}) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-sm text-text-secondary', className)}>
      <StatusDot status={status} />
      {children}
    </span>
  )
}

/** A 0-100 composite risk score as a status and its label. */
export function riskBand(score: number): { status: Status; label: string } {
  if (score >= 70) return { status: 'critical', label: 'high' }
  if (score >= 40) return { status: 'caution', label: 'elevated' }
  return { status: 'nominal', label: 'low' }
}

/* -------------------------------------------------------------------------- */
/* Tag and Badge — reference .tag. A quiet marker; never used to claim liveness */
/* -------------------------------------------------------------------------- */

const TAG_TONE = {
  neutral: 'bg-surface-2 text-text-secondary',
  strong: 'bg-surface-3 text-text-primary',
  // .tag.new: mint with ink. The one accent per view.
  highlight: 'bg-highlight text-highlight-fg',
} as const

export function Tag({
  tone = 'neutral',
  pill = false,
  dot,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: keyof typeof TAG_TONE
  pill?: boolean
  /** A status shape before the text. The text still says the status. */
  dot?: Status
}) {
  return (
    <span
      className={clsx(
        'inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap px-2.5 text-sm tracking-[0.044em]',
        pill ? 'rounded-pill' : 'rounded-sm',
        TAG_TONE[tone],
        className
      )}
      {...props}
    >
      {dot ? <StatusDot status={dot} className="h-1.5 w-1.5" /> : null}
      {children}
    </span>
  )
}

export function Badge({
  className,
  tone = 'neutral',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: 'neutral' | 'accent' }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs tracking-[0.044em]',
        tone === 'accent'
          ? 'bg-accent-muted text-text-primary'
          : 'bg-surface-2 text-text-secondary',
        className
      )}
      {...props}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* Segmented control — reference .seg                                          */
/* -------------------------------------------------------------------------- */

export type SegmentedOption<T extends string | number> = {
  value: T
  label: ReactNode
  /** Accessible name when the visible label is abbreviated. */
  title?: string
}

/**
 * A row of mutually exclusive choices. Buttons with aria-pressed inside a
 * labelled group, as the reference builds it; the selected one is a paper
 * chip on the grey track. Wraps rather than scrolls, so no choice is ever
 * hidden at 375px.
 */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    // A fieldset, the semantic element for a group of controls; its legend is
    // the group's accessible name. min-w-0 and m-0 undo the fieldset defaults.
    <fieldset
      className={clsx('m-0 inline-flex min-w-0 flex-wrap gap-0.5 rounded-md border-0 bg-surface-2 p-[3px]', className)}
    >
      <legend className="sr-only">{label}</legend>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={on}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={clsx(
              'inline-flex h-[34px] items-center gap-1.5 rounded-sm px-3.5 text-[14px] tracking-[0.044em] ' +
                'transition-[background-color,color] duration-[180ms] ease-out',
              on
                ? 'bg-surface-0 text-text-primary ring-1 ring-border-default'
                : 'text-text-secondary hover:text-text-primary'
            )}
          >
            {o.label}
          </button>
        )
      })}
    </fieldset>
  )
}

/* -------------------------------------------------------------------------- */
/* Switch — reference .switch                                                  */
/* -------------------------------------------------------------------------- */

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  /** Accessible name. Render a visible label beside it as well. */
  label: string
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative h-6 w-10 shrink-0 rounded-pill transition-[background-color] duration-[180ms] ease-out',
        'disabled:cursor-not-allowed disabled:opacity-35',
        checked ? 'bg-inverse-bg' : 'bg-surface-3 ring-1 ring-inset ring-border-interactive',
        className
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          'absolute left-[3px] top-[3px] h-[18px] w-[18px] rounded-full transition-[translate] duration-[180ms] ease-out',
          checked ? 'translate-x-4 bg-inverse-fg' : 'bg-surface-0'
        )}
      />
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/* Data well and source fills                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The dark ground every chart sits on: the reference's media well (.feature
 * .media, .stage) as a .chrome-dark scope, so the text, grid and tooltip
 * inside resolve to the dark tokens and the series can use the reference
 * brights (tokens.css, "Data"). Add the radius at the call site: the card's
 * own radius when the well is the card, `rounded-tile` when it is nested.
 */
export const DATA_WELL = 'chrome-dark border border-border-default bg-surface-1 text-text-primary'

/**
 * Reference brights as tag fills (tokens.css, "Fills"): a tint with ink on
 * light surfaces, the full bright inside .chrome-dark. Keyed by hue; callers
 * choose by meaning (green measured or live, mint derived, yellow synthetic
 * or cached) and the label always names it.
 */
export const FILL = {
  green: 'border-transparent bg-fill-green text-on-fill',
  mint: 'border-transparent bg-fill-mint text-on-fill',
  yellow: 'border-transparent bg-fill-yellow text-on-fill',
} as const

/* -------------------------------------------------------------------------- */
/* Field — reference .field + .input                                           */
/* -------------------------------------------------------------------------- */

/**
 * The input itself. 46px, --r-md, a 3:1 boundary (mapping §5.1) that turns to
 * ink on focus; the global focus ring still draws for keyboard users.
 */
export const INPUT_CLASS =
  'h-[46px] w-full rounded-md border border-border-interactive bg-surface-0 px-3.5 text-base ' +
  'tracking-[0.02em] text-text-primary transition-[border-color] duration-[180ms] ease-out ' +
  'focus:border-text-primary disabled:opacity-35'

/** A compact input for dense panels (forms inside cards and tables). */
export const INPUT_SM_CLASS =
  'h-9 rounded-md border border-border-interactive bg-surface-0 px-3 text-sm ' +
  'tracking-[0.02em] text-text-primary transition-[border-color] duration-[180ms] ease-out ' +
  'focus:border-text-primary disabled:opacity-35'

export const FIELD_LABEL_CLASS = 'text-sm tracking-[0.044em] text-text-secondary'

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string
  htmlFor: string
  hint?: string
  error?: string | null
  children: ReactNode
  className?: string
}) {
  return (
    <div className={clsx('grid gap-1.5', className)}>
      <label htmlFor={htmlFor} className={FIELD_LABEL_CLASS}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-status-critical">{error}</p>
      ) : hint ? (
        <p className="text-sm text-text-tertiary">{hint}</p>
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Loading and empty states                                                    */
/* -------------------------------------------------------------------------- */

/** Skeleton, not a spinner over existing content. Static under reduced motion. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={clsx('animate-pulse rounded-sm bg-surface-3', className)}
    />
  )
}

/**
 * An empty state states why it is empty. It never renders a zero, which would
 * imply a measured value of zero.
 */
export function EmptyState({
  title,
  detail,
  action,
  className,
}: {
  title: string
  detail?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={clsx(
        'flex flex-col items-start gap-2 rounded-xl border border-dashed border-border-strong bg-surface-1 px-5 py-6',
        className
      )}
    >
      <p className="text-base text-text-primary">{title}</p>
      {detail ? <p className="measure text-sm text-text-secondary">{detail}</p> : null}
      {action}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Page scaffolding — reference .sec-head                                      */
/* -------------------------------------------------------------------------- */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="label">{eyebrow}</p> : null}
        <h1 className={clsx('font-display text-4xl md:text-5xl', eyebrow && 'mt-3')}>{title}</h1>
        {description ? (
          <p className="measure mt-4 text-lg text-text-secondary">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  )
}

export function Section({
  title,
  children,
  className,
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={clsx('mt-8', className)}>
      {title ? <h2 className="label mb-3">{title}</h2> : null}
      {children}
    </section>
  )
}

/**
 * The context a calculator page works on: which mine. Shared by the method,
 * blending and scenario pages, which each carried their own copy of a pill
 * row with a gradient selected state.
 */
export function MineSwitcher<T extends { id: number | string; name: string; state?: string }>({
  mines,
  selectedId,
  onSelect,
}: {
  mines: T[]
  selectedId: T['id']
  onSelect: (mine: T) => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border-default bg-surface-1 p-4 lg:flex-row lg:items-center lg:gap-5">
      <p className="label shrink-0" aria-hidden="true">
        Mine
      </p>
      <Segmented
        label="Mine"
        value={selectedId}
        onChange={(id) => {
          const m = mines.find((x) => x.id === id)
          if (m) onSelect(m)
        }}
        options={mines.map((m) => ({
          value: m.id,
          label: (
            <>
              {m.name}
              {m.state ? <span className="text-text-tertiary">{m.state}</span> : null}
            </>
          ),
        }))}
      />
    </div>
  )
}

/**
 * Where to go next, at the foot of a page. Replaces the "Page N:" bars whose
 * labels named screens that no longer exist. Each label says what is there.
 */
export function PageNav({
  links,
}: {
  links: { href: string; label: string; detail?: string }[]
}) {
  return (
    <nav
      aria-label="Related pages"
      className="grid gap-3 border-t border-border-default pt-8 sm:grid-cols-2 lg:grid-cols-3"
    >
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="group flex flex-col gap-1 rounded-xl border border-border-default bg-surface-1 p-5 transition-[background-color] duration-[180ms] ease-out hover:bg-surface-2"
        >
          <span className="inline-flex items-center gap-1.5 text-base tracking-[0.044em] text-text-primary">
            {l.label}
            <span aria-hidden="true" className="link-arrow">
              ↗
            </span>
          </span>
          {l.detail ? <span className="text-sm text-text-secondary">{l.detail}</span> : null}
        </Link>
      ))}
    </nav>
  )
}
