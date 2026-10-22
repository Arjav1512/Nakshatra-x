# Bug report — two fail-open browser guards, and shared MineTwin scenario history

| | |
|---|---|
| Found | 2026-10-18, during the UI-redesign Phase 0 baseline |
| Commit | `20d1cdd` (= `origin/main` at the time) |
| Status | **Fixed on `fix/critical-high-issues` (2026-10-22), approved by the owner.** Fixes and verification: `2026-10-21-critical-high-sweep.md` |
| Scope | Separate from the UI redesign. Do not fix on the redesign branch |

Each finding was reproduced locally against servers on ports 3100/3199. No
deployed instance was contacted. The repro scripts live outside the repo, in
`/tmp/nx-bugrepro/` (`fail-open.sh`, `mine-twin.sh`, `browser-check.cjs`).

---

## BUG-1 — `provenance-guard.js` passes when it scanned nothing

**Where:** `frontend/tools/provenance-guard.js:192-198` and `:224`

When a route fails to load, the guard counts it in `failed` and moves on. The
exit code ignores `failed`. It is computed only from `total`, the number of
violations on the pages that did load:

```js
process.exit(REPORT ? 0 : total === 0 ? 0 : 1)
```

If every route fails to load, `total` is 0, so the guard prints `PASS` and exits 0.

**Reproduced** with nothing listening on the port:

```
$ E2E_BASE=http://127.0.0.1:3199 GUARD_ROUTES=/,/console,/mine-twin node tools/provenance-guard.js
  ERROR /: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:3199/
  ERROR /console: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:3199/console
  ERROR /mine-twin: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:3199/mine-twin

PASS — 0 unattributed data-shaped value(s) across 3 routes
exit=0
```

The `--offline` mode does the same and also exits 0. CI uses that mode in
`routes-provenance`.

**Exposure:**
- CI waits for both servers before the browser suites start
  (`scripts/ci/start-servers.sh:59`). The gap is a server that dies or hangs
  mid-job, or a wrong `E2E_BASE`. The job then goes green for routes it never
  scanned.
- This happened during the Phase 0 baseline: the frontend server died mid-run,
  and these guards still reported PASS.

**Proposed remediation:**
- Exit non-zero when `failed > 0`, except in `--report` mode.
- Print the unscanned routes in the summary line, e.g. `ERROR — 3 route(s) not
  scanned`.
- Optional: treat a non-2xx document response as a failure too.
  `page.goto` resolves on HTTP 500 without throwing. Before adopting this,
  confirm that every route in `ROUTES` returns 200 in `--offline` mode.

**Proposed regression test:** a self-test step that runs the guard against a
closed port and expects a non-zero exit, for example:

```
! E2E_BASE=http://127.0.0.1:<closed> GUARD_ROUTES=/ node tools/provenance-guard.js
```

---

## BUG-2 — `a11y.js` audits Chrome's error page

**Where:** `frontend/tools/a11y.js:72-76`

```js
try {
  await page.goto(base + route, { waitUntil: 'networkidle2', timeout: 45000 })
} catch {
  /* fall through — audit whatever rendered */
}
```

The fall-through was meant for `networkidle2` timeouts on pages that keep
loading map tiles. It also catches connection failures. axe then audits
Chrome's built-in error page. The status-label audit finds no labels, and it
has no minimum count, so finding none is not a failure.

**Reproduced** with nothing listening on the port:

```
$ node tools/a11y.js --base http://127.0.0.1:3199 --only /,/console
desktop  /          1 total   0 serious/critical  PASS
    status labels desktop /: 0 found, 0 below threshold
...
PASS — 0 serious/critical violations and 0 status label(s) below threshold ...
exit=0
```

The one violation on each page is `meta-viewport` (moderate), and it belongs to
Chrome's error page.

Elsewhere, `e2e-routes.js:259` and `capture.js:74` keep the response from
`goto` and do not swallow the error. No other guard in `frontend/tools/` has
this pattern.

**Proposed remediation:**
- Keep the response from `goto`.
- Fail the route if any of these hold:
  - `goto` threw anything other than a `TimeoutError`
  - the response is null or not OK
  - `page.url()` starts with `chrome-error://`
- On a timeout, continue only if the document belongs to the app, e.g. `#main`
  exists.
- Count those routes as failures in the final exit code.

**Proposed regression test:** run the tool against a closed port with `--only /`
and expect a non-zero exit.

---

## BUG-3 — MineTwin scenario history is shared across all visitors

**Where:**
- `frontend/src/app/api/v1/mine-twin/route.ts`: line 49 holds a module-level
  `let SCENARIOS: any[] = []`, line 103 appends to it, and lines 112-113 and
  123-125 return it to any caller.
- `frontend/src/components/mine-twin/MineTwinPanel.tsx`: lines 339-351 load it
  on every page mount, and lines 1008-1016 display it.

This is server-side code in the Next.js app. FastAPI is not involved.

