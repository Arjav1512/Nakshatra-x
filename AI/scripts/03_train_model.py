import pandas as pd
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.metrics import accuracy_score, classification_report, roc_auc_score, f1_score, precision_score, recall_score
import json
import os
from datetime import datetime, timezone

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs")
os.makedirs(OUTPUT_DIR, exist_ok=True)

training_table_path = os.path.join(OUTPUT_DIR, "training_table.csv")
if not os.path.exists(training_table_path):
    import subprocess
    subprocess.run(["python3", os.path.join(BASE_DIR, "scripts", "02_extract_features.py")], check=True)

df = pd.read_csv(training_table_path)

feature_cols = [
    "iron_oxide_index",
    "ferrous_mineral_index",
    "swir_b11_reflectance",
    "swir_b12_reflectance",
    "ndvi",
    "elevation_m",
    "slope_deg",
    "dist_to_fault_km",
    "temp_c",
    "rainfall_mm",
]

X = df[feature_cols]
y = df["label"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

model = RandomForestClassifier(
    n_estimators=200,
    max_depth=10,
    min_samples_split=3,
    class_weight="balanced",
    random_state=42,
    n_jobs=-1,
)

model.fit(X_train, y_train)

# Model predictions on test split
pred = model.predict(X_test)
probs = model.predict_proba(X_test)[:, 1]

acc = accuracy_score(y_test, pred)
prec = precision_score(y_test, pred, zero_division=0)
rec = recall_score(y_test, pred, zero_division=0)
f1 = f1_score(y_test, pred, zero_division=0)

try:
    auc = roc_auc_score(y_test, probs)
except Exception as exc:
    # Previously `auc = 1.0` -- a failure to compute was reported as a PERFECT
    # score, and printed as "Test ROC-AUC: 1.0000". roc_auc_score raises when
    # the test split holds a single class, so the one case where the metric is
    # undefined was the case that produced the most flattering number.
    # An undefined metric is now reported as undefined.
    auc = float("nan")
    print(f"[WARN] ROC-AUC undefined for this split ({exc}); reporting NaN, not 1.0")

# 5-Fold Stratified Cross Validation
cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
cv_acc_scores = cross_val_score(model, X, y, cv=cv, scoring="accuracy")
cv_auc_scores = cross_val_score(model, X, y, cv=cv, scoring="roc_auc")

print("==================================================")
print("NAKSHATRA-X ML MODEL TRAINING & EVALUATION REPORT")
print("==================================================")
print(f"Dataset Size:           {len(df)} samples")
print(f"Test Accuracy:          {acc * 100:.2f}%")
print(f"Test Precision:         {prec * 100:.2f}%")
print(f"Test Recall:            {rec * 100:.2f}%")
print(f"Test F1-Score:          {f1 * 100:.2f}%")
print(f"Test ROC-AUC:           {'undefined' if auc != auc else f'{auc:.4f}'}")
print(f"5-Fold Mean Accuracy:   {cv_acc_scores.mean() * 100:.2f}% (±{cv_acc_scores.std() * 100:.2f}%)")
print(f"5-Fold Mean ROC-AUC:    {cv_auc_scores.mean():.4f}")
print("\nClassification Report:")
print(classification_report(y_test, pred, target_names=["background", "manganese"]))

importances = []
print("\nFeature Importances:")
for col, imp in sorted(zip(feature_cols, model.feature_importances_), key=lambda x: -x[1]):
    print(f"  {col:25s} {imp:.4f}")
    importances.append({"feature": col, "importance": round(float(imp), 4)})

# Save model file
model_path = os.path.join(OUTPUT_DIR, "prospectivity_model.pkl")
joblib.dump(model, model_path)
print(f"\n[OK] Saved ML Model: {model_path}")

# Export comprehensive model metadata
metrics_path = os.path.join(OUTPUT_DIR, "model_metrics.json")
metrics_payload = {
    # Self-labelling: this script trains the LEGACY pipeline, whose features are
    # derived from distance to the known mine coordinates -- which are the
    # positive labels. Any score here measures that leakage, not geology
    # (docs/INTEGRITY.md section 4). The honest figures come from
    # 08_train_honest_model.py -> model_metrics_honest.json, and are what the
    # API serves. A previously shipped copy of this file reported roc_auc
    # 0.9858 with dist_to_fault_km as the top feature.
    "VALIDITY_WARNING": (
        "Leakage-affected. Features derive from distance to the labelled mines. "
        "Do not quote. Use model_metrics_honest.json (leave-one-mine-out)."
    ),
    "superseded_by": "model_metrics_honest.json",
    "model_type": "RandomForestClassifier",
    "n_estimators": 200,
    "max_depth": 10,
    "accuracy": round(float(acc), 4),
    "precision": round(float(prec), 4),
    "recall": round(float(rec), 4),
    "f1_score": round(float(f1), 4),
    # NaN is not valid JSON; an undefined metric serialises as null so a
    # consumer sees "absent", never a number that was never computed.
    "roc_auc": None if auc != auc else round(float(auc), 4),
    "cv_accuracy_mean": round(float(cv_acc_scores.mean()), 4),
    "cv_roc_auc_mean": round(float(cv_auc_scores.mean()), 4),
    "dataset_size": len(df),
    "features": feature_cols,
    "feature_importances": importances,
    "trained_timestamp": datetime.now(timezone.utc).isoformat()
}

with open(metrics_path, "w") as f:
    json.dump(metrics_payload, f, indent=2)

print(f"[OK] Saved Model Metrics: {metrics_path}")
print("==================================================")
