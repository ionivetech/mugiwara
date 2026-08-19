#!/usr/bin/env bash
# scripts/savepoint.sh — write .mugiwara/state/<mission>/<member>.json at every
# wave boundary. Computed from git + file counts; zero model judgement.
# Identity is (mission, member), never branch. Solo = member empty → the file
# is named state.json. Usage:
#   savepoint.sh <mission> [member] [wave] [mode] [lane]
set -u

die() { echo "savepoint: $*" >&2; exit 1; }

MUGIWARA_DIR="${MUGIWARA_DIR:-.mugiwara}"

# shared path patterns — single source of truth (D3)
# shellcheck source=scripts/lib/patterns.sh
source "$(dirname "$0")/lib/patterns.sh"
# shared lane budgets — single source of truth (D5), validated by lane-base.ts
# shellcheck source=scripts/lib/lane-base.sh
source "$(dirname "$0")/lib/lane-base.sh"

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

# --- parse mission args: <mission> [member] [wave] [mode] ---
MISSION="${1:-${STATE_MISSION:-}}"
MEMBER="${2:-${STATE_MEMBER:-}}"
WAVE="${3:-${STATE_WAVE:-1}}"
MODE="${4:-${STATE_MODE:-guided}}"
# Triage lane (M7): the lane Luffy assigned at Flow 0. Without it savepoint
# recomputed the lane from file counts alone and silently discarded the
# triage decision — a Lane 3 mission recorded itself as "direct". Explicit
# lane acts as a FLOOR: the computed lane may still raise it, never lower it.
LANE_EXPLICIT="${5:-${STATE_LANE:-}}"
case "$LANE_EXPLICIT" in
  ""|direct|lean|standard|full|spike) ;;
  *) die "invalid lane \"$LANE_EXPLICIT\" (one of: direct lean standard full spike)" ;;
esac
# Wave may be fractional in the docs (4.5 = the checkpoint between waves).
# parseInt("4.5")=4 while tr -cd '0-9' gives "45", so state and continue
# disagreed on the same mission. Normalize once, here, for both writers.
# Keep only digits and the decimal point, then take the integer part. Garbage
# input still sanitizes to 0 (the N2 contract the continue writer already had);
# a fractional wave now truncates identically in BOTH writers instead of
# splitting into 4 (parseInt) and 45 (digit-strip).
WAVE_INT=$(printf '%s' "$WAVE" | tr -cd '0-9.')
WAVE_INT=${WAVE_INT%%.*}
case "$WAVE_INT" in
  ''|*[!0-9]*) WAVE_INT=0 ;;
esac

# verbosity from config (project .mugiwara/config), default normal; env override
VERBOSITY="${STATE_VERBOSITY:-normal}"
if [ -f "$MUGIWARA_DIR/config" ]; then
  CFG_VERBOSITY=$(grep -E '^verbosity=' "$MUGIWARA_DIR/config" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '[:space:]')
  [ -n "$CFG_VERBOSITY" ] && VERBOSITY="$CFG_VERBOSITY"
fi
case "$VERBOSITY" in
  normal|full) ;;
  *) VERBOSITY="normal" ;;
esac
ACTOR="${STATE_ACTOR:-${GIT_AUTHOR_NAME:-${GIT_ID:-${USER:-${USERNAME:-}}}}}"
BRANCH="$(git branch --show-current 2>/dev/null || echo 'unknown')"

# treat the legacy empty-actor placeholder '""' as "no member" (solo). The old
# interface used '""' for the actor slot; the new (mission, member) interface
# uses an empty arg. Accept both so callers need not know which one.
if [ "$MEMBER" = '""' ]; then MEMBER=""; fi

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

# member allowlist — MEMBER feeds a per-member file name; same rules as MISSION.
case "$MEMBER" in
  *[!a-zA-Z0-9._-]*) die "invalid member name \"$MEMBER\" (allowlist: [a-zA-Z0-9._-])" ;;
