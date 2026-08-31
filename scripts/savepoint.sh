#!/usr/bin/env bash
# scripts/savepoint.sh — write .mugiwara/missions/<mission>/<member>.json at every
# flow-stage boundary. Computed from git + file counts; zero model judgement.
# Identity is (mission, member), never branch. Solo = member empty → the file
# is named state.json. Usage:
#   savepoint.sh <mission> [member] [flow] [mode] [lane]
set -u

die() { echo "savepoint: $*" >&2; exit 1; }

MUGIWARA_DIR="${MUGIWARA_DIR:-.mugiwara}"

# optional provider-reported tokens file (T4): --tokens-file <path> JSON {input_tokens, output_tokens}
TOKENS_FILE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --tokens-file) TOKENS_FILE="${2:-}"; [ -n "$TOKENS_FILE" ] || die "--tokens-file requires a path"; shift 2 ;;
    --tokens-file=*) TOKENS_FILE="${1#*=}"; shift ;;
    --) shift; break ;;
    -*) die "unknown flag \"$1\"" ;;
    *) break ;;
  esac
done

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

# heal_max_cycles from config (project .mugiwara/config), default 3; env override
HEAL_MAX_CYCLES="${STATE_HEAL_MAX_CYCLES:-3}"
if [ -f "$MUGIWARA_DIR/config" ]; then
  CFG_HEAL_MAX=$(grep -E '^heal_max_cycles=' "$MUGIWARA_DIR/config" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '[:space:]')
  [ -n "$CFG_HEAL_MAX" ] && HEAL_MAX_CYCLES="$CFG_HEAL_MAX"
fi
case "$HEAL_MAX_CYCLES" in
  ''|*[!0-9]*) HEAL_MAX_CYCLES=3 ;;
esac
[ "$HEAL_MAX_CYCLES" -lt 1 ] 2>/dev/null && HEAL_MAX_CYCLES=3

# delegate_threshold from config (project .mugiwara/config), default 60; env override
DELEGATE_THRESHOLD="${STATE_DELEGATE_THRESHOLD:-60}"
if [ -f "$MUGIWARA_DIR/config" ]; then
  CFG_DELEGATE=$(grep -E '^delegate_threshold=' "$MUGIWARA_DIR/config" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '[:space:]')
  [ -n "$CFG_DELEGATE" ] && DELEGATE_THRESHOLD="$CFG_DELEGATE"
fi
case "$DELEGATE_THRESHOLD" in
  ''|*[!0-9]*) DELEGATE_THRESHOLD=60 ;;
esac
[ "$DELEGATE_THRESHOLD" -lt 1 ] 2>/dev/null && DELEGATE_THRESHOLD=1
[ "$DELEGATE_THRESHOLD" -gt 100 ] 2>/dev/null && DELEGATE_THRESHOLD=100
ACTOR="${STATE_ACTOR:-${GIT_AUTHOR_NAME:-${GIT_ID:-${USER:-${USERNAME:-}}}}}"
BRANCH="$(git branch --show-current 2>/dev/null || echo 'unknown')"
# Per-stage model attribution (A4): record which model produced THIS stage.
# MUGIWARA_MODEL wins over ANTHROPIC_MODEL; 'unknown' beats a lie. Closure
# renders the unique set across stage files so mid-mission switches stay
# visible in provenance instead of every line attributing to the last value.
MODEL="${MUGIWARA_MODEL:-${ANTHROPIC_MODEL:-}}"
[ -n "$MODEL" ] || MODEL="unknown"

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
# reserved stems — <member>.json and continue-<member>.json share the mission
# dir with state.json / continue.json; member "state" or "continue" would
# overwrite the solo files (state pointer or resume pointer).
case "$MEMBER" in
  state|continue) die "reserved member name \"$MEMBER\" (state, continue)" ;;
esac

