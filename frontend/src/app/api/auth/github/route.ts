import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'

// GET: Initiates GitHub OAuth Authorization Flow
export async function GET(request: Request) {
  try {
    const clientId = process.env.GITHUB_CLIENT_ID || process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID

    if (!clientId) {
      // If GitHub OAuth credentials are not yet configured in .env.local
      const url = new URL('/login', request.url)
      url.searchParams.set(
        'error',
        'GitHub OAuth credentials (GITHUB_CLIENT_ID) are missing in .env.local. Please configure your GitHub OAuth App at https://github.com/settings/developers'
      )
      return NextResponse.redirect(url)
    }

    const { searchParams, origin } = new URL(request.url)
    const redirectUri = `${origin}/api/auth/github/callback`
    // Cryptographically secure CSRF token (Math.random is predictable).
    const state = crypto.randomBytes(32).toString('base64url')

    // Store state in CSRF security cookie
    const cookieStore = await cookies()
    cookieStore.set('github_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 10, // 10 minutes
    })

    const githubAuthUrl = new URL('https://github.com/login/oauth/authorize')
    githubAuthUrl.searchParams.set('client_id', clientId)
    githubAuthUrl.searchParams.set('redirect_uri', redirectUri)
    githubAuthUrl.searchParams.set('scope', 'user:email read:user')
    githubAuthUrl.searchParams.set('state', state)

    return NextResponse.redirect(githubAuthUrl.toString())
  } catch (err: any) {
    console.error('[AUTH/GITHUB] Redirect exception:', err)
    return NextResponse.redirect(new URL('/login?error=GitHub+Auth+Redirect+Failed', request.url))
  }
}
