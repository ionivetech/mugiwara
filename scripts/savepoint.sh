#!/usr/bin/env bash
# scripts/savepoint.sh — write .mugiwara/state.json at every wave boundary.
# Computed from git + file counts; zero model judgement.
set -u

die() { echo "savepoint: $*" >&2; exit 1; }

MUGIWARA_DIR="${MUGIWARA_DIR:-.mugiwara}"

# shared path patterns — single source of truth (D3)
# shellcheck source=scripts/lib/patterns.sh
source "$(dirname "$0")/lib/patterns.sh"

# lane ordering: direct < lean < standard < full < spike (spike resizes, not a rise)
lane_rank() {
  case "$1" in
    direct) echo 0 ;;
    lean) echo 1 ;;
    standard) echo 2 ;;
    full) echo 3 ;;
    spike) echo 4 ;;
    *) echo 0 ;;
  esac
}

# --- git identity for actor attribution ---
# Resolve once from repo git config; used when no actor is passed explicitly.
# GIT_AUTHOR_NAME is an env var usually unset — falling through to $USER
# attributes the savepoint to the OS user instead of the git identity.
GIT_NAME="$(git config user.name 2>/dev/null || true)"
GIT_EMAIL="$(git config user.email 2>/dev/null || true)"
if [ -n "$GIT_NAME" ] && [ -n "$GIT_EMAIL" ]; then GIT_ID="$GIT_NAME <$GIT_EMAIL>"; else GIT_ID="$GIT_NAME"; fi

# --- parse mission args ---
# --branch flag must parse FIRST — it shifts positionals
BRANCH_MODE=0
if [ "${1:-}" = "--branch" ]; then
  BRANCH_MODE=1
  shift
  MISSION="${1:-${STATE_MISSION:-}}"
  ACTOR="${2:-${STATE_ACTOR:-${GIT_AUTHOR_NAME:-${GIT_ID:-${USER:-}}}}}"
  BRANCH="${3:-$(git branch --show-current 2>/dev/null || echo 'unknown')}"
  WAVE="${4:-${STATE_WAVE:-1}}"
  MODE="${5:-${STATE_MODE:-guided}}"
else
  MISSION="${1:-${STATE_MISSION:-}}"
  ACTOR="${2:-${STATE_ACTOR:-${GIT_AUTHOR_NAME:-${GIT_ID:-${USER:-}}}}}"
  BRANCH="${3:-$(git branch --show-current 2>/dev/null || echo 'unknown')}"
  WAVE="${4:-${STATE_WAVE:-1}}"
  MODE="${5:-${STATE_MODE:-guided}}"
fi

# mission allowlist — MISSION feeds paths + sed + node argv; traversal or
# sed metacharacters must not reach filesystem operations
case "$MISSION" in
  ""|*[!a-zA-Z0-9._-]*) die "invalid mission name \"$MISSION\" (allowlist: [a-zA-Z0-9._-])" ;;
esac
# dot-only names (".", "..", "...") pass the char allowlist but resolve upward
# through join(...,"..") — reject them before any path is built from MISSION.
if [[ "$MISSION" =~ ^\.+$ ]]; then
  die "invalid mission name \"$MISSION\" (allowlist: [a-zA-Z0-9._-], not a dot-path)"
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

LOC_INS=0
LOC_DEL=0
LOC_DELTA=0
LOC_CHURN=0
if [ "$BASE_SHA" != "unknown" ]; then
  STAT=$(git diff --shortstat "$BASE_SHA"..HEAD 2>/dev/null || echo "")
  INS=$(echo "$STAT" | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo 0)
  DEL=$(echo "$STAT" | grep -oE '[0-9]+ deletion'  | grep -oE '[0-9]+' || echo 0)
  LOC_INS=$(( ${INS:-0} + 0 ))
  LOC_DEL=$(( ${DEL:-0} + 0 ))
  LOC_DELTA=$(( LOC_INS - LOC_DEL ))
  # churn is insertion+deletion — refactors and deletions are work too (D4)
  LOC_CHURN=$(( LOC_INS + LOC_DEL ))
