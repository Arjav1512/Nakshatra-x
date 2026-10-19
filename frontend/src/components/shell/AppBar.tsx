'use client'

/**
 * The application bar — one navigation model for the whole product.
 * Specification: docs/design/IA.md section 3.
 *
 * Replaces TopBanner, which set `overflow-hidden shrink` on its centre zone and
 * so clipped the navigation at 1280px (audit N-1) and overlapped page content
 * at 375px (N-2). This bar never clips: below 768px the destinations move into
 * a drawer rather than being truncated.
 *
 * Capabilities carried over unchanged: the account menu (UserNav) and the AI-X
 * copilot trigger, which dispatches the same `open-aix-copilot` event that
 * GlobalCopilotWrapper already listens for.
 *
 * Drawn as the design reference's floating nav (.nav): a translucent bar over
 * an 18px blur, 1px line, 16px radius, sticky with the page visible around it.
 * Its total height is 56px below md — the sticky mobile summary and section
 * tabs on the console are offset against exactly that — and 68px from md.
 */

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { Bot, ChevronDown, Menu, X } from 'lucide-react'
import { UserNav } from '@/components/auth/UserNav'

type NavItem = { label: string; href: string; children?: { label: string; href: string }[] }

/**
 * Stage 1 deliberately changes no URL, so these point at the routes that exist
 * today. Stage 2 applies the renames and redirects in IA.md section 5.
 */
const NAV: NavItem[] = [
  { label: 'Console', href: '/console' },
  // Track A's prospectivity surface. It had no navigation entry at all: the map
  // was reachable only by opening the console, picking a mine, switching tab and
  // scrolling past the drill-target table. Nothing in the product named it.
  { label: 'Prospectivity', href: '/console?track=a' },
  { label: 'Production', href: '/production' },
  {
    label: 'Operations',
    href: '/blending',
    children: [
      { label: 'Ore blending', href: '/blending' },
      { label: 'Mine twin', href: '/mine-twin' },
      { label: 'Flood alert', href: '/flood-alert' },
    ],
  },
  { label: 'Method', href: '/method' },
]

function isActive(pathname: string, search: string, item: NavItem) {
  const hrefs = item.children ? item.children.map((c) => c.href) : [item.href]
  return hrefs.some((h) => {
    const [hPath, hQuery] = h.split('?')
    if (pathname !== hPath && !pathname.startsWith(`${hPath}/`)) return false
    // /console and /console?track=a are different destinations in the same
    // route, so the query has to take part in the active check or both light up.
    if (hQuery) return search.includes(hQuery)
    return !search.includes('track=a')
  })
}

/** Interface role: 14px in the bar until lg, where the reference's 16px fits. */
const LINK_BASE =
  'rounded-md px-2.5 py-1.5 text-[14px] tracking-[0.044em] lg:px-3 lg:text-base ' +
  'transition-[background-color,color] duration-[180ms] ease-out ' +
  'hover:bg-surface-2 hover:text-text-primary'

const LINK_ACTIVE = 'bg-surface-2 text-text-primary'
const LINK_IDLE = 'text-text-secondary'

