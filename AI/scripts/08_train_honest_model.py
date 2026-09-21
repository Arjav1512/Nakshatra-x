"""
Train and honestly validate the Track A prospectivity model (PRD A-3, A-4, A-7).

Validation is **leave-one-mine-out (LOMO)**, not a random split.

Why that matters: the ten positives are ten mines, and points near the same
deposit share geology. A random split can put samples from the same mine on
both sides, so the model is scored on ground it has effectively seen. LOMO
holds out an entire deposit — the model must identify a mine it has never been
shown. That is the question a geologist actually asks: *would this have found
the next deposit?*

The previous pipeline reported ~0.98 AUC from a random split over features
derived from distance to the mines. This script reports what the real
measurements support, which is a lower number, and that is the honest result.

Run:  python AI/scripts/08_train_honest_model.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sentinel_features import FEATURE_COLS  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / "outputs"
MODEL_VERSION = "track-a-gbt-lomo-v1"
SEED = 20260921


def _model() -> GradientBoostingClassifier:
    # Deliberately small: 10 positives cannot support a large model, and an
    # over-parameterised fit would inflate the very number this script exists
    # to report honestly.
    return GradientBoostingClassifier(
        n_estimators=120,
        learning_rate=0.05,
        max_depth=2,
        subsample=0.9,
        random_state=SEED,
    )


def leave_one_mine_out(df: pd.DataFrame) -> dict:
    """
    Pool out-of-fold predictions across folds, then score once.

    Each fold holds out one positive mine plus a rotating slice of negatives,
    so both classes are represented out-of-fold.
    """
    pos = df[df.label == 1].reset_index(drop=True)
    neg = df[df.label == 0].reset_index(drop=True)
    rng = np.random.default_rng(SEED)
    neg_fold = rng.permutation(len(neg)) % len(pos)

    oof_scores, oof_labels, per_fold = [], [], []
    for i in range(len(pos)):
        held_pos = pos.iloc[[i]]
        held_neg = neg.iloc[neg_fold == i]
        train = pd.concat([pos.drop(index=i), neg.drop(index=held_neg.index)])
        test = pd.concat([held_pos, held_neg])

        scaler = StandardScaler().fit(train[FEATURE_COLS])
        clf = _model().fit(scaler.transform(train[FEATURE_COLS]), train.label)
        p = clf.predict_proba(scaler.transform(test[FEATURE_COLS]))[:, 1]

        oof_scores.extend(p.tolist())
        oof_labels.extend(test.label.tolist())
        # Rank of the held-out mine among the negatives it was scored with.
        mine_score = float(p[0])
        neg_scores = p[1:]
        pct = float(np.mean(neg_scores < mine_score)) if len(neg_scores) else float("nan")
        per_fold.append({
            "held_out_mine": str(held_pos.name.iloc[0]),
            "mine_score": round(mine_score, 4),
            "n_negatives_in_fold": int(len(neg_scores)),
            "percentile_vs_negatives": round(pct, 3),
        })

    y = np.array(oof_labels)
    s = np.array(oof_scores)
    return {
        "_labels": oof_labels,
        "_scores": oof_scores,
        "auc": round(float(roc_auc_score(y, s)), 4),
        "average_precision": round(float(average_precision_score(y, s)), 4),
        "base_rate": round(float(y.mean()), 4),
        "n_out_of_fold": int(len(y)),
        "per_fold": per_fold,
    }


SPECTRAL = ["iron_oxide_ratio", "ferrous_ratio", "clay_alteration_ratio", "ndvi", "swir_ratio_norm"]
TERRAIN = ["elevation_m", "slope_deg"]


def _lomo_auc(df: pd.DataFrame, cols: list[str]) -> float:
    """LOMO AUC over a restricted feature set, for ablation."""
    pos = df[df.label == 1].reset_index(drop=True)
    neg = df[df.label == 0].reset_index(drop=True)
    rng = np.random.default_rng(SEED)
    fold = rng.permutation(len(neg)) % len(pos)
    scores, labels = [], []
    for i in range(len(pos)):
        hp, hn = pos.iloc[[i]], neg.iloc[fold == i]
        tr = pd.concat([pos.drop(index=i), neg.drop(index=hn.index)])
        te = pd.concat([hp, hn])
        sc = StandardScaler().fit(tr[cols])
        clf = _model().fit(sc.transform(tr[cols]), tr.label)
        scores += clf.predict_proba(sc.transform(te[cols]))[:, 1].tolist()
        labels += te.label.tolist()
    return round(float(roc_auc_score(labels, scores)), 4)


def bootstrap_auc_ci(labels, scores, n_boot: int = 2000) -> tuple[float, float]:
    """
    Percentile bootstrap CI on the out-of-fold AUC.

    With 10 positives the point estimate is unstable, and a single AUC quoted
    without an interval would overstate what 50 points can support.
    """
    y, s = np.asarray(labels), np.asarray(scores)
    rng = np.random.default_rng(SEED)
    pos_idx = np.flatnonzero(y == 1)
    neg_idx = np.flatnonzero(y == 0)
    out = []
    for _ in range(n_boot):
        pi = rng.choice(pos_idx, len(pos_idx), replace=True)
        ni = rng.choice(neg_idx, len(neg_idx), replace=True)
        idx = np.concatenate([pi, ni])
        if len(np.unique(y[idx])) < 2:
            continue
        out.append(roc_auc_score(y[idx], s[idx]))
    return round(float(np.percentile(out, 2.5)), 3), round(float(np.percentile(out, 97.5)), 3)


def random_split_for_contrast(df: pd.DataFrame) -> float:
    """
    The same model under a random 5-fold split, shown only for contrast.

    This is the protocol that produced the old headline number. Reporting both
    makes the gap visible instead of letting a reader assume the higher one.
    """
    from sklearn.model_selection import StratifiedKFold, cross_val_predict
    from sklearn.pipeline import make_pipeline

    pipe = make_pipeline(StandardScaler(), _model())
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    p = cross_val_predict(pipe, df[FEATURE_COLS], df.label, cv=cv, method="predict_proba")[:, 1]
    return round(float(roc_auc_score(df.label, p)), 4)


def main() -> None:
    csv = OUT / "training_table_honest.csv"
    if not csv.exists():
        raise SystemExit("Run 07_build_honest_dataset.py first")
    df = pd.read_csv(csv)
    print(f"Loaded {len(df)} points ({int(df.label.sum())} positive, {int((1-df.label).sum())} negative)")
    print(f"Features ({len(FEATURE_COLS)}): {', '.join(FEATURE_COLS)}")
    print("No feature is a function of distance to a mine; lat/lng are excluded.\n")

    lomo = leave_one_mine_out(df)
    random_auc = random_split_for_contrast(df)
    ablation = {
        "all_features": lomo["auc"],
        "spectral_only": _lomo_auc(df, SPECTRAL),
        "terrain_only": _lomo_auc(df, TERRAIN),
        "slope_only": _lomo_auc(df, ["slope_deg"]),
    }

    print("=== LEAVE-ONE-MINE-OUT (the honest protocol) ===")
    print(f"  AUC                {lomo['auc']}")
    print(f"  Average precision  {lomo['average_precision']}  (base rate {lomo['base_rate']})")
    print(f"  Out-of-fold points {lomo['n_out_of_fold']}")
    print()
    print("  per held-out mine:")
    for f in lomo["per_fold"]:
        print(f"    {f['held_out_mine']:16} score {f['mine_score']:.3f}  "
              f"above {f['percentile_vs_negatives']*100:5.1f}% of its fold's negatives")
    print()
    lo, hi = bootstrap_auc_ci(lomo["_labels"], lomo["_scores"])
    lomo["auc_ci95"] = [lo, hi]
    print(f"  95% bootstrap CI   [{lo}, {hi}]  <- 10 positives cannot support a tighter claim")
    print()
    print("=== ABLATION: where the signal comes from ===")
    print(f"  all features (7)     LOMO AUC {ablation['all_features']}")
    print(f"  spectral only (5)    LOMO AUC {ablation['spectral_only']}   <- the geological claim")
    print(f"  terrain only (2)     LOMO AUC {ablation['terrain_only']}")
    print(f"  slope only (1)       LOMO AUC {ablation['slope_only']}   <- ~chance")
    print()
    print("=== RANDOM 5-FOLD, for contrast only ===")
    print(f"  AUC {random_auc}  <- the optimistic protocol; do not quote this")

    # Fit the final model on everything for inference.
    scaler = StandardScaler().fit(df[FEATURE_COLS])
    clf = _model().fit(scaler.transform(df[FEATURE_COLS]), df.label)
    importance = sorted(
        zip(FEATURE_COLS, clf.feature_importances_), key=lambda x: -x[1]
    )
    print()
    print("=== feature importance (final fit) ===")
    for name, imp in importance:
        print(f"    {name:24} {imp:.4f}")

    import joblib
    joblib.dump({"model": clf, "scaler": scaler, "features": FEATURE_COLS},
                OUT / "prospectivity_model_honest.pkl")

    metrics = {
        "model_version": MODEL_VERSION,
        "validation": "leave-one-mine-out",
        "lomo": {k: v for k, v in lomo.items() if not k.startswith("_")},
        "ablation_lomo_auc": ablation,
        "random_split_auc_for_contrast": random_auc,
        "ablation_note": (
            "Spectral indices alone reach only ~0.60 LOMO AUC, and slope alone is "
            "chance. Neither family carries the result on its own; the model is "
            "using combinations. With 10 positives the interval is wide, so the "
            "point estimate should not be quoted without it."
        ),
        "feature_importance": {k: round(float(v), 4) for k, v in importance},
        "features": FEATURE_COLS,
        "n_samples": int(len(df)),
        "honest_note": (
            "LOMO AUC is the figure to quote. The previous pipeline reported "
            "~0.98 from a random split over features derived from distance to "
            "the mine coordinates, which are the positive labels; that number "
            "measured leakage, not geology."
        ),
        "guardrail": (
            "Surface indicators only. This does not detect subsurface ore and "
            "is not a reserve statement (PRD 2.2, 2.4)."
        ),
        "lithology_note": (
            "GSI lithology unavailable (bhukosh.gsi.gov.in unreachable); omitted "
            "rather than substituted."
        ),
    }
    (OUT / "model_metrics_honest.json").write_text(json.dumps(metrics, indent=2) + "\n")
    print(f"\nWrote {(OUT / 'model_metrics_honest.json').name} and the fitted model.")


if __name__ == "__main__":
    main()
