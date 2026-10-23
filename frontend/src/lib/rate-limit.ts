/**
 * In-process sliding-window rate limits.
 *
 * The OTP route had none: anyone could request codes for any address as often
 * as they liked (each send also e-mails that address when a mail provider is
 * configured) and guess a 6-digit code without limit. These limits live in
 * process memory, like the OTP store they protect, so they hold per server
 * process; a deployment with many instances needs a shared store instead.
 */

declare global {
  // Survives Next's dev hot reloads, as the OTP store does.
  var __NAKSHATRA_RATE_LIMITS: Map<string, number[]> | undefined
}

if (!globalThis.__NAKSHATRA_RATE_LIMITS) globalThis.__NAKSHATRA_RATE_LIMITS = new Map()
const buckets: Map<string, number[]> = globalThis.__NAKSHATRA_RATE_LIMITS

/** Past this many tracked keys, keys idle for an hour are dropped. */
const MAX_KEYS = 50_000
const IDLE_MS = 60 * 60 * 1000

function prune(now: number) {
  for (const [key, times] of buckets) {
    if (!times.length || times[times.length - 1] < now - IDLE_MS) buckets.delete(key)
  }
}

/**
 * Record one event for `key` and say whether it is within `limit` events per
 * `windowMs`. A refused event is not recorded, so a caller who backs off
 * recovers when the window passes.
 */
export function hit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): { ok: boolean; retryAfterSeconds: number } {
  const recent = (buckets.get(key) ?? []).filter((t) => t > now - windowMs)
  if (recent.length >= limit) {
    buckets.set(key, recent)
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) }
  }
  recent.push(now)
  buckets.set(key, recent)
  if (buckets.size > MAX_KEYS) prune(now)
  return { ok: true, retryAfterSeconds: 0 }
}

/**
 * The caller's address as the nearest proxy reports it. Spoofable when the app
 * is reached directly rather than through a proxy that sets the header, so
 * limits keyed on it are a second line; the per-address limits are the first.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
}
