"""
The README states no figure of its own.

Every quotable figure lives in `docs/PITCH_FIGURES.md`, which is written from
what the API serves and checked against it in CI (`batch pitch-check`). A
number typed into the README has no such check: it goes stale silently, and it
is the first thing a reader quotes. So the README may cite figures only by
reference, and this file enforces that:

1. no value from `docs/PITCH_FIGURES.md` appears in the README;
2. no withdrawn figure appears, either one this project retracted or one it
   withholds (P(shortfall) and the 14-day coverage behind it);
3. every other data-like number in the README sits inside an allowlisted
   phrase, and each entry in the allowlist says why that number is not data;
4. while `docs/PITCH_FIGURES.md` lists P(shortfall) as withheld, the README
   says it is withdrawn.

A "data-like number" is a standalone run of digits, with an optional decimal
part or `%`. Digits inside identifiers (`SIH26009`, `D-044`, `Sentinel-2`,
`07_build_honest_dataset.py`, `/api/v1`), section and PR references (`§5`,
`#39`) and ordered-list markers are not data and are skipped.
"""
from __future__ import annotations

import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
README = REPO / "README.md"
PITCH = REPO / "docs" / "PITCH_FIGURES.md"

# Phrases whose number is a name, a version, a port or a design parameter, not
# a result. A number is allowed only where one of these phrases covers it.
ALLOWED_PHRASES = {
    "Smart India Hackathon 2026": "the hackathon's name",
    "an 80% interval": "the forecaster's nominal interval (NOMINAL_COVERAGE, app/ml/forecaster.py): a design parameter",
    "80% intervals contain 80% of outcomes": "the definition of interval calibration at the nominal level",
    "the 14-day aggregate": "the forecast horizon P(shortfall) is defined over: a design parameter",
    "Node 22": "CI's Node version (.github/actions/frontend-env)",
    "Python 3.12": "the floor rasterio 1.5 sets (Requires-Python >=3.12)",
    "Python 3.13": "CI's and setup_dev.sh's Python version",
    "http://localhost:8000": "FastAPI's local port",
    "http://localhost:3000": "the Next.js app's local port",
    "Next.js 16": "framework version",
    "React 19": "framework version",
    "Tailwind CSS 4": "framework version",
}

# Figures that must never reappear. Each was retracted as fabricated or leaked,
# or is withheld until a fix passes a pre-registered test.
WITHDRAWN = {
    "0.98": "the leaky Track A AUC, which measured leakage (docs/TRACK_A.md, 'The headline')",
    "98.7%": "a fabricated accuracy claim (docs/INTEGRITY.md, row 9)",
    "0.995": "a fabricated ROC-AUC (docs/INTEGRITY.md, row 9)",
    "10.8k": "a fabricated count of core drill logs (docs/INTEGRITY.md, row 9)",
    "10,829": "the same fabricated count (docs/READINESS.md §3, guardrail table)",
    "0.9875": "an invented /metrics fallback (docs/FABRICATION_SWEEP.md §3)",
    "0.9950": "an invented /metrics fallback (docs/FABRICATION_SWEEP.md §3)",
    "99.4": "a fabricated accuracy cap (docs/FABRICATION_SWEEP.md)",
    "92.4%": "a fabricated reserve probability (comment in IndiaSatelliteMap.tsx)",
    "0.88": "worst-grade P(shortfall), withdrawn (docs/DECISIONS.md D-044)",
    "0.97": "a P(shortfall) value, withdrawn (docs/DECISIONS.md D-044)",
    "0.717": "14-day coverage on the frozen dataset, withheld (docs/DECISIONS.md D-044)",
    "0.163": "14-day tails on the frozen dataset, withheld (docs/DECISIONS.md D-044)",
    "0.738": "14-day coverage, 20 September dataset, withheld (docs/CALIBRATION.md)",
    "0.165": "14-day tails, 20 September dataset, withheld (docs/CALIBRATION.md)",
    "0.683": "14-day coverage, 6 October dataset, withheld (docs/DECISIONS.md D-043)",
}

NUMBER = re.compile(r"\d+(?:[.,]\d+)*%?")


