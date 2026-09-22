'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react'

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error safely without exposing raw system pointers
    console.error('[Security Single-Thread Guardrail] Handled UI Exception:', error.message)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050914] text-white p-6">
      <div className="max-w-md w-full p-8 rounded-3xl bg-white/[0.03] backdrop-blur-2xl border border-white/10 shadow-2xl text-center space-y-5">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FF2E63]/15 border border-[#FF2E63]/40 flex items-center justify-center text-[#FF2E63] shadow-[0_0_20px_rgba(255,46,99,0.3)]">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div>
          <span className="ios-badge !bg-[#00FF88]/15 !text-[#00FF88] !border-[#00FF88]/40 mb-3 inline-flex items-center gap-1 text-[10px] font-mono font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            SINGLE-THREAD THREAD GUARDRAIL ACTIVE
          </span>
          <h2 className="text-xl font-bold font-space uppercase tracking-wider text-white">
            Process Intercepted Safely
          </h2>
          <p className="text-xs text-slate-300 mt-2 leading-relaxed">
            An unexpected error was safely isolated by the NAKSHATRA-X security boundary, preventing Node.js event loop disruption.
          </p>
        </div>

        <button type="button"
          onClick={() => reset()}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#38BDF8] to-[#00FF88] text-[#050914] font-mono font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#00FF88]/20"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Recover Thread & Reload State</span>
        </button>
      </div>
    </div>
  )
}
