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
          <div className="mb-4 p-3.5 rounded-md bg-accent/10 border border-accent/40 text-accent flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2 text-xs">
              <Sparkles size={16} className="shrink-0" />
              <span>Single Admin Slot Open (0/1 registered)</span>
            </div>
            <Link
              href="/admin/setup"
              className="px-2.5 py-1 rounded-lg bg-accent text-black font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-opacity"
            >
              Claim Slot
            </Link>
          </div>
        )}

        <div className="rounded-md bg-surface-1/90 border border-border-default p-8  relative overflow-hidden">
          {/* Top Radial Glow */}
          <div className="absolute -top-16 -left-16 w-32 h-32 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="h-14 w-14 rounded-md bg-accent/10 border border-accent/40 flex items-center justify-center text-accent mb-3">
              <Shield size={28} />
            </div>
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-accent">
              RESTRICTED COMMAND ACCESS
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold text-text-primary mt-1">
              Commander Terminal
            </h1>
            <p className="text-xs text-text-secondary mt-1">
              {slotAvailable === false
                ? 'Single Administrator Slot Sealed [1/1 Occupied]'
                : 'Enter Master Credentials to unlock Command Center'}
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-5 p-3 rounded-md bg-status-critical/15 border border-status-critical/50 text-status-critical text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-text-secondary mb-1.5 flex items-center gap-1">
                <User size={12} className="text-accent" /> Commander Call Sign / Email
              </label>
              <input
                type="text"
                placeholder="e.g. commander or your email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                className="w-full bg-surface-0/80 border border-border-default rounded-md py-3 px-3.5 text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-text-secondary mb-1.5 flex items-center gap-1">
                <KeyRound size={12} className="text-accent" /> Master Access Passphrase
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-surface-0/80 border border-border-default rounded-md py-3 pl-3.5 pr-10 text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-md bg-gradient-to-r from-accent to-accent text-black font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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
          <div className="mt-6 pt-4 border-t border-border-default flex items-center justify-between text-xs text-text-secondary">
            {slotAvailable ? (
              <Link href="/admin/setup" className="text-accent hover:underline flex items-center gap-1">
                Claim Admin Slot &rarr;
              </Link>
            ) : (
              <span className="text-accent text-xs flex items-center gap-1">
                <Radio size={12} /> Security Sealed
              </span>
            )}
            <Link href="/" className="hover:text-text-primary transition-colors">
              &larr; Platform
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
