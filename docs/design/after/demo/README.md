# Demo walk screenshots

Produced by `node frontend/tools/demo-walk.js` (`_walk.json` holds every step's
result and the facts it recorded), one image per beat of `docs/DEMO.md`.

**Re-captured 2026-10-06, in the cold-start rehearsal** — a fresh clone that
followed DEMO.md word for word, live servers, real network. Two things differ
from earlier sets:

- **The design system's fonts.** Every earlier screenshot in this repository
  rendered in the system font, because Inter, Sora and IBM Plex Mono were never
  applied (fixed in this PR; `npm run test:fonts`). These are the first that
  show the product as designed. Older sets (`docs/design/after-v*`) are left as
  they were, as the record of their own PRs.
- **The dataset.** The rehearsal regenerated every artifact for 6 October, as
  DEMO.md's "day before" says, so the figures here are that dataset's (pilot
  MAPE 11.00% vs 13.22%, coverage 0.819; 14-day calibration 0.683) — not the
  committed artifacts' (11.67% vs 14.81%, 0.812, 0.738). On demo day the screen
  shows whatever the day-before regeneration produced; read figures off it.

The previous screenshots of this folder were removed in commit `2dd8d4a`, whose
message does not say so (a commit-hygiene miss, recorded in the PR); this set
replaces them in the commit that adds this file.
