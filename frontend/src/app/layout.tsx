import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Hanken_Grotesk } from 'next/font/google'
import './globals.css'
import AppBar from '@/components/shell/AppBar'
import IntegrityFooter from '@/components/shell/IntegrityFooter'
import OfflineIndicator from '@/components/offline/OfflineIndicator'
import PWARegistry from '@/components/offline/PWARegistry'
import GlobalCopilotWrapper from '@/components/mission-control/GlobalCopilotWrapper'

/**
 * The design reference's three faces (docs/ui-redesign/design-system-mapping.md
 * §1.5, §5.7). Its primary and secondary faces, DieGrotesk and ABC Diatype, are
 * licensed and are not used; these are the web fallbacks the reference itself
 * declares, all SIL Open Font License. next/font downloads them at build time
 * and serves them from this origin, so no request reaches Google at runtime and
 * the type survives a venue with no network (`npm run test:fonts` asserts it).
 *
 * One weight is the rule (reference: "one regular weight"); 500 is the ceiling,
 * for the wordmark.
 */
const geist = Geist({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-geist',
})

/** Secondary face: eyebrows and the dark chrome's small labels. */
const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-hanken',
})

/** Figures, identifiers, coordinates and code. Tabular figures throughout. */
const geistMono = Geist_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-geist-mono',
})

export const viewport: Viewport = {
  // Mirrors --color-surface-0. Next serialises this into <meta name="theme-color">
  // at build time, so it has to be a literal — a CSS custom property cannot be
  // resolved here. It is the only colour literal outside tokens.css and the
  // print block, and it must be updated with the token.
  themeColor: '#FAFAFA',
}

export const metadata: Metadata = {
  title: 'Nakshatra-X',
  description:
    'Reserve prospectivity and production-shortfall decision support for the Ministry of Steel and MOIL Ltd.',
  manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // The font variables go on <html>, not <body>. The tokens that use them
    // (--font-sans, --font-mono, --font-display, tokens.css) are emitted by
    // @theme on :root — which is <html> — so a variable defined only on <body>
    // does not exist where they are resolved. That is what happened: every page
    // rendered in the system font, with its faces declared, downloaded at
    // build time and never used. `npm run test:fonts` asserts it.
    <html
      lang="en"
      className={`${geist.variable} ${hanken.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="apple-touch-icon" href="/favicon.ico" />
      </head>
      <body
        className="bg-surface-0 text-text-primary antialiased"
        suppressHydrationWarning
      >
        <a
          href="#main"
          className="sr-only rounded-md bg-inverse-bg px-4 py-2 text-sm text-inverse-fg focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60]"
        >
          Skip to content
        </a>
        <PWARegistry />
        <AppBar />
        {/*
          At least one viewport tall, less the 56px app bar, so the footer starts
          below the fold on the first paint. Every route fetches its content after
          that paint, and while the page was still short the footer was drawn
          mid-screen and then shoved off it as the content arrived — the largest
          single layout shift on most routes (0.144 on a mine's detail, 0.145 on
          /blending in one run of three, measured with a layout-shift observer).
          Moving below the fold is a shift nobody sees, and CLS does not count it.
        */}
        <div id="main" className="min-h-[calc(100dvh-3.5rem)]">{children}</div>
        <IntegrityFooter />
        <GlobalCopilotWrapper />
        <OfflineIndicator />
      </body>
    </html>
  )
}
