import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, decodeSession } from '@/lib/session'

/**
 * Session inspection endpoint.
 *
 * GET returns the current verified session, or null.
 *
 * There is deliberately no POST. This route previously minted a session from
 * an unauthenticated request body, including a caller-supplied `role`, which
 * let anyone become any user (superadmin included) with a single request.
 * Sessions are now issued only by routes that have actually verified an
 * identity: OTP verification, the GitHub OAuth callback, and guest access.
 */
export async function GET() {
  try {
    const cookieStore = await cookies()
    const user = decodeSession(cookieStore.get(SESSION_COOKIE)?.value)
    return NextResponse.json({ user })
  } catch {
    return NextResponse.json({ user: null })
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE, '', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
  } catch {
    // Ignore — clearing is best-effort.
  }
  return NextResponse.json({ success: true })
}
