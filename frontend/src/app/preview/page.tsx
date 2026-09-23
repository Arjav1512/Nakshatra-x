'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { Starfield } from '@/components/nakshatra/sections'
import { GlassCard } from '@/components/nakshatra/ui'
import { LoginForm } from '@/components/auth/LoginForm'
import { CyberRobotAvatar } from '@/components/auth/CyberRobotAvatar'
import {
  ShieldCheck,
  Mail,
  Compass,
  Satellite,
  ArrowRight,
  LogOut,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  Cpu,
  Activity,
  Lock,
} from 'lucide-react'

interface UserProfile {
  id: string
  email: string
  full_name: string
  avatar_url?: string
  role: string
  provider: string
  designation?: string
  email_verified?: boolean
}

export default function PreviewPage() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [diagnostics, setDiagnostics] = useState<string[]>([])

  const addLog = (msg: string) => {
    setDiagnostics((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 14)])
  }

  const fetchSession = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/auth/session')
      const data = await res.json()
      if (data.user) {
        setCurrentUser(data.user)
        addLog(`Session detected: ${data.user.email} (${data.user.role})`)
      } else {
        setCurrentUser(null)
        addLog('No active session (Unauthenticated)')
      }
    } catch (err: any) {
      addLog(`Error checking session: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSession()
  }, [])

  // Quick Guest Mode Trigger
  const handleQuickGuest = async () => {
    try {
      setActionLoading('quick_guest')
      setStatusMessage('Creating guest demo session...')
      addLog('Triggering Guest Demo Access...')

      const res = await fetch('/api/auth/guest', { method: 'POST' })
      const data = await res.json()
      if (data.success && data.user) {
        setCurrentUser(data.user)
        setStatusMessage('Guest demo session created!')
        addLog(`Authenticated as Guest: ${data.user.id}`)
      }
    } catch (err: any) {
      setStatusMessage(`Failed: ${err.message}`)
      addLog(`Guest login error: ${err.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  // Clear Session
  const handleSignOut = async () => {
    try {
      setActionLoading('signout')
      setStatusMessage('Terminating session...')
      addLog('Signing out...')

      await fetch('/api/auth/session', { method: 'DELETE' })
      setCurrentUser(null)
      setStatusMessage('Session terminated.')
      addLog('Session cleared from cookie store.')
    } catch (err: any) {
      addLog(`Sign out error: ${err.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-black text-white selection:bg-[#00FF88]/30">
      <Starfield />

      <main className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 pt-20 pb-16">
        {/* Top Control Navigation */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00FF88]/10 border border-[#00FF88]/40 text-[#00FF88] shadow-[0_0_15px_rgba(0,255,136,0.3)]">
              <Satellite size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#38BDF8]">
                  NAKSHATRA-X AUTHENTICATION
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#00FF88]/15 border border-[#00FF88]/40 px-2 py-0.5 text-[9px] font-mono text-[#00FF88] font-bold">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#00FF88] " />
                  LIVE PREVIEW
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Email OTP &amp; Guest Mode Console
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors"
            >
              &larr; Home
            </Link>
            <Link
              href="/admin/login"
              className="px-3 py-1.5 rounded-lg bg-[#38BDF8]/15 hover:bg-[#38BDF8]/25 border border-[#38BDF8]/50 text-[#38BDF8] font-bold transition-colors flex items-center gap-1"
            >
              <Lock size={11} /> Admin Users Store
            </Link>
            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded-lg bg-[#00FF88]/20 hover:bg-[#00FF88]/30 border border-[#00FF88]/50 text-[#00FF88] font-bold transition-colors flex items-center gap-1 shadow-[0_0_12px_rgba(0,255,136,0.2)]"
            >
              Launch Dashboard <ExternalLink size={12} />
            </Link>
          </div>

        </div>

        {/* Live Status Indicators Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/10 backdrop-blur-md">
            <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1 mb-1">
              <Mail size={12} className="text-[#38BDF8]" /> EMAIL OTP ENGINE
            </div>
            <div className="text-xs font-mono font-bold text-[#00FF88] flex items-center gap-1.5">
              <CheckCircle2 size={13} />
              Resend Delivery Active
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/10 backdrop-blur-md">
            <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1 mb-1">
              <Compass size={12} className="text-yellow-400" /> GUEST MODE
            </div>
            <div className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#00FF88]" />
              1-Click Demo Available
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/10 backdrop-blur-md">
            <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1 mb-1">
              <ShieldCheck size={12} className="text-[#00FF88]" /> CURRENT SESSION
            </div>
            <div className="text-xs font-mono font-bold text-[#38BDF8]">
              {loading ? 'Checking...' : currentUser ? `${currentUser.role} (${currentUser.provider})` : 'Logged Out'}
            </div>
          </div>
        </div>

        {/* Status Notification */}
        {statusMessage && (
          <div className="mb-6 p-3 rounded-xl bg-[#00FF88]/15 border border-[#00FF88]/40 text-[#00FF88] text-xs font-mono flex items-center justify-between animate-in fade-in">
            <span className="flex items-center gap-2">
              <CheckCircle2 size={14} /> {statusMessage}
            </span>
            <button type="button"
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-white text-[10px] uppercase font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Email OTP & Guest LoginForm */}
          <div className="lg:col-span-6 flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-3 px-2">
              <span className="text-xs font-mono text-[#38BDF8] font-bold tracking-wider uppercase flex items-center gap-1.5">
                <Lock size={13} /> Active Login Console
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Email OTP &bull; Guest Mode
              </span>
            </div>

            <Suspense fallback={<div className="text-xs font-mono text-slate-500 py-10">Loading access console...</div>}>
              <LoginForm />
            </Suspense>
          </div>

          {/* Right Column: Live Session Inspector & Diagnostic Feed */}
          <div className="lg:col-span-6 space-y-6">
            {/* Quick Guest Trigger Card */}
            <GlassCard className="p-5 border border-white/15">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Compass size={14} className="text-[#38BDF8]" /> Quick Guest Mode Demo
                </span>
                <button type="button"
                  onClick={fetchSession}
                  disabled={loading}
                  className="text-[10px] font-mono text-slate-400 hover:text-[#38BDF8] flex items-center gap-1 transition-colors"
                >
                  <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>

              <p className="text-xs text-slate-400 font-mono mb-4 leading-relaxed">
                Test the platform immediately without entering an email address. Guest mode grants observer clearance and opens the full dashboard.
              </p>

              <button type="button"
                onClick={handleQuickGuest}
                disabled={actionLoading !== null}
                className="w-full p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 hover:border-[#38BDF8]/60 text-white text-left font-mono text-xs font-bold transition-colors flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="text-white flex items-center gap-2">
                    <Compass size={14} className="text-[#38BDF8]" />
                    <span>Launch Quick Guest Session</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                    Instant demo clearance &bull; Session valid 24h
                  </div>
                </div>
                <ArrowRight size={14} className="text-[#38BDF8]" />
              </button>

              {currentUser && (
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-[#00FF88] flex items-center gap-1">
                    <CheckCircle2 size={12} /> Active session established
                  </span>
                  <button type="button"
                    onClick={handleSignOut}
                    disabled={actionLoading === 'signout'}
                    className="text-[11px] font-mono text-[#FF2E63] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <LogOut size={12} /> Sign Out
                  </button>
                </div>
              )}
            </GlassCard>

            {/* Live Session State Inspector */}
            <GlassCard className="p-5 border border-white/15">
              <div className="text-xs font-mono font-bold text-[#38BDF8] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Cpu size={14} /> Active Session State
              </div>

              {loading ? (
                <div className="py-8 text-center text-xs font-mono text-slate-400">
                  Checking active cookie store...
                </div>
              ) : currentUser ? (
                <div className="space-y-4">
                  {/* User Profile Card with 3D Cyber Robot DP */}
                  <div className="p-4 rounded-xl bg-black/50 border border-[#00FF88]/30 flex items-center gap-4">
                    <CyberRobotAvatar size="md" className="h-12 w-12 shrink-0 border-2 border-[#00FF88] shadow-[0_0_15px_rgba(0,255,136,0.3)]" />
                    <div className="flex-1 min-w-0">

                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm truncate">
                          {currentUser.full_name}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#00FF88]/15 text-[#00FF88] border border-[#00FF88]/40">
                          ACTIVE
                        </span>
                      </div>
                      <div className="text-xs font-mono text-[#38BDF8] truncate">
                        {currentUser.email}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                        {currentUser.role} &bull; {currentUser.designation}
                      </div>
                    </div>
                  </div>

                  {/* Properties Table */}
                  <div className="rounded-xl overflow-hidden border border-white/10 bg-black/40 text-[11px] font-mono">
                    <div className="divide-y divide-white/5">
                      <div className="px-3 py-2 flex justify-between">
                        <span className="text-slate-400">User ID:</span>
                        <span className="text-white font-bold">{currentUser.id}</span>
                      </div>
                      <div className="px-3 py-2 flex justify-between">
                        <span className="text-slate-400">Auth Method:</span>
                        <span className="text-[#38BDF8]">{currentUser.provider}</span>
                      </div>
                      <div className="px-3 py-2 flex justify-between">
                        <span className="text-slate-400">Email Verified:</span>
                        <span className={currentUser.email_verified ? 'text-[#00FF88]' : 'text-slate-400'}>
                          {currentUser.email_verified ? 'true (Inbox Verified)' : 'false (Guest)'}
                        </span>
                      </div>
                      <div className="px-3 py-2 flex justify-between">
                        <span className="text-slate-400">Cookie:</span>
                        <span className="text-purple-300">nx-operator-session</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Link
                      href="/dashboard"
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#00FF88]/25 to-[#38BDF8]/25 hover:from-[#00FF88]/35 hover:to-[#38BDF8]/35 border border-[#00FF88] text-center font-mono text-xs font-bold text-white transition-colors shadow-[0_0_20px_rgba(0,255,136,0.2)] flex items-center justify-center gap-1.5"
                    >
                      Enter Operator Console <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-xl bg-black/40 border border-white/10 text-center">
                  <div className="text-slate-500 font-mono text-xs mb-2">
                    No active session in cookies.
                  </div>
                  <p className="text-[11px] font-mono text-slate-400 max-w-xs mx-auto">
                    Enter your email to receive an OTP code, or click Guest Mode to test the website instantly.
                  </p>
                </div>
              )}
            </GlassCard>

            {/* Real-time Diagnostics Log */}
            <GlassCard className="p-4 border border-white/10">
              <div className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Activity size={12} className="text-[#38BDF8]" /> Diagnostic Feed
              </div>
              <div className="h-28 overflow-y-auto rounded-lg bg-black/70 p-2.5 font-mono text-[10px] text-slate-300 space-y-1 border border-white/5">
                {diagnostics.length === 0 ? (
                  <div className="text-slate-600">Awaiting events...</div>
                ) : (
                  diagnostics.map((d, i) => (
                    <div key={i} className="text-slate-400 border-b border-white/[0.02] pb-0.5">
                      {d}
                    </div>
                  ))
                )}
              </div>
            </GlassCard>
          </div>
        </div>
      </main>
    </div>
  )
}
