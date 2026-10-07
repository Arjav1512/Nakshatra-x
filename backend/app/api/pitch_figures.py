"""
The figures the pitch quotes, read from what the API serves.

    python -m app.api.batch pitch          # write docs/PITCH_FIGURES.md
    python -m app.api.batch pitch-check    # does it still match what is served?

The slides, docs/JURY_QA.md and the demo script quote a handful of numbers.
Before this, each was typed in by hand, from whichever dataset its author last
ran: the readiness pass found docs quoting the 20 September dataset (MAPE
11.67%) beside a rehearsal serving the 6 October one (11.00%). Both were real,
and a jury comparing a slide with the screen would have seen two different
claims about one model.

So the figures are computed here from the same functions the API serves them
through, written once to docs/PITCH_FIGURES.md with the artifact each comes
from and that artifact's identity, and checked: `batch pitch-check` and
backend/test_pitch_figures.py fail if the file and the served artifacts
disagree, and the test also fails if DEMO.md or JURY_QA.md quote a figure
(`**value**<!-- pitch:key -->`) that the file does not hold.

Outside the forecast code fingerprint: changing this module changes no artifact.
"""
from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
PITCH_DOC = REPO / "docs" / "PITCH_FIGURES.md"
#: Docs that quote pitch figures, checked against PITCH_DOC.
QUOTING_DOCS = (REPO / "docs" / "DEMO.md", REPO / "docs" / "JURY_QA.md")

PILOT_CODE = "MOIL-BAL-01"
PILOT_ID = 1
BACKTEST_SPAN, BACKTEST_STEP = 150, 14

BACKTEST_FILE = f"backend/artifacts/backtests/{PILOT_CODE}_{BACKTEST_SPAN}d_{BACKTEST_STEP}step.json"
CALIBRATION_FILE = "backend/artifacts/calibration/cumulative_coverage.json"
TRACK_A_FILE = "AI/outputs/model_metrics_honest.json"

#: Where each source is served, for the reader of the table.
SERVED = {
    BACKTEST_FILE: f"GET /api/v1/mines/{PILOT_ID}/backtest",
    CALIBRATION_FILE: f"GET /api/v1/calibration/cumulative?mine_code={PILOT_CODE}",
    TRACK_A_FILE: "GET /api/v1/prospectivity/metrics",
}


@dataclass(frozen=True)
class Figure:
    key: str
    label: str
    value: str
    source: str  # repo-relative artifact path
    field: str  # where in the served response


def _pct(x: float) -> str:
    return f"{x:.2f}%"


def _ci(pair, dp: int = 3) -> str:
    return f"[{pair[0]:.{dp}f}, {pair[1]:.{dp}f}]"


#: Track A to two places: ten positives cannot support a third.
def _auc(x: float) -> str:
    return f"{x:.2f}"


