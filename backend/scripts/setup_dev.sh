#!/usr/bin/env bash
#
# Create the backend development environment, in the repo, reproducibly.
#
#   backend/scripts/setup_dev.sh            # create or update .venv
#   backend/scripts/setup_dev.sh --recreate # throw it away and rebuild
#
# WHY THIS EXISTS
# ---------------
# The environment used to live in a per-session scratchpad outside the repo.
# When a session ended the scratchpad was cleaned, the venv went with it, and
# the next session could not run a single backend test until it noticed and
# rebuilt one by hand. Verification is not reproducible if the thing that runs
# it is not.
#
# The venv lives at backend/.venv, which .gitignore already covers.

set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV="$BACKEND_DIR/.venv"
PY="${PYTHON:-python3}"

if [[ "${1:-}" == "--recreate" ]]; then
  echo "Removing $VENV"
  rm -rf "$VENV"
fi

if [[ ! -x "$VENV/bin/python" ]]; then
  echo "Creating venv at $VENV"
  "$PY" -m venv "$VENV"
fi

VPY="$VENV/bin/python"

echo "Upgrading pip"
"$VPY" -m pip install --quiet --upgrade pip

for req in requirements.txt requirements-dev.txt; do
  if [[ -f "$BACKEND_DIR/$req" ]]; then
    echo "Installing $req"
    "$VPY" -m pip install --quiet -r "$BACKEND_DIR/$req"
  else
    echo "WARNING: $BACKEND_DIR/$req not found, skipping"
  fi
done

echo
echo "Environment ready. Versions:"
"$VPY" - <<'PYEOF'
import importlib.metadata as md
import platform
import sys

print(f"  python           {platform.python_version()}  ({sys.executable})")
for dist in ("fastapi", "uvicorn", "sqlalchemy", "pydantic",
             "numpy", "scikit-learn", "scipy", "pandas", "pytest"):
    try:
        print(f"  {dist:16} {md.version(dist)}")
    except md.PackageNotFoundError:
        print(f"  {dist:16} NOT INSTALLED")
PYEOF

echo
echo "Use it with:"
echo "  backend/.venv/bin/python -m pytest test_demo_hardening.py -q"
echo "  backend/.venv/bin/python -m uvicorn app.main:app --port 8000"
