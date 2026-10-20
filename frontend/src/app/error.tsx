'use client'

import { useEffect } from 'react'
import { RefreshCw } from 'lucide-react'

/**
 * Client error boundary.
 *
 * The previous version announced "SINGLE-THREAD THREAD GUARDRAIL ACTIVE" and
 * said the error had been "safely isolated by the NAKSHATRA-X security
 * boundary, preventing Node.js event loop disruption". None of that describes
 * what happens here: this is React's render boundary, it runs in the browser,
 * and it has no relationship to the server's event loop. It also borrowed the
 * word "guardrail", which in this project names four specific commitments about
 * data, not an exception handler.
 *
 * A screen shown when something broke is the worst place to overstate what the
 * system did.
 */
export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[ui] render error:', error.message)
  }, [error])

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-[1280px] items-center px-4 sm:px-6 lg:px-8">
      <div className="measure">
        <p className="label">Error</p>
        <h1 className="mt-3 font-display text-4xl md:text-5xl">This screen failed to render</h1>
        <p className="mt-4 text-lg text-text-secondary">
          Something in the page threw while rendering. Nothing was saved or sent, and no data has
          been changed. Reloading may work; if it does not, the problem is not on your side.
        </p>

        {error.digest ? (
          <p className="mt-4 font-mono text-xs text-text-tertiary">
            Reference: {error.digest}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex h-[42px] items-center justify-center gap-2 rounded-md bg-inverse-bg px-4 text-base tracking-[0.044em] text-inverse-fg transition-[background-color,scale] duration-[180ms] ease-out hover:bg-inverse-hover active:scale-[.97]"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
          <a
            href="/console"
            className="inline-flex h-[42px] items-center justify-center rounded-md bg-surface-2 px-4 text-base tracking-[0.044em] text-text-primary transition-[background-color,scale] duration-[180ms] ease-out hover:bg-surface-3 active:scale-[.97]"
          >
            Back to the console
          </a>
        </div>
      </div>
    </main>
  )
}