def figures_from(backtest: dict, calibration: dict, track_a: dict) -> list[Figure]:
    """
    The pitch figures from three served responses.

    Takes the JSON bodies, so the writer (route functions) and the test (HTTP)
    compute them with the same code and the same rounding.
    """
    B, C, A = BACKTEST_FILE, CALIBRATION_FILE, TRACK_A_FILE
    if calibration.get("status") != "ok":
        raise ValueError(f"calibration is not being served: {calibration.get('reason') or calibration.get('status')}")
    daily = calibration.get("daily") or {}
    if not daily.get("portfolio"):
        raise ValueError("the calibration artifact has no daily figures; re-measure it (batch all)")
    dp, cp, cm = daily["portfolio"], calibration["portfolio"], calibration["mine"]
    lomo, abl = track_a["lomo"], track_a["ablation_lomo_auc"]
    return [
        # ---- Track B: the pilot backtest, on screen at 1:35 ------------------
        Figure("pilot.mape_model", "Balaghat backtest: model MAPE", _pct(backtest["model"]["mape_pct"]), B, "model.mape_pct"),
        Figure("pilot.mape_baseline", "Balaghat backtest: seasonal-naive baseline MAPE",
               _pct(backtest["baseline"]["mape_pct"]), B, "baseline.mape_pct"),
        Figure("pilot.daily_coverage", "Balaghat backtest: daily 80% interval coverage",
               f"{backtest['model']['coverage_80']:.3f}", B, "model.coverage_80"),
        Figure("pilot.n_predictions", "Balaghat backtest: held-out predictions scored",
               str(backtest["model"]["n"]), B, "model.n"),
        Figure("pilot.n_origins", "Balaghat backtest: forecast origins", str(backtest["n_origins"]), B, "n_origins"),
        # ---- Track B: calibration, portfolio-wide and Balaghat ---------------
        Figure("portfolio.daily_coverage", "All ten mines: daily 80% interval coverage",
               f"{dp['coverage_80']:.3f}", C, "daily.portfolio.coverage_80"),
        Figure("portfolio.daily_coverage_ci", "All ten mines: daily coverage, 95% interval",
               _ci(dp["coverage_80_ci95"]), C, "daily.portfolio.coverage_80_ci95"),
        Figure("portfolio.daily_mape", "All ten mines: daily MAPE", _pct(dp["mape_pct"]), C, "daily.portfolio.mape_pct"),
        Figure("portfolio.cumulative_coverage", "All ten mines: 14-day total inside its 80% band",
               f"{cp['coverage_80']:.3f}", C, "portfolio.coverage_80"),
        Figure("portfolio.cumulative_coverage_ci", "All ten mines: 14-day coverage, 95% interval",
               _ci(cp["coverage_80_ci95"]), C, "portfolio.coverage_80_ci95"),
        Figure("portfolio.cumulative_tails", "All ten mines: 14-day totals in the outer tails (nominal 0.10)",
               f"{cp['pit_at_extremes']:.3f}", C, "portfolio.pit_at_extremes"),
        Figure("portfolio.n_origin_dates", "Calibration: origin dates measured", str(cp["n_origin_dates"]), C,
               "portfolio.n_origin_dates"),
        Figure("balaghat.cumulative_coverage", "Balaghat: 14-day total inside its 80% band",
               f"{cm['coverage_80']:.3f}", C, "mine.coverage_80"),
        Figure("balaghat.cumulative_coverage_ci", "Balaghat: 14-day coverage, 95% interval",
               _ci(cm["coverage_80_ci95"]), C, "mine.coverage_80_ci95"),
        # ---- Track A: leave-one-mine-out, real Sentinel-2 + SRTM -------------
        Figure("track_a.auc", "Track A: leave-one-mine-out AUC", _auc(lomo["auc"]), A, "lomo.auc"),
        Figure("track_a.auc_ci", "Track A: AUC, 95% interval", _ci(lomo["auc_ci95"], 2), A, "lomo.auc_ci95"),
        Figure("track_a.spectral_only", "Track A ablation: spectral features only",
               _auc(abl["spectral_only"]), A, "ablation_lomo_auc.spectral_only"),
        Figure("track_a.terrain_only", "Track A ablation: terrain features only",
               _auc(abl["terrain_only"]), A, "ablation_lomo_auc.terrain_only"),
        Figure("track_a.slope_only", "Track A ablation: slope only", _auc(abl["slope_only"]), A,
               "ablation_lomo_auc.slope_only"),
        Figure("track_a.random_split", "Track A: random 5-fold AUC, for contrast",
               _auc(track_a["random_split_auc_for_contrast"]), A, "random_split_auc_for_contrast"),
    ]


def identities_from(backtest: dict, calibration: dict, track_a: dict) -> dict:
    """Each source's identity as served (Track A has no dataset: its data is real)."""
    return {
        BACKTEST_FILE: backtest["artifact_identity"],
        CALIBRATION_FILE: calibration["artifact_identity"],
        TRACK_A_FILE: {
            "model_version": track_a["model_version"],
            "sha256": hashlib.sha256((REPO / TRACK_A_FILE).read_bytes()).hexdigest()[:16],
        },
    }


def served() -> tuple[dict, dict, dict]:
    """
    The three responses, from the functions the routes serve them through.

    The backtest route only resolves the mine id through the database first; the
    batch may run where that database was never seeded, so the function behind
    it is called with the code directly. Never computes: a missing artifact is
    an error here, as it is a 404 there.
    """
    from app.api.routes import calibration_cumulative, prospectivity_metrics
    from app.api.track_b import backtest_mine

    backtest = backtest_mine(PILOT_CODE, span_days=BACKTEST_SPAN, step_days=BACKTEST_STEP, allow_compute=False)
    return backtest, calibration_cumulative(PILOT_CODE), prospectivity_metrics()


def window_passed(ident: dict, today=None) -> str | None:
    """
    Whether the frozen dataset's forecast window has already ended.

    Not a check failure — the figures still match what is served — but figures
    from a passed window must not go into slides, and the file says so.
    """
    from datetime import date, timedelta

    end = date.fromisoformat(ident[BACKTEST_FILE]["data_end_date"])
    first, last = end + timedelta(days=1), end + timedelta(days=14)
    if last >= (today or date.today()):
        return None
    return f"{first.strftime('%-d %b')} – {last.strftime('%-d %b %Y')}"


