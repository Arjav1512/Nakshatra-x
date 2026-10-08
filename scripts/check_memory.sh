#!/usr/bin/env bash
# Is there memory for a long CPU-bound run? Run it next to the CPU check before
# `batch all` (docs/DEMO.md, "Run it on a quiet machine").
#
#   scripts/check_memory.sh        # exit 0: go; exit 1: close apps first
#
# Why: on 2026-10-08 a `batch all` that fits a forecast in about 24 s took 15-22
# minutes per forecast from the sixth on, with swap at 7.5 of 8 GB — the machine
# was paging — and was stopped at its time limit (DECISIONS.md D-044, result).
# The output would have been identical; the time was not.
#
# The gate is the operating system's own memory-pressure level, not a number
# tuned here: macOS reports normal, warn or critical, and only normal passes.
# Free memory and swap are printed for the record. Swap *in use* is not a
# signal on its own — macOS keeps it allocated long after the pressure that
# caused it, so a machine can show 8 GB of swap and fit at full speed. Swap
# *growing during a run* is the signal: see DEMO.md.
#
# On Linux (CI), MemAvailable must be at least MIN_AVAILABLE_PCT of MemTotal.
set -uo pipefail

MIN_AVAILABLE_PCT="${MIN_AVAILABLE_PCT:-25}"
CLOSE_APPS="Close browsers, IDEs, chat and video apps, then run this again. A stopped 'batch all' resumes where it stopped: it skips every artifact already written for the same date."

if [[ "$(uname)" == Darwin ]]; then
  level="$(sysctl -n kern.memorystatus_vm_pressure_level 2>/dev/null || echo unknown)"
  case "$level" in
    1) name=normal ;; 2) name=warn ;; 4) name=critical ;; *) name="unknown ($level)" ;;
  esac
  free="$(memory_pressure 2>/dev/null | awk -F': ' '/free percentage/ {print $2}')"
  swap="$(sysctl -n vm.swapusage 2>/dev/null)"
  echo "memory pressure: $name · free: ${free:-?} · swap: ${swap:-?}"
  if [[ "$level" != 1 ]]; then
    echo "NOT READY: memory pressure is $name, not normal. $CLOSE_APPS"
    exit 1
  fi
else
  read -r total avail swap_total swap_free < <(awk '
    /^MemTotal:/ {t=$2} /^MemAvailable:/ {a=$2} /^SwapTotal:/ {st=$2} /^SwapFree:/ {sf=$2}
    END {print t, a, st, sf}' /proc/meminfo)
  pct=$(( avail * 100 / total ))
  echo "memory available: ${pct}% of $(( total / 1024 )) MB · swap used: $(( (swap_total - swap_free) / 1024 )) MB"
  if (( pct < MIN_AVAILABLE_PCT )); then
    echo "NOT READY: ${pct}% available, below ${MIN_AVAILABLE_PCT}%. $CLOSE_APPS"
    exit 1
  fi
fi
echo "memory: ready"
