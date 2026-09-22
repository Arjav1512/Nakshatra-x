'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Starfield } from '@/components/nakshatra/sections'
import { GlassCard } from '@/components/nakshatra/ui'
import { ShieldCheck, Loader2, AlertCircle, ArrowRight } from 'lucide-react'
import Link from 'next/link'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<string>('Authenticating with Supabase & Google...')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function processAuth() {
      try {
        const errorParam = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')

        if (errorParam) {
          throw new Error(errorDescription || errorParam || 'Authentication failed from provider.')
        }

        const code = searchParams.get('code')
        const next = searchParams.get('next') || '/dashboard'

        let session = null

        // 1. If PKCE code is in URL, exchange it for session using Supabase client
        if (code) {
          setStatus('Exchanging authentication token with Supabase...')
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

          if (exchangeError) {
            console.warn('[AUTH CALLBACK] exchangeCodeForSession notice:', exchangeError.message)
            // Try fetching session if already stored
            const { data: existingData } = await supabase.auth.getSession()
            session = existingData?.session || null
            if (!session) {
              throw exchangeError
            }
          } else {
            session = data.session
          }
        } else {
          // 2. Otherwise, check active session from hash or local client
          setStatus('Verifying active Supabase session...')
          const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
          if (sessionErr) throw sessionErr
          session = sessionData.session
        }

        // 3. If session found, extract real user profile data
        if (session?.user) {
          const user = session.user
          const meta = user.user_metadata || {}

          const profile = {
            id: user.id,
            email: user.email || '',
            full_name:
              meta.full_name || meta.name || user.email?.split('@')[0] || 'Orbital Specialist',
            avatar_url: meta.avatar_url || meta.picture || '',
            role: 'operator',
            designation: 'Mission Specialist',
            provider: 'Supabase Google',
            email_verified: !!user.email_confirmed_at,
          }

          if (isMounted) setStatus('Synchronizing orbital operator profile...')

          // 4. Upsert into Supabase profiles table
          try {
            await supabase.from('profiles').upsert(
              {
                id: profile.id,
                email: profile.email,
                full_name: profile.full_name,
                avatar_url: profile.avatar_url,
                role: profile.role,
                provider: profile.provider,
                last_sign_in_at: new Date().toISOString(),
              },
              { onConflict: 'id' }
            )
          } catch (dbErr) {
            console.warn('[AUTH CALLBACK] Profile table upsert skipped:', dbErr)
          }

          // 5. Establish secure server session cookie for Next.js
          const sessionRes = await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profile),
          })

          if (!sessionRes.ok) {
            console.warn('[AUTH CALLBACK] Session API response not OK, setting client cookie')
          }

          // Also set client cookie as immediate sync
          try {
            document.cookie = `nx-operator-session=${encodeURIComponent(
              JSON.stringify(profile)
            )}; path=/; max-age=604800; SameSite=Lax`
          } catch {
            // Ignore
          }

          if (isMounted) {
            setStatus('Identity confirmed! Entering Orbital Console...')
            setTimeout(() => {
              window.location.href = next
            }, 300)
          }
          return
        }

        // If no user/session found after checking
        throw new Error('No valid Supabase user session was returned. Please try logging in again.')
      } catch (err: any) {
        console.error('[AUTH CALLBACK ERROR]:', err)
        if (isMounted) {
          setError(err?.message || 'Authentication failed. Please return to login.')
          setStatus('Authentication incomplete.')
        }
      }
    }

    processAuth()

    return () => {
      isMounted = false
    }
  }, [searchParams, router])

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-black text-white flex items-center justify-center p-4">
      <Starfield />

      <GlassCard className="relative z-10 w-full max-w-md p-8 text-center border border-white/15 shadow-[0_0_50px_rgba(0,0,0,0.85)]">
        <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-[#00FF88]/10 border border-[#00FF88]/40 text-[#00FF88] shadow-[0_0_24px_rgba(0,255,136,0.3)] mb-4">
          <ShieldCheck size={30} />
        </div>

        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-[#38BDF8] mb-1">
          NAKSHATRA-X SECURITY GATEWAY
        </div>

        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mb-2">
          Supabase Authentication
        </h2>

        {error ? (
          <div className="space-y-4 text-left">
            <div className="p-3.5 text-xs font-mono rounded-xl bg-[#FF2E63]/15 border border-[#FF2E63]/50 text-[#FF2E63] flex items-start gap-2.5">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>

            <Link
              href="/login"
              className="w-full py-3 px-4 rounded-xl bg-[#38BDF8]/20 hover:bg-[#38BDF8]/30 border border-[#38BDF8]/60 text-[#38BDF8] hover:text-white font-mono text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
            >
              <span>Return to Login</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-center gap-3 text-sm font-mono text-[#00FF88]">
              <Loader2 size={18} className="animate-spin text-[#00FF88]" />
              <span>{status}</span>
            </div>
            <p className="text-xs font-mono text-slate-400">
              Validating real Google credentials &amp; orbital clearance...
            </p>
          </div>
        )}
      </GlassCard>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center font-mono text-xs text-slate-400">
          Loading orbital authentication gateway...
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  )
}
