/**
 * Which mines the product features as pilots. A designation, not a register.
 *
 * Each pilot is named by its register code and nothing else. Its id, name and
 * coordinates are read from FastAPI's register (GET /api/v1/mines) wherever
 * they are needed. If the register cannot be read there is no pilot to show,
 * and the caller says so.
 *
 * This is the one file in src/ that may contain a mine code, and it may hold
 * nothing else about a mine: `npm run lint:mine-register` enforces both. Before
 * it, the console, the landing page and Track A each carried their own pilot,
 * as a code, as `{ id: 1, name, code }`, and as a name with coordinates.
 */

/**
 * Track B's pilot: the one mine with a committed rolling-origin backtest
 * (PRD §13 Q4; the backend's own designation is `PILOT_CODE` in
 * backend/app/api/pitch_figures.py).
 */
export const TRACK_B_PILOT_CODE = 'MOIL-BAL-01'

/**
 * Track A's opencast pilot. PRD §13 Q4 recommends an opencast mine for surface
 * prospectivity; the Track B pilot is underground.
 */
export const TRACK_A_OPENCAST_PILOT_CODE = 'MOIL-DON-05'
