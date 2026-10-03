#!/usr/bin/env bash
#
# Start the backend (:8000) and the production frontend (:3000) for the
# browser suites, and wait until both answer.
#
#   scripts/ci/start-servers.sh offline   # every external service unreachable
#   scripts/ci/start-servers.sh live      # real upstreams (non-blocking job only)
#
# OFFLINE is what the required browser jobs use, so no external outage can
# change their result (docs/CI.md):
#   - backend: NAKSHATRA_OFFLINE=1 points NASA POWER, STAC and Open-Meteo at the
#     discard port, and HTTP(S)_PROXY at the same port refuses anything else it
#     reaches over httpx (Planetary Computer mosaic registration);
#   - frontend: NAKSHATRA_OFFLINE=1 does the same for its own upstreams;
#   - the browser: CHROME_PATH=scripts/ci/chrome-offline, which can resolve
#     only this machine.
#
# Needs a production build (npm run build) and backend/.venv.
set -euo pipefail

MODE="${1:?usage: start-servers.sh offline|live}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOGS="${RUNNER_TEMP:-/tmp}/servers"
mkdir -p "$LOGS"

"$ROOT/scripts/check_port.sh" 8000 "FastAPI"
"$ROOT/scripts/check_port.sh" 3000 "Next.js"

if [[ "$MODE" == offline ]]; then
  export NAKSHATRA_OFFLINE=1
  SINK=http://127.0.0.1:9
  (cd "$ROOT/backend" && HTTP_PROXY=$SINK HTTPS_PROXY=$SINK http_proxy=$SINK https_proxy=$SINK \
     NO_PROXY=localhost,127.0.0.1 no_proxy=localhost,127.0.0.1 \
     nohup .venv/bin/python -m uvicorn app.main:app --port 8000 > "$LOGS/backend.log" 2>&1 &
   echo $! > "$LOGS/backend.pid")
else
  (cd "$ROOT/backend" && nohup .venv/bin/python -m uvicorn app.main:app --port 8000 > "$LOGS/backend.log" 2>&1 &
   echo $! > "$LOGS/backend.pid")
fi

# Auth routes fail closed without a session secret. One is generated for this
# run and never written anywhere.
(cd "$ROOT/frontend" && SESSION_SECRET="$(openssl rand -hex 32)" \
   nohup npm start > "$LOGS/frontend.log" 2>&1 &
 echo $! > "$LOGS/frontend.pid")

for i in $(seq 1 120); do
  if curl -sf -o /dev/null http://localhost:8000/api/v1/readyz && curl -sf -o /dev/null http://localhost:3000/; then
    echo "servers up ($MODE) after ${i}s — readyz 200, web 200"
    exit 0
  fi
  sleep 1
done
echo "servers did not come up in 120 s"; tail -30 "$LOGS/backend.log" "$LOGS/frontend.log"
exit 1
