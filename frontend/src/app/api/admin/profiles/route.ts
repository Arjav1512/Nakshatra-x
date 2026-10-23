import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'

export async function GET() {
  // This authorised on `admin_session === 'true'`. That cookie is issued as a
  // non-authoritative UI hint — /api/admin/auth says so in as many words — and
  // httpOnly stops a script *reading* a cookie, not writing one, so the check
  // was satisfiable from the browser console. It is the same forgeable-cookie
  // defect this project already fixed once; `requireAdmin` (the signed-token
  // check written at that time, in lib/auth.ts) had simply never been wired in
  // here.
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }


  const usersList: any[] = []
  const seenIds = new Set<string>()

  // 1. Fetch real authenticated users directly from Supabase Auth via Admin SDK
  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers()
    if (!authError && authData?.users) {
      for (const u of authData.users) {
        seenIds.add(u.id)
        const meta = u.user_metadata || {}
        const appMeta = u.app_metadata || {}
        const providerName =
          appMeta.provider === 'nakshatra-admin-sealed'
            ? 'Master Admin'
            : appMeta.provider === 'google'
            ? 'Google OAuth'
            : appMeta.provider === 'email'
            ? 'Email OTP'
            : (u.identities && u.identities[0]?.provider) || 'Supabase Auth'

        usersList.push({
          id: u.id,
          email: u.email || 'No Email',
          full_name:
            meta.full_name || meta.name || u.email?.split('@')[0] || 'Orbital Operator',
          avatar_url: meta.avatar_url || meta.picture || null,
          role:
            meta.role ||
            (appMeta.role === 'superadmin' ? 'Chief Orbital Commander' : 'Mission Specialist'),
          provider: providerName,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at || u.created_at || new Date().toISOString(),
        })
      }
    }
  } catch (err) {
    console.error('[ADMIN] Error listing Supabase auth users:', err)
  }


  // 2. Fetch from Supabase profiles table (if created)
  try {
    const { data: profiles, error: profError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (!profError && profiles) {
      for (const p of profiles) {
        if (!seenIds.has(p.id)) {
          seenIds.add(p.id)
          usersList.push({
            id: p.id,
            email: p.email,
            full_name: p.full_name,
            avatar_url: p.avatar_url || null,
            role: p.role || 'operator',
            provider: p.provider || 'Supabase',
            created_at: p.created_at,
            last_sign_in_at: p.last_sign_in_at || null,
          })
        }
      }
    }
  } catch (err) {
    console.warn('[ADMIN] Profiles table not yet queried:', err)
  }

  // Two fallbacks stood here. One parsed the requester's `nx-operator-session`
  // cookie as unverified JSON and listed it as a registered user, role and all;
  // the other, when the list was empty, inserted an invented "Commander" with a
  // real person's name, dated yesterday. An admin's user list holds only users
  // the auth provider returned; when it returns none, the list is empty.
  return NextResponse.json({ users: usersList })
}