def data_like_numbers(text: str):
    """(start, end, token) for every data-like number in `text`."""
    for m in NUMBER.finditer(text):
        s, e = m.span()
        before = text[s - 1] if s else ""
        after = text[e] if e < len(text) else ""
        if before and (before.isalnum() or before in "_#§/"):
            continue  # inside an identifier or path, or a §/# reference
        if s >= 2 and text[s - 1] == "-" and text[s - 2].isalpha():
            continue  # D-044, Sentinel-2
        if after and (after.isalpha() or after == "_"):
            continue  # 07_build..., 2A
        line_start = text.rfind("\n", 0, s) + 1
        if not text[line_start:s].strip() and text[e:e + 2] == ". ":
            continue  # ordered-list marker
        yield s, e, m.group(0)


def pitch_values() -> set[str]:
    """Every number shown as a figure in docs/PITCH_FIGURES.md's tables."""
    values = set()
    for line in PITCH.read_text().splitlines():
        if not line.startswith("|"):
            continue
        for bold in re.findall(r"\*\*([^*]+)\*\*", line):
            values.update(m.group(0).rstrip("%") for m in NUMBER.finditer(bold))
    return values


def covered(text: str) -> list[tuple[int, int]]:
    """Spans of every allowlisted phrase; a space in a phrase matches any line wrap."""
    spans = []
    for phrase in ALLOWED_PHRASES:
        pattern = r"\s+".join(re.escape(word) for word in phrase.split(" "))
        spans.extend(m.span() for m in re.finditer(pattern, text))
    return spans


def test_the_readme_quotes_no_pitch_figure():
    text = README.read_text()
    figures = pitch_values()
    assert figures, "docs/PITCH_FIGURES.md has no figures; the parser is out of date"
    quoted = sorted({t for _, _, t in data_like_numbers(text) if t.rstrip("%") in figures})
    assert not quoted, (
        f"README states pitch figures {quoted}. Refer to docs/PITCH_FIGURES.md instead; "
        "a figure typed into the README is not pitch-checked."
    )
    assert "docs/PITCH_FIGURES.md" in text, "README must point readers to docs/PITCH_FIGURES.md"


def test_the_readme_carries_no_withdrawn_figure():
    text = README.read_text()
    found = {v: why for v, why in WITHDRAWN.items() if v in text}
    assert not found, "README states withdrawn figures:\n  " + "\n  ".join(f"{v}: {w}" for v, w in found.items())


def test_every_number_in_the_readme_is_allowlisted():
    text = README.read_text()
    spans = covered(text)
    stray = []
    for s, e, token in data_like_numbers(text):
        if not any(a <= s and e <= b for a, b in spans):
            line_no = text.count("\n", 0, s) + 1
            stray.append(f"line {line_no}: {token!r} in {text.splitlines()[line_no - 1].strip()[:80]!r}")
    assert not stray, (
        "README has data-like numbers outside the allowlist. Cite docs/PITCH_FIGURES.md "
        "or the doc that measured it, or, if the number is not data, add the phrase to "
        "ALLOWED_PHRASES with the reason:\n  " + "\n  ".join(stray)
    )


def test_the_allowlist_admits_no_figure():
    """The allowlist must not become the way a figure gets back in."""
    figures = pitch_values()
    for phrase in ALLOWED_PHRASES:
        for _, _, token in data_like_numbers(phrase):
            assert token not in WITHDRAWN, f"allowlisted phrase {phrase!r} carries withdrawn figure {token}"
            assert token.rstrip("%") not in figures, f"allowlisted phrase {phrase!r} carries pitch figure {token}"


def test_the_readme_says_p_shortfall_is_withdrawn_while_it_is_withheld():
    withheld = PITCH.read_text().split("## Withheld", 1)
    if len(withheld) < 2 or "P(shortfall)" not in withheld[1].split("\n## ", 1)[0]:
        return  # it came back through a passing pre-registered test; the README may say so
    assert "P(shortfall) is withdrawn" in README.read_text(), (
        "docs/PITCH_FIGURES.md withholds P(shortfall); the README's limits must say it is withdrawn"
    )


def test_the_number_finder_sees_what_it_should():
    """A guard on the guard: these must be found, and these must not."""
    found = [t for _, _, t in data_like_numbers("AUC 0.85, MAPE 11.50% over 160 days and 24 dates")]
    assert found == ["0.85", "11.50%", "160", "24"]
    skipped = "SIH26009 D-044 Sentinel-2 L2A 07_build.py /api/v1 §5 #39 track-a-gbt-lomo-v1\n1. item"
    assert list(data_like_numbers(skipped)) == []
