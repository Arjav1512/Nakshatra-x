"""
The pitch and the live demo quote one set of figures, and it is what is served.

docs/PITCH_FIGURES.md is written by `python -m app.api.batch pitch` from the
frozen dataset (docs/DEMO.md, "Freeze the pitch dataset"). These read the same
figures over HTTP from the running app and fail if the file says anything else
— a value, or the identity of the artifact it came from — and if DEMO.md or
JURY_QA.md quote a figure (`**value**<!-- pitch:key -->`) the file does not
hold. So a regenerated dataset, a re-measured calibration or a retrained Track A
model cannot leave the slides' numbers behind without failing CI.
"""
from __future__ import annotations

from app.api import pitch_figures as pf


def _served(client):
    bt = client.get(f"/api/v1/mines/{pf.PILOT_ID}/backtest",
                    params={"span_days": pf.BACKTEST_SPAN, "step_days": pf.BACKTEST_STEP})
    cal = client.get("/api/v1/calibration/cumulative", params={"mine_code": pf.PILOT_CODE})
    ta = client.get("/api/v1/prospectivity/metrics")
    for r in (bt, cal, ta):
        assert r.status_code == 200, f"{r.url} -> {r.status_code}: {r.text[:300]}"
    return bt.json(), cal.json(), ta.json()


def test_pitch_figures_are_what_the_api_serves(client):
    bt, cal, ta = _served(client)
    problems = pf.compare(pf.PITCH_DOC.read_text(), pf.figures_from(bt, cal, ta), pf.identities_from(bt, cal, ta))
    assert not problems, (
        "docs/PITCH_FIGURES.md disagrees with the served artifacts. If the dataset "
        "was re-frozen on purpose, rewrite it with `python -m app.api.batch pitch` "
        "and update the slides:\n  " + "\n  ".join(problems)
    )


def test_the_docs_quote_only_the_frozen_figures():
    written, _ = pf.parse(pf.PITCH_DOC.read_text())
    assert written, "docs/PITCH_FIGURES.md holds no figures"
    problems = pf.quoted_problems(written)
    assert not problems, "\n".join(problems)
    for doc in pf.QUOTING_DOCS:
        assert pf.QUOTE.search(doc.read_text()), f"{doc.name} quotes no pitch figure; it should read them from here"


def test_the_check_notices_a_changed_figure_or_identity(client):
    """The comparison itself, so a change to it cannot quietly pass everything."""
    bt, cal, ta = _served(client)
    figs, ident = pf.figures_from(bt, cal, ta), pf.identities_from(bt, cal, ta)
    text = pf.render(figs, ident)
    assert pf.compare(text, figs, ident) == []

    f = figs[0]
    row = next(line for line in text.splitlines() if line.startswith(f"| `{f.key}` |"))
    edited = text.replace(row, row.replace(f"**{f.value}**", "**99.99%**"))
    assert any(f.key in p for p in pf.compare(edited, figs, ident))

    other = {**ident, pf.BACKTEST_FILE: {**ident[pf.BACKTEST_FILE], "data_end_date": "1999-01-01"}}
    assert any(p.startswith("identity") for p in pf.compare(pf.render(figs, other), figs, ident))


def test_withdrawn_figures_stay_out_of_the_pitch(client):
    """
    P(shortfall) and the 14-day cumulative figures are withheld (DECISIONS.md
    D-044): not computed as pitch figures, not written to PITCH_FIGURES.md, and
    not quoted by DEMO.md or JURY_QA.md. Putting one back fails here until
    D-045's fix passes its pre-registered test and this list is changed with it.
    """
    bt, cal, ta = _served(client)
    figs, ident = pf.figures_from(bt, cal, ta), pf.identities_from(bt, cal, ta)
    assert not {f.key for f in figs} & pf.WITHHELD.keys()
    written, _ = pf.parse(pf.PITCH_DOC.read_text())
    assert not written.keys() & pf.WITHHELD.keys(), sorted(written.keys() & pf.WITHHELD.keys())
    for doc in pf.QUOTING_DOCS:
        quoted = {k for _, k in pf.QUOTE.findall(doc.read_text())}
        assert not quoted & pf.WITHHELD.keys(), f"{doc.name} quotes {sorted(quoted & pf.WITHHELD.keys())}"

    # The check itself refuses one, so this cannot pass by never looking.
    text = pf.render(figs, ident)
    row = "| `portfolio.cumulative_coverage` | 14-day coverage | **0.738** | x | `y` |"
    first = next(line for line in text.splitlines() if line.startswith("| `"))
    smuggled = text.replace(first, f"{first}\n{row}", 1)
    assert any("withheld" in p for p in pf.compare(smuggled, figs, ident))
    assert pf.withheld_problems(["portfolio.daily_coverage"]) == []
