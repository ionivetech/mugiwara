#!/usr/bin/env bash
# scripts/savepoint.sh — write .mugiwara/state.json at every wave boundary.
# Computed from git + file counts; zero model judgement.
set -u

die() { echo "savepoint: $*" >&2; exit 1; }

MUGIWARA_DIR="${MUGIWARA_DIR:-.mugiwara}"

# --- parse mission args ---
MISSION="${1:-${STATE_MISSION:-}}"
ACTOR="${2:-${STATE_ACTOR:-${GIT_AUTHOR_NAME:-${USER:-}}}}"
BRANCH="${3:-$(git branch --show-current 2>/dev/null || echo 'unknown')}"
WAVE="${4:-${STATE_WAVE:-1}}"
MODE="${5:-${STATE_MODE:-guided}}"

# --branch flag for per-branch state
BRANCH_MODE=0
if [ "${1:-}" = "--branch" ]; then
  BRANCH_MODE=1
  MISSION="${2:-${STATE_MISSION:-}}"
  BRANCH="${3:-$(git branch --show-current 2>/dev/null || echo 'unknown')}"
  shift 2 2>/dev/null || true
fi

# per-branch state file when --branch used
BRANCH_SLUG=$(echo "$BRANCH" | tr '/' '-')
if [ "$BRANCH_MODE" -eq 1 ]; then
  STATE_FILE="$MUGIWARA_DIR/state-${BRANCH_SLUG}.json"
else
  STATE_FILE="$MUGIWARA_DIR/state.json"
fi

[ -z "$MISSION" ] && die "usage: savepoint.sh <mission> [actor] [branch] [wave] [mode]"
[ -d .git ] || die "not a git repository"

# --- computed fields ---
BASE_SHA=$(git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null || git rev-parse HEAD~1 2>/dev/null || echo "unknown")
HEAD_SHA=$(git rev-parse HEAD 2>/dev/null || echo "unknown")

CHANGED_FILES=$(git diff --name-only "$BASE_SHA"..HEAD 2>/dev/null || git diff --name-only --cached 2>/dev/null || true)
FILES_TOUCHED=$( [ -n "$CHANGED_FILES" ] && echo "$CHANGED_FILES" | wc -l | tr -d ' ' || echo 0 )

LOC_DELTA=0
if [ "$BASE_SHA" != "unknown" ]; then
  LOC_DELTA=$(git diff --shortstat "$BASE_SHA"..HEAD 2>/dev/null | \
    awk '{ins=0; del=0; for(i=1;i<=NF;i++){if($i=="insertion") ins=$(i-1); if($i=="deletion") del=$(i-1)} print ins-del}' || echo 0)
