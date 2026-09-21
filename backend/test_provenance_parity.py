"""
Cross-runtime parity and provenance-contract tests.

The Python and TypeScript synthetic generators must agree exactly, or the same
mine and day would yield different numbers depending on which runtime served
the request — breaking PRD N-4 (same inputs, same model version, same output).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.core.provenance import data_integrity, derived, measured, reference, synthetic
from app.core.synthetic import SyntheticStream, hash_seed, mine_stream


def test_prng_matches_typescript():
    """
    Golden values produced by frontend/src/lib/synthetic.ts for the stream
    label below. Regenerate with:
      node -e "<mulberry32 + FNV-1a from synthetic.ts>"
    """
    label = "nakshatra-x|balaghat|operations|2026-09-21"
    assert hash_seed(label) == 3373950071, "FNV-1a hash diverged from the TS implementation"

    expected = [
        0.586205191910,
        0.726103080437,
        0.470468535321,
        0.228948798729,
        0.006708146771,
        0.698486695066,
    ]
    s = SyntheticStream(label)
    got = [round(s.uniform(), 12) for _ in expected]
    assert got == expected, f"mulberry32 diverged from TS: {got} != {expected}"
    print("✓ PRNG parity: Python matches TypeScript bit-for-bit")


def test_stream_is_reproducible():
    a = [mine_stream("balaghat", "operations", "2026-09-21").uniform() for _ in range(3)]
    b = [mine_stream("balaghat", "operations", "2026-09-21").uniform() for _ in range(3)]
    assert a == b
    c = mine_stream("bharweli", "operations", "2026-09-21").uniform()
    assert c != a[0], "different mines must not share a stream"
    print("✓ Seeded streams reproducible and mine-scoped")


def test_flags_are_computed_not_supplied():
    """A caller must not be able to label synthetic data as live."""
    assert measured(1, "mm", "src")["is_live"] is True
    assert measured(1, "mm", "src")["is_synthetic"] is False
    assert synthetic(1, "mm", "src")["is_synthetic"] is True
    assert synthetic(1, "mm", "src")["is_live"] is False
    assert derived(1, "mm", "src")["is_live"] is False
    assert reference(1, "mm", "src")["is_live"] is False
    # source_kind is the only control surface, and it is validated.
    try:
        from app.core.provenance import envelope
        envelope(1, "mm", "src", "live")  # type: ignore[arg-type]
        raise AssertionError("envelope accepted an invalid source_kind")
    except ValueError:
        pass
    print("✓ is_live / is_synthetic are computed from source_kind and cannot be spoofed")


def test_degraded_banner_states_staleness():
    d = data_integrity(contains_synthetic=True, live_ok=False, degraded_reason="upstream down")
    assert "DEGRADED" in d["notice"]
    assert d["live_sources_ok"] is False
    assert d["degraded_reason"] == "upstream down"
    print("✓ Degraded banner states the reason (PRD N-6)")


if __name__ == "__main__":
    test_prng_matches_typescript()
    test_stream_is_reproducible()
    test_flags_are_computed_not_supplied()
    test_degraded_banner_states_staleness()
    print("\nALL PROVENANCE / PARITY TESTS PASSED.")
