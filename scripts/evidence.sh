#!/usr/bin/env bash
# scripts/evidence.sh — run a check and capture its evidence.
# Usage: evidence.sh <mission> <label> [-- command args...]
# output: .mugiwara/results/<mission>/<label>-<hash>.log
set -u

die() { echo "evidence: $*" >&2; exit 1; }

MISSION="${1:-}"
LABEL="${2:-}"
shift 2>/dev/null || true
[ -z "$MISSION" ] && die "usage: evidence.sh <mission> <label> [-- command args...]"
[ -z "$LABEL" ] && die "usage: evidence.sh <mission> <label> [-- command args...]"

# mission allowlist — path-traversal guard (same rule as mission-report.sh)
case "$MISSION" in
  *[!a-zA-Z0-9._-]*) die "invalid mission name \"$MISSION\" (allowlist: [a-zA-Z0-9._-])" ;;
esac

MUGIWARA_DIR="${MUGIWARA_DIR:-.mugiwara}"
RESULTS_DIR="$MUGIWARA_DIR/results/$MISSION"
mkdir -p "$RESULTS_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
HASH=$(echo "${LABEL}-${TIMESTAMP}-$$-${RANDOM}" | (sha256sum 2>/dev/null || shasum -a 256 2>/dev/null || openssl sha256) | cut -c1-12 2>/dev/null || echo "${TIMESTAMP}")
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
