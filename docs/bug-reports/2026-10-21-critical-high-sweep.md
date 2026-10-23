# Critical- and high-priority sweep — findings and fixes

| | |
|---|---|
| Swept | 2026-10-20 to 2026-10-22, on branch `fix/critical-high-issues` |
| Base | `0e0d2f4`, the head of PR #36 (redesign); this branch stacks on it |
| Scope | Critical and high only. Medium and low findings are listed at the end, unfixed |
| Method | Five independent review lenses (frontend security, backend security, end-to-end in a browser, integrity/config/guards, client/offline), each finding reproduced before it was fixed and re-verified after |

Severity rubric used throughout:
- **Critical:** exploitable without special conditions (auth bypass, privilege escalation, other users' data, fabricated data shown as real), or a core flow broken for every user.
- **High:** serious but conditional: a brute-forceable factor, cross-user leakage of low-sensitivity data, DoS through unbounded input on a public endpoint, users told they are authenticated when they are not, an open redirect in an auth flow, a CI guard that passes vacuously, or a core flow broken for some users or inputs.

## Findings and fixes

| ID | Sev. | Finding | Fix | Verified by |
|---|---|---|---|---|
| FE-SEC-1 | Critical | Admin login accepted `user_metadata.is_primary_admin`, which any Supabase user can set on their own account with the public key | Authorise on `app_metadata.role === 'superadmin'` only (`lib/admin-slot.ts` `isSuperadmin`), in login, the username lookup and setup | Code review (needs a real Supabase project to exercise) |
| E2E-1 | Critical | MineTwin what-if controls changed only their labels: every run returned the same estimate (a 12 h blast delay showed +2,285 t). `chooseOption` was defined and never called | Each control now adopts its option's documented factor | `test:scenario`: +6 h changes the estimate (+2,285 to +1,213 t) and the factor reads 0.93 |
| FE-SEC-2 | High | `/auth/callback?next=` was assigned to `window.location.href` unchecked: `javascript:` ran in the app's origin; off-site URLs redirected | The callback no longer navigates to `next` at all (see BUG-4: it cannot start a session, so it says so). A first fix, `safeNext()`, was bypassed in review: it validated the raw string but returned the URL-normalised path, so `/.//evil.com` became `//evil.com` | Browser: `next=javascript:…`, `https://example.com`, `//example.com` run nothing and leave nothing; no navigation code remains |
| FE-SEC-3 | High | E-mail code verification had no attempt limit (`attempts` set to 0, never read) | Five wrong codes withdraw the code; at most 10 verify attempts per address in 10 minutes whichever provider sent the code (review found the Supabase verify path bypassed the per-code count); per-client limits checked first; constant-time compare | Live: 400 ×4, then 429; the right code afterwards is refused |
| FE-SEC-4 | High | Admin single-slot check failed open (lookup error → "slot free") and read one page of users | `findSuperadmin()` pages through all users; an unknown status refuses setup (503) | Live: GET and POST return 503 with the auth provider unreachable; the setup page says so |
| FE-SEC-5 | High | Public `GET /api/admin/setup` returned the admin's id, e-mail, username and name | GET returns only whether the slot is free | Live: no identity in the response |
| FE-SEC-6 | High | The caller's `fullName` went unescaped into the HTML of the code e-mail, with no rate limit on sending | HTML-escaped and capped at 64 characters; sends limited per address (1/min, 5/h) and per IP (20/h) | Code review (no mail provider configured); limits verified live (re-send within a minute → 429) |
| FE-SEC-7 | High | The OTP route accepted bodies of any size into a process-global map that was never swept | 4 KB body cap, field limits, expired entries swept, store capped | Live: a 1 MB `fullName` → 413 |
| FE-SEC-8 | High | The admin console was unreachable: pages read an HttpOnly cookie through `document.cookie`; setup issued an unsigned token the server rejects | Pages ask `GET /api/admin/auth` (signed token); setup issues the signed token | Browser with a validly signed token: `/admin` and `/admin/profile` load with the admin's name; signed out → 401 |
| BUG-1 | High | `provenance-guard.js` exited 0 when every route failed to load | Routes that do not load, return ≥ 400, land on the browser's error page or are not app documents fail the run; a `networkidle2` timeout on a map page is still scanned (review: the first fix would have failed a healthy slow page) | Closed port: exit 1, "2 route(s) NOT SCANNED"; full suite on a healthy server below |
| BUG-2 | High | `a11y.js` audited Chrome's error page when the server was down, and passed | Non-timeout navigation errors, error pages, 5xx and non-app documents are "NOT AUDITED" and fail the run | Closed port: exit 1, "4 route/viewport(s) NOT AUDITED" |
| BUG-3 | High | MineTwin "Scenarios you have run · this session only" was one server-side list shown to every visitor, accepting any input (a 2 MB name was stored and served) | History kept in the browser tab (sessionStorage); the server keeps nothing, validates mine, selections and factors, caps the body | `test:scenario`: GET → 405; unknown mine/selection/factor → 400; oversized → 413; a second visitor sees none of the first's runs |
| BUG-4 | High | "Continue with Google" could never create a session (no server verifies a Google token; `/api/auth/session` has no POST), so it always ended in a false "successful"; a failed popup fabricated a user marked `email_verified: true` with a hardcoded personal Gmail address. The admin user list parsed an unverified cookie and inserted an invented operator named after a real person | Google option removed from `/login` and the account menu until a server route verifies the ID token. The same false sign-in sat in `/auth/callback` (found in review): it now says it cannot start a session from that link, posts nothing and writes no cookie. The admin list holds only users the auth provider returns | Browser: no Google option; admin list has no invented entries |
| E2E-2 | High | An infeasible blend was shown as "Meets customer spec" with blank figures; the solver's reason was dropped | `success: false` renders "No feasible blend" with the solver's status and message | Browser at the slider maximum: "No feasible blend (Infeasible)" with the reason |
| E2E-3 | High | Every successful sign-in landed back on the sign-in form (`/dashboard` permanently redirects to `/login`) | Sign-in, GitHub callback and the account menu go to `/console` | Browser: guest sign-in lands on `/console` |
| E2E-4 | High | "Sign out" cleared cookies through `document.cookie`, which cannot touch HttpOnly cookies: the session survived 7 days and returned on reload | Sign-out calls the server's DELETE handlers (operator session and admin token); `/admin/profile`'s logout too | Browser: after sign-out and reload, no session and no cookie |
| E2E-5 | High | `/production` showed a legacy drag-model figure as "Shortfall against plan" (43 % where the forecaster says 0.7 % for the same mine), labelled as not synthetic, and an invented plan target badged as MOIL register data | The three figures are labelled synthetic with accurate sources; the tile is "Conditions drag, % of plan", with a note pointing to the forecaster | Browser: tiles badged SYNTHETIC; the old label is gone |
| FE-SEC-9 | High | Server code signed users in on the module-level Supabase client (admin `signInWithPassword`, `verifyOtp`), which keeps the session in memory and is shared by every request, so later requests' reads and writes (and `supabaseAdmin` without a service key) ran as the last user to sign in. Found in review | `serverAuthClient()`: a fresh client per server sign-in, dropped with the request | Code review; no server route signs in on the shared client (`grep`) |
| BE-1 | High | Any forecast horizon other than 14 days fitted a model on request (~45 s, two workers, unbounded queue) and wrote a new file into the committed artifact set, which can later fail `/readyz` | The forecast and recommendations routes serve only the precomputed 14-day horizon and refuse others (400) before anything is scheduled. Enforced in `routes.py`: `forecast_store.py` and `track_b.py` are fingerprinted into every committed artifact, and an edit there marked them all stale (13 backend tests caught a first attempt) | `test_request_limits.py`: 7 and 30 days → 400, no flight, no file |
| BE-2 | High | `backtest?compute=true` refitted inside the request (26–216 s) for anyone, writing artifacts for any span/step | Off unless `ALLOW_ONDEMAND_BACKTEST` is set; the nightly batch is the normal path | `test_request_limits.py` (403) |
| BE-3 | High | `/dispatch-operational-alert`: fields of any size kept in a global list served to every caller; records claimed an SMS/radio/SCADA dispatch that never happened | 6 MB request cap for the whole API; bounded fields and a severity enum; the record says `RECORDED_ONLY` | `test_request_limits.py` |
| BE-4 | High | CSV upload read the whole body before its size check, materialised every row, and said it had "ingested" rows it discarded | Capped read, rows counted while iterating (100k cap), response says nothing was stored | `test_request_limits.py` |
| BE-5 | High | Live `prospectivity/predict` (the default) made three outbound requests with 45 s timeouts per coordinate, unbounded in concurrency, reachable anonymously through the site | At most two live reads at once; over that, the kriged surface with a stated reason | `test_request_limits.py` |

## Verification on the final code

All on this worktree's own servers. Browser suites ran on a production build
with the backend offline-sinked, as CI runs them, on fresh servers per group,
with server health recorded before and after every suite.

| Check | Result |
|---|---|
| `npx tsc --noEmit`, `npm run lint:literals`, `npm run build` | PASS |
| Biome, no worse than the PR base `0e0d2f4` | PASS: 19 errors / 67 warnings, against 20 / 75 |
| Backend pytest, the CI command | PASS: 151 passed (141 before plus 10 in `test_request_limits.py`), 1 deselected. The committed-artifact guard and the network block both reported active |
| Console group: e2e, dates, pilot, scenario, surface, nav, auth, motion, fonts, band, blending, interactions | PASS 12/12. Interactions: 330 activations, 0 violations |
| Routes; provenance; provenance `--offline`; interactions `--backend-down` | PASS: 108/108 (1 external skip); 0 unattributed values across 16 routes; 0 offline; 213 activations, 0 violations |
| CLS | PASS |
| a11y (17 routes × 2 viewports); a11y-map | PASS: 0 serious or critical |
| Guards against a closed port | `provenance-guard.js` and `a11y.js` both exit 1 ("NOT SCANNED" / "NOT AUDITED"); the 16 other CI tools already failed closed |
| Live, in a browser and over HTTP | Every finding in the table re-checked: OTP limits, attempt cap and size cap; MineTwin isolation and controls; callback with hostile `next`; sign-in landing; sign-out; admin gate with and without a validly signed token; setup fail-closed; blending infeasibility; `/production` labels |

Two runs of `test:interactions --backend-down` and `test:cls` crashed with
Puppeteer's "Attempted to use detached Frame" while the machine was heavily
loaded (load average about 12). The same suites passed on a quiet rerun. This
is a known harness race, not an application failure.

`test_track_b.py` and `test_track_b_dates.py`, CI's separate Track B jobs, were
not run locally. They call the forecaster directly, and the modules they
exercise are unchanged; CI runs them on the PR.

## Checked and not critical/high

- Dependency audit: `npm audit --omit=dev` reports one critical and six highs, none reachable. The `next` advisories need `next/og`, the Pages Router or `use cache` / Draft Mode, none used here; `sharp`/librsvg needs SVG input to sharp; `source-map-js` is build-time; `@grpc/grpc-js` sits under Firestore server APIs that are not used. An upgrade is still advisable (medium).
- Every other CI browser tool fails closed against a closed port (16 tools checked).
- Session cookies are HMAC-signed and verified; forged cookies are rejected. GitHub OAuth state is random, single-use and compared. The tile and mine proxies allowlist their path segments. No XSS sink takes user or geocoder text.
- `lib/supabase.ts` falls back to a hardcoded Supabase project whose host no longer resolves (NXDOMAIN), so no request reaches it; recorded as medium.

## Independent review

A separate reviewer read the full diff adversarially. Every fix above was judged
fixed except two, which were then corrected: FE-SEC-2 (the `safeNext`
dot-segment bypass) and FE-SEC-3 (the Supabase verify path). It also found
FE-SEC-9, the leftover false sign-in in `/auth/callback`, and a way the BUG-1
fix could fail a healthy server; all are fixed above. A second round verified
those four follow-ups as fixed, including that no navigation sink in
`frontend/src` is now driven by a URL parameter and that no server code signs in
on the shared Supabase client. Its medium and low items are listed below.

The end-to-end tester re-tested its five findings on the final code and swept
the site again. All five are fixed. The sweep covered 25 routes × 1440 / 390,
Track B for all 10 mines, Track A, map search, blending, mine-twin, flood alert,
AI-X, guest and e-mail sign-in, sign-out, and admin while signed out. It found
no uncaught errors, no 5xx and no overflow, and no new critical or high issue.

## Medium and low, not fixed here

From the review: the OTP limits let a third party lock one address out of
code sign-in for a while (the trade-off for capping guesses); the per-client
limit keys on `X-Forwarded-For`, which a direct caller controls; concurrent
anonymous setup POSTs on an unclaimed deployment could both create a
superadmin (setup is anonymous by design); admin login's two error messages
reveal whether a username is the admin's; a chunked over-limit body gets 400
rather than 413 from the backend cap (memory stays bounded); Next route
handlers buffer a chunked body before their size check; the admin user list
reads one page of users; `/auth/callback` shows `?error_description=` text
verbatim (escaped, so text only); after a navigation timeout the provenance
guard cannot check the document's HTTP status; `signInWithSupabaseGoogle` in
`lib/supabase.ts` is unused code. From the end-to-end re-test: `/admin/login`
reads "Sealed" while the slot status is unknown; `/production`'s planned output
(8,400 t) and the console's plan (13,030 t) are two synthetic plan figures for
the same mine, both now labelled synthetic; the telemetry API still returns the
drag heuristic's legacy `risk_level` field; the mine-twin baseline is badged
REFERENCE; `/dashboard` still redirects to `/login`.

From the sweep:

Hardcoded Supabase/Firebase fallbacks; `/api/debug/firebase` reachable in production; development `SESSION_SECRET` fallback outside production; `X-Forwarded-Proto` and `X-Forwarded-For` trusted from the client; no CSP header; internal error messages echoed; `tile-layers?force=1` amplification; live feature-cache files written into `AI/outputs/feature_cache`; out-of-belt Track A points scored without a warning; empty Track A fields scored as (0, 0); AI-X off-topic answers and a personal support e-mail in its fallback; flood alert depends on a browser-side Open-Meteo call (daily quota); `/console?mine=` with an unknown id silently shows the portfolio; `/production` ignores `?mine=`; CSV export without per-grade rows; `mine_id` > 2^63 and `shift_window` hours > 23 return 500; the borehole endpoint accepts nonsensical bounds; `docker-compose.yml` exposes Postgres/Redis with default credentials.
