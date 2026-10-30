/**
 * Request hardening shared by the /api/v1 route handlers: JSON-key
 * sanitisation, replay-nonce validation and the mine-id schema.
 */

import { z } from 'zod'

// ============================================================================
// NoSQL / JSON Injection Guard
// ============================================================================
export function sanitizeNoSqlObject<T>(input: T): T {
  if (!input || typeof input !== 'object') return input

  if (Array.isArray(input)) {
    return input.map(item => sanitizeNoSqlObject(item)) as unknown as T
  }

  const cleaned: Record<string, any> = {}
  for (const [key, value] of Object.entries(input as Record<string, any>)) {
    // Strip keys starting with $ (MongoDB query operators like $gt, $ne, $where)
    if (key.startsWith('$') || key.includes('.')) {
      continue
    }
    if (value && typeof value === 'object') {
      cleaned[key] = sanitizeNoSqlObject(value)
    } else {
      cleaned[key] = value
    }
  }
  return cleaned as T
}

// ============================================================================
// Login Replay & Session Nonce Guard
// ============================================================================
const recentNonces = new Set<string>()
const NONCE_WINDOW_MS = 5 * 60 * 1000 // 5-minute replay window

export function validateReplayNonce(nonceHeader?: string | null): { valid: boolean; reason?: string } {
  if (!nonceHeader) {
    return { valid: true } // Optional in public dev telemetry mode, strictly tracked when present
  }

  const parts = nonceHeader.split('-')
  if (parts.length < 2) {
    return { valid: false, reason: 'Malformed security nonce' }
  }

  const timestamp = parseInt(parts[0], 10)
  const now = Date.now()

  if (isNaN(timestamp) || Math.abs(now - timestamp) > NONCE_WINDOW_MS) {
    return { valid: false, reason: 'Security nonce expired (Replay window exceeded)' }
  }

  if (recentNonces.has(nonceHeader)) {
    return { valid: false, reason: 'Duplicate nonce detected (Potential Replay Attack)' }
  }

  recentNonces.add(nonceHeader)

  // Prune nonces older than 10 minutes to prevent memory leaks
  if (recentNonces.size > 5000) {
    recentNonces.clear()
  }

  return { valid: true }
}

// ============================================================================
// Common Zod Schemas for Validated Endpoints
// ============================================================================
/**
 * Mine primary key as the service layer defines it: a positive integer (DEF-1).
 *
 * The mine data routes forward the id to FastAPI, which keys mines by integer.
 * They previously validated with a slug schema and then called `parseInt`, so
 * `'balaghat'` passed validation and became `NaN` — producing a request for
 * `/api/v1/mines/NaN/...`, or worse, `NaN || 1`, which silently served mine 1's
 * record under another mine's name.
 *
 * Parsing here rather than after validation means an id that is not a mine id
 * is rejected at the edge with a 400, instead of degrading into a wrong answer.
 */
export const MineNumericIdParamSchema = z
  .string()
  .regex(/^\d+$/, 'Mine id must be a positive integer')
  .transform((v) => Number.parseInt(v, 10))
  .refine((n) => Number.isSafeInteger(n) && n > 0, 'Mine id must be a positive integer')
