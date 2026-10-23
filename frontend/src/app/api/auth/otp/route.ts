import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  SESSION_COOKIE,
  buildSession,
  encodeSession,
  requestIsHttps,
  sessionCookieOptions,
} from '@/lib/session'
import crypto from 'crypto'
import nodemailer from 'nodemailer'
import { serverAuthClient, supabaseAdmin } from '@/lib/supabase'
import { clientIp, hit } from '@/lib/rate-limit'

// In-memory store for OTPs (with timestamp fallback)
interface OtpRecord {
  code: string
  fullName: string
  expiresAt: number
  attempts: number
}

// Global OTP store persisting across hot reloads in development
declare global {
  var __NAKSHATRA_OTP_STORE: Map<string, OtpRecord> | undefined
}

const otpStore: Map<string, OtpRecord> =
  global.__NAKSHATRA_OTP_STORE || (global.__NAKSHATRA_OTP_STORE = new Map())

/*
 * Bounds on the code flow. Before these, the 6-digit code could be guessed
 * without limit (`attempts` was set to 0 and never read), codes could be
 * requested for any address as often as anyone liked, `fullName` of any size
 * was stored in this process-global map (a 1 MB body was accepted) and pasted
 * unescaped into the HTML of the e-mail, and expired entries were never
 * removed.
 */
const MAX_BODY_BYTES = 4 * 1024
const MAX_EMAIL_LENGTH = 254
const MAX_NAME_LENGTH = 64
/** Wrong codes allowed per issued code; then the code is withdrawn. */
const MAX_VERIFY_ATTEMPTS = 5
/** Verify attempts per address in 10 minutes, whichever provider sent the code:
 *  the Supabase path is checked first and the per-code count above cannot see it. */
const VERIFIES_PER_ADDRESS_PER_10_MIN = 10
/** Codes per address: one a minute, five an hour. */
const SEND_COOLDOWN_MS = 60 * 1000
const SENDS_PER_HOUR = 5
/** Per client address, behind the per-address limits. */
const SENDS_PER_IP_PER_HOUR = 20
const VERIFIES_PER_IP_PER_10_MIN = 30
const MAX_STORED_CODES = 10_000
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

function codesMatch(expected: string, given: string): boolean {
  const a = Buffer.from(expected)
  const b = Buffer.from(given)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function sweepExpired(now: number) {
  for (const [key, record] of otpStore) {
    if (record.expiresAt < now) otpStore.delete(key)
  }
}

function tooMany(message: string, retryAfterSeconds: number) {
  return NextResponse.json(
    { error: message },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
  )
}

// 1. Send verification email via free SMTP (e.g. Gmail / Brevo / Custom)
async function sendSmtpEmail(to: string, code: string, rawName: string): Promise<boolean> {
  const name = escapeHtml(rawName.slice(0, MAX_NAME_LENGTH))
  const host = process.env.SMTP_HOST || 'smtp.gmail.com'
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!user || !pass) {
    return false
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT) || 465,
      secure: Number(process.env.SMTP_PORT) !== 587,
      auth: { user, pass },
    })

    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"NAKSHATRA-X Mission Security" <${user}>`,
      to,
      subject: `${code} — Your NAKSHATRA-X Verification Code`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #0A0E1A; color: #E2E8F0; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);">
          <div style="text-align: center; margin-bottom: 28px;">
            <div style="font-size: 11px; font-weight: 800; color: #00FF88; letter-spacing: 0.25em; text-transform: uppercase; margin-bottom: 6px;">
              NAKSHATRA-X ORBITAL SECURITY
            </div>
            <h1 style="font-size: 22px; font-weight: 900; color: #FFFFFF; margin: 0;">
              Mission Access Verification Code
            </h1>
          </div>
          <div style="text-align: center; margin: 28px 0;">
            <div style="display: inline-block; background: #050B14; border: 2px solid #00FF88; border-radius: 12px; padding: 14px 28px; box-shadow: 0 0 20px rgba(0,255,136,0.25);">
              <span style="font-size: 36px; font-weight: 900; letter-spacing: 0.35em; color: #00FF88; font-family: monospace;">
                ${code}
              </span>
            </div>
          </div>
          <p style="font-size: 14px; color: #94A3B8; text-align: center; line-height: 1.6; margin: 0 0 8px 0;">
            Hello <strong style="color: #FFFFFF;">${name}</strong>, enter this 6-digit code to access your NAKSHATRA-X operator console.
          </p>
          <p style="font-size: 12px; color: #64748B; text-align: center; margin: 0;">
            This security code expires in 10 minutes. If you did not request this, you may safely ignore this message.
          </p>
          <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center; font-size: 10px; color: #475569;">
            NAKSHATRA-X — Ministry of Steel &amp; MOIL Ltd.
          </div>
        </div>
      `,
    })

    console.log(`[AUTH] Real email delivered to ${to} via SMTP (${host})`)
    return true
  } catch (err: any) {
    console.warn('[AUTH] SMTP delivery note:', err?.message)
    return false
  }
}

