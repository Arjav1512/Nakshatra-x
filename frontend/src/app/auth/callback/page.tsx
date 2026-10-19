'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
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

          if (isMounted) setStatus('Loading your profile…')

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
            setStatus('Signed in. Opening the console…')
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

  // The design reference's flat card on the page ground; the pure-black full
  // screen and the "orbital clearance" copy are gone. The status line is
  // announced, so a screen reader hears the sign-in progress.
  return (
    <main className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-4 py-12">
      <GlassCard className="w-full max-w-md p-8 text-left">
        <p className="label flex items-center gap-2">
          <ShieldCheck size={14} aria-hidden="true" />
          Nakshatra&#8209;X · sign-in
        </p>

        <h1 className="mt-3 font-display text-3xl text-text-primary">
          Completing sign-in
        </h1>

        {error ? (
          <div className="mt-6 space-y-4">
            <div role="alert" className="flex items-start gap-2.5 rounded-tile border border-status-critical/40 bg-status-critical/[0.06] p-3.5 text-sm text-status-critical">
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>

            <Link
              href="/login"
              className="flex h-[42px] w-full items-center justify-center gap-2 rounded-md bg-inverse-bg px-4 text-base tracking-[0.044em] text-inverse-fg transition-[background-color] duration-[180ms] ease-out hover:bg-inverse-hover"
            >
              <span>Return to Login</span>
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <div role="status" className="flex items-center gap-3 text-base text-text-primary">
              <Loader2 size={18} className="animate-spin text-text-secondary" aria-hidden="true" />
              <span>{status}</span>
            </div>
            <p className="text-sm text-text-secondary">
              Checking the credentials your provider returned.
            </p>
          </div>
        )}
      </GlassCard>
    </main>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-4 text-sm text-text-secondary">
          Loading sign-in…
        </main>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  )
}