fi
[ -z "$LOC_DELTA" ] && LOC_DELTA=0

SENSITIVE_PATHS=$(echo "$CHANGED_FILES" | grep -E "$SENSITIVE_PATS" 2>/dev/null | tr '\n' ',' | sed 's/,$//' || true)

LANE="direct"
LANE_REASON=""
# Sensitive-path escalation is unconditional — it wins over any count-based
# lane AND over the docs-only downgrade below (bug C9).
if [ -n "$SENSITIVE_PATHS" ]; then
  LANE="full"
  LANE_REASON="sensitive paths: $SENSITIVE_PATHS"
elif [ "$FILES_TOUCHED" -ge 9 ] 2>/dev/null; then
  LANE="full"
  LANE_REASON="$FILES_TOUCHED files"
elif [ "$FILES_TOUCHED" -ge 3 ] 2>/dev/null; then
  LANE="standard"
  LANE_REASON="$FILES_TOUCHED files"
elif [ "$FILES_TOUCHED" -ge 2 ] 2>/dev/null; then
  LANE="lean"
  LANE_REASON="$FILES_TOUCHED files"
elif [ "$FILES_TOUCHED" -eq 1 ] 2>/dev/null; then
  # 1-file rule mirrors lane.sh: >=20 added LOC -> lean, else direct
  ADDED=$(git diff --numstat "$BASE_SHA"..HEAD 2>/dev/null | awk '{s+=$1} END {print s+0}')
  if [ "${ADDED:-0}" -ge 20 ] 2>/dev/null; then
    LANE="lean"
    LANE_REASON="1 file, $ADDED LOC"
  else
    LANE="direct"
    LANE_REASON="1 file, <20 LOC"
  fi
else
  LANE="direct"
  LANE_REASON="$FILES_TOUCHED file(s) under 20 LOC"
fi

# path-weighted sizing (mirrors lane.sh): docs-only changes outside the product
# surface never escalate to full from file count alone; sensitive-path
# escalation above still wins.
if [ "$LANE" = "full" ] && [ -z "$SENSITIVE_PATHS" ] && [ -n "$CHANGED_FILES" ]; then
  CODE_COUNT=$(echo "$CHANGED_FILES" | grep -E "$PRODUCT_PAT" 2>/dev/null | grep -c . || true)
  if [ -z "$CODE_COUNT" ] || [ "$CODE_COUNT" -eq 0 ] 2>/dev/null; then
    PREV="$LANE"
    LANE="standard"
    LANE_REASON="$FILES_TOUCHED files, docs-only — path-weighted down from $PREV"
  fi
fi

# --- lane-rise compare (F9) + monotonic clamp (D2): read previous state ---
# Clamp runs here — before LANE_BASE/BUDGET — so tokens and budget follow the
# held lane, never the raw shrunken one.
LANE_PREV=""
LANE_PEAK=""
LANE_ROSE=false
PREV_MISSION=""
if [ -f "$STATE_FILE" ]; then
  PREV_JSON=$(node -e "try{const fs=require('fs');const s=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(JSON.stringify({mission:s.mission||'',lane:s.lane||'',peak:s.lane_peak||''}))}catch(e){process.stdout.write('{}')}" "$STATE_FILE" 2>/dev/null || true)
  PREV_MISSION=$(echo "$PREV_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{process.stdout.write(JSON.parse(d).mission||'')}catch(e){process.stdout.write('')}})" 2>/dev/null || true)
  LANE_PREV=$(echo "$PREV_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{process.stdout.write(JSON.parse(d).lane||'')}catch(e){process.stdout.write('')}})" 2>/dev/null || true)
  LANE_PEAK=$(echo "$PREV_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{process.stdout.write(JSON.parse(d).peak||'')}catch(e){process.stdout.write('')}})" 2>/dev/null || true)
