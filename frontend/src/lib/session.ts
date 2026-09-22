/**
 * Signed session cookies.
 *
 * Previously the session cookie was a plain JSON blob: anyone could craft
 * `{"email":"x","role":"superadmin"}`, set the cookie, and be treated as that
 * user. The cookie is now HMAC-signed server-side and verified on every read,
 * and the role is assigned by the server — never taken from client input.
 */
import crypto from 'node:crypto'

export const SESSION_COOKIE = 'nx-operator-session'

/** Roles the server is willing to issue. `role` is never read from a request body. */
export const ISSUABLE_ROLES = ['operator', 'guest'] as const
export type IssuableRole = (typeof ISSUABLE_ROLES)[number]

export interface SessionProfile {
  id: string
  email: string
  full_name: string
  avatar_url?: string
  role: IssuableRole
  provider: string
  designation?: string
  email_verified?: boolean
  /** Issued-at, epoch seconds. */
  iat: number
  /** Expiry, epoch seconds. */
  exp: number
}

function secret(): string {
  const s = process.env.SESSION_SECRET
  if (s && s.length >= 32) return s
  if (process.env.NODE_ENV === 'production') {
    // Fail closed in production rather than signing with a guessable key.
    throw new Error(
      'SESSION_SECRET is not set (min 32 chars). Refusing to issue sessions in production.'
    )
  }
  // Development only: stable per-process key so local sessions work without setup.
  return 'dev-only-insecure-session-secret-change-me-32+'
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
}

/** Serialise and sign a profile into a cookie value. */
export function encodeSession(profile: SessionProfile): string {
  const payload = Buffer.from(JSON.stringify(profile), 'utf8').toString('base64url')
  return `${payload}.${sign(payload)}`
}

/**
 * Verify and decode a cookie value. Returns null on any tampering, bad
 * signature, malformed payload, or expiry — callers treat null as signed-out.
 */
export function decodeSession(raw: string | undefined | null): SessionProfile | null {
  if (!raw) return null

  // Cookies may arrive URL-encoded depending on the client.
  const candidates = [raw]
  try {
    candidates.push(decodeURIComponent(raw))
  } catch {
    // Ignore malformed encoding.
  }

  for (const value of candidates) {
    const dot = value.lastIndexOf('.')
    if (dot <= 0) continue

    const payload = value.slice(0, dot)
    const provided = value.slice(dot + 1)
    const expected = sign(payload)

    // Constant-time comparison; lengths must match for timingSafeEqual.
    const a = Buffer.from(provided)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) continue

    try {
      const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
      if (!parsed || typeof parsed !== 'object') continue
      if (typeof parsed.exp !== 'number' || parsed.exp < Math.floor(Date.now() / 1000)) continue
      if (!ISSUABLE_ROLES.includes(parsed.role)) continue
      return parsed as SessionProfile
    } catch {
    }
  }

  return null
}

/**
 * Build a session profile. The caller supplies verified identity only; the
 * role is passed explicitly by server-side code that has established how the
 * user authenticated, and is validated against the issuable set.
 */
export function buildSession(args: {
  id: string
  email: string
  full_name: string
  role: IssuableRole
  provider: string
  avatar_url?: string
  designation?: string
  email_verified?: boolean
  ttlSeconds?: number
}): SessionProfile {
  if (!ISSUABLE_ROLES.includes(args.role)) {
    throw new Error(`Refusing to issue session with role "${args.role}"`)
  }
  const now = Math.floor(Date.now() / 1000)
  return {
    id: args.id,
    email: args.email,
    full_name: args.full_name,
    avatar_url: args.avatar_url,
    role: args.role,
    provider: args.provider,
    designation: args.designation,
    email_verified: !!args.email_verified,
    iat: now,
    exp: now + (args.ttlSeconds ?? 60 * 60 * 24 * 7),
  }
}

/** Cookie options used everywhere a session is set. */
export function sessionCookieOptions(isHttps: boolean, maxAge: number) {
  return {
    httpOnly: true as const,
    secure: isHttps,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  }
}

export function requestIsHttps(request: Request): boolean {
  return (
    request.headers.get('x-forwarded-proto') === 'https' ||
    process.env.NODE_ENV === 'production'
  )
}

// --- Administrator tokens ---------------------------------------------------
// Admin identity is a separate, signed token. `superadmin` is deliberately not
// in ISSUABLE_ROLES so it can never be minted through the operator path.

export const ADMIN_COOKIE = 'nx_admin_token'

export interface AdminProfile {
  kind: 'admin'
  id: string
  email: string
  username?: string
  full_name: string
  role: 'superadmin'
  iat: number
  exp: number
}

export function buildAdmin(args: {
  id: string
  email: string
  username?: string
  full_name: string
  ttlSeconds?: number
}): AdminProfile {
  const now = Math.floor(Date.now() / 1000)
  return {
    kind: 'admin',
    id: args.id,
    email: args.email,
    username: args.username,
    full_name: args.full_name,
    role: 'superadmin',
    iat: now,
    exp: now + (args.ttlSeconds ?? 60 * 60 * 24 * 7),
  }
}

export function encodeAdmin(profile: AdminProfile): string {
  const payload = Buffer.from(JSON.stringify(profile), 'utf8').toString('base64url')
  return `${payload}.${sign(payload)}`
}

/** Verify an admin token. Returns null unless the signature and `kind` match. */
export function decodeAdmin(raw: string | undefined | null): AdminProfile | null {
  if (!raw) return null
  const candidates = [raw]
  try {
    candidates.push(decodeURIComponent(raw))
  } catch {
    // Ignore malformed encoding.
  }
  for (const value of candidates) {
    const dot = value.lastIndexOf('.')
    if (dot <= 0) continue
    const payload = value.slice(0, dot)
    const a = Buffer.from(value.slice(dot + 1))
    const b = Buffer.from(sign(payload))
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) continue
    try {
      const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
      if (parsed?.kind !== 'admin' || parsed?.role !== 'superadmin') continue
      if (typeof parsed.exp !== 'number' || parsed.exp < Math.floor(Date.now() / 1000)) continue
      return parsed as AdminProfile
    } catch {
    }
  }
  return null
}
