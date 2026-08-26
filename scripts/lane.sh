#!/usr/bin/env bash
# scripts/lane.sh — compute lane from git diff, deterministic.
# Usage: lane.sh [base-ref] [--json]
set -u

# shared path patterns — single source of truth (D3)
# shellcheck source=scripts/lib/patterns.sh
source "$(dirname "$0")/lib/patterns.sh"

BASE="${1:-main}"
JSON_OUT=0
[ "${2:-}" = "--json" ] && JSON_OUT=1

[ -d .git ] || { echo "lane: not a git repository" >&2; exit 1; }

# resolve base
if ! git rev-parse "$BASE" >/dev/null 2>&1; then
  ALT=$(git branch --list main master --format='%(refname:short)' 2>/dev/null | head -1 || true)
  [ -n "$ALT" ] && BASE="$ALT" || BASE="HEAD~1"
fi

# union of committed + staged + unstaged + untracked (F) — see patterns.sh
CHANGED=$(changed_files "$BASE")
FILE_COUNT=0
[ -n "$CHANGED" ] && FILE_COUNT=$(echo "$CHANGED" | wc -l | tr -d ' ')
read -r ADDED_INS ADDED_DEL <<EOF
$(changed_loc "$BASE")
EOF

SENSITIVE=$(echo "$CHANGED" | grep -E "$SENSITIVE_PATS" 2>/dev/null | tr '\n' ',' | sed 's/,$//' || true)
HAS_SENSITIVE=0
[ -n "$SENSITIVE" ] && HAS_SENSITIVE=1

# lane logic
LANE="direct"
REASON=""

if [ "$FILE_COUNT" -eq 0 ] 2>/dev/null; then
  LANE="direct"
  REASON="no changed files"
elif [ "$FILE_COUNT" -le 1 ] 2>/dev/null; then
  ADDED="${ADDED_INS:-0}"
  if [ "$ADDED" -lt 20 ] 2>/dev/null; then
    LANE="direct"
    REASON="1 file, <20 LOC"
  else
    LANE="lean"
    REASON="1 file, $ADDED LOC"
  fi
elif [ "$FILE_COUNT" -eq 2 ] 2>/dev/null; then
  LANE="lean"
  REASON="2 files"
elif [ "$FILE_COUNT" -le 8 ] 2>/dev/null; then
  LANE="standard"
  REASON="$FILE_COUNT files"
else
  LANE="full"
  REASON="$FILE_COUNT files"
fi

# Sensitive-path escalation is unconditional — it wins over any count-based
# lane AND over the docs-only downgrade below (bug C9).
if [ "$HAS_SENSITIVE" -eq 1 ]; then
  PREV="$LANE"
  LANE="full"
  REASON="sensitive paths ($SENSITIVE) — escalated from $PREV"
fi

# path-weighted sizing: docs-only changes (markdown/config/docs outside the
# product surface) never escalate to full from file count alone — size by the
# code surface actually touched. Sensitive-path escalation above still wins.
# Product surface for mugiwara: content/, src/, scripts/, test/, hooks/,
# .opencode/, .claude/, evals/ — everything else is docs/config/asset.
if [ "$LANE" = "full" ] && [ "$HAS_SENSITIVE" -eq 0 ] && [ -n "$CHANGED" ]; then
  CODE_COUNT=$(echo "$CHANGED" | grep -E "$PRODUCT_PAT" 2>/dev/null | grep -c . || true)
  if [ -z "$CODE_COUNT" ] || [ "$CODE_COUNT" -eq 0 ] 2>/dev/null; then
    PREV="$LANE"
    LANE="standard"
    REASON="$FILE_COUNT files, docs-only — path-weighted down from $PREV"
  fi
fi

# policy as code: mugiwara.policy.yml lanes.force_full pushes the lane UP to
# full — always upward, never downward, and it wins over the docs-only
# downgrade above. Optional by design: no policy file (or no bun) = no-op.
if command -v bun >/dev/null 2>&1 && { [ -f mugiwara.policy.yml ] || [ -f mugiwara.policy.yaml ]; }; then
  POLICY_HITS=$(printf '%s\n' "$CHANGED" | bun "$(dirname "$0")/policy-force.ts" 2>/dev/null || true)
  if [ -n "$POLICY_HITS" ]; then
    LANE="full"
    REASON="policy force_full ($POLICY_HITS)"
  fi
fi

if [ "$JSON_OUT" -eq 1 ]; then
  SENS_ARR=""
  [ -n "$SENSITIVE" ] && SENS_ARR=$(echo "$SENSITIVE" | tr ',' '\n' | sed 's/^/"/;s/$/"/' | tr '\n' ',' | sed 's/,$//')
  cat <<JSON
{
  "lane": "$LANE",
  "reason": "$REASON",
  "files_touched": $FILE_COUNT,
  "sensitive_paths": [${SENS_ARR}],
  "base": "$BASE"
}
JSON
else
  echo "$LANE"
fi
