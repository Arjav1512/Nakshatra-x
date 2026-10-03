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
    for s in test:e2e test:dates test:pilot test:scenario test:surface test:nav test:auth test:motion; do run "$s"; done ;;
  routes-provenance)
    run test:routes
    run test:provenance
    # The offline guard's question is "what renders with the service layer
    # stopped?", so the backend is stopped for it.
    kill "$(cat "$LOGS/backend.pid")" && sleep 2
    run test:provenance -- --offline ;;
  cls)
    run test:cls ;;
  *) echo "unknown group $GROUP"; exit 2 ;;
esac

echo; cat "$LOGS/suites.txt"
exit $failed
