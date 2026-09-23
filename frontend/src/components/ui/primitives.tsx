/**
 * Nakshatra-X UI primitives.
 *
 * These replace the three parallel component vocabularies the audit found
 * (components/ui, components/nakshatra/ui.tsx, and bespoke markup inside
 * mission-control). Every primitive draws from tokens only — no primitive
 * declares a colour, and none of them animate beyond the motion inventory in
 * docs/DESIGN_SYSTEM.md section 7.4.
 */
import clsx from 'clsx'
import type { ReactNode, ButtonHTMLAttributes, HTMLAttributes } from 'react'

/* -------------------------------------------------------------------------- */
/* Button                                                                      */
/* -------------------------------------------------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md'

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium ' +
  'transition-colors duration-[120ms] ease-out ' +
  'disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none'

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  // One primary action per view. The accent is not decoration.
  primary: 'bg-accent text-surface-0 hover:bg-accent/90',
  secondary:
    'bg-surface-2 text-text-primary border border-border-interactive hover:bg-surface-3',
  ghost: 'text-text-secondary hover:bg-surface-2 hover:text-text-primary',
}

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-base',
}

export function Button({
  variant = 'secondary',
  size = 'sm',
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}) {
  return (
    <button
      type={type}
      className={clsx(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], className)}
      {...props}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* Card — elevation by surface value, never by shadow or glow                  */
/* -------------------------------------------------------------------------- */

export function Card({
  className,
  interactive = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={clsx(
        'rounded-md border border-border-default bg-surface-2',
        interactive &&
          'transition-colors duration-[120ms] ease-out hover:bg-surface-3 ' +
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

/* -------------------------------------------------------------------------- */
/* Badge — a quiet marker. Never used to claim liveness.                       */
/* -------------------------------------------------------------------------- */

export function Badge({
  className,
  tone = 'neutral',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: 'neutral' | 'accent' }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-xs',
        tone === 'accent'
          ? 'border-accent/40 bg-accent-muted text-accent'
          : 'border-border-default bg-surface-1 text-text-tertiary',
        className
      )}
      {...props}
    />
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
        'flex flex-col items-start gap-2 rounded-md border border-dashed border-border-default px-4 py-6',
        className
      )}
    >
      <p className="text-sm font-medium text-text-secondary">{title}</p>
      {detail ? <p className="measure text-sm text-text-tertiary">{detail}</p> : null}
      {action}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Page scaffolding                                                            */
/* -------------------------------------------------------------------------- */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-border-subtle pb-5 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl">{title}</h1>
        {description ? (
          <p className="measure mt-1 text-sm text-text-secondary">{description}</p>
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
