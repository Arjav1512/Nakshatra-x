import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Mono, Inter, Sora } from 'next/font/google'
import './globals.css'
import AppBar from '@/components/shell/AppBar'
import IntegrityFooter from '@/components/shell/IntegrityFooter'
import OfflineIndicator from '@/components/offline/OfflineIndicator'
import PWARegistry from '@/components/offline/PWARegistry'
import GlobalCopilotWrapper from '@/components/mission-control/GlobalCopilotWrapper'

/**
 * Two families, per docs/design/DESIGN_SYSTEM.md section 4.1. Space Grotesk was
 * removed: its only job was the gradient-clipped display text in .font-3d-cyber
 * (audit T-6, T-7), and gradient-filled text has no single contrast ratio, so
 * it can neither pass an audit nor be measured by one.
 */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

/**
 * Display family (B-2).
 *
 * Sora is geometric where Inter is neo-grotesque: rounder bowls, a single-storey
 * 'a', wider apertures. At 36px and above that difference is what separates a
 * heading from large body text, which the audit found this product did not do —
 * everything was Inter at slightly different sizes.
 *
 * Display only. It is never used below --text-2xl, and never for data: figures
 * stay in IBM Plex Mono, which ships true tabular figures.
 */
const sora = Sora({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-sora',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-plex-mono',
})

export const viewport: Viewport = {
  // Mirrors --color-surface-0. Next serialises this into <meta name="theme-color">
  // at build time, so it has to be a literal — a CSS custom property cannot be
  // resolved here. It is the only colour literal outside tokens.css and the
  // print block, and it must be updated with the token.
  themeColor: '#0b0d10',
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
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/favicon.ico" />
      </head>
      <body
        className={`${inter.variable} ${plexMono.variable} ${sora.variable} bg-surface-0 text-text-primary antialiased`}
        suppressHydrationWarning
      >
        <a
          href="#main"
          className="sr-only rounded-md bg-surface-2 px-4 py-2 text-sm text-text-primary focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60]"
        >
          Skip to content
        </a>
        <PWARegistry />
        <AppBar />
        <div id="main">{children}</div>
        <IntegrityFooter />
        <GlobalCopilotWrapper />
        <OfflineIndicator />
      </body>
    </html>
  )
}
