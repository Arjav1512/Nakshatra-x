import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import {
  SESSION_COOKIE,
  buildSession,
  encodeSession,
  requestIsHttps,
  sessionCookieOptions,
} from '@/lib/session'

/**
 * Guest/demo access. The server assigns the `guest` role; nothing is read from
 * the request body. The cookie is signed and httpOnly (it was previously
 * httpOnly: false, so page scripts could read and tamper with it).
 */
export async function POST(request: Request) {
  try {
    const id = `guest_${crypto.randomBytes(6).toString('hex')}`
    const profile = buildSession({
      id,
      email: 'guest@nakshatra-x.demo',
      full_name: 'Guest Operator',
      avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(id)}&backgroundColor=050b14`,
      role: 'guest',
      provider: 'Guest Access',
      designation: 'Demo Observer',
      email_verified: false,
      ttlSeconds: 60 * 60 * 24,
    })

    const cookieStore = await cookies()
    cookieStore.set(
      SESSION_COOKIE,
      encodeSession(profile),
      sessionCookieOptions(requestIsHttps(request), 60 * 60 * 24)
    )

    return NextResponse.json({ success: true, message: 'Guest session created', user: profile })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to create guest session' },
      { status: 500 }
    )
  }
}
