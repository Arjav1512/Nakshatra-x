import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { findSuperadmin } from '@/lib/admin-slot'
import { ADMIN_COOKIE, buildAdmin, encodeAdmin, requestIsHttps, sessionCookieOptions } from '@/lib/session'

/*
 * The single primary-admin slot.
 *
 * The slot check reported the slot free whenever the user lookup failed, read
 * only the first page of users, and counted `user_metadata.is_primary_admin`
 * (writable by any user) as an admin — any of which let an anonymous POST here
 * create a second superadmin. GET also returned the admin's id, e-mail,
 * username and full name to anyone, i.e. both login identifiers. Now the
 * lookup reads every page, only `app_metadata.role` counts, an unknown status
 * refuses rather than assumes, and GET says only whether the slot is free.
 */
const UNAVAILABLE = {
  error: 'The administrator slot status could not be determined. Setup is refused until it can be.',
}

// GET: Check slot availability. "Unknown" is an answer, not a server error:
// isSlotAvailable is null and clients must not treat it as free. Setup itself
// (POST) is refused with 503 while the status is unknown.
export async function GET() {
  const lookup = await findSuperadmin()
  if (!lookup.ok) {
    console.error('[ADMIN/SETUP] slot lookup failed:', lookup.reason)
    return NextResponse.json({ isSlotAvailable: null, ...UNAVAILABLE, policy: 'SINGLE_PRIMARY_ADMIN_LOCK' })
  }
  return NextResponse.json({
    isSlotAvailable: lookup.admin === null,
    policy: 'SINGLE_PRIMARY_ADMIN_LOCK',
  })
}

// POST: Register the single primary administrator
export async function POST(request: Request) {
  try {
    // 1. Enforce strict single-slot lock — and refuse when it cannot be checked.
    const lookup = await findSuperadmin()
    if (!lookup.ok) {
      console.error('[ADMIN/SETUP] slot lookup failed:', lookup.reason)
      return NextResponse.json(UNAVAILABLE, { status: 503 })
    }
    if (lookup.admin !== null) {
      return NextResponse.json(
        {
          error:
            'ADMIN_SLOT_SEALED: The single primary admin slot has already been claimed. No additional admin accounts are permitted.',
          isSlotAvailable: false,
        },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { email, password, username, fullName } = body

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email address is required.' }, { status: 400 })
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: 'Master access password must be at least 8 characters long.' },
        { status: 400 }
      )
    }

    const adminUsername = (username || 'commander').trim().toLowerCase()
    const adminFullName = (fullName || 'Primary Orbital Commander').trim()

    // 2. Create the superadmin in Supabase Auth with bcrypt hashing
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: password,
      email_confirm: true,
      // The role lives in app_metadata, which only the service role can set.
      user_metadata: {
        username: adminUsername,
        full_name: adminFullName,
        role: 'Chief Orbital Commander',
        security_clearance: 'LEVEL-5-OMEGA',
      },
      app_metadata: {
        role: 'superadmin',
        provider: 'nakshatra-admin-sealed',
      },
    })

    if (createError || !created?.user) {
      return NextResponse.json(
        { error: createError?.message || 'Failed to initialize administrator in Supabase.' },
        { status: 500 }
      )
    }

    // 3. Record in public.profiles table as well
    try {
      await supabaseAdmin.from('profiles').upsert(
        {
          id: created.user.id,
          email: created.user.email,
          full_name: adminFullName,
          role: 'Chief Orbital Commander',
          provider: 'Master Admin',
          last_sign_in_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
    } catch {
      // Ignored if profiles table has specific policy
    }

    // 4. Sign the new administrator in with the same signed token as login.
    // This set an unsigned JSON `nx_admin_token` that decodeAdmin() rejects, so
    // a freshly created admin was not signed in at all.
    const maxAge = 60 * 60 * 24 * 7
    const cookieStore = await cookies()
    cookieStore.set(
      ADMIN_COOKIE,
      encodeAdmin(
        buildAdmin({
          id: created.user.id,
          email: created.user.email || email.trim().toLowerCase(),
          username: adminUsername,
          full_name: adminFullName,
          ttlSeconds: maxAge,
        })
      ),
      sessionCookieOptions(requestIsHttps(request), maxAge)
    )

    console.log(`[ADMIN/SETUP] Single admin slot claimed by: ${created.user.email}`)

    return NextResponse.json({
      success: true,
      message: 'Primary Commander successfully initialized. Admin slot permanently sealed.',
      admin: {
        id: created.user.id,
        email: created.user.email,
        username: adminUsername,
        full_name: adminFullName,
      },
    })
  } catch (err: any) {
    console.error('[ADMIN/SETUP] Fatal error in admin registration:', err)
    return NextResponse.json(
      { error: err?.message || 'Internal server error initializing administrator.' },
      { status: 500 }
    )
  }
}
