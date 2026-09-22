'use client'

import type React from 'react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  KeyRound,
  Shield,
  Lock,
  User,
  AlertCircle,
  Loader2,
  Sparkles,
  Eye,
  EyeOff,
  Radio,
} from 'lucide-react'

export default function AdminLoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [slotAvailable, setSlotAvailable] = useState<boolean | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function checkSlot() {
      try {
        const res = await fetch('/api/admin/setup')
        const data = await res.json()
        setSlotAvailable(data.isSlotAvailable)
      } catch {
        // Fall through
      }
    }
    checkSlot()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Authentication rejected.')
      }

      router.push('/admin')
      router.refresh()
    } catch (err: any) {
      setError(err?.message || 'Access denied.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#030712] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.15),rgba(255,255,255,0))] flex items-center justify-center p-4 font-mono">
      <div className="max-w-md w-full">
        {/* Slot Available Notice Banner */}
        {slotAvailable === true && (
          <div className="mb-4 p-3.5 rounded-xl bg-[#00FF88]/10 border border-[#00FF88]/40 text-[#00FF88] flex items-center justify-between shadow-[0_0_30px_rgba(0,255,136,0.15)] animate-in fade-in">
            <div className="flex items-center gap-2 text-xs">
              <Sparkles size={16} className="shrink-0" />
              <span>Single Admin Slot Open (0/1 registered)</span>
            </div>
            <Link
              href="/admin/setup"
              className="px-2.5 py-1 rounded-lg bg-[#00FF88] text-black font-bold text-[10px] uppercase tracking-wider hover:opacity-90 transition-opacity"
            >
              Claim Slot
            </Link>
          </div>
        )}

        <div className="rounded-2xl bg-[#090D16]/90 border border-white/15 p-8 shadow-[0_0_60px_rgba(56,189,248,0.1)] backdrop-blur-xl relative overflow-hidden">
          {/* Top Radial Glow */}
          <div className="absolute -top-16 -left-16 w-32 h-32 bg-[#38BDF8]/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="h-14 w-14 rounded-2xl bg-[#38BDF8]/10 border border-[#38BDF8]/40 flex items-center justify-center text-[#38BDF8] shadow-[0_0_30px_rgba(56,189,248,0.25)] mb-3">
              <Shield size={28} />
            </div>
            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#38BDF8]">
              RESTRICTED COMMAND ACCESS
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
              Commander Terminal
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {slotAvailable === false
                ? 'Single Administrator Slot Sealed [1/1 Occupied]'
                : 'Enter Master Credentials to unlock Command Center'}
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-[#FF2E63]/15 border border-[#FF2E63]/50 text-[#FF2E63] text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                <User size={12} className="text-[#38BDF8]" /> Commander Call Sign / Email
              </label>
              <input
                type="text"
                placeholder="e.g. commander or your email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                className="w-full bg-black/60 border border-white/15 rounded-xl py-3 px-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#38BDF8] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                <KeyRound size={12} className="text-[#00FF88]" /> Master Access Passphrase
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-black/60 border border-white/15 rounded-xl py-3 pl-3.5 pr-10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00FF88] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-500 hover:text-white transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-[#38BDF8] to-[#00FF88] text-black font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_25px_rgba(56,189,248,0.25)] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <Lock size={15} />
                  <span>Authenticate &amp; Enter Console</span>
                </>
              )}
            </button>
          </form>

          {/* Footer Navigation */}
          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
            {slotAvailable ? (
              <Link href="/admin/setup" className="text-[#00FF88] hover:underline flex items-center gap-1">
                Claim Admin Slot &rarr;
              </Link>
            ) : (
              <span className="text-[#38BDF8] text-[10px] flex items-center gap-1">
                <Radio size={12} className="animate-pulse" /> Security Sealed
              </span>
            )}
            <Link href="/" className="hover:text-white transition-colors">
              &larr; Platform
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
