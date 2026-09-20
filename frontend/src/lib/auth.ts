import { cookies } from 'next/headers'
import {
  ADMIN_COOKIE,
  SESSION_COOKIE,
  decodeAdmin,
  decodeSession,
} from '@/lib/session'

export interface UserProfile {
  id: string
  email: string
  full_name: string
  avatar_url?: string
  role: string
  provider: string
  designation?: string
  email_verified?: boolean
}

/**
 * Verify and decode a session cookie.
 *
 * This previously JSON-parsed whatever the browser sent and trusted the
 * `role` field inside it, so a forged cookie granted any role. It now
 * requires a valid HMAC signature produced by this server.
 */
export function parseSessionCookie(rawCookie: string | undefined): UserProfile | null {
  const session = decodeSession(rawCookie)
  if (!session) return null
  return {
    id: session.id,
    email: session.email,
    full_name: session.full_name,
    avatar_url: session.avatar_url || '',
    role: session.role,
    provider: session.provider,
    designation: session.designation,
    email_verified: !!session.email_verified,
  }
}

export async function getCurrentUser(): Promise<UserProfile | null> {
  try {
    const cookieStore = await cookies()

    // 1. Signed operator session.
    const user = parseSessionCookie(cookieStore.get(SESSION_COOKIE)?.value)
    if (user) return user

    // 2. Signed administrator token.
    //
    // The previous implementation also granted `superadmin` whenever a cookie
    // literally named `admin_session` had the value "true". httpOnly prevents
    // scripts reading a cookie but not writing one, so that check could be
    // satisfied from the browser console. Admin identity now requires a token
    // signed by this server.
    const admin = decodeAdmin(cookieStore.get(ADMIN_COOKIE)?.value)
    if (admin) {
      return {
        id: admin.id,
        email: admin.email,
        full_name: admin.full_name,
        avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin&backgroundColor=050b14',
        role: 'superadmin',
        provider: 'Master Administration',
        designation: 'Chief Administrator',
        email_verified: true,
      }
    }
  } catch (err) {
    console.error('[AUTH] getCurrentUser error:', err)
  }

  return null
}

/** True only for a verified administrator token. */
export async function requireAdmin(): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    return decodeAdmin(cookieStore.get(ADMIN_COOKIE)?.value) !== null
  } catch {
    return false
  }
}