fi
# fresh mission resets the clamp: a different mission in state.json is a new
# run, not a lane drop — no carry-over of peak or prev (case 10).
if [ -n "$PREV_MISSION" ] && [ "$PREV_MISSION" != "$MISSION" ]; then
  LANE_PREV=""
  LANE_PEAK=""
fi
# monotonic clamp: never drop below the previous peak; spike is a resize, not a rise.
if [ -n "$LANE_PEAK" ] && [ "$LANE_PEAK" != "spike" ] && [ "$(lane_rank "$LANE")" -lt "$(lane_rank "$LANE_PEAK")" ]; then
  LANE="$LANE_PEAK"
  LANE_REASON="$LANE_REASON (held at peak $LANE — clamp D2)"
fi
if [ -z "$LANE_PEAK" ] || [ "$LANE_PEAK" = "spike" ]; then
  LANE_PEAK="$LANE"
elif [ "$(lane_rank "$LANE")" -gt "$(lane_rank "$LANE_PEAK")" ]; then
  LANE_PEAK="$LANE"
fi
if [ -n "$LANE_PREV" ] && [ "$LANE_PREV" != "$LANE" ]; then
  case "$LANE_PREV:$LANE" in
    direct:lean|direct:standard|direct:full|lean:standard|lean:full|standard:full) LANE_ROSE=true ;;
    *) LANE_ROSE=false ;;
  esac
fi

