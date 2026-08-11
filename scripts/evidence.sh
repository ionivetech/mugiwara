#!/usr/bin/env bash
# scripts/evidence.sh — run a check and capture its evidence.
# Usage: evidence.sh <label> [-- command args...]
# output: .mugiwara/results/<label>-<hash>.log
set -u

die() { echo "evidence: $*" >&2; exit 1; }

LABEL="${1:-}"
shift 2>/dev/null || true
[ -z "$LABEL" ] && die "usage: evidence.sh <label> [-- command args...]"

MUGIWARA_DIR="${MUGIWARA_DIR:-.mugiwara}"
RESULTS_DIR="$MUGIWARA_DIR/results"
mkdir -p "$RESULTS_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
HASH=$(echo "${LABEL}-${TIMESTAMP}-$$-${RANDOM}" | shasum -a 256 | cut -c1-12 2>/dev/null || echo "${TIMESTAMP}")
EVIDENCE_FILE="$RESULTS_DIR/${LABEL}-${HASH}.log"

{
  echo "# Evidence: $LABEL"
  echo "# At: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "# Command: ${*:-<stdin pipeline>}"
  echo "# ---"
  echo

  if [ $# -gt 0 ]; then
    "$@" 2>&1
  else
    cat
  fi
} > "$EVIDENCE_FILE"
EXIT_CODE=$?

echo "$EVIDENCE_FILE"
exit $EXIT_CODE