// 2. Send verification email via Resend API (secondary fallback)
async function sendVerificationEmail(to: string, code: string, rawName: string): Promise<boolean> {
  const name = escapeHtml(rawName.slice(0, MAX_NAME_LENGTH))
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return false
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'NAKSHATRA-X <onboarding@resend.dev>',
        to: [to],
        subject: `${code} — Your NAKSHATRA-X Verification Code`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #0A0E1A; color: #E2E8F0; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="font-size: 11px; font-weight: 700; color: #38BDF8; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 8px;">
                NAKSHATRA-X MISSION SECURITY
              </div>
              <h1 style="font-size: 24px; font-weight: 900; color: #FFFFFF; margin: 0;">
                Verification Code
              </h1>
            </div>
            <div style="text-align: center; margin: 32px 0;">
              <div style="display: inline-block; background: #000000; border: 2px solid #00FF88; border-radius: 12px; padding: 16px 32px;">
                <span style="font-size: 36px; font-weight: 900; letter-spacing: 0.3em; color: #00FF88; font-family: monospace;">
                  ${code}
                </span>
              </div>
            </div>
            <p style="font-size: 14px; color: #94A3B8; text-align: center; line-height: 1.6; margin: 0 0 8px 0;">
              Hi <strong style="color: #FFFFFF;">${name}</strong>, enter this 6-digit code to access your NAKSHATRA-X console.
            </p>
            <p style="font-size: 12px; color: #64748B; text-align: center; margin: 0;">
              This code expires in 10 minutes. If you didn't request this, ignore this email.
            </p>
            <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center; font-size: 10px; color: #475569;">
              NAKSHATRA-X — Secure Orbital Intelligence Platform
            </div>
          </div>
        `,
      }),
    })

    if (!res.ok) {
      return false
    }

    const data = await res.json()
    console.log(`[AUTH] Resend verification sent to ${to} (id: ${data.id})`)
    return true
  } catch (err: any) {
    return false
  }
}

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Request body too large.' }, { status: 413 })
    }
    const raw = await request.text()
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Request body too large.' }, { status: 413 })
    }
    let body: Record<string, unknown>
    try {
      body = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'Malformed request.' }, { status: 400 })
    }
    const action = body?.action
    const email = typeof body?.email === 'string' ? body.email : ''
    const code = typeof body?.code === 'string' ? body.code.slice(0, 12) : ''
    const fullName =
      typeof body?.fullName === 'string' ? body.fullName.trim().slice(0, MAX_NAME_LENGTH) : ''

    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail || normalizedEmail.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    }
    const ip = clientIp(request)

    // 1. ACTION: SEND VERIFICATION CODE
    if (action === 'send') {
      // Per client first, so a refused request spends none of the address's budget.
      const perIp = hit(`otp-send-ip:${ip}`, SENDS_PER_IP_PER_HOUR, 60 * 60 * 1000)
      if (!perIp.ok) {
        return tooMany('Too many codes requested. Please try again later.', perIp.retryAfterSeconds)
      }
      const cooldown = hit(`otp-send-cooldown:${normalizedEmail}`, 1, SEND_COOLDOWN_MS)
      if (!cooldown.ok) {
        return tooMany('A code was sent to this address in the last minute. Please wait before asking again.', cooldown.retryAfterSeconds)
      }
      const hourly = hit(`otp-send:${normalizedEmail}`, SENDS_PER_HOUR, 60 * 60 * 1000)
      if (!hourly.ok) {
        return tooMany('Too many codes requested. Please try again later.', hourly.retryAfterSeconds)
      }
      const now = Date.now()
      sweepExpired(now)
      if (!otpStore.has(normalizedEmail) && otpStore.size >= MAX_STORED_CODES) {
        return NextResponse.json({ error: 'Sign-in by code is busy. Please try again shortly.' }, { status: 503 })
      }

      // Cryptographically secure: Math.random is predictable and must never
      // generate an authentication credential.
      const generatedCode = crypto.randomInt(100000, 1000000).toString()
      const expiresAt = Date.now() + 10 * 60 * 1000 // 10 minutes

      otpStore.set(normalizedEmail, {
        code: generatedCode,
        fullName: fullName || normalizedEmail.split('@')[0].slice(0, MAX_NAME_LENGTH),
        expiresAt,
        attempts: 0,
      })

      let emailSent = false
      let providerName = 'Email Service'

      // A. Priority 1: Direct SMTP (e.g. Free Gmail App Password or Brevo) — sends to ANY email in the world!
      if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        emailSent = await sendSmtpEmail(
          normalizedEmail,
          generatedCode,
          fullName || normalizedEmail.split('@')[0]
        )
        if (emailSent) {
          providerName = 'Direct SMTP'
        }
      }

      // B. Priority 2: Supabase Free Mailer
      if (!emailSent) {
        try {
          const { error: supErr } = await serverAuthClient().auth.signInWithOtp({
            email: normalizedEmail,
            options: {
              shouldCreateUser: true,
              data: {
                full_name: fullName || normalizedEmail.split('@')[0],
              },
            },
          })

          if (!supErr) {
            emailSent = true
            providerName = 'Supabase Free Mailer'
            console.log(`[AUTH] Real verification OTP sent to ${normalizedEmail} via Supabase`)
          } else {
            console.warn('[AUTH] Supabase mailer note:', supErr.message)
          }
        } catch (e: any) {
          console.warn('[AUTH] Supabase dispatch error:', e.message)
        }
      }

      // C. Priority 3: Resend API
      if (!emailSent && process.env.RESEND_API_KEY) {
        const resendOk = await sendVerificationEmail(
          normalizedEmail,
          generatedCode,
          fullName || normalizedEmail.split('@')[0]
        )
        if (resendOk) {
          emailSent = true
          providerName = 'Resend'
        }
      }

      if (process.env.NODE_ENV !== 'production') {
        // Local development convenience only — never runs in a deployed build.
        console.log(`[AUTH][dev] Code for ${normalizedEmail}: ${generatedCode}`)
      } else {
        console.log(`[AUTH] Code dispatched to ${normalizedEmail} (delivered=${emailSent} via ${providerName})`)
      }

      return NextResponse.json({
        success: true,
        message: emailSent
          ? `Verification code dispatched to ${normalizedEmail}. Check your inbox!`
          : `Verification code generated for ${normalizedEmail}`,
        emailSent,
        provider: providerName,
        // The verification code is never returned to the client. Returning it
        // made the entire email-verification step bypassable by reading the
        // HTTP response. It is delivered only over the email channel.
        expiresInSeconds: 600,
      })
    }

    // 2. ACTION: VERIFY CODE
    if (action === 'verify') {
      const perIp = hit(`otp-verify-ip:${ip}`, VERIFIES_PER_IP_PER_10_MIN, 10 * 60 * 1000)
      if (!perIp.ok) {
        return tooMany('Too many attempts. Please try again later.', perIp.retryAfterSeconds)
      }
      const perAddress = hit(`otp-verify:${normalizedEmail}`, VERIFIES_PER_ADDRESS_PER_10_MIN, 10 * 60 * 1000)
      if (!perAddress.ok) {
        return tooMany('Too many attempts for this address. Please wait and request a new code.', perAddress.retryAfterSeconds)
      }
      const cleanCode = code.replace(/[^0-9]/g, '').trim()
      let isVerified = false
      let verifiedName = fullName || normalizedEmail.split('@')[0]

      // A. Check with Supabase Auth OTP verification (verifies code sent by Supabase to user's inbox)
      try {
        const { data: supAuthData, error: supVerifyError } = await serverAuthClient().auth.verifyOtp({
          email: normalizedEmail,
          token: cleanCode,
          type: 'email',
        })

        if (!supVerifyError && supAuthData?.user) {
          isVerified = true
          if (supAuthData.user.user_metadata?.full_name) {
            verifiedName = supAuthData.user.user_metadata.full_name
          }
          console.log(`[AUTH] Verified via Supabase Auth for ${normalizedEmail}`)
        }
      } catch (err: any) {
        console.warn('[AUTH] Supabase verify check note:', err.message)
      }

      // B. Fallback to internal OTP store (verifies code sent via Resend or local store)
      if (!isVerified) {
        const record = otpStore.get(normalizedEmail)
        if (record) {
          if (Date.now() > record.expiresAt) {
            otpStore.delete(normalizedEmail)
          } else if (codesMatch(record.code, cleanCode)) {
            isVerified = true
            verifiedName = record.fullName || verifiedName
            otpStore.delete(normalizedEmail)
            console.log(`[AUTH] Verified via internal OTP store for ${normalizedEmail}`)
          } else {
            record.attempts += 1
            if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
              // Withdrawn: a sixth guess needs a new code, and new codes are
              // rate-limited per address.
              otpStore.delete(normalizedEmail)
              return tooMany('Too many incorrect codes. Please request a new code.', 60)
            }
          }
        }
      }

      if (!isVerified) {
        return NextResponse.json(
          { error: 'Invalid 6-digit verification code. Please check your email inbox and try again.' },
          { status: 400 }
        )
      }

      // Create verified operator profile
      const userProfile = {
        id: `usr_${crypto.randomBytes(8).toString('hex')}`,
        email: normalizedEmail,
        full_name: verifiedName,
        avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(normalizedEmail)}&backgroundColor=050b14`,
        role: 'operator',
        designation: 'Mission Specialist',
        provider: 'Email Verification (Verified)',
        email_verified: true,
        verified_at: new Date().toISOString(),
      }

      // Signed, httpOnly session. The role is assigned by the server after the
      // emailed code was verified above; it is never taken from the request.
      const maxAge = 60 * 60 * 24 * 7
      const session = buildSession({
        id: userProfile.id,
        email: userProfile.email,
        full_name: userProfile.full_name,
        avatar_url: userProfile.avatar_url,
        role: 'operator',
        provider: 'Email Verification (Verified)',
        designation: 'Mission Specialist',
        email_verified: true,
        ttlSeconds: maxAge,
      })

      const cookieStore = await cookies()
      cookieStore.set(
        SESSION_COOKIE,
        encodeSession(session),
        sessionCookieOptions(requestIsHttps(request), maxAge)
      )

      // Sync verified email user to Supabase Auth & profiles table
      try {
        const { data: existingData } = await supabaseAdmin.auth.admin.listUsers()
        const found = existingData?.users?.find((u) => u.email?.toLowerCase() === normalizedEmail)
        let uid = found?.id
        if (!uid) {
          const { data: created } = await supabaseAdmin.auth.admin.createUser({
            email: normalizedEmail,
            email_confirm: true,
            user_metadata: {
              full_name: userProfile.full_name,
              avatar_url: userProfile.avatar_url,
              role: 'operator',
            },
            app_metadata: {
              provider: 'email',
            },
          })
          uid = created?.user?.id
        }

        if (uid) {
          await supabaseAdmin.from('profiles').upsert(
            {
              id: uid,
              email: normalizedEmail,
              full_name: userProfile.full_name,
              avatar_url: userProfile.avatar_url,
              role: 'operator',
              provider: 'Email OTP',
              last_sign_in_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
          )
        }
      } catch (supErr) {
        console.warn('[AUTH/OTP] Supabase sync background note:', supErr)
      }

      return NextResponse.json({
        success: true,
        message: 'Email verified successfully!',
        user: userProfile,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Verification service error' },
      { status: 500 }
    )
  }
}
