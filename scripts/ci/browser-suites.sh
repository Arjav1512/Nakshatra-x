#!/usr/bin/env bash
#
# Run one group of browser suites against servers started by start-servers.sh,
# timing each. Groups run as parallel CI jobs; together they are ~21 minutes.
#
#   scripts/ci/browser-suites.sh console|routes-provenance|cls
set -uo pipefail

GROUP="${1:?usage: browser-suites.sh console|routes-provenance|cls}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOGS="${RUNNER_TEMP:-/tmp}/servers"
cd "$ROOT/frontend"
# The provenance guard writes its report to a committed evidence file unless
# told otherwise; keep CI's (and a local run's) out of the tree.
export GUARD_OUT="$LOGS/provenance-guard.json"

failed=0
run() {
  local t0=$SECONDS
  echo "::group::npm run $*"
  npm run -s "$@"
  local rc=$?
  echo "::endgroup::"
  printf '%-34s %s  %4ss\n' "npm run $*" "$([[ $rc == 0 ]] && echo PASS || echo FAIL)" "$((SECONDS - t0))" | tee -a "$LOGS/suites.txt"
  [[ $rc == 0 ]] || failed=1
}

case "$GROUP" in
  console)
    for s in test:e2e test:dates test:pilot test:scenario test:surface test:nav test:auth test:motion test:fonts; do run "$s"; done ;;
  routes-provenance)
    run test:routes -- --external-offline
    run test:provenance
    # The offline guard's question is "what renders with the service layer
    # stopped?", so the backend is stopped for it.
    # By pattern, not by the recorded PID: a macOS venv's python is a launcher
    # that starts the real interpreter as a child, so the PID is not the server.
    pkill -f "uvicorn app.main:app --port 8000"; sleep 2
    if curl -s -o /dev/null http://127.0.0.1:8000/api/v1/healthz; then echo "backend still up"; exit 1; fi
    run test:provenance -- --offline ;;
  cls)
    run test:cls ;;
  *) echo "unknown group $GROUP"; exit 2 ;;
esac

echo; cat "$LOGS/suites.txt"
exit $failed