fi
[ -z "$LOC_DELTA" ] && LOC_DELTA=0
[ "$LOC_DELTA" = "0" ] || LOC_DELTA=${LOC_DELTA//[^0-9-]/}

SENSITIVE_PATTERNS="auth/|payment/|billing/|crypto/|secrets/|\.env|config/|migration/|\.sql$|schema\.|\.prisma$"
SENSITIVE_PATHS=$(echo "$CHANGED_FILES" | grep -E "$SENSITIVE_PATTERNS" 2>/dev/null | tr '\n' ',' | sed 's/,$//' || true)

LANE="direct"
LANE_REASON=""
if [ "$FILES_TOUCHED" -ge 9 ] 2>/dev/null || [ -n "$SENSITIVE_PATHS" ]; then
  LANE="full"
  LANE_REASON="$( [ -n "$SENSITIVE_PATHS" ] && echo "sensitive paths: $SENSITIVE_PATHS" || echo "$FILES_TOUCHED files")"
elif [ "$FILES_TOUCHED" -ge 3 ] 2>/dev/null; then
  LANE="standard"
  LANE_REASON="$FILES_TOUCHED files"
elif [ "$FILES_TOUCHED" -ge 2 ] 2>/dev/null; then
  LANE="lean"
  LANE_REASON="$FILES_TOUCHED files"
else
  LANE="direct"
  LANE_REASON="$FILES_TOUCHED file(s) under 20 LOC"
fi

# task counts from plan doc
PLAN_FILE=$(ls "$MUGIWARA_DIR/plans/${MISSION}.md" 2>/dev/null || true)
TASKS_DONE=0
TASKS_TOTAL=0
if [ -n "$PLAN_FILE" ] && [ -f "$PLAN_FILE" ]; then
  TASKS_TOTAL=$(grep -c '\[ \]' "$PLAN_FILE" 2>/dev/null || echo 0)
  TASKS_DONE=$(grep -c '\[x\]' "$PLAN_FILE" 2>/dev/null || echo 0)
fi

# blocker count
BLOCKERS_FILE=$(ls "$MUGIWARA_DIR/issues/${MISSION}-blockers.md" 2>/dev/null || true)
BLOCKERS_OPEN=0
if [ -n "$BLOCKERS_FILE" ] && [ -f "$BLOCKERS_FILE" ]; then
  BLOCKERS_OPEN=$(grep -c '|' "$BLOCKERS_FILE" 2>/dev/null || echo 0)
fi

# heal cycle
HEAL_CYCLE=1
TRACE_FILE=$(ls "$MUGIWARA_DIR/results/${MISSION}-trace.md" 2>/dev/null || true)
if [ -n "$TRACE_FILE" ] && [ -f "$TRACE_FILE" ]; then
  HEAL_COUNT=$(grep -ci 'Wave 8\|wave 8\|heal' "$TRACE_FILE" 2>/dev/null || echo 0)
  HEAL_CYCLE=$((HEAL_COUNT + 1))
fi

# evidence paths
EVIDENCE=$(ls "$MUGIWARA_DIR/results/" 2>/dev/null | grep "$MISSION" | sed 's|^|.mugiwara/results/|' | tr '\n' ',' | sed 's/,$//' || true)

# skill version from package.json
SKILL_VERSION="1"
if [ -f package.json ]; then
  PKG_JSON="$MUGIWARA_DIR/../package.json"
  [ -f "$PKG_JSON" ] && SKILL_VERSION=$(python3 -c "import json; v=json.load(open('$PKG_JSON')).get('version','1'); print(v.split('.')[0])" 2>/dev/null || echo "1")
fi

# tokens from env var (harness exports estimated tokens consumed)
TOKENS_EST=${MUGIWARA_TOKENS:-0}

# budget per lane
BUDGET=0
case "$LANE" in
  lean) BUDGET=4000 ;;
  standard) BUDGET=10000 ;;
  full) BUDGET=20000 ;;
  spike) BUDGET=3000 ;;
  *) BUDGET=0 ;;
esac

# token budget gate
WARN_AT=$(( BUDGET * 3 / 2 ))
STOP_AT=$(( BUDGET * 3 ))
STATUS="ok"
if [ "$BUDGET" -gt 0 ] && [ "$TOKENS_EST" -ge "$STOP_AT" ] 2>/dev/null; then
  STATUS="stop"
elif [ "$BUDGET" -gt 0 ] && [ "$TOKENS_EST" -ge "$WARN_AT" ] 2>/dev/null; then
  STATUS="warn"
fi

SENSITIVE_ARR=""
if [ -n "$SENSITIVE_PATHS" ]; then
  SENSITIVE_ARR=$(echo "$SENSITIVE_PATHS" | tr ',' '\n' | sed 's/^/"/;s/$/"/' | tr '\n' ',' | sed 's/,$//')
fi
EVIDENCE_ARR=""
if [ -n "$EVIDENCE" ]; then
  EVIDENCE_ARR=$(echo "$EVIDENCE" | tr ',' '\n' | sed 's/^/"/;s/$/"/' | tr '\n' ',' | sed 's/,$//')
fi

mkdir -p "$MUGIWARA_DIR"

cat > "$STATE_FILE" <<JSON
{
  "mission": "$MISSION",
  "actor": "$ACTOR",
  "branch": "$BRANCH",
  "lane": "$LANE",
  "lane_reason": "$LANE_REASON",
  "wave": $WAVE,
  "mode": "$MODE",
  "base_sha": "$BASE_SHA",
  "head_sha": "$HEAD_SHA",
  "files_touched": $FILES_TOUCHED,
  "loc_delta": $LOC_DELTA,
  "sensitive_paths": [${SENSITIVE_ARR}],
  "tasks": { "done": $TASKS_DONE, "total": $TASKS_TOTAL },
  "blockers_open": $BLOCKERS_OPEN,
  "heal_cycle": $HEAL_CYCLE,
  "tokens_est": $TOKENS_EST,
  "budget": $BUDGET,
  "budget_status": "$STATUS",
  "skill_version": "$SKILL_VERSION",
  "evidence": [${EVIDENCE_ARR}],
  "updated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON

echo "✓ savepoint written: $STATE_FILE (lane=$LANE, wave=$WAVE, files=$FILES_TOUCHED)"
