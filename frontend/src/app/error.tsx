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
        <h1 className="mt-3 text-2xl">This screen failed to render</h1>
        <p className="mt-3 text-base text-text-secondary">
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
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-accent px-4 text-base font-medium text-surface-0 transition-colors duration-[120ms] ease-out hover:bg-accent/90"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
          <a
            href="/console"
            className="inline-flex h-10 items-center justify-center rounded-md border border-border-interactive bg-surface-2 px-4 text-base font-medium text-text-primary transition-colors duration-[120ms] ease-out hover:bg-surface-3"
          >
            Back to the console
          </a>
        </div>
      </div>
    </main>
  )
}
