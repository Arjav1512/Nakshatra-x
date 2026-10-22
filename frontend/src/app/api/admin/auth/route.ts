import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { serverAuthClient } from '@/lib/supabase'
import { findSuperadmin, isSuperadmin } from '@/lib/admin-slot'
import { currentAdmin } from '@/lib/auth'
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

    // If identifier is a username, it can only be the superadmin's.
    if (!targetEmail.includes('@')) {
      const lookup = await findSuperadmin()
      if (!lookup.ok) {
        return NextResponse.json(
          { error: 'The administrator lookup is unavailable. Sign in with the e-mail address.' },
          { status: 503 }
        )
      }
      const matched =
        lookup.admin && lookup.admin.user_metadata?.username?.toLowerCase() === targetEmail
          ? lookup.admin
          : null

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
    const { data: authData, error: authError } = await serverAuthClient().auth.signInWithPassword({
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

    // app_metadata only: user_metadata is writable by the user themself, so
    // `user_metadata.is_primary_admin` let any account make itself admin.
    const user = authData.user
    if (!isSuperadmin(user)) {
      return NextResponse.json(
        { error: 'ACCESS_DENIED: This account does not possess Commander clearance.' },
        { status: 403 }
      )
    }

    // 2. Issue a signed administrator token. Authorisation is decided solely
    // by it (lib/auth.ts). The `admin_session` "UI hint" it used to set was
    // HttpOnly, so the admin pages, which read it through document.cookie,
    // never saw it and sent every signed-in admin back to the login form; they
    // now ask GET below.
    const maxAge = 60 * 60 * 24 * 7
    const cookieStore = await cookies()
    const isHttps = requestIsHttps(request)

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

// GET: who the signed administrator token says is signed in, or 401.
export async function GET() {
  const admin = await currentAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Not signed in as administrator.' }, { status: 401 })
  }
  return NextResponse.json({
    admin: { id: admin.id, email: admin.email, username: admin.username, full_name: admin.full_name },
  })
}

// DELETE: Terminate Admin Session
export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete('admin_session')
  cookieStore.delete(ADMIN_COOKIE)
  return NextResponse.json({ success: true, message: 'Admin session terminated.' })
}
