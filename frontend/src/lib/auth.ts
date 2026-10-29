import { cookies } from 'next/headers'
import { ADMIN_COOKIE, decodeAdmin } from '@/lib/session'

/** The signed administrator token's profile, or null. */
export async function currentAdmin() {
  try {
    const cookieStore = await cookies()
    return decodeAdmin(cookieStore.get(ADMIN_COOKIE)?.value)
  } catch {
    return null
  }
}

export async function requireAdmin(): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    return decodeAdmin(cookieStore.get(ADMIN_COOKIE)?.value) !== null
  } catch {
    return false
  }
}
