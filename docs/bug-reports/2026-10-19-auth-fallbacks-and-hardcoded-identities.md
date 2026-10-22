# Bug report — Google sign-in fallback fabricates a verified user; hardcoded identities

| | |
|---|---|
| Found | 2026-10-19, while verifying the redesigned `/login` and `/admin/*` on the local review server |
| Commit | `20d1cdd` (all of it predates the redesign; the redesign did not touch these handlers) |
| Status | **Fixed on `fix/critical-high-issues` (2026-10-22), approved by the owner.** Fixes and verification: `2026-10-21-critical-high-sweep.md` |
| Scope | Separate from the UI redesign. Do not fix on the redesign branch |

The redesign changed two things nearby: the `/login` e-mail placeholder (it now says
`name@organisation.in`) and the `/admin/setup` name and e-mail placeholders (`Full
name`, `name@organisation.in`). Both were display-only changes. Everything below is
logic and data, and none of it was changed.

## BUG-4 — "Continue with Google" fabricates a verified identity when the popup fails

**Where:** `frontend/src/components/auth/LoginForm.tsx`, `handleGoogleLogin`, the
`catch` around `signInWithGooglePopup()` (≈ lines 293-306 at `20d1cdd`).

**What it does.** If the Firebase popup throws for any reason — the popup is blocked,
the user closes it, the domain is not authorised in Firebase, or there is no
network — the handler does not report the failure. It builds a user instead:

- `id: goog_<timestamp>`
- `email:` whatever is in the e-mail field, **or a hardcoded personal Gmail address**
- `email_verified: true`
- `provider: 'Google Authentication (Verified Clearance)'`

It then does three things:
1. POSTs that user to `/api/auth/session`.
2. Writes the raw JSON into a script-readable `nx-operator-session` cookie.
3. Shows "Google authentication successful! Entering Orbital Console..." and
   navigates to `/dashboard`.

**What stops it from becoming a session today.** All three of these were verified on the
local review server on 2026-10-19; see "Verified" below.
- `/api/auth/session` has no POST handler. Its own comment says the POST that
  minted sessions from a request body was removed, so the request is refused.
- `lib/session.ts` HMAC-verifies the cookie on every read. The unsigned JSON is not
  a session.
- `/dashboard` permanently redirects to `/login`.

So this is **not an authentication bypass** with the current server code. What
remains is still wrong:
- The user is told they signed in with Google when they did not. They are bounced
  back to `/login` with no explanation.
- The client asserts `email_verified: true` for an address nobody verified. Any
  future server code that trusts the request body would turn this straight into a
  bypass. That is exactly the shape of the defect the session route already had
  to have removed once.
- A real person's e-mail address is hardcoded as a default identity.

**Related hardcoded identities**, all present at `20d1cdd`:
- `frontend/src/app/admin/page.tsx:180` falls back to displaying a named person as
  "Commander …" when the admin record has no `full_name`.
- `frontend/src/app/api/admin/profiles/route.ts` (admin-gated, verified 401 without
  credentials) has two problems:
  - It parses the requester's `nx-operator-session` cookie as **unverified** JSON
    and lists it as a user, taking `role` from the cookie.
  - When the list is otherwise empty, it inserts a "default demo operator" with the
    same named person and the role "Chief Orbital Commander". The admin's user
    table therefore shows invented records as if they were real.
- `frontend/src/firebase.ts` falls back to a specific, real Firebase project's web
  config when `NEXT_PUBLIC_FIREBASE_*` is unset. Firebase web config is a public
  client identifier, not a secret. But it does mean every unconfigured run — local
  dev, CI, a preview deploy — talks to that project. Nobody has confirmed whether
  that project is production.

**Proposed remediation** (on its own branch, e.g. `fix/auth-fallbacks`):
1. On popup failure, show the error and stop. Delete the fabricated-user branch.
2. Hide the Google button when Firebase is not configured. Remove the hardcoded
   Firebase fallbacks so that "configured" means env vars are set.
3. Remove the hardcoded personal e-mail address and name from all four places.
4. In `/api/admin/profiles`, read the session only through `lib/session.ts` (verified).
   Delete the demo-operator insertion, or label such rows as samples in the response
   and the UI.

**Proposed regression tests:**
- `tools/e2e-auth.js`: with Firebase unconfigured, clicking "Continue with Google"
  must not show a success notice and must not set `nx-operator-session`.
- A static check: `LoginForm.tsx` must contain no literal `email_verified: true`.
- `/api/admin/profiles` with a hand-written unsigned `nx-operator-session`, plus a
  valid admin token: the unsigned identity must not appear in the response.

## Verified

Run against the local review server on 2026-10-19 (`next dev` on :3001, uvicorn on
:8001, no credentials configured):

```
POST /api/auth/session  {"id":"goog_1","email_verified":true,"role":"admin",...}  -> 405
GET  /api/auth/session  Cookie: nx-operator-session=<unsigned JSON, role admin>    -> {"user":null}
GET  /dashboard                                                                    -> 308 /login
GET  /api/admin/profiles  (no credentials)                                         -> 401
```

**Not verified:** clicking "Continue with Google" in a real browser. That would
contact the hardcoded Firebase project, which is an external service, so it was
deliberately not exercised. The behaviour described above comes from reading the
handler, and the server-side outcomes come from the requests shown.