# BRANCH_SLUG sanitized to [A-Za-z0-9._-] — it feeds the continue branch field;
# a newline/control char in BRANCH would corrupt the JSON (F5). Dropping illegal
# chars is safe: slugs are keys, not content. Dot-only slugs emptied
# (BSD/macOS-safe: no \+ BRE).
BRANCH_SLUG=$(echo "$BRANCH" | tr '/' '-' | tr -cd 'A-Za-z0-9._-' | sed 's/^\.\{1,\}$//' )

# state + continue live in the mission dir. Solo (member empty) → state.json
# + continue.json; team writes <member>.json + continue-<member>.json so
# parallel members never clobber each other.
MISSION_DIR="$MUGIWARA_DIR/missions/$MISSION"
if [ -n "$MEMBER" ]; then
  STATE_FILE="$MISSION_DIR/$MEMBER.json"
  CONTINUE_FILE="$MISSION_DIR/continue-$MEMBER.json"
else
  STATE_FILE="$MISSION_DIR/state.json"
  CONTINUE_FILE="$MISSION_DIR/continue.json"
fi

[ -z "$MISSION" ] && die "usage: savepoint.sh <mission> [member] [wave] [mode] [lane]"
[ -d .git ] || die "not a git repository"

# --- computed fields ---
BASE_SHA=$(git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null || git merge-base HEAD "$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||')" 2>/dev/null || git rev-parse HEAD~1 2>/dev/null || echo "unknown")
HEAD_SHA=$(git rev-parse HEAD 2>/dev/null || echo "unknown")

# lane_scope_glob (T5): monorepo scoping — count only files matching the glob
LANE_SCOPE_GLOB=""
if [ -f "$MUGIWARA_DIR/config" ]; then
  _cfg_scope=$(grep -E '^lane_scope_glob=' "$MUGIWARA_DIR/config" 2>/dev/null | head -1 | cut -d= -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | tr -d '"' | tr -d "'")
  [ -n "$_cfg_scope" ] && LANE_SCOPE_GLOB="$_cfg_scope"
fi
# union of committed + staged + unstaged + untracked (F) — see patterns.sh
CHANGED_FILES=$(changed_files "$BASE_SHA")
# sensitive-path escalation always uses unfiltered set (safety never shrinks, T5)
SENSITIVE_PATHS=$(echo "$CHANGED_FILES" | grep -E "$SENSITIVE_PATS" 2>/dev/null | tr '\n' ',' | sed 's/,$//' || true)
# scoped counting (T5)
SCOPED_FILES="$CHANGED_FILES"
if [ -n "$LANE_SCOPE_GLOB" ] && [ -n "$CHANGED_FILES" ]; then
  shopt -s extglob globstar 2>/dev/null || true
  SCOPED_FILES=""
  while IFS= read -r _sf; do
    [ -z "$_sf" ] && continue
    # shellcheck disable=SC2053
    if [[ "$_sf" == $LANE_SCOPE_GLOB ]]; then
      SCOPED_FILES="${SCOPED_FILES}${SCOPED_FILES:+
}$_sf"
    fi
  done <<< "$CHANGED_FILES"
fi
FILES_TOUCHED=$( [ -n "$SCOPED_FILES" ] && echo "$SCOPED_FILES" | wc -l | tr -d ' ' || echo 0 )
if [ -n "$LANE_SCOPE_GLOB" ]; then
  read -r LOC_INS LOC_DEL <<EOF
$( { echo "$SCOPED_FILES" | while IFS= read -r _lf; do [ -n "$_lf" ] && git diff --numstat "$BASE_SHA"..HEAD -- "$_lf" 2>/dev/null; git diff --numstat HEAD -- "$_lf" 2>/dev/null; done; echo "$SCOPED_FILES" | while IFS= read -r _uf; do [ -z "$_uf" ] && continue; if git ls-files --others --exclude-standard -- "$_uf" 2>/dev/null | grep -qx "$_uf"; then printf '%s\t0\t%s\n' "$(wc -l < "$_uf" 2>/dev/null | tr -d ' ' || echo 0)" "$_uf"; fi; done; } | awk '{ if ($1 ~ /^[0-9]+$/) i+=$1; if ($2 ~ /^[0-9]+$/) d+=$2 } END { print (i+0)" "(d+0) }')
EOF
else
  read -r LOC_INS LOC_DEL <<EOF
