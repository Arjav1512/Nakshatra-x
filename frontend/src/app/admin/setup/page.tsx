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
      <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center p-4 font-mono text-white">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-2 border-[#38BDF8]/20 border-t-[#38BDF8] animate-spin" />
          <Radio className="absolute inset-0 m-auto h-6 w-6 text-[#38BDF8] " />
        </div>
        <p className="mt-4 text-xs tracking-widest text-[#38BDF8] uppercase ">
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border bg-black/50 backdrop-blur-md">
            {isSlotAvailable ? (
              <>
                <span className="h-2 w-2 rounded-full bg-[#00FF88] " />
                <span className="text-[#00FF88]">Slot Available: 1 of 1 Free</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-[#FF2E63]" />
                <span className="text-[#FF2E63]">Slot Sealed: 1 of 1 Occupied</span>
              </>
            )}
          </span>
        </div>

        {/* ================= CASE 1: SLOT IS OPEN (Claim It) ================= */}
        {isSlotAvailable && !success && (
          <div className="rounded-2xl bg-[#090D16]/90 border border-white/10 shadow-[0_0_60px_rgba(56,189,248,0.12)] p-6 sm:p-8 relative overflow-hidden backdrop-blur-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#00FF88]/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center gap-3.5 mb-6 border-b border-white/10 pb-5">
              <div className="h-12 w-12 rounded-xl bg-[#00FF88]/10 border border-[#00FF88]/40 flex items-center justify-center text-[#00FF88] shadow-[0_0_20px_rgba(0,255,136,0.25)]">
                <Sparkles size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-wider text-white">INITIALIZE PRIMARY COMMANDER</h1>
                <p className="text-[11px] text-[#94A3B8]">
                  Claim the single administrator account for Nakshatra-X
                </p>
              </div>
            </div>

            {/* Critical Security Warning */}
            <div className="mb-6 p-3.5 rounded-xl bg-[#FFB800]/10 border border-[#FFB800]/30 text-[#FFB800] text-xs flex items-start gap-2.5">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <strong>SINGLE-SLOT PROTOCOL:</strong> Once you create this master account, the registration slot will be <strong>permanently locked</strong>. No other admin account will ever be permitted to register.
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-[#FF2E63]/15 border border-[#FF2E63]/50 text-[#FF2E63] text-xs flex items-start gap-2">
                <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSetup} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#94A3B8] mb-1.5 flex items-center gap-1">
                    <User size={12} className="text-[#38BDF8]" /> Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rupraj Datta"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full bg-black/60 border border-white/15 rounded-xl py-2.5 px-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#38BDF8] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#94A3B8] mb-1.5 flex items-center gap-1">
                    <Terminal size={12} className="text-[#38BDF8]" /> Call Sign / Username
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. commander"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full bg-black/60 border border-white/15 rounded-xl py-2.5 px-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#38BDF8] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#94A3B8] mb-1.5 flex items-center gap-1">
                  <Mail size={12} className="text-[#38BDF8]" /> Administrator Email
                </label>
                <input
                  type="email"
                  placeholder="e.g. dattarupraj@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-black/60 border border-white/15 rounded-xl py-2.5 px-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#38BDF8] transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#94A3B8] mb-1.5 flex items-center gap-1">
                    <KeyRound size={12} className="text-[#00FF88]" /> Master Passphrase
                  </label>
                  <input
                    type="password"
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-black/60 border border-white/15 rounded-xl py-2.5 px-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00FF88] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#94A3B8] mb-1.5 flex items-center gap-1">
                    <Lock size={12} className="text-[#00FF88]" /> Confirm Passphrase
                  </label>
                  <input
                    type="password"
                    placeholder="Repeat master passphrase"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full bg-black/60 border border-white/15 rounded-xl py-2.5 px-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00FF88] transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 py-3 px-4 rounded-xl bg-gradient-to-r from-[#00FF88] to-[#38BDF8] text-black font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_30px_rgba(0,255,136,0.3)] disabled:opacity-50"
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
                className="text-[11px] text-[#94A3B8] hover:text-[#38BDF8] transition-colors"
              >
                Already have credentials? Enter Access Console &rarr;
              </Link>
            </div>
          </div>
        )}

        {/* ================= CASE 2: SUCCESS JUST REGISTERED ================= */}
        {success && (
          <div className="rounded-2xl bg-[#090D16]/90 border border-[#00FF88]/40 shadow-[0_0_60px_rgba(0,255,136,0.2)] p-8 text-center backdrop-blur-xl animate-in zoom-in-95">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-[#00FF88]/15 border border-[#00FF88] flex items-center justify-center text-[#00FF88] mb-4 shadow-[0_0_30px_rgba(0,255,136,0.4)]">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="text-xl font-bold text-white tracking-widest mb-1">COMMANDER INITIALIZED</h2>
            <p className="text-xs text-[#00FF88] mb-4">
              Single Administrator Slot Permanently Sealed [1/1 Occupied]
            </p>
            <p className="text-xs text-slate-400 mb-6">
              Transferring clearance to Global Command Center...
            </p>
            <div className="flex justify-center">
              <Loader2 className="animate-spin text-[#38BDF8] h-6 w-6" />
            </div>
          </div>
        )}

        {/* ================= CASE 3: SLOT IS ALREADY TAKEN (Locked) ================= */}
        {!isSlotAvailable && !success && (
          <div className="rounded-2xl bg-[#090D16]/95 border border-white/10 shadow-[0_0_60px_rgba(255,46,99,0.15)] p-6 sm:p-8 text-center backdrop-blur-xl">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-[#FF2E63]/10 border border-[#FF2E63]/40 flex items-center justify-center text-[#FF2E63] mb-4 shadow-[0_0_30px_rgba(255,46,99,0.3)]">
              <Lock size={30} />
            </div>
            <div className="text-[10px] uppercase font-bold tracking-[0.25em] text-[#FF2E63] mb-1">
              REGISTRATION PERMANENTLY SEALED
            </div>
            <h2 className="text-xl font-bold text-white mb-2">SINGLE ADMIN SLOT OCCUPIED</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mb-6 leading-relaxed">
              The sole administrator account for this platform has already been claimed by Primary Commander{' '}
              <span className="text-[#38BDF8] font-bold">
                {adminUser?.email || adminUser?.username || 'System Administrator'}
              </span>
              . No additional admin accounts can be created.
            </p>

            <div className="p-4 rounded-xl bg-black/60 border border-white/10 mb-6 text-left text-xs space-y-2">
              <div className="flex justify-between items-center text-slate-400 text-[11px]">
                <span>Status:</span>
                <span className="text-[#FF2E63] font-bold uppercase">Locked (1/1)</span>
              </div>
              <div className="flex justify-between items-center text-slate-400 text-[11px]">
                <span>Registered Commander:</span>
                <span className="text-white font-mono">{adminUser?.full_name || 'Primary Commander'}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400 text-[11px]">
                <span>Security Level:</span>
                <span className="text-[#00FF88] font-mono">LEVEL-5-OMEGA</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push('/admin/login')}
              className="w-full py-3 px-4 rounded-xl bg-[#38BDF8] hover:bg-[#38BDF8]/90 text-black font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(56,189,248,0.3)]"
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
