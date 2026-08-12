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

export STATE_FILE REPORT_DIR MISSION
node << 'NODE'
const fs = require('fs');
const path = require('path');

const stateFile = process.env.STATE_FILE || ".mugiwara/state.json";
const reportDir = process.env.REPORT_DIR || ".mugiwara/reports";
const mission = process.env.MISSION || "unknown";

if (!fs.existsSync(stateFile)) {
  console.error("mission-report: " + stateFile + " not found");
  process.exit(1);
}

fs.mkdirSync(reportDir, { recursive: true });
const s = JSON.parse(fs.readFileSync(stateFile, 'utf8'));

const reportFile = path.join(reportDir, mission + ".md");
const now = new Date().toISOString().slice(0, 10);
const lane = s.lane || "unknown";
const mode = s.mode || "guided";
const actor = s.actor || "unknown";
const branch = s.branch || "unknown";
const wave = s.wave || 0;
const filesTouched = s.files_touched || 0;
const locDelta = s.loc_delta || 0;
const sensitive = s.sensitive_paths || [];
const tasks = s.tasks || {};
const blockers = s.blockers_open || 0;
const healCycle = s.heal_cycle || 1;
const tokens = s.tokens_est || 0;
const budget = s.budget || 0;
const evidence = s.evidence || [];
const updated = s.updated_at || new Date().toISOString();

let report = "# Mission: " + mission + " . " + now + "\n\n";
report += "**Lane** " + lane + " . **Mode** " + mode + " . **Actor** " + actor + " . **Branch** " + branch + "\n\n";
report += "## What changed\n\n";
report += filesTouched + " files, +" + locDelta + " LOC";

if (sensitive.length) {
  report += "\nSensitive paths: " + sensitive.join(", ");
}

report += "\n\n## Gates\n\n| Gate | Verdict | Evidence |\n|------|---------|----------|";
for (const e of evidence) {
  report += "\n| \u2014 | PASS | " + e + " |";
}

report += "\n\n## State\n\n| Field | Value |\n|-------|-------|\n";
report += "| Wave | " + wave + " |\n";
report += "| Tasks | " + (tasks.done || 0) + "/" + (tasks.total || 0) + " done |\n";
report += "| Blockers open | " + blockers + " |\n";
report += "| Heal cycles | " + healCycle + " |\n";
report += "| Tokens used | " + tokens.toLocaleString() + " / " + budget.toLocaleString() + " |\n\n";
report += "## Updated\n\n" + updated + "\n";

fs.writeFileSync(reportFile, report);
console.log("\u2713 mission report: " + reportFile);
NODE
