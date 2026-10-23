import type { User } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Who the primary administrator is, decided only from server-controlled data.
 *
 * Admin login and the single-slot setup both accepted
 * `user_metadata.is_primary_admin === true` as proof of superadmin. In Supabase,
 * user_metadata is written by the user — `auth.updateUser({ data })` with the
 * public key that ships to every browser — so any account could grant itself
 * the admin role. `app_metadata` is the field only the service role can set.
 */
export function isSuperadmin(user: Pick<User, 'app_metadata'> | null | undefined): boolean {
  return user?.app_metadata?.role === 'superadmin'
}

export type SlotLookup = { ok: true; admin: User | null } | { ok: false; reason: string }

const PER_PAGE = 1000
const MAX_PAGES = 100

/**
 * Find the superadmin by reading every page of users.
 *
 * The slot check read only the first page (50 users by default), so once the
 * admin was not on it the slot looked free and an anonymous POST could create
 * a second superadmin; and it reported the slot free on any lookup error.
 * Failure is now its own result, so callers can refuse instead of assuming.
 */
export async function findSuperadmin(): Promise<SlotLookup> {
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: PER_PAGE })
      if (error) return { ok: false, reason: error.message }
      const users = data?.users ?? []
      const admin = users.find(isSuperadmin)
      if (admin) return { ok: true, admin }
      if (users.length < PER_PAGE) return { ok: true, admin: null }
    }
    return { ok: false, reason: 'More users than the lookup reads; the slot status is unknown.' }
  } catch (err: any) {
    return { ok: false, reason: err?.message || 'User lookup failed.' }
  }
}
