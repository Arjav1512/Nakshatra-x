#!/usr/bin/env bash
#
# Refuse to start a service on a port another process already owns.
#
#   scripts/check_port.sh 8000 "FastAPI service layer"
#   scripts/check_port.sh 3000 "Next.js"      # exits 1 and names the owner
#   scripts/check_port.sh 8000 api --kill     # only with an explicit flag
#
# WHY THIS EXISTS
# ---------------
# Twice now a verification run has reported a phantom failure because a server
# from an earlier session still owned the port. The new process failed to bind,
# exited, and the old one kept answering — so `curl` got 404s from code that no
# longer existed on disk, and the obvious reading was "the new routes are
# broken". They were not. The second time cost a full debugging detour into
# route registration that was correct all along.
#
# A free port is a precondition for trusting anything a local run says, so it is
# checked rather than assumed. This prints the PID and the command line, because
# "port in use" without the owner just moves the puzzle one step along.
#
# --kill is deliberately opt-in. A port can be owned by something that is not
# ours, and silently killing a stranger's process to free a port is not a trade
# this script gets to make on anyone's behalf.

set -euo pipefail

PORT="${1:?usage: check_port.sh <port> [label] [--kill]}"
LABEL="${2:-service}"
KILL=""
for arg in "$@"; do [ "$arg" = "--kill" ] && KILL=1; done

owner_pids() { lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true; }

PIDS="$(owner_pids)"
if [ -z "$PIDS" ]; then
  echo "port $PORT is free — starting $LABEL"
  exit 0
fi

echo "PORT $PORT IS ALREADY IN USE — refusing to start $LABEL" >&2
for pid in $PIDS; do
  CMD="$(ps -o command= -p "$pid" 2>/dev/null | head -1)"
  START="$(ps -o lstart= -p "$pid" 2>/dev/null | head -1)"
  echo "  PID $pid  started $START" >&2
  echo "    $CMD" >&2
done

if [ -z "$KILL" ]; then
  cat >&2 <<EOF

  Nothing was started. A second process cannot bind this port, so it would exit
  and the OLD one would keep answering — which looks exactly like the new code
  being broken.

  To take the port over, re-run with --kill, or stop it yourself:
      kill $PIDS
EOF
  exit 1
fi

echo "  --kill given; stopping $PIDS" >&2
kill $PIDS 2>/dev/null || true
for _ in $(seq 1 25); do
  sleep 0.2
  [ -z "$(owner_pids)" ] && { echo "port $PORT freed — starting $LABEL"; exit 0; }
done

echo "port $PORT still held after SIGTERM; not escalating to SIGKILL" >&2
exit 1
