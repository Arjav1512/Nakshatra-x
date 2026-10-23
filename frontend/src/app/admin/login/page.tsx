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
        // Unknown when the server cannot tell; never assume the slot is free.
        setSlotAvailable(res.ok ? data.isSlotAvailable === true : null)
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
    <div className="min-h-[calc(100dvh-3.5rem)] bg-surface-0  flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Slot Available Notice Banner */}
        {slotAvailable === true && (
          <div className="mb-4 p-3.5 rounded-tile bg-surface-2 text-text-primary flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <Sparkles size={16} className="shrink-0" />
              <span>Single Admin Slot Open (0/1 registered)</span>
            </div>
            <Link
              href="/admin/setup"
              className="px-2.5 py-1 rounded-sm bg-inverse-bg text-inverse-fg text-xs tracking-[0.044em] hover:bg-inverse-hover transition-[background-color]"
            >
              Claim Slot
            </Link>
          </div>
        )}

        <div className="rounded-2xl bg-surface-1 border border-border-default p-8 relative overflow-hidden">
          {/* Top Radial Glow */}

          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="h-14 w-14 rounded-tile bg-surface-2 flex items-center justify-center text-text-primary mb-3">
              <Shield size={28} />
            </div>
            <div className="label">
              Restricted command access
            </div>
            <h1 className="text-xl sm:text-2xl text-text-primary mt-1">
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
            <div className="mb-5 p-3 rounded-md bg-status-critical/15 border border-status-critical/50 text-status-critical text-xs flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mb-1.5 flex text-sm tracking-[0.044em] text-text-secondary items-center gap-1">
                <User size={12} className="text-accent" /> Commander Call Sign / Email
              </label>
              <input
                type="text"
                placeholder="e.g. commander or your email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                className="w-full bg-surface-0 border border-border-interactive rounded-md py-3 px-3.5 text-base text-text-primary focus:border-text-primary transition-colors"
              />
            </div>

            <div>
              <label className="mb-1.5 flex text-sm tracking-[0.044em] text-text-secondary items-center gap-1">
                <KeyRound size={12} className="text-accent" /> Master Access Passphrase
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-surface-0 border border-border-interactive rounded-md py-3 pl-3.5 pr-10 text-base text-text-primary focus:border-text-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-sm text-text-tertiary transition-colors hover:text-text-primary cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff size={16} aria-hidden="true" />
                  ) : (
                    <Eye size={16} aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-md bg-inverse-bg text-inverse-fg text-base tracking-[0.044em] hover:bg-inverse-hover transition-[background-color] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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