esac
if [[ "$MEMBER" =~ ^\.+$ ]]; then
  die "invalid member name \"$MEMBER\" (allowlist: [a-zA-Z0-9._-], not a dot-path)"
fi

# BRANCH_SLUG sanitized to [A-Za-z0-9._-] — it feeds the continue branch field;
# a newline/control char in BRANCH would corrupt the JSON (F5). Dropping illegal
# chars is safe: slugs are keys, not content. Dot-only slugs emptied
# (BSD/macOS-safe: no \+ BRE).
BRANCH_SLUG=$(echo "$BRANCH" | tr '/' '-' | tr -cd 'A-Za-z0-9._-' | sed 's/^\.\{1,\}$//' )

# state + continue live per (mission, member). Solo (member empty) → state.json.
STATE_DIR="$MUGIWARA_DIR/state/$MISSION"
CONTINUE_DIR="$MUGIWARA_DIR/continue/$MISSION"
if [ -n "$MEMBER" ]; then
  STATE_FILE="$STATE_DIR/$MEMBER.json"
  CONTINUE_FILE="$CONTINUE_DIR/$MEMBER.json"
else
  STATE_FILE="$STATE_DIR/state.json"
  CONTINUE_FILE="$CONTINUE_DIR/state.json"
fi

[ -z "$MISSION" ] && die "usage: savepoint.sh <mission> [member] [wave] [mode] [lane]"
[ -d .git ] || die "not a git repository"

# --- computed fields ---
BASE_SHA=$(git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null || git merge-base HEAD "$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||')" 2>/dev/null || git rev-parse HEAD~1 2>/dev/null || echo "unknown")
HEAD_SHA=$(git rev-parse HEAD 2>/dev/null || echo "unknown")

# union of committed + staged + unstaged + untracked (F) — see patterns.sh
CHANGED_FILES=$(changed_files "$BASE_SHA")
FILES_TOUCHED=$( [ -n "$CHANGED_FILES" ] && echo "$CHANGED_FILES" | wc -l | tr -d ' ' || echo 0 )

read -r LOC_INS LOC_DEL <<EOF
$(changed_loc "$BASE_SHA")
EOF
LOC_INS=$(( ${LOC_INS:-0} + 0 ))
LOC_DEL=$(( ${LOC_DEL:-0} + 0 ))
LOC_DELTA=$(( LOC_INS - LOC_DEL ))
# churn is insertion+deletion — refactors and deletions are work too (D4)
LOC_CHURN=$(( LOC_INS + LOC_DEL ))

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
  ADDED="$LOC_INS"
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

# explicit triage lane (M7) applied as a floor — the computed lane above may
# raise it, never lower it. Sensitive-path escalation still wins
# unconditionally: spike is a resize, not a rise, so it never displaces the
# full lane a sensitive path forced.
if [ -n "$LANE_EXPLICIT" ]; then
  if [ "$LANE_EXPLICIT" = "spike" ] && [ -n "$SENSITIVE_PATHS" ]; then
    LANE_REASON="$LANE_REASON (explicit spike ignored — sensitive paths)"
  elif [ "$(lane_rank "$LANE_EXPLICIT")" -gt "$(lane_rank "$LANE")" ]; then
    LANE_REASON="triage lane $LANE_EXPLICIT (floor; computed $LANE — $LANE_REASON)"
    LANE="$LANE_EXPLICIT"
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
# The crew writes the DATED name (`YYYY-MM-DD-<mission>-blockers.md`) — that is
# what 15 prose sites mandate and what lands on disk. Matching only the bare
# name made blockers_open structurally 0 forever, and that zero feeds the DoD
# ship-readiness axis. Accept both; newest wins.
BLOCKERS_FILE=$(ls -t "$MUGIWARA_DIR/issues/${MISSION}-blockers.md" "$MUGIWARA_DIR"/????-??-??-"${MISSION}"-blockers.md "$MUGIWARA_DIR/issues"/????-??-??-"${MISSION}"-blockers.md 2>/dev/null | head -1 || true)
BLOCKERS_OPEN=0
if [ -n "$BLOCKERS_FILE" ] && [ -f "$BLOCKERS_FILE" ]; then
  # data rows start with a wave number; header "| wave |" and separator
  # "|---|" are excluded by the ^\| ?[0-9]+ \| pattern
  BLOCKERS_OPEN=$(grep -cE '^\| ?[0-9]+ ?\|' "$BLOCKERS_FILE" 2>/dev/null || true)
