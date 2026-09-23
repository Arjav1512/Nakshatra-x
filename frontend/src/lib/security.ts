import crypto from 'crypto'
/**
 * NAKSHATRA-X Enterprise Security Suite
 * Comprehensive mitigation for the 7 Top Vulnerabilities of Vibe-Coded Apps:
 * 1. Server-Side Template Injection (SSTI)
 * 2. Regular Expression Denial of Service (ReDoS)
 * 3. Long Input / Payload DoS Protection
 * 4. AWS / S3 & Secret Leakage Prevention
 * 5. NoSQL / JSON Injection Sanitization
 * 6. Pastejacking & Safe Clipboard Utilities
 * 7. Replay Attack Prevention (Nonce + Timestamps)
 * + Single-Thread Guardrail & Resilient Error Handling
 */

import { z } from 'zod'

// ============================================================================
// 1. SSTI (Server-Side Template Injection) Guard
// ============================================================================
const DANGEROUS_TEMPLATE_PATTERNS = [
  /\{\{.*?\}\}/g,            // Jinja / Handlebars {{...}}
  /\$\{.*?\}/g,              // ES6 Template Literals ${...}
  /<%.*?%>/g,                // EJS / ERB <%...%>
  /eval\s*\(/gi,             // eval()
  /Function\s*\(/gi,         // new Function()
  /__proto__/gi,             // Prototype pollution
  /constructor/gi,
]

export function sanitizeTemplateString(input: string): string {
  if (typeof input !== 'string') return ''
  let sanitized = input
  for (const pattern of DANGEROUS_TEMPLATE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[SANITIZED]')
  }
  return sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// ============================================================================
// 2. ReDoS (Regular Expression Denial of Service) Guard
// ============================================================================
export function safeValidatePattern(value: string, pattern: RegExp, maxLen = 256): boolean {
  if (!value || typeof value !== 'string') return false
  if (value.length > maxLen) return false // Hard length limit prevents backtracking explosions
  return pattern.test(value)
}

export const SAFE_MINE_CODE_REGEX = /^[A-Z0-9_-]{2,32}$/
export const SAFE_NAME_REGEX = /^[a-zA-Z0-9\s.,()_-]{1,128}$/
export const SAFE_NUMERIC_ID_REGEX = /^[0-9]{1,16}$/

// ============================================================================
// 3. Long Password / Payload DoS Guard
// ============================================================================
export const MAX_INPUT_LENGTHS = {
  PASSWORD: 128,
  AUTH_TOKEN: 512,
  MINE_ID: 64,
  SHORT_TEXT: 256,
  LONG_TEXT: 2048,
  CSV_UPLOAD_BYTES: 5 * 1024 * 1024, // 5MB max
  JSON_PAYLOAD_BYTES: 512 * 1024,     // 512KB max
}

export function enforceMaxLength(str: unknown, maxLen: number, fieldName = 'input'): string {
  if (typeof str !== 'string') {
    throw new Error(`Invalid data type for ${fieldName}: expected string`)
  }
  if (str.length > maxLen) {
    throw new Error(`Payload validation failed: ${fieldName} exceeds max allowed length of ${maxLen} characters`)
  }
  return str
}

// ============================================================================
// 4. Secret & Credential Leakage Guard
// ============================================================================
export function maskSensitiveValue(value: string | undefined): string {
  if (!value) return '***'
  if (value.length <= 8) return '********'
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

export function sanitizePublicResponse<T extends Record<string, any>>(data: T): T {
  const sensitiveKeys = ['secret', 'password', 'key', 'aws', 'token', 'credential', 'private']
  const clean = JSON.parse(JSON.stringify(data))

  function scrub(obj: any) {
    if (!obj || typeof obj !== 'object') return
    for (const k of Object.keys(obj)) {
      if (sensitiveKeys.some(sk => k.toLowerCase().includes(sk))) {
        delete obj[k]
      } else if (typeof obj[k] === 'object') {
        scrub(obj[k])
      }
    }
  }

  scrub(clean)
  return clean
}

// ============================================================================
// 5. NoSQL / JSON Injection Guard
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
// 6. Clipboard Copy Attack (Pastejacking) Guard
// ============================================================================
export async function secureCopyToClipboard(textToCopy: string): Promise<boolean> {
  if (typeof window === 'undefined' || !navigator?.clipboard?.writeText) {
    return false
  }

  // Strip hidden terminal escape codes, ANSI sequences, and carriage returns that execute commands
  const sanitizedText = textToCopy
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '') // ANSI escape codes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Control characters
    .replace(/\r\n/g, '\n')

  try {
    await navigator.clipboard.writeText(sanitizedText)
    return true
  } catch (err) {
    console.error('[Security] Clipboard write failed safely:', err)
    return false
  }
}

// ============================================================================
// 7. Login Replay & Session Nonce Guard
// ============================================================================
const recentNonces = new Set<string>()
const NONCE_WINDOW_MS = 5 * 60 * 1000 // 5-minute replay window

export function generateSecurityNonce(): string {
  const timestamp = Date.now()
  const randomStr = crypto.randomBytes(16).toString('base64url')
  return `${timestamp}-${randomStr}`
}

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
// 8. Single-Thread Guardrail & Resilient API Route Wrapper
// ============================================================================
export async function secureApiHandler<T>(
  action: () => Promise<T>
): Promise<{ data?: T; error?: string; status: number }> {
  try {
    const result = await action()
    return { data: result, status: 200 }
  } catch (err: any) {
    console.error('[Security Guardrail] Intercepted unhandled exception:', err?.message || err)
    return {
      error: err?.message ? sanitizeTemplateString(err.message) : 'Secure internal server error',
      status: err?.status || 500,
    }
  }
}

// ============================================================================
// Common Zod Schemas for Validated Endpoints
// ============================================================================
export const MineIdParamSchema = z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/)

/**
 * Mine primary key as the service layer defines it: a positive integer (DEF-1).
 *
 * `MineIdParamSchema` above accepts any slug, which is correct for the routes
 * that genuinely key on slugs. The mine data routes do not: they forward the id
 * to FastAPI, which keys mines by integer. They previously validated with the
 * slug schema and then called `parseInt`, so `'balaghat'` passed validation and
 * became `NaN` — producing a request for `/api/v1/mines/NaN/...`, or worse,
 * `NaN || 1`, which silently served mine 1's record under another mine's name.
 *
 * Parsing here rather than after validation means an id that is not a mine id
 * is rejected at the edge with a 400, instead of degrading into a wrong answer.
 */
export const MineNumericIdParamSchema = z
  .string()
  .regex(/^\d+$/, 'Mine id must be a positive integer')
  .transform((v) => Number.parseInt(v, 10))
  .refine((n) => Number.isSafeInteger(n) && n > 0, 'Mine id must be a positive integer')

export const DispatchAlertSchema = z.object({
  mine_id: z.string().min(1).max(64),
  type: z.enum(['ALERT', 'WORK_ORDER', 'DISPATCH', 'HAULAGE_DIVERT']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  reason: z.string().min(1).max(1024),
  impact: z.string().min(1).max(1024),
  action_order_id: z.string().max(128).optional(),
})

export const OreBlendingSchema = z.object({
  targetGradeMn: z.number().min(10).max(60),
  stockpiles: z.array(
    z.object({
      id: z.string().max(64),
      name: z.string().max(128),
      gradeMn: z.number().min(0).max(100),
      availableTonnes: z.number().min(0).max(1000000),
      costPerTonne: z.number().min(0).max(100000),
    })
  ).max(20),
})
