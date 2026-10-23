import { createClient } from '@supabase/supabase-js'

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseUrl = (rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))
  ? rawUrl
  : 'https://xtnfzngrhdtazisrvbci.supabase.co'

const rawAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabaseAnonKey = (rawAnonKey && rawAnonKey !== '[SENSITIVE]')
  ? rawAnonKey
  : 'sb_publishable_EJZOXmiFJaI553N9DzCGuw_wA5BdnsB'

const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabaseServiceKey = (rawServiceKey && rawServiceKey !== '[SENSITIVE]')
  ? rawServiceKey
  : ''

// Client-side Supabase client (anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * A Supabase client for one server request.
 *
 * `supabase` above keeps whatever session was last signed in on it. In the
 * browser that is the visitor's own; on the server the module is shared by
 * every request, and admin login (signInWithPassword) and code verification
 * (verifyOtp) signed in on it — so the last user to sign in stayed signed in
 * on the client that later requests, and `supabaseAdmin` when no service key
 * is set, used for their own reads and writes. Server code that signs in or
 * verifies uses a client of its own, which is dropped with the request.
 */
export function serverAuthClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

// Server-side Admin Supabase client (service role key, bypasses RLS)
// Safely created only when service role key is present; falls back to standard client on browser side to prevent runtime crash
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : supabase

export interface SupabaseProfile {
  id: string
  email: string
  full_name: string
  avatar_url?: string | null
  role?: string
  provider?: string
  last_sign_in_at?: string
  created_at?: string
}

/**
 * Trigger Google OAuth Sign-in through Supabase
 */
export async function signInWithSupabaseGoogle(redirectTo?: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const targetRedirect = redirectTo || `${origin}/auth/callback`

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: targetRedirect,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })

  if (error) {
    throw error
  }

  // If Supabase returns an OAuth redirect URL, redirect the browser
  if (data?.url && typeof window !== 'undefined') {
    window.location.href = data.url
  }

  return data
}
