# Phase 1 Security Remediation

Seven authentication and authorisation defects, each independently sufficient
to compromise the application. All are fixed on this branch; each entry names
the file and gives the check that demonstrates the fix.

## 1. Hardcoded password backdoor (critical)

`frontend/src/app/api/admin/auth/route.ts` accepted two literal passwords —
`admin123` and a second personal-looking password — when Supabase auth
*failed*, and granted `superadmin` without further checks.

Fixed: the fallback block is deleted. A failed Supabase sign-in returns 401.

> **Action required by the repository owner:** the second hardcoded string
> looks like a real personal password and has been public in this repository's
> history. Removing it from the working tree does not remove it from history.
> Rotate that password anywhere it is used.

## 2. Unauthenticated session minting with caller-supplied role (critical)

`POST /api/auth/session` built a session from an unauthenticated request body,
including `role: body.role`. A single request granted any identity and any
role:

```bash
curl -X POST /api/auth/session -d '{"email":"a@b.c","role":"superadmin"}'
```

Fixed: the POST handler is removed (now 405). Sessions are issued only by
routes that have verified an identity — OTP verification, the GitHub OAuth
callback, and guest access — and the role is assigned server-side. `superadmin`
is deliberately not in `ISSUABLE_ROLES`, so the operator path cannot mint it.

## 3. Unsigned, forgeable session cookies (critical)

The session cookie was plain JSON. `parseSessionCookie` JSON-parsed whatever
the browser sent and trusted the `role` inside it.

Fixed: cookies are HMAC-SHA256 signed (`frontend/src/lib/session.ts`), verified
with a constant-time comparison, and carry an expiry. Without `SESSION_SECRET`
(min 32 chars) the app **refuses to issue sessions in production** rather than
signing with a guessable default.

Verified:

```
forged cookie  {"role":"superadmin"}   -> {"user":null}
POST /api/auth/session                 -> HTTP 405
valid guest cookie                     -> {"user":{...,"role":"guest"}}
same cookie, role flipped to superadmin-> {"user":null}
```

## 4. `admin_session=true` granted superadmin (critical)

`getCurrentUser()` returned a `superadmin` profile whenever a cookie named
`admin_session` held the string `"true"`. `httpOnly` prevents scripts *reading*
a cookie but not *writing* one, so this was satisfiable from the browser
console even after the cookie was hardened.

Fixed: admin identity now requires `nx_admin_token`, a separately signed token
(`decodeAdmin`). `admin_session` remains only as a non-authoritative UI hint.

## 5. OTP returned in the HTTP response (critical)

`/api/auth/otp` returned `devCode: generatedCode` on every request, so email
verification could be bypassed by reading the response. The code was also
logged unconditionally.

Fixed: `devCode` removed; the code is delivered only by email. Logging of the
code is gated to non-production.

## 6. OAuth `state` never verified (CSRF)

`/api/auth/github/callback` read `state` from the query string and never
compared it to the `github_oauth_state` cookie, so a forged callback could log
a victim into an attacker-controlled GitHub account. The token was also
generated with `Math.random()`, which is predictable.

Fixed: the callback requires `state` to equal the cookie value and deletes the
cookie after a single use; the token is now `crypto.randomBytes(32)`. The same
`Math.random` weakness in the replay nonce (`lib/security.ts`) is fixed.

## 7. Row Level Security allowed reading every user (data exposure)

`database/schema.sql`:

```sql
CREATE POLICY ... ON public.db_users FOR SELECT USING (true);
```

Any holder of the anon key could read every row in `db_users` — emails, names,
metadata. The real anon key was published in `frontend/.env.example` in this
**public** repository, so the path was live.

Fixed: `FOR SELECT USING (auth.uid() = id)`. Service-role keys still bypass RLS
for admin tooling.

## 8. Real credentials in `.env.example`

`frontend/.env.example` contained a live Supabase project URL and anon key and
a full Firebase web config, not placeholders.

Fixed: replaced with placeholders, and `SESSION_SECRET` documented.

> **Action required by the repository owner:** these values are in this public
> repository's git history. Rotate the Supabase anon key and review the
> Firebase project's API key restrictions.

## Configuration change

`SESSION_SECRET` is now **required in production**:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Set it in the deployment environment. Without it, session-issuing routes return
500 by design — failing closed rather than signing with a known key. Existing
sessions are invalidated by this change, which is intended: they were forgeable.