**What the screen claims:**
- *"Scenarios you have run (N)"*
- *"assumption-based · this session only"*

Neither is true. The list holds the last 20 scenarios computed by the server
process, from **any** client.

**Reproduced** locally (`/tmp/nx-bugrepro/mine-twin.sh`):

```
1. visitor B, before anyone runs anything: 0 scenario(s); marker visible: false
2. visitor A runs a scenario (no cookie, no auth): POST status 200
3. visitor B, separate client, no shared cookie: 1 scenario(s); marker visible: true
4. fresh browser context on /mine-twin:
   "SCENARIOS YOU HAVE RUN (1) ASSUMPTION-BASED · THIS SESSION ONLY
    Balaghat 06:02 pm • VISITOR-A-PRIVATE-INPUT 14,200 t → 15,620 t (+1,420 t)"
5. a 2 MB client-supplied mineName: POST 200; another client's GET returns 2,098,046 bytes
```

**Exposure assessment:**
- **What leaks through normal UI use:**
  - the chosen mine
  - the planner's assumption selections and edited factors
  - the baseline and its source
  - the computed result
  - the time of the run

  No name, account, cookie or IP is stored, and the UI has no free-text field.
  Confidentiality impact is **low to moderate**: planning inputs, which users
  are told are private to their session.
- **What a direct API caller can do:**
  - The API does not validate `mineId`, `mineName` or `selections` against
    known values.
  - It accepts any size: a 2 MB string was stored and served back.
  - Arbitrary text sent by one client appears on every other visitor's
    `/mine-twin` screen. React renders it as text and the component has no
    `dangerouslySetInnerHTML`, so this is content injection, not script
    execution.
  - Integrity impact is **moderate**. On a demo machine, an audience member
    could put any text on the presenter's screen, under a heading that
    attributes it to the presenter.
  - Availability impact is **low to moderate**. Twenty unbounded entries are
    kept in memory and downloaded on every `/mine-twin` load.
- **How widely the history is shared** depends on where the app runs:
  - With `npm run start` (the on-prem N-5 topology, or a demo laptop), every
    visitor shares the history until the process restarts.
  - On Vercel (`vercel.json` is present), sharing is per warm function
    instance. That is non-deterministic, but it can last minutes to hours.
- **Not assessed:** any deployed instance. I didn't send requests to one,
  because that would read or write other people's data.
- **Conflicts with existing documentation:** `frontend/tools/auth-matrix.js:65-66`
  records this as an accepted residual that "holds no user or operational data
  and is read by no decision path". The UI's own wording contradicts that
  acceptance, and so do the repro's steps 4 and 5.
- **Side effect on tests:** `e2e-scenario.js:38` asserts the store is empty, and
  the `/mine-twin` provenance scan depends on what earlier runs left behind.
  Both pass only on a fresh server. That is why `/mine-twin` failed in a longer
  local run order, then passed in CI order.

**Interim mitigation until a fix is approved:**
- Restart the web server immediately before any public demo.
- Don't enter sensitive values on `/mine-twin`.

**Proposed remediation:**
1. **Recommended: keep the history on the client.**
   - POST returns only the computed scenario, and `SCENARIOS` is removed.
   - `MineTwinPanel` keeps the history in React state, optionally mirrored to
     `sessionStorage`. That matches the "this session only" wording exactly,
     and it holds no server state, which also suits serverless.
   - GET either goes away or returns the model note with no list.
2. **Not recommended: a per-session store on the server**, keyed by the signed
   session cookie. It still holds state in memory, still behaves inconsistently
   on serverless, and adds more code than it removes.
3. **Harden the inputs, whichever option is chosen:**
   - Validate `mineId` against the known mines and derive `mineName` on the
     server.
   - Accept `selections` keys and values only from
     `src/lib/scenario-assumptions.ts`.
   - Bound the factors and cap the request body size.
   - Replace `id: scen-${Date.now()}`, which collides within the same
     millisecond, with `crypto.randomUUID()`.
4. Correct the `auth-matrix.js` note once the behaviour changes.

**Proposed regression tests**, extending `tools/e2e-scenario.js`:
- Two isolated browser contexts. A runs a scenario. B's page and B's API
  response contain no trace of it.
- A still sees its own run in "Scenarios you have run (1)".
- Unknown `mineId`, unknown selection values and oversized bodies get 400.
- Running the suite twice against the same server passes both times. No
  fresh-server dependency.
- `test:provenance` passes on `/mine-twin` whatever ran before it.

**Suggested branch when approved:** `fix/mine-twin-session-isolation`, with the
guard fixes either alongside or on their own `fix/guards-fail-closed` branch.

---

## Limitation carried forward

`test:interactions --backend-down` crashed locally twice, with Puppeteer's
"Attempted to use detached Frame". The 1280px pass completed with 0 violations,
and the crash came at the change to 375px. CI passes this suite on `20d1cdd`
(run 39068189283). **The 375px backend-down sweep remains unverified locally.**