$(changed_loc "$BASE_SHA")
EOF
fi
LOC_INS=$(( ${LOC_INS:-0} + 0 ))
LOC_DEL=$(( ${LOC_DEL:-0} + 0 ))
LOC_DELTA=$(( LOC_INS - LOC_DEL ))
# churn is insertion+deletion — refactors and deletions are work too (D4)
LOC_CHURN=$(( LOC_INS + LOC_DEL ))

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
# escalation above still wins. With lane_scope_glob the check applies to the
# scoped set — but sensitive wins unfiltered above, so safety never shrinks.
if [ "$LANE" = "full" ] && [ -z "$SENSITIVE_PATHS" ] && [ -n "$SCOPED_FILES" ]; then
  CODE_COUNT=$(echo "$SCOPED_FILES" | grep -E "$PRODUCT_PAT" 2>/dev/null | grep -c . || true)
  if [ -z "$CODE_COUNT" ] || [ "$CODE_COUNT" -eq 0 ] 2>/dev/null; then
    PREV="$LANE"
    LANE="standard"
    LANE_REASON="$FILES_TOUCHED files, docs-only — path-weighted down from $PREV"
  fi
fi

# policy as code: mugiwara.policy.yml lanes.force_full raises the
# lane to full — upward only. Optional: no file or no bun = no-op.
if command -v bun >/dev/null 2>&1 && { [ -f mugiwara.policy.yml ] || [ -f mugiwara.policy.yaml ]; }; then
  POLICY_HITS=$(printf '%s\n' "$CHANGED_FILES" | bun "$(dirname "$0")/policy-force.ts")
  RC=$?
  if [ "$RC" -ne 0 ]; then
    die "mugiwara.policy.yml is invalid — fix or remove it (fail-closed)"
  fi
  if [ -n "$POLICY_HITS" ]; then
    LANE="full"
    LANE_REASON="policy force_full ($POLICY_HITS)"
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

# task counts from plan doc — bare name, one file per mission.
PLAN_FILE="$MISSION_DIR/plan.md"
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
BLOCKERS_FILE="$MISSION_DIR/blockers.md"
BLOCKERS_OPEN=0
if [ -n "$BLOCKERS_FILE" ] && [ -f "$BLOCKERS_FILE" ]; then
  # data rows start with a wave number; header "| wave |" and separator
  # "|---|" are excluded by the ^\| ?[0-9]+ \| pattern
  BLOCKERS_OPEN=$(grep -cE '^\| ?[0-9]+ ?\|' "$BLOCKERS_FILE" 2>/dev/null || true)
fi

# heal cycle — count Flow-8 (healing) section headings in the DECISION LOG
# (missions/<mission>/decisions.md), which every mission writes (luffy-
# orchestrator rule 10). Not the word "heal" anywhere (heal workers/healing
# text would inflate the counter and cause a premature halt). Each heal cycle
# is logged as a "## Flow 8 — healing" section; the [^0-9a-z] guard keeps
# adjacent "## Flow 8b"-style sections from counting.
HEAL_CYCLE=1
HEAL_COUNT=0
LOG_FILE="$MISSION_DIR/decisions.md"
if [ -f "$LOG_FILE" ]; then
  HEAL_COUNT=$(grep -ciE '^## flow 8([^0-9a-z]|$)' "$LOG_FILE" 2>/dev/null || true)
fi
if [ "$HEAL_COUNT" -gt 0 ]; then
  HEAL_CYCLE=$((HEAL_COUNT + 1))
fi

# heal halt — computed from the heal counter and the config cap (task 4f wires
# heal_max_cycles into the counter's home). heal_cycle starts at 1, so
# heal_cycle >= heal_max_cycles means the cap is reached: escalate, never re-run.
HEAL_HALT=false
if [ "$HEAL_CYCLE" -ge "$HEAL_MAX_CYCLES" ] 2>/dev/null; then
  HEAL_HALT=true
fi