fi

# heal cycle — count Wave-8 (healing) section headings in the DECISION LOG,
# which every mission writes (luffy-orchestrator rule 10). Not the word "heal"
# anywhere (heal workers/healing text would inflate the counter and cause a
# premature halt). Each heal cycle is logged as a "## Flow 8 — healing" section;
# the [^0-9a-z] guard keeps adjacent "## Wave 8b"-style sections from counting.
HEAL_CYCLE=1
LOG_FILE=$(ls -t "$MUGIWARA_DIR"/????-??-??-"${MISSION}".md "$MUGIWARA_DIR/logs"/????-??-??-"${MISSION}".md 2>/dev/null | head -1 || true)
if [ -n "$LOG_FILE" ] && [ -f "$LOG_FILE" ]; then
  HEAL_COUNT=$(grep -ciE '^## flow 8([^0-9a-z]|$)' "$LOG_FILE" 2>/dev/null || true)
  HEAL_CYCLE=$((HEAL_COUNT + 1))
fi

# evidence paths — per-mission results folder (quoted printf, no sed — mission
# name is allowlisted above, but avoid sed metacharacter semantics entirely)
EVIDENCE=""
for evf in "$MUGIWARA_DIR/results/${MISSION}/"*.md; do
  [ -f "$evf" ] || continue
  EVIDENCE="${EVIDENCE}${EVIDENCE:+,}.mugiwara/results/${MISSION}/$(basename "$evf")"
done

# skill version — MUGIWARA's own package.json, resolved from the script
# location (B3). The old "$MUGIWARA_DIR/../package.json" was the USER's
# project manifest: the version-mismatch resume prompt fired when a user
# shipped their own v2.0.0 and stayed silent across every real mugiwara
# release. Never fall back to the user's file — "unknown" is the honest
# answer. Full version, not the major: mugiwara's breaking changes land in
# 0.x minors, which a major-only string can never see.
SKILL_VERSION="unknown"
PKG_JSON="$(dirname "$0")/../package.json"
if [ -f "$PKG_JSON" ]; then
  SKILL_VERSION=$(node -e "try{const v=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).version;console.log(v||'unknown')}catch(e){console.log('unknown')}" "$PKG_JSON" 2>/dev/null || echo "unknown")
fi
[ -z "$SKILL_VERSION" ] && SKILL_VERSION="unknown"

# tokens proxy (F7): deterministic estimate when the harness does not report
# real usage. Monotonic beats precise — LANE_BASE stands in for the skills
# loaded this lane (measured from content, validated by scripts/lane-base.ts);
# loc_churn and written-artifact words scale with growth.
# MUGIWARA_TOKENS overrides as the reported value.
LANE_BASE=0
case "$LANE" in
  lean) LANE_BASE=$LANE_BASE_lean ;;
  standard) LANE_BASE=$LANE_BASE_standard ;;
  full) LANE_BASE=$LANE_BASE_full ;;
  spike) LANE_BASE=$LANE_BASE_spike ;;
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
  lean) BUDGET=$BUDGET_lean ;;
  standard) BUDGET=$BUDGET_standard ;;
  full) BUDGET=$BUDGET_full ;;
  spike) BUDGET=$BUDGET_spike ;;
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

mkdir -p "$MUGIWARA_DIR/state/$MISSION" "$MUGIWARA_DIR/continue/$MISSION"

