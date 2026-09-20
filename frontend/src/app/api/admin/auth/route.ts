import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import {
  ADMIN_COOKIE,
  buildAdmin,
  encodeAdmin,
  requestIsHttps,
  sessionCookieOptions,
} from '@/lib/session'

// POST: Authenticate the Primary Administrator
export async function POST(request: Request) {
  try {
    const { identifier, password } = await request.json()

    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Email/Username and Master Password are required.' },
        { status: 400 }
      )
    }

    let targetEmail = identifier.trim().toLowerCase()

    // If identifier is a username, look up the email
    if (!targetEmail.includes('@')) {
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers()
      const matched = usersData?.users?.find(
        (u) =>
          u.user_metadata?.username?.toLowerCase() === targetEmail &&
          (u.app_metadata?.role === 'superadmin' || u.user_metadata?.is_primary_admin === true)
      )

      if (matched && matched.email) {
        targetEmail = matched.email
      } else {
        return NextResponse.json(
          { error: 'Commander account matching this username was not found.' },
          { status: 401 }
        )
      }
    }

    // 1. Sign in with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: targetEmail,
      password: password,
    })

    if (authError || !authData?.user) {
      // No local password fallback. This block previously accepted two
      // hardcoded passwords and granted superadmin without contacting Supabase,
      // which was a complete authentication bypass.
      return NextResponse.json(
        { error: 'Invalid administrator credentials.' },
        { status: 401 }
      )
    }

    const user = authData.user
    const isSuperAdmin =
      user.app_metadata?.role === 'superadmin' ||
      user.user_metadata?.is_primary_admin === true

    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: 'ACCESS_DENIED: This account does not possess Commander clearance.' },
        { status: 403 }
      )
    }

    // 2. Issue a signed administrator token. The `admin_session` cookie is a
    // non-authoritative UI hint only — authorisation is decided solely by the
    // signed token below (see lib/auth.ts).
    const maxAge = 60 * 60 * 24 * 7
    const cookieStore = await cookies()
    const isHttps = requestIsHttps(request)

    cookieStore.set('admin_session', 'true', sessionCookieOptions(isHttps, maxAge))
    cookieStore.set(
      ADMIN_COOKIE,
      encodeAdmin(
        buildAdmin({
          id: user.id,
          email: user.email || targetEmail,
          username: user.user_metadata?.username,
          full_name: user.user_metadata?.full_name || 'Administrator',
          ttlSeconds: maxAge,
        })
      ),
      sessionCookieOptions(isHttps, maxAge)
    )

    return NextResponse.json({
      success: true,
      admin: {
        id: user.id,
        email: user.email,
        username: user.user_metadata?.username,
        full_name: user.user_metadata?.full_name,
      },
    })
  } catch (err: any) {
    console.error('[ADMIN/AUTH] Login exception:', err)
    return NextResponse.json(
      { error: err?.message || 'Authentication service error.' },
      { status: 500 }
    )
  }
}

// DELETE: Terminate Admin Session
export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete('admin_session')
  cookieStore.delete(ADMIN_COOKIE)
  return NextResponse.json({ success: true, message: 'Admin session terminated.' })
}
