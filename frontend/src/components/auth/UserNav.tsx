'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Compass,
  LogOut,
  ShieldCheck,
  LayoutDashboard,
  Loader2,
  Mail,
  User,
} from 'lucide-react'

interface UserData {
  id: string
  email: string
  full_name: string
  avatar_url?: string
}

export function UserNav() {
  const router = useRouter()
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<'google' | 'github' | 'guest' | 'logout' | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function getUser() {
      try {
        const res = await fetch('/api/auth/session')
        if (res.ok) {
          const data = await res.json()
          if (data.user) {
            setUser(data.user)
          }
        }
      } catch {
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    getUser()
  }, [])

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleGuestLogin = async () => {
    setActionLoading('guest')
    try {
      const res = await fetch('/api/auth/guest', { method: 'POST' })
      const data = await res.json()
      if (data.success && data.user) {
        document.cookie = `nx-operator-session=${encodeURIComponent(JSON.stringify(data.user))}; path=/; max-age=86400; SameSite=Lax`
        setUser(data.user)
        setMenuOpen(false)
        router.push('/dashboard')
      } else {
        router.push('/login')
      }
    } catch (err) {
      console.warn('Guest login error:', err)
      router.push('/login')
    } finally {
      setActionLoading(null)
    }
  }

  const handleGoogleLogin = () => {
    setMenuOpen(false)
    router.push('/login')
  }

  const handleGithubLogin = () => {
    setActionLoading('github')
    setMenuOpen(false)
    window.location.href = '/api/auth/github'
  }

  const handleLogout = () => {
    document.cookie = 'nx-operator-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    document.cookie = 'admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    setUser(null)
    setMenuOpen(false)
    router.push('/login')
  }

  return (
    <div className="relative inline-block text-left" ref={popoverRef}>
      {/* Account control.

          The two stacked green dots that used to sit here rendered
          unconditionally — they were not guarded by `user` — so a signed-out
          visitor saw the same "active" indicator as a signed-in operator. They
          are gone rather than made conditional: session state belongs in the
          label, where a screen reader can reach it, not in a colour.

          Also dropped: hover scale and the glow shadow, both banned by the
          motion and elevation policies. */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        aria-expanded={menuOpen}
        aria-haspopup="true"
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-interactive bg-surface-2 text-text-secondary transition-colors duration-[120ms] ease-out hover:bg-surface-3 hover:text-text-primary"
        type="button"
        title={user ? `Signed in as ${user.full_name || user.email}` : 'Sign in'}
      >
        <User className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">{user ? 'Account menu' : 'Sign in'}</span>
      </button>

      {/* Floating Interactive Popover Menu */}
      {menuOpen && (
        <div className="absolute right-0 z-50 mt-2 w-72 space-y-3 rounded-md border border-border-default bg-surface-3 p-4  sm:w-80">
          {/* Header Status */}
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-accent" />
              <span className="text-xs font-mono font-bold text-text-primary uppercase tracking-wider">
                {user ? 'Authenticated Session' : 'Access Console'}
              </span>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/40">
              {user ? 'OPERATOR' : 'SELECT MODE'}
            </span>
          </div>

          {/* User Info (If Authenticated) */}
          {user ? (
            <div className="p-3 rounded-md bg-surface-2 border border-border-subtle space-y-2">
              <div className="text-xs font-bold text-text-primary truncate font-sans">
                {user.full_name || user.email}
              </div>
              <div className="text-xs font-mono text-text-secondary truncate">
                {user.email}
              </div>
              <div className="pt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    router.push('/dashboard')
                  }}
                  className="flex-1 py-2 px-3 rounded-md bg-accent/20 border border-accent text-accent hover:text-text-primary font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <LayoutDashboard size={14} />
                  <span>Dashboard</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="py-2 px-3 rounded-md bg-status-critical/20 border border-status-critical/60 text-status-critical hover:text-text-primary font-mono text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut size={14} />
                </button>
              </div>
            </div>
          ) : (
            /* Sign In Options (Google, GitHub, Guest, Email) */
            <div className="space-y-2.5">
              <p className="text-xs font-mono text-text-secondary leading-snug">
                Select your authentication method or launch Guest Mode:
              </p>

              {/* Google Sign-in */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 px-3.5 rounded-md bg-white hover:bg-text-primary text-slate-900 font-sans font-semibold text-xs transition-colors shadow-md cursor-pointer group"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </button>

              {/* GitHub Sign-in */}
              <button
                type="button"
                onClick={handleGithubLogin}
                disabled={actionLoading === 'github'}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 px-3.5 rounded-md bg-surface-3 hover:bg-[#1B1F23] border border-border-interactive text-text-primary font-sans font-semibold text-xs transition-colors shadow-md cursor-pointer group disabled:opacity-50"
              >
                {actionLoading === 'github' ? (
                  <Loader2 size={15} className="animate-spin text-text-primary" />
                ) : (
                  <svg className="w-4 h-4 shrink-0 fill-current text-text-primary" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                )}
                <span>{actionLoading === 'github' ? 'Connecting GitHub...' : 'Sign in with GitHub'}</span>
              </button>

              {/* Guest Mode Trigger */}
              <button
                type="button"
                onClick={handleGuestLogin}
                disabled={actionLoading === 'guest'}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-md bg-accent/15 hover:bg-accent/25 border border-accent/60 text-accent font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer  disabled:opacity-50"
              >
                {actionLoading === 'guest' ? (
                  <Loader2 size={15} className="animate-spin text-accent" />
                ) : (
                  <Compass size={15} className="text-accent" />
                )}
                <span>{actionLoading === 'guest' ? 'Entering Guest Mode...' : 'Enter Guest Mode'}</span>
              </button>

              {/* Email OTP Link */}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  router.push('/login')
                }}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md bg-surface-2 hover:bg-surface-3 text-text-secondary text-xs font-mono transition-colors cursor-pointer border border-border-subtle"
              >
                <Mail size={13} className="text-accent" />
                <span>Or Sign in with Email OTP &rarr;</span>
              </button>
            </div>
          )}

          {/* Footer Badge */}
          <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-xs font-mono text-text-secondary">
            <span>MOIL &bull; NAKSHATRA-X</span>
            <span className="text-accent">SECURED ACCESS</span>
          </div>
        </div>
      )}
    </div>
  )
}
