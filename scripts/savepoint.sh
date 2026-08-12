#!/usr/bin/env bash
# scripts/savepoint.sh — write .mugiwara/state.json at every wave boundary.
# Computed from git + file counts; zero model judgement.
set -u

die() { echo "savepoint: $*" >&2; exit 1; }

MUGIWARA_DIR="${MUGIWARA_DIR:-.mugiwara}"

# --- parse mission args ---
# --branch flag must parse FIRST — it shifts positionals
BRANCH_MODE=0
if [ "${1:-}" = "--branch" ]; then
  BRANCH_MODE=1
  shift
  MISSION="${1:-${STATE_MISSION:-}}"
  ACTOR="${2:-${STATE_ACTOR:-${GIT_AUTHOR_NAME:-${USER:-}}}}"
  BRANCH="${3:-$(git branch --show-current 2>/dev/null || echo 'unknown')}"
  WAVE="${4:-${STATE_WAVE:-1}}"
  MODE="${5:-${STATE_MODE:-guided}}"
else
  MISSION="${1:-${STATE_MISSION:-}}"
  ACTOR="${2:-${STATE_ACTOR:-${GIT_AUTHOR_NAME:-${USER:-}}}}"
  BRANCH="${3:-$(git branch --show-current 2>/dev/null || echo 'unknown')}"
  WAVE="${4:-${STATE_WAVE:-1}}"
  MODE="${5:-${STATE_MODE:-guided}}"
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
BASE_SHA=$(git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null || git merge-base HEAD "$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||')" 2>/dev/null || git rev-parse HEAD~1 2>/dev/null || echo "unknown")
HEAD_SHA=$(git rev-parse HEAD 2>/dev/null || echo "unknown")

CHANGED_FILES=$(git diff --name-only "$BASE_SHA"..HEAD 2>/dev/null || git diff --name-only --cached 2>/dev/null || true)
FILES_TOUCHED=$( [ -n "$CHANGED_FILES" ] && echo "$CHANGED_FILES" | wc -l | tr -d ' ' || echo 0 )

LOC_DELTA=0
if [ "$BASE_SHA" != "unknown" ]; then
  STAT=$(git diff --shortstat "$BASE_SHA"..HEAD 2>/dev/null || echo "")
  INS=$(echo "$STAT" | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo 0)
  DEL=$(echo "$STAT" | grep -oE '[0-9]+ deletion'  | grep -oE '[0-9]+' || echo 0)
  LOC_DELTA=$(( ${INS:-0} - ${DEL:-0} ))
fi
[ -z "$LOC_DELTA" ] && LOC_DELTA=0

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
  [ -f "$PKG_JSON" ] && SKILL_VERSION=$(node -e "try{console.log(JSON.parse(require('fs').readFileSync('$PKG_JSON','utf8')).version.split('.')[0])}catch(e){console.log('1')}" 2>/dev/null || echo "1")
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

mkdir -p "$MUGIWARA_DIR"

node -e "
const data = {
  mission: process.argv[1],
  actor: process.argv[2],
  branch: process.argv[3],
  lane: process.argv[4],
  lane_reason: process.argv[5],
  wave: parseInt(process.argv[6], 10),
  mode: process.argv[7],
  base_sha: process.argv[8],
  head_sha: process.argv[9],
  files_touched: parseInt(process.argv[10], 10),
  loc_delta: parseInt(process.argv[11], 10),
  sensitive_paths: process.argv[12] ? process.argv[12].split(',').filter(Boolean) : [],
  tasks: { done: parseInt(process.argv[13], 10), total: parseInt(process.argv[14], 10) },
  blockers_open: parseInt(process.argv[15], 10),
  heal_cycle: parseInt(process.argv[16], 10),
  tokens_est: parseInt(process.argv[17], 10) || 0,
  budget: parseInt(process.argv[18], 10) || 0,
  budget_status: process.argv[19],
  skill_version: process.argv[20],
  evidence: process.argv[21] ? process.argv[21].split(',').filter(Boolean) : [],
  updated_at: process.argv[22]
};
require('fs').writeFileSync(process.argv[23], JSON.stringify(data, null, 2) + '\n');
" \
  "$MISSION" "$ACTOR" "$BRANCH" "$LANE" "$LANE_REASON" \
  "$WAVE" "$MODE" "$BASE_SHA" "$HEAD_SHA" "$FILES_TOUCHED" \
  "$LOC_DELTA" "$SENSITIVE_PATHS" "$TASKS_DONE" "$TASKS_TOTAL" \
  "$BLOCKERS_OPEN" "$HEAL_CYCLE" "$TOKENS_EST" "$BUDGET" \
  "$STATUS" "$SKILL_VERSION" "$EVIDENCE" \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  "$STATE_FILE"

echo "✓ savepoint written: $STATE_FILE (lane=$LANE, wave=$WAVE, files=$FILES_TOUCHED)"
