# Continuous integration

`.github/workflows/ci.yml` runs on every pull request and on every push to
`main`. Jobs run in parallel. **No job that can fail a PR depends on an external
service**: anything that needs NASA POWER, STAC, Planetary Computer or
Open-Meteo is either run with that service made unreachable on purpose, or runs
in the non-blocking network job, which reports and never fails.

## Jobs

| Job | What it runs | Gates the PR | Runtime on the runner |
|---|---|---|---|
| **Frontend** | `tsc --noEmit`, `lint:literals`, Biome no worse than the base commit, `npm run build` | yes | 0:40 (0:27–0:40) |
| **Backend — fast suites** | every backend suite except Track B, network-marked tests deselected; then confirms the artifact guard and network block were active, and that no committed artifact changed | yes | 1:17 (1:16–1:39) |
| **Backend — Track B** | `test_track_b.py` | yes | 8:52 (8:52–12:35) |
| **Artifacts** | `python -m app.api.batch check` | yes | 0:45 (0:33–0:45) |
| **Browser — console** | `test:e2e`, `test:dates`, `test:pilot`, `test:scenario`, `test:surface`, `test:nav`, `test:auth`, `test:motion` | yes | 5:30 (5:30–5:34) |
| **Browser — routes-provenance** | `test:routes -- --external-offline`, `test:provenance`, then `test:provenance -- --offline` with the backend stopped | yes | 9:51 |
| **Browser — cls** | `test:cls` | yes | 9:22 (9:18–9:22) |
| **Network — live services** | `pytest -m network`; `test:map`, `test:map -- --evicted` and `test:routes` (basemap check included) against the live services | **no** — writes its outcome to the job summary and a warning annotation | 4:04 |

Runtimes are job wall-clock times on `ubuntu-latest`, setup included: the first
figure from the first all-green run (37145888229), the range across the runs of
PR #25 in which that job ran the same steps and passed. A PR's checks take as
long as the longest job — about ten minutes — not the sum.

Every job sets up the same way a developer does: Python 3.13 and
`backend/scripts/setup_dev.sh` (composite action `.github/actions/backend-env`),
Node 22 and `npm ci` (`.github/actions/frontend-env`).

**Required checks are a repository setting**, not something this file can set.
To make the gating jobs required, add them under *Settings → Branches → Branch
protection → Require status checks*: the seven "gates the PR" rows above. Leave
"Network — live services" out.

## Biome: no worse than the base, and how the baseline is pinned

`main` carries Biome findings from before Biome was introduced (33 errors, 79
warnings when the gate was written), so "Biome must pass" would fail every PR.
`frontend/tools/biome-no-worse.js` gates on the difference instead: a PR may not
raise the error count or the warning count. Infos are reported, not gated.