function OperationsMenu({ item, pathname, search }: { item: NavItem; pathname: string; search: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          LINK_BASE,
          'inline-flex items-center gap-1',
          isActive(pathname, search, item) ? LINK_ACTIVE : LINK_IDLE
        )}
      >
        {item.label}
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {open ? (
        <div
          id={menuId}
          className="absolute left-0 top-full z-50 mt-2 min-w-52 rounded-lg border border-border-strong bg-surface-0 p-1.5"
        >
          {item.children?.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              onClick={() => setOpen(false)}
              aria-current={pathname === child.href ? 'page' : undefined}
              className={clsx(
                'block rounded-md px-3 py-2 text-[14px] tracking-[0.044em] transition-[background-color,color] duration-[180ms] ease-out hover:bg-surface-2 hover:text-text-primary',
                pathname === child.href ? LINK_ACTIVE : LINK_IDLE
              )}
            >
              {child.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function AppBar() {
  const pathname = usePathname() || '/'

  /**
   * The query string, read after mount rather than through useSearchParams.
   *
   * useSearchParams in a component rendered by the root layout opts every
   * statically rendered page into a client-side bailout — the build fails on
   * /about with "should be wrapped in a suspense boundary". Nav highlighting is
   * a progressive enhancement, so it is fine for it to settle on hydration;
   * wrapping the whole bar in Suspense to get it one paint earlier would cost a
   * fallback flash on every static page.
   */
  const [search, setSearch] = useState('')
  useEffect(() => {
    setSearch(window.location.search.replace(/^\?/, ''))
  }, [pathname])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawerId = useId()

  // Close the drawer on navigation so it never covers the page it opened.
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  function openCopilot() {
    window.dispatchEvent(new CustomEvent('open-aix-copilot'))
  }

  return (
    <header className="sticky top-0 z-50 px-2 py-1.5 sm:px-4 md:py-2 lg:px-6">
      <div className="mx-auto flex h-11 max-w-[1264px] items-center gap-2 rounded-lg border border-border-default bg-nav-bg pl-4 pr-1.5 backdrop-blur-[18px] backdrop-saturate-[1.4] md:h-[52px] md:pl-[18px] md:pr-2">
        {/* Wordmark: the reference's one use of weight 500, italic, tight. */}
        <Link
          href="/"
          className="shrink-0 text-[20px] italic leading-none tracking-[-0.04em] text-text-primary [font-weight:500]"
        >
          Nakshatra&#8209;X
        </Link>

        {/* Desktop navigation. No overflow-hidden anywhere on this row. */}
        <nav aria-label="Primary" className="ml-3 hidden items-center gap-0.5 md:flex lg:ml-5 lg:gap-1">
          {NAV.map((item) =>
            item.children ? (
              <OperationsMenu key={item.label} item={item} pathname={pathname} search={search} />
            ) : (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(pathname, search, item) ? 'page' : undefined}
                className={clsx(LINK_BASE, isActive(pathname, search, item) ? LINK_ACTIVE : LINK_IDLE)}
              >
                {item.label}
              </Link>
            )
          )}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={openCopilot}
            // The visible label is `hidden sm:inline` and the icon is
            // aria-hidden, so below 640px this button had no accessible name at
            // all. The project's axe run only visits desktop widths, which is
            // why it passed there and Lighthouse's mobile emulation did not.
            aria-label="Open the AI-X assistant"
            className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-surface-2 px-2.5 text-[14px] tracking-[0.044em] text-text-primary transition-[background-color] duration-[180ms] ease-out hover:bg-surface-3 md:h-9 md:px-3"
          >
            <Bot className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">AI&#8209;X</span>
          </button>

          <UserNav />

          <button
            type="button"
            aria-expanded={drawerOpen}
            aria-controls={drawerId}
            aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setDrawerOpen((v) => !v)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-text-primary transition-[background-color] duration-[180ms] ease-out hover:bg-surface-2 md:hidden"
          >
            {drawerOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer. Destinations move here rather than being truncated. */}
      {drawerOpen ? (
        <nav
          id={drawerId}
          aria-label="Primary"
          className="mx-auto mt-1.5 max-w-[1264px] rounded-lg border border-border-default bg-surface-0 p-2 md:hidden"
        >
          {NAV.map((item) => (
            <div key={item.label} className="py-1">
              {item.children ? (
                <>
                  <p className="label px-3 pb-1 pt-2">{item.label}</p>
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      aria-current={pathname === child.href ? 'page' : undefined}
                      className={clsx(
                        'block rounded-md px-3 py-2.5 text-base tracking-[0.044em] transition-[background-color,color] duration-[180ms] ease-out hover:bg-surface-2',
                        pathname === child.href ? LINK_ACTIVE : LINK_IDLE
                      )}
                    >
                      {child.label}
                    </Link>
                  ))}
                </>
              ) : (
                <Link
                  href={item.href}
                  aria-current={isActive(pathname, search, item) ? 'page' : undefined}
                  className={clsx(
                    'block rounded-md px-3 py-2.5 text-base tracking-[0.044em] transition-[background-color,color] duration-[180ms] ease-out hover:bg-surface-2',
                    isActive(pathname, search, item) ? LINK_ACTIVE : LINK_IDLE
                  )}
                >
                  {item.label}
                </Link>
              )}
            </div>
          ))}
        </nav>
      ) : null}
    </header>
  )
}
