'use client'

import type React from 'react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  KeyRound,
  Mail,
  User,
  ArrowRight,
  Loader2,
  AlertTriangle,
  Radio,
  CheckCircle2,
  Sparkles,
  Terminal,
} from 'lucide-react'

export default function AdminSetupPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [isSlotAvailable, setIsSlotAvailable] = useState<boolean | null>(null)
  const [adminUser, setAdminUser] = useState<any>(null)

  // Form State
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // UI State
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // 1. Query whether the 1 and only admin slot is available
  useEffect(() => {
    async function checkSlot() {
      try {
        setChecking(true)
        const res = await fetch('/api/admin/setup')
        const data = await res.json()
        setIsSlotAvailable(data.isSlotAvailable)
        setAdminUser(data.adminUser || null)
      } catch {
        setError('Failed to query admin registration gateway.')
      } finally {
        setChecking(false)
      }
    }
    checkSlot()
  }, [])

  // 2. Handle registering the single primary admin account
  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email || !email.includes('@')) {
      setError('Please provide a valid mission administrator email address.')
      return
    }

    if (password.length < 8) {
      setError('Master security key must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Password confirmation does not match the master key.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim() || 'Chief Orbital Commander',
          username: username.trim().toLowerCase() || 'commander',
          email: email.trim().toLowerCase(),
          password,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to initialize administrator.')
      }

      setSuccess(true)
      setIsSlotAvailable(false)

      setTimeout(() => {
        router.push('/admin')
      }, 1500)
    } catch (err: any) {
      setError(err?.message || 'Initialization failed.')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center p-4 font-mono text-text-primary">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-2 border-accent/20 border-t-[#38BDF8] animate-spin" />
          <Radio className="absolute inset-0 m-auto h-6 w-6 text-accent " />
        </div>
        <p className="mt-4 text-xs tracking-widest text-accent uppercase ">
          Scanning Commander Cryptographic Registry...
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#030712] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.15),rgba(255,255,255,0))] flex items-center justify-center p-4 font-mono">
      <div className="max-w-xl w-full">
        {/* Top Floating Badge */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase border bg-black/50 ">
            {isSlotAvailable ? (
              <>
                <span className="h-2 w-2 rounded-full bg-accent " />
                <span className="text-accent">Slot Available: 1 of 1 Free</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-status-critical" />
                <span className="text-status-critical">Slot Sealed: 1 of 1 Occupied</span>
              </>
            )}
          </span>
        </div>

        {/* ================= CASE 1: SLOT IS OPEN (Claim It) ================= */}
        {isSlotAvailable && !success && (
          <div className="rounded-md bg-surface-1/90 border border-border-default p-6 sm:p-8 relative overflow-hidden ">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center gap-3.5 mb-6 border-b border-border-default pb-5">
              <div className="h-12 w-12 rounded-md bg-accent/10 border border-accent/40 flex items-center justify-center text-accent">
                <Sparkles size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-wider text-text-primary">INITIALIZE PRIMARY COMMANDER</h1>
                <p className="text-xs text-text-tertiary">
                  Claim the single administrator account for Nakshatra-X
                </p>
              </div>
            </div>

            {/* Critical Security Warning */}
            <div className="mb-6 p-3.5 rounded-md bg-status-caution/10 border border-status-caution/30 text-status-caution text-xs flex items-start gap-2.5">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <strong>SINGLE-SLOT PROTOCOL:</strong> Once you create this master account, the registration slot will be <strong>permanently locked</strong>. No other admin account will ever be permitted to register.
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-md bg-status-critical/15 border border-status-critical/50 text-status-critical text-xs flex items-start gap-2">
                <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSetup} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-text-tertiary mb-1.5 flex items-center gap-1">
                    <User size={12} className="text-accent" /> Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rupraj Datta"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full bg-surface-0/80 border border-border-default rounded-md py-2.5 px-3.5 text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-text-tertiary mb-1.5 flex items-center gap-1">
                    <Terminal size={12} className="text-accent" /> Call Sign / Username
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. commander"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full bg-surface-0/80 border border-border-default rounded-md py-2.5 px-3.5 text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-text-tertiary mb-1.5 flex items-center gap-1">
                  <Mail size={12} className="text-accent" /> Administrator Email
                </label>
                <input
                  type="email"
                  placeholder="e.g. dattarupraj@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-surface-0/80 border border-border-default rounded-md py-2.5 px-3.5 text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-text-tertiary mb-1.5 flex items-center gap-1">
                    <KeyRound size={12} className="text-accent" /> Master Passphrase
                  </label>
                  <input
                    type="password"
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-surface-0/80 border border-border-default rounded-md py-2.5 px-3.5 text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-text-tertiary mb-1.5 flex items-center gap-1">
                    <Lock size={12} className="text-accent" /> Confirm Passphrase
                  </label>
                  <input
                    type="password"
                    placeholder="Repeat master passphrase"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full bg-surface-0/80 border border-border-default rounded-md py-2.5 px-3.5 text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 py-3 px-4 rounded-md bg-gradient-to-r from-accent to-accent text-black font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Sealing Administrator Slot...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>Claim Slot &amp; Seal Registration</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-4 text-center">
              <Link
                href="/admin/login"
                className="text-xs text-text-tertiary hover:text-accent transition-colors"
              >
                Already have credentials? Enter Access Console &rarr;
              </Link>
            </div>
          </div>
        )}

        {/* ================= CASE 2: SUCCESS JUST REGISTERED ================= */}
        {success && (
          <div className="rounded-md bg-surface-1/90 border border-accent/40 p-8 text-center  animate-in zoom-in-95">
            <div className="h-16 w-16 mx-auto rounded-md bg-accent/15 border border-accent flex items-center justify-center text-accent mb-4">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="text-xl font-bold text-text-primary tracking-widest mb-1">COMMANDER INITIALIZED</h2>
            <p className="text-xs text-accent mb-4">
              Single Administrator Slot Permanently Sealed [1/1 Occupied]
            </p>
            <p className="text-xs text-text-secondary mb-6">
              Transferring clearance to Global Command Center...
            </p>
            <div className="flex justify-center">
              <Loader2 className="animate-spin text-accent h-6 w-6" />
            </div>
          </div>
        )}

        {/* ================= CASE 3: SLOT IS ALREADY TAKEN (Locked) ================= */}
        {!isSlotAvailable && !success && (
          <div className="rounded-md bg-surface-1/95 border border-border-default p-6 sm:p-8 text-center ">
            <div className="h-16 w-16 mx-auto rounded-md bg-status-critical/10 border border-status-critical/40 flex items-center justify-center text-status-critical mb-4">
              <Lock size={30} />
            </div>
            <div className="text-xs uppercase font-bold tracking-[0.25em] text-status-critical mb-1">
              REGISTRATION PERMANENTLY SEALED
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-2">SINGLE ADMIN SLOT OCCUPIED</h2>
            <p className="text-xs text-text-secondary max-w-sm mx-auto mb-6 leading-relaxed">
              The sole administrator account for this platform has already been claimed by Primary Commander{' '}
              <span className="text-accent font-bold">
                {adminUser?.email || adminUser?.username || 'System Administrator'}
              </span>
              . No additional admin accounts can be created.
            </p>

            <div className="p-4 rounded-md bg-surface-0/80 border border-border-default mb-6 text-left text-xs space-y-2">
              <div className="flex justify-between items-center text-text-secondary text-xs">
                <span>Status:</span>
                <span className="text-status-critical font-bold uppercase">Locked (1/1)</span>
              </div>
              <div className="flex justify-between items-center text-text-secondary text-xs">
                <span>Registered Commander:</span>
                <span className="text-text-primary font-mono">{adminUser?.full_name || 'Primary Commander'}</span>
              </div>
              <div className="flex justify-between items-center text-text-secondary text-xs">
                <span>Security Level:</span>
                <span className="text-accent font-mono">LEVEL-5-OMEGA</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push('/admin/login')}
              className="w-full py-3 px-4 rounded-md bg-accent hover:bg-accent/90 text-black font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Enter Commander Login Console</span>
              <ArrowRight size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