The baseline is **the PR's base commit, measured in the same run** — not a
number committed to a file, which goes stale the day someone fixes a finding and
from then on lets regressions back in up to the old count. The job checks out
`github.event.pull_request.base.sha` in a separate worktree and lints both trees
with the same Biome binary (the lockfile's version) and the same configuration
(the PR's `biome.json`, copied over the base's), so the comparison measures the
code change and nothing else. A PR that loosens `biome.json` is visible in
review, not in the count.

## Network-dependent tests

### Backend

Outbound network is **off for every backend test** except those marked
`@pytest.mark.network` (`backend/conftest.py`, THE NETWORK). The block covers
the whole session, the app's background threads included, and is checked by
`test_network_policy.py`. It was measured before it was written: with every
non-loopback connection refused, all 75 backend tests outside Track B passed,
and only two steps of `test_api` reached out. Track B passes under the same
block.

| Test | Needs | Where it runs |
|---|---|---|
| `test_api.py::test_live_upstreams` | NASA POWER, Earth Search STAC | network job (non-blocking) |
| `test_api.py::test_upstreams_degrade_honestly_when_unreachable` | nothing — upstreams pointed at the discard port | backend job (required) |
| every other backend test | nothing | backend / Track B jobs (required) |

The two upstream steps used to sit inside `test_full_pipeline` and asserted only
HTTP 200, which the degraded path also returns. They are now split: the live
test asserts the services actually answered (`is_live: true`), and the offline
test asserts the endpoints degrade honestly when they do not.

### Browser suites

The required browser jobs run with **every external service unreachable**
(`scripts/ci/start-servers.sh offline`):

- backend: `NAKSHATRA_OFFLINE=1` (NASA POWER, STAC, Open-Meteo → discard port)
  and a dead `HTTP(S)_PROXY` for anything else it reaches (the Planetary Computer
  mosaic registration);
- Next server: its five Node-side upstreams (Open-Meteo, STAC, Photon,
  Nominatim, ESRI) each overridden to the discard port, and a preload
  (`scripts/ci/node-offline.cjs`) that lets the process resolve only this
  machine — which also covers the auth integrations (Supabase, GitHub, Resend)
  that `/admin/setup` reaches during the suites. Not `NAKSHATRA_OFFLINE=1`, which
  in the Next server also cuts off the backend, by design, for the offline
  provenance guard;
- Chrome: `CHROME_PATH=scripts/ci/chrome-offline`, which passes
  `--host-resolver-rules` so the browser can resolve only this machine.

So an outage cannot change their result: they already run as if everything
external were down. The one gap is a request to an IP address rather than a
hostname, which a resolver block cannot see; the app makes none.

One check in those suites needs an external service by nature: `test:routes`'
"at least 8 tiles loaded", which counts ESRI basemap tiles. Measured offline it
was the only failure (107 of 108 passed). The required job runs the suite with
`--external-offline`, which reports such checks as **SKIP**, naming the service,
and counts them separately — never as passes; the network job runs the suite
without the flag, so the basemap is still checked against the live service.

| Suite | Needs | Where it runs |
|---|---|---|
| `test:map` | Planetary Computer, ESRI basemap | network job (non-blocking) |
| `test:map -- --evicted` | Planetary Computer, to re-register | network job (non-blocking) |
| `test:routes` — "at least 8 tiles loaded" | ESRI basemap | network job (non-blocking); SKIP in the browser job |
| every suite in the browser jobs above | nothing external | browser jobs (required) |

## Local only, and why

| Tool | Why it is not in CI |
|---|---|
| `npm run test:map -- --pc-blocked` | Proves the map falls back to the local tile cache. That cache is 39.3 MB fetched from Planetary Computer by `python -m app.api.batch tiles` (560 s) and is gitignored; a CI copy would have to be downloaded from the service the test is about. It is in the DEMO.md pre-flight instead. |
| `tools/a11y.js`, `tools/a11y-map-layers.js` | **Not yet — they fail offline, on a real defect.** Both gate (exit 1 on any serious violation), and both were run under the same unreachable-services setup as the browser jobs: every route passed except the map, `/console?track=a`, where axe flags two labels in the layer switcher's degraded state — the active layer's "ON" (`#6aa5f0` on `#414447`, 3.85:1 against the 4.5:1 required for 12 px text) and each unreachable tile layer's "unavailable". In an online run made to compare, axe did not evaluate those labels at all — they appear in none of its violations, incomplete or passes — so earlier clean online audits do not show they pass. Fixing them is a change to the app, outside this CI change; once fixed, both audits belong in the browser jobs. |
| `tools/capture*.js`, `tools/demo-walk.js`, Lighthouse (`npx lighthouse`) | Screenshot and score generators for evidence, not checks. |
| `python -m app.api.batch all` / `tiles` | Regenerate artifacts and download tiles; CI checks the committed set with `batch check` instead. |

## Build-time dependency: Google Fonts

`npm run build` downloads its three fonts from Google (`next/font/google`).
Measured: a cold build fails when `fonts.googleapis.com` is unreachable, and a
build with Next's cache (`.next/cache`) restored does not. The frontend action
caches `.next/cache`, so once a lockfile has built once, a Google outage cannot
turn the build red. The residual exposure is a cold cache — the first build
after the lockfile changes, or after GitHub evicts an unused cache (7 days).
Removing it entirely means self-hosting the fonts (`next/font/local`), which is a
change to the app rather than to CI.

## Track B

Measured on the runner: jobs of 12:35, 12:31 and 8:52, of which the tests took
11:53 and 8:10 where recorded — two to three times the 4 minutes they take on an
8-core laptop, and under the ~15-minute line at which it would stop running on
every PR. So it runs on every PR, in its own job, in parallel with the rest.

If it passes 15 minutes, move it off the PR path rather than make every PR wait:
give the `track-b` job `if: github.event_name == 'push'` (it then runs on every
push to `main`), or a `schedule:` trigger for a nightly run, and drop it from the
required checks.

## Reproducibility

Committed artifacts record the versions of the libraries the forecast imports
(numpy, pydantic, scikit-learn) as part of their identity. All three are pinned
in `backend/requirements.txt`; pydantic used to arrive only transitively, so a
clean install could have resolved a different version and refused every
committed artifact.