# task counts from plan doc — plan is written date-prefixed (plans/YYYY-MM-DD-<mission>.md)
# or bare (plans/<mission>.md); glob both, first match wins.
PLAN_FILE=$(ls "$MUGIWARA_DIR"/plans/${MISSION}.md "$MUGIWARA_DIR"/plans/*-${MISSION}.md 2>/dev/null | head -1 || true)
TASKS_DONE=0
TASKS_TOTAL=0
if [ -n "$PLAN_FILE" ] && [ -f "$PLAN_FILE" ]; then
  # total counts ALL task lines (checked + unchecked); done counts checked only.
  # A fully-completed plan must read total=N done=N, never total=0 (the old
  # unchecked-only grep degenerated a done plan to tasks.total=0).
  TASKS_TOTAL=$(grep -cE '^\s*-\s*\[[ xX]\]' "$PLAN_FILE" 2>/dev/null || true)
  TASKS_DONE=$(grep -c '\[x\]' "$PLAN_FILE" 2>/dev/null || true)
fi

# blocker count
BLOCKERS_FILE=$(ls "$MUGIWARA_DIR/issues/${MISSION}-blockers.md" 2>/dev/null || true)
BLOCKERS_OPEN=0
if [ -n "$BLOCKERS_FILE" ] && [ -f "$BLOCKERS_FILE" ]; then
  # data rows start with a wave number; header "| wave |" and separator
  # "|---|" are excluded by the ^\| ?[0-9]+ \| pattern
  BLOCKERS_OPEN=$(grep -cE '^\| ?[0-9]+ ?\|' "$BLOCKERS_FILE" 2>/dev/null || true)
fi

# heal cycle — count WAVE-8 banner occurrences in the trace, not the word
# "heal" anywhere (heal workers/healing text would inflate the counter and
# cause a premature halt)
HEAL_CYCLE=1
TRACE_FILE=$(ls "$MUGIWARA_DIR/results/${MISSION}/"*trace*.md 2>/dev/null | head -1 || true)
if [ -n "$TRACE_FILE" ] && [ -f "$TRACE_FILE" ]; then
  HEAL_COUNT=$(grep -ci '^.*Wave 8.*\|wave 8' "$TRACE_FILE" 2>/dev/null || true)
  HEAL_CYCLE=$((HEAL_COUNT + 1))
fi

# evidence paths — per-mission results folder (quoted printf, no sed — mission
# name is allowlisted above, but avoid sed metacharacter semantics entirely)
EVIDENCE=""
for evf in "$MUGIWARA_DIR/results/${MISSION}/"*.md; do
  [ -f "$evf" ] || continue
  EVIDENCE="${EVIDENCE}${EVIDENCE:+,}.mugiwara/results/${MISSION}/$(basename "$evf")"
done

# skill version from package.json (argv-passing — never interpolate paths into node -e)
SKILL_VERSION="1"
if [ -f package.json ]; then
  PKG_JSON="$MUGIWARA_DIR/../package.json"
  [ -f "$PKG_JSON" ] && SKILL_VERSION=$(node -e "try{console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).version.split('.')[0])}catch(e){console.log('1')}" "$PKG_JSON" 2>/dev/null || echo "1")
fi

# tokens proxy (F7): deterministic estimate when the harness does not report
# real usage. Monotonic beats precise — LANE_BASE stands in for the skills
# loaded this lane; loc_delta and written-artifact words scale with growth.
# MUGIWARA_TOKENS overrides as the reported value.
LANE_BASE=0
case "$LANE" in
  lean) LANE_BASE=1500 ;;
  standard) LANE_BASE=4000 ;;
  full) LANE_BASE=9000 ;;
  spike) LANE_BASE=1000 ;;
esac
DOC_WORDS=$(cat "$MUGIWARA_DIR"/results/${MISSION}/*.md "$MUGIWARA_DIR"/plans/${MISSION}.md "$MUGIWARA_DIR"/plans/*-${MISSION}.md "$MUGIWARA_DIR"/spec/${MISSION}.md "$MUGIWARA_DIR"/spec/*-${MISSION}.md "$MUGIWARA_DIR"/logs/${MISSION}.md "$MUGIWARA_DIR"/logs/*-${MISSION}.md 2>/dev/null | wc -w | tr -d ' ')
LOC_TOKENS=$(( LOC_CHURN * 12 ))
TOKENS_SOURCE="computed"
TOKENS_EST=$(( LANE_BASE + DOC_WORDS * 135 / 100 + LOC_TOKENS ))
if [ -n "${MUGIWARA_TOKENS:-}" ]; then
  TOKENS_EST="${MUGIWARA_TOKENS}"
  TOKENS_SOURCE="reported"
fi

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
  lane_prev: process.argv[24] || null,
  lane_peak: process.argv[27] || null,
  lane_rose: process.argv[25] === 'true',
  wave: parseInt(process.argv[6], 10),
  mode: process.argv[7],
  base_sha: process.argv[8],
  head_sha: process.argv[9],
  files_touched: parseInt(process.argv[10], 10),
  loc_delta: parseInt(process.argv[11], 10),
  loc_ins: parseInt(process.argv[28], 10) || 0,
  loc_del: parseInt(process.argv[29], 10) || 0,
  loc_churn: parseInt(process.argv[30], 10) || 0,
  sensitive_paths: process.argv[12] ? process.argv[12].split(',').filter(Boolean) : [],
  tasks: { done: parseInt(process.argv[13], 10), total: parseInt(process.argv[14], 10) },
  blockers_open: parseInt(process.argv[15], 10),
  heal_cycle: parseInt(process.argv[16], 10),
  tokens_est: parseInt(process.argv[17], 10) || 0,
  tokens_source: process.argv[26] || 'computed',
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
  "$STATE_FILE" "$LANE_PREV" "$LANE_ROSE" "$TOKENS_SOURCE" "$LANE_PEAK" \
  "$LOC_INS" "$LOC_DEL" "$LOC_CHURN"

if [ "$LANE_ROSE" = true ]; then
  echo "⚠ LANE ROSE: $LANE_PREV → $LANE ($LANE_REASON) — escalate per check-in protocol"
fi
echo "✓ savepoint written: $STATE_FILE (lane=$LANE, wave=$WAVE, files=$FILES_TOUCHED)"