# depth flags — advisory → measured (roadmap v0.8 item 4). Read from config
# like the other keys; computed into state.json so enforcement is a fact the
# gates flow stage can read, not prose.
DEPTH_REVIEW="full"; DEPTH_QUALITY="full"; DEPTH_VERIFY="off"
if [ -f "$MUGIWARA_DIR/config" ]; then
  _cfg_r=$(grep -E '^review_depth=' "$MUGIWARA_DIR/config" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '[:space:]')
  [ -n "$_cfg_r" ] && DEPTH_REVIEW="$_cfg_r"
  _cfg_q=$(grep -E '^quality_depth=' "$MUGIWARA_DIR/config" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '[:space:]')
  [ -n "$_cfg_q" ] && DEPTH_QUALITY="$_cfg_q"
  _cfg_v=$(grep -E '^verify_merged=' "$MUGIWARA_DIR/config" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '[:space:]')
  [ -n "$_cfg_v" ] && DEPTH_VERIFY="$_cfg_v"
fi
case "$DEPTH_REVIEW" in full|standard|lean) ;; *) DEPTH_REVIEW="full" ;; esac
case "$DEPTH_QUALITY" in full|standard|lean) ;; *) DEPTH_QUALITY="full" ;; esac
case "$DEPTH_VERIFY" in on|off) ;; *) DEPTH_VERIFY="off" ;; esac

# evidence paths — the mission's flow folder (quoted printf, no sed — mission
# name is allowlisted above, but avoid sed metacharacter semantics entirely).
# New missions use flows/; a legacy mission that already keeps waves/ stays on
# waves/ so an in-flight trail never splits across two directories.
FLOWDIR="flows"
if [ -d "$MISSION_DIR/waves" ] && [ ! -d "$MISSION_DIR/flows" ]; then
  FLOWDIR="waves"
fi
EVIDENCE=""
for evf in "$MISSION_DIR/$FLOWDIR/"*.md; do
  [ -f "$evf" ] || continue
  EVIDENCE="${EVIDENCE}${EVIDENCE:+,}.mugiwara/missions/${MISSION}/${FLOWDIR}/$(basename "$evf")"
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
# auto-detect harness for token reporting (Tier-1: Claude Code / opencode)
# If --tokens-file not given, try env/file fallbacks so estimator is last resort.
if [ -z "$TOKENS_FILE" ]; then
  for _cand in "${MUGIWARA_TOKENS_FILE:-}" "${CLAUDE_TOKENS_FILE:-}" "${OPENCODE_TOKENS_FILE:-}" "/tmp/mugiwara-tokens.json" "$HOME/.cache/mugiwara/tokens.json" ".mugiwara/tokens.json"; do
    [ -n "$_cand" ] && [ -f "$_cand" ] && TOKENS_FILE="$_cand" && break
  done
fi
# detect harness (for logging / future tier checks)
HARNESS="unknown"
if [ -n "${CLAUDECODE:-}" ] || [ -n "${CLAUDE_CODE_ENTRYPOINT:-}" ] || echo "${ANTHROPIC_MODEL:-}" | grep -qi claude 2>/dev/null; then HARNESS="claude";
elif [ -n "${OPENCODE:-}" ] || [ -f ".opencode/config.json" ] || [ -n "${OPENCODE_TOKENS_FILE:-}" ]; then HARNESS="opencode";
elif [ -n "${CURSOR:-}" ] || [ -n "${VSCODE_GIT_ASKPASS_NODE:-}" ]; then HARNESS="cursor/vscode"; fi

# MUGIWARA_TOKENS overrides as the reported value.
# --tokens-file (T4) is the first-class provider-reported path: JSON {input_tokens, output_tokens}
LANE_BASE=0
case "$LANE" in
  lean) LANE_BASE=$LANE_BASE_lean ;;
  standard) LANE_BASE=$LANE_BASE_standard ;;
  full) LANE_BASE=$LANE_BASE_full ;;
  spike) LANE_BASE=$LANE_BASE_spike ;;
