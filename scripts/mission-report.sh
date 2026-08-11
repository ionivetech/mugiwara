#!/usr/bin/env bash
# scripts/mission-report.sh — generate human-readable mission report from state.json
# Usage: mission-report.sh <mission>
set -u

MISSION="${1:-}"
[ -z "$MISSION" ] && { echo "usage: mission-report.sh <mission>" >&2; exit 1; }

MUGIWARA_DIR="${MUGIWARA_DIR:-.mugiwara}"
STATE_FILE="$MUGIWARA_DIR/state.json"
REPORT_DIR="$MUGIWARA_DIR/reports"
REPORT_FILE="$REPORT_DIR/${MISSION}.md"

[ -f "$STATE_FILE" ] || { echo "mission-report: $STATE_FILE not found" >&2; exit 1; }

python3 <<PY
import json, os, sys
from datetime import datetime

state_file = "$STATE_FILE"
report_file = "$REPORT_FILE"
os.makedirs(os.path.dirname(report_file), exist_ok=True)

with open(state_file) as f:
    s = json.load(f)

mission = s.get("mission", "$MISSION")
actor = s.get("actor", "unknown")
branch = s.get("branch", "unknown")
lane = s.get("lane", "unknown")
lane_reason = s.get("lane_reason", "")
mode = s.get("mode", "guided")
wave = s.get("wave", 0)
files_touched = s.get("files_touched", 0)
loc_delta = s.get("loc_delta", 0)
sensitive = s.get("sensitive_paths", [])
tasks = s.get("tasks", {})
blockers = s.get("blockers_open", 0)
heal_cycle = s.get("heal_cycle", 1)
tokens = s.get("tokens_est", 0)
budget = s.get("budget", 0)
evidence = s.get("evidence", [])
updated = s.get("updated_at", datetime.utcnow().isoformat() + "Z")

now = datetime.utcnow().strftime("%Y-%m-%d")
report = f"""# Mission: {mission} · {now}

**Lane** {lane} · **Mode** {mode} · **Actor** {actor} · **Branch** {branch}

## What changed

{files_touched} files, +{loc_delta if loc_delta >= 0 else loc_delta} LOC"""

if sensitive:
    report += "\nSensitive paths: " + ", ".join(sensitive)

report += f"""

## Gates

| Gate | Verdict | Evidence |
|------|---------|----------|"""

for e in evidence:
    report += f"\n| — | PASS | {e} |"

report += f"""

## State

| Field | Value |
|-------|-------|
| Wave | {wave} |
| Tasks | {tasks.get('done', 0)}/{tasks.get('total', 0)} done |
| Blockers open | {blockers} |
| Heal cycles | {heal_cycle} |
| Tokens used | {tokens:,} / {budget:,} |

## Updated

{updated}
"""

with open(report_file, 'w') as f:
    f.write(report)

print(f"✓ mission report: {report_file}")
PY