node -e "
const data = {
  mission: process.argv[1],
  member: process.argv[31] || null,
  actor: process.argv[2],
  branch: process.argv[3],
  lane: process.argv[4],
  lane_reason: process.argv[5],
  lane_prev: process.argv[24] || null,
  lane_peak: process.argv[27] || null,
  lane_rose: process.argv[25] === 'true',
  wave: parseInt(process.argv[6], 10),
  mode: process.argv[7],
  verbosity: process.argv[32] || 'normal',
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
  "$WAVE_INT" "$MODE" "$BASE_SHA" "$HEAD_SHA" "$FILES_TOUCHED" \
  "$LOC_DELTA" "$SENSITIVE_PATHS" "$TASKS_DONE" "$TASKS_TOTAL" \
  "$BLOCKERS_OPEN" "$HEAL_CYCLE" "$TOKENS_EST" "$BUDGET" \
  "$STATUS" "$SKILL_VERSION" "$EVIDENCE" \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  "$STATE_FILE" "$LANE_PREV" "$LANE_ROSE" "$TOKENS_SOURCE" "$LANE_PEAK" \
  "$LOC_INS" "$LOC_DEL" "$LOC_CHURN" "$MEMBER" "$VERBOSITY"

if [ "$LANE_ROSE" = true ]; then
  echo "⚠ LANE ROSE: $LANE_PREV → $LANE ($LANE_REASON) — escalate per check-in protocol"
fi

# --- continue/<mission>/<member>.json (D10): machine-written resume point ---
# Written alongside state.json so an interrupted session (step-limit truncation,
# crash, new session) can resume without human recall. Same trust as state.json:
# computed fields, never model judgement. The resume skill treats it as data to
# verify against the plan/todos, never verbatim instructions.
# Scoped by (mission, member) like state.json — solo writes state.json, team
# writes <member>.json, so parallel members never clobber each other. The
# crew-written next_session_prompt line is preserved across savepoints.
if [ -n "$MISSION" ]; then
  NEXT_SESSION_PROMPT=""
  if [ -f "$CONTINUE_FILE" ]; then
    NEXT_SESSION_PROMPT=$(node -e "try{const s=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));process.stdout.write(s.next_session_prompt||'')}catch(e){process.stdout.write('')}" "$CONTINUE_FILE" 2>/dev/null || true)
  fi
  # N2: every field echoed into continue is validated first. MISSION + MEMBER
  # are allowlisted upstream; WAVE numeric, MODE enum, BRANCH slug-sanitized.
  CONT_WAVE="$WAVE_INT"
  case "$MODE" in
    guided|semi|auto) CONT_MODE="$MODE" ;;
    *) CONT_MODE="guided" ;;
  esac
  CONT_BRANCH="${BRANCH_SLUG:-unknown}"
  node -e "
  const fs = require('fs');
  const data = {
    mission: process.argv[1],
    member: process.argv[2] || null,
    actor: process.argv[13] || '',
    branch: process.argv[3],
    wave: parseInt(process.argv[4], 10) || 0,
    mode: process.argv[5],
    tasks_done: parseInt(process.argv[6], 10) || 0,
    tasks_total: parseInt(process.argv[7], 10) || 0,
    lane: process.argv[8],
    lane_prev: process.argv[9] || null,
    updated_at: process.argv[10],
    next_action: 'verify this wave against the plan, then continue per plan (next wave or closure)'
  };
  try { data.next_session_prompt = JSON.parse(fs.readFileSync(process.argv[12],'utf8')).next_session_prompt || ''; } catch (e) { data.next_session_prompt = ''; }
  fs.writeFileSync(process.argv[11], JSON.stringify(data, null, 2) + '\n');
  " \
    "$MISSION" "$MEMBER" "$CONT_BRANCH" "$CONT_WAVE" "$CONT_MODE" \
    "$TASKS_DONE" "$TASKS_TOTAL" "$LANE" "$LANE_PREV" \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    "$CONTINUE_FILE" "$CONTINUE_FILE" "$ACTOR"
fi

echo "✓ savepoint written: $STATE_FILE (lane=$LANE, wave=$WAVE, files=$FILES_TOUCHED)"