esac
DOC_WORDS=$(cat "$MISSION_DIR"/"$FLOWDIR"/*.md "$MISSION_DIR"/plan.md "$MISSION_DIR"/spec.md "$MISSION_DIR"/decisions.md 2>/dev/null | wc -w | tr -d ' ')
LOC_TOKENS=$(( LOC_CHURN * 12 ))
TOKENS_SOURCE="estimator"
TOKENS_EST=$(( LANE_BASE + DOC_WORDS * 135 / 100 + LOC_TOKENS ))
if [ -n "${MUGIWARA_TOKENS:-}" ]; then
  TOKENS_EST="${MUGIWARA_TOKENS}"
  TOKENS_SOURCE="reported"
fi
if [ -n "$TOKENS_FILE" ]; then
  [ -f "$TOKENS_FILE" ] || die "tokens file not found: $TOKENS_FILE"
  TOKENS_EST=$(node -e "try{const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));const i=Number(j.input_tokens)||0;const o=Number(j.output_tokens)||0;console.log(i+o)}catch(e){console.log(0)}" "$TOKENS_FILE" 2>/dev/null || echo 0)
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

# delegate due — the execution skill's context-pressure trigger (task 4f wires
# delegate_threshold into a computed flag). tokens_est >= threshold% of budget
# → remaining sequential tasks dispatch to workers. Threshold stays relative:
# a bigger budget raises the bar, it does not remove it. Budget 0 (unknown
# lane) → never due.
DELEGATE_DUE=false
if [ "$BUDGET" -gt 0 ] 2>/dev/null; then
  DELEGATE_AT=$(( BUDGET * DELEGATE_THRESHOLD / 100 ))
  if [ "$TOKENS_EST" -ge "$DELEGATE_AT" ] 2>/dev/null; then
    DELEGATE_DUE=true
  fi
fi

mkdir -p "$MISSION_DIR"

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
  flow: parseInt(process.argv[6], 10),
  mode: process.argv[7],
  verbosity: process.argv[32] || 'normal',
  model: process.argv[37] || 'unknown',
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
  heal_max_cycles: parseInt(process.argv[33], 10) || 3,
  heal_halt: process.argv[34] === 'true',
  delegate_threshold: parseInt(process.argv[35], 10) || 60,
  delegate_due: process.argv[36] === 'true',
  review_depth: process.argv[38] || 'full',
  quality_depth: process.argv[39] || 'full',
  verify_merged: process.argv[40] || 'off',
  tokens_est: parseInt(process.argv[17], 10) || 0,
  tokens_source: process.argv[26] || 'computed',
  budget: parseInt(process.argv[18], 10) || 0,
  budget_status: process.argv[19],
  skill_version: process.argv[20],
  evidence: process.argv[21] ? process.argv[21].split(',').filter(Boolean) : [],
  updated_at: process.argv[22],
  schema_version: 2
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
  "$LOC_INS" "$LOC_DEL" "$LOC_CHURN" "$MEMBER" "$VERBOSITY" \
  "$HEAL_MAX_CYCLES" "$HEAL_HALT" "$DELEGATE_THRESHOLD" "$DELEGATE_DUE" \
  "$MODEL" "$DEPTH_REVIEW" "$DEPTH_QUALITY" "$DEPTH_VERIFY"

if [ "$LANE_ROSE" = true ]; then
  echo "⚠ LANE ROSE: $LANE_PREV → $LANE ($LANE_REASON) — escalate per check-in protocol"
fi

# --- continue.json (D10): machine-written resume point ---
# Written alongside state.json so an interrupted session (step-limit truncation,
# crash, new session) can resume without human recall. Same trust as state.json:
# computed fields, never model judgement. The resume skill treats it as data to
# verify against the plan/todos, never verbatim instructions.
# Scoped by (mission, member) like state.json — solo writes continue.json, team
# writes continue-<member>.json. The crew-written next_session_prompt line is
# preserved across savepoints.
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
    flow: parseInt(process.argv[4], 10) || 0,
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

echo "✓ savepoint written: $STATE_FILE (lane=$LANE, flow=$WAVE, files=$FILES_TOUCHED)"