def render(figs: list[Figure], ident: dict) -> str:
    ds = ident[BACKTEST_FILE]
    from datetime import date, timedelta

    end = date.fromisoformat(ds["data_end_date"])
    passed = window_passed(ident)
    lines = [
        "# Pitch figures",
        "",
        "<!-- Written by `python -m app.api.batch pitch`. Do not edit by hand: "
        "`batch pitch-check` and backend/test_pitch_figures.py fail when this "
        "file and the served artifacts disagree. -->",
        "",
        "The numbers the pitch quotes — slides, `docs/JURY_QA.md`, the demo script —",
        "from **one** frozen dataset, read from what the API serves. Quote them from",
        "here; `docs/DEMO.md` (*Freeze the pitch dataset*) says how they were made and",
        "how to re-make them.",
        "",
    ]
    if passed:
        lines += [
            f"> **Not demo-ready: forecast window already passed** ({passed}). These",
            "> figures come from the committed dataset so the tooling and its checks",
            "> run on something real. Nothing here goes into slides until the dataset",
            "> is re-frozen for the demo window (`docs/DEMO.md`, *Freeze the pitch",
            "> dataset*).",
            "",
        ]
    lines += [
        f"**Dataset:** `{ds['generator']}`, seed {ds['generator_seed']}, contract "
        f"{ds['contract_version']}, actuals to **{end.isoformat()}** — the forecast "
        f"window is {(end + timedelta(days=1)).strftime('%-d %b')} – "
        f"{(end + timedelta(days=14)).strftime('%-d %b %Y')}. Operational data is "
        "synthetic (MOIL's is proprietary, PRD 8.2); Track A's inputs are real.",
        "",
        f"**Code:** `{ds['model_version']}`, code fingerprint `{ds['code_fingerprint']}`.",
        "",
    ]
    sections = [
        ("Track B — the pilot backtest (Balaghat)", "pilot."),
        ("Track B — calibration, all ten mines and Balaghat", ("portfolio.", "balaghat.")),
        ("Track A — prospectivity, leave-one-mine-out", "track_a."),
    ]
    for title, prefix in sections:
        lines += [f"## {title}", "", "| Key | Figure | Value | Served at → field | Artifact |", "|---|---|---|---|---|"]
        for f in figs:
            if f.key.startswith(prefix):
                lines.append(
                    f"| `{f.key}` | {f.label} | **{f.value}** | {SERVED[f.source]} → `{f.field}` | `{f.source}` |"
                )
        lines.append("")
    lines += [
        "## Identity of each source",
        "",
        "What the figures above were read from. The check compares these with what",
        "is served, so a regenerated artifact cannot pass under an old table.",
        "",
        "```json",
        json.dumps(ident, indent=2, sort_keys=True),
        "```",
        "",
    ]
    return "\n".join(lines)


ROW = re.compile(r"^\| `([a-z0-9_.]+)` \| [^|]+ \| \*\*([^*]+)\*\* \|", re.M)
IDENT = re.compile(r"## Identity of each source.*?```json\n(.*?)\n```", re.S)
QUOTE = re.compile(r"\*\*([^*]+)\*\*\s*<!--\s*pitch:([a-z0-9_.]+)\s*-->")


def parse(text: str) -> tuple[dict[str, str], dict]:
    m = IDENT.search(text)
    return dict(ROW.findall(text)), (json.loads(m.group(1)) if m else {})


def compare(text: str, figs: list[Figure], ident: dict) -> list[str]:
    """What differs between a PITCH_FIGURES.md and the served figures."""
    written, written_ident = parse(text)
    problems = []
    for f in figs:
        if f.key not in written:
            problems.append(f"{f.key}: missing from {PITCH_DOC.name}")
        elif written[f.key] != f.value:
            problems.append(f"{f.key}: {PITCH_DOC.name} says {written[f.key]}, served {f.value}")
    for k in written.keys() - {f.key for f in figs}:
        problems.append(f"{k}: in {PITCH_DOC.name} but not a pitch figure")
    if written_ident != ident:
        problems.append(
            f"identity: {PITCH_DOC.name} records {json.dumps(written_ident, sort_keys=True)}, "
            f"served {json.dumps(ident, sort_keys=True)}"
        )
    return problems


def quoted_problems(figs: dict[str, str], docs=QUOTING_DOCS, against: str = PITCH_DOC.name) -> list[str]:
    """
    Every `**value**<!-- pitch:key -->` in the quoting docs holds that key's value.

    `against` names where `figs` came from — the file, or what is served — so
    a message never attributes a value to the wrong one.
    """
    problems = []
    for doc in docs:
        for value, key in QUOTE.findall(doc.read_text()):
            if key not in figs:
                problems.append(f"{doc.name}: quotes pitch:{key}, which {against} does not have")
            elif value.strip() != figs[key]:
                problems.append(f"{doc.name}: pitch:{key} quoted as {value.strip()}, {against}: {figs[key]}")
    return problems


def write() -> Path:
    bt, cal, ta = served()
    PITCH_DOC.write_text(render(figures_from(bt, cal, ta), identities_from(bt, cal, ta)))
    return PITCH_DOC


def check() -> list[str]:
    """
    What differs between PITCH_FIGURES.md, the quoting docs and what is served.

    A source that cannot be served as a pitch figure (a stale calibration, one
    measured before the daily figures existed, a missing backtest) is reported
    the same way as a differing value, not raised: either way the figures are
    not the served ones.
    """
    try:
        bt, cal, ta = served()
        figs = figures_from(bt, cal, ta)
        ident = identities_from(bt, cal, ta)
    except Exception as exc:  # noqa: BLE001 — reported, and the check fails
        return [f"cannot read the figures from what is served: {type(exc).__name__}: {exc}"]
    if not PITCH_DOC.exists():
        return [f"{PITCH_DOC} does not exist; write it with `python -m app.api.batch pitch`"]
    problems = compare(PITCH_DOC.read_text(), figs, ident)
    return problems + quoted_problems({f.key: f.value for f in figs}, against="served")
