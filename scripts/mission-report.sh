#!/usr/bin/env bash
# scripts/mission-report.sh — generate aggregate mission report from state.json
# + per-mission wave artifacts. Usage: mission-report.sh <mission>
# Output: .mugiwara/reports/YYYY-MM-DD-<mission>.md — one-file summary of all waves.
set -u

MISSION="${1:-}"
[ -z "$MISSION" ] && { echo "usage: mission-report.sh <mission>" >&2; exit 1; }
case "$MISSION" in
  *[!a-zA-Z0-9._-]*) echo "mission-report: invalid mission name \"$MISSION\" (allowlist: [a-zA-Z0-9._-])" >&2; exit 1 ;;
esac

MUGIWARA_DIR="${MUGIWARA_DIR:-.mugiwara}"
STATE_FILE="$MUGIWARA_DIR/state.json"
REPORT_DIR="$MUGIWARA_DIR/reports"
RESULTS_DIR="$MUGIWARA_DIR/results/$MISSION"
REVIEW_DIR="$MUGIWARA_DIR/review"
ISSUES_DIR="$MUGIWARA_DIR/issues"

[ -f "$STATE_FILE" ] || { echo "mission-report: $STATE_FILE not found" >&2; exit 1; }

export STATE_FILE REPORT_DIR RESULTS_DIR REVIEW_DIR ISSUES_DIR MISSION
node << 'NODE'
const fs = require('fs');
const path = require('path');

const stateFile = process.env.STATE_FILE || ".mugiwara/state.json";
const reportDir = process.env.REPORT_DIR || ".mugiwara/reports";
const resultsDir = process.env.RESULTS_DIR || ".mugiwara/results/unknown";
const reviewDir = process.env.REVIEW_DIR || ".mugiwara/review";
const issuesDir = process.env.ISSUES_DIR || ".mugiwara/issues";
const mission = process.env.MISSION || "unknown";

if (!fs.existsSync(stateFile)) {
  console.error("mission-report: " + stateFile + " not found");
  process.exit(1);
}

fs.mkdirSync(reportDir, { recursive: true });
const s = JSON.parse(fs.readFileSync(stateFile, 'utf8'));

const now = new Date().toISOString().slice(0, 10);
const reportFile = path.join(reportDir, now + "-" + mission + ".md");
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

// --- wave artifact scan: results/<mission>/NN-*.md with verdict sniffing ---
const WAVE_LABEL = {
  "01-execution": "Execute (Wave 3)",
  "02-audit": "Checkpoint (Wave 4)",
  "03-quality": "Quality (Wave 5)",
  "04-gates": "Gates (Wave 6)",
  "05-healing": "Healing (Wave 8)",
  "06-closure": "Closure (Wave 9)",
  "07-pr-verdict": "PR material",
};

const WAVE_FILES = new Set(Object.keys(WAVE_LABEL));

function sniffVerdict(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/).filter(l => /pass|fail|✅|❌|verdict|go|no-go/i.test(l));
  for (const l of lines) {
    const m = l.match(/(NO-GO|GO|PASS|FAIL|✅|❌)/i);
    if (m) return m[1].toUpperCase();
  }
  return "?";
}

const waveRows = [];
if (fs.existsSync(resultsDir)) {
  const files = fs.readdirSync(resultsDir).filter(f => f.endsWith('.md')).sort();
  for (const f of files) {
    const base = f.replace(/\.md$/, '');
    if (!WAVE_FILES.has(base)) continue; // support files (todos.md, resume.md, eval.md, evidence logs) not in waves table
    const label = WAVE_LABEL[base];
    const verdict = sniffVerdict(path.join(resultsDir, f));
    waveRows.push({ label, file: f, verdict });
  }
}

// --- review + issues scan: aggregate findings count + open blockers ---
let reviewFiles = [];
let reviewFindings = 0;
if (fs.existsSync(reviewDir)) {
  reviewFiles = fs.readdirSync(reviewDir).filter(f => (f.startsWith(mission + "-") || f.startsWith(mission + "/")) && f.endsWith('.md'));
  for (const f of reviewFiles) {
    const text = fs.readFileSync(path.join(reviewDir, f), 'utf8');
    reviewFindings += (text.match(/^\s*(?:#+\s*)?(?:🔴|🟠|🟡|⚪)(?:\s*\/\s*(?:🔴|🟠|🟡|⚪))?\s+.*/gm) || []).length;
  }
}

let issueRows = [];
if (fs.existsSync(issuesDir)) {
  const issueFiles = fs.readdirSync(issuesDir).filter(f => (f.startsWith(mission + "-") || f.startsWith(mission + "/")) && f.endsWith('.md'));
  for (const f of issueFiles) {
    const text = fs.readFileSync(path.join(issuesDir, f), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      if (line.trim().startsWith('|') && line.includes('|') && !line.includes('---')) {
        const cells = line.split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length >= 5 && !/^wave$/i.test(cells[0])) issueRows.push(cells.join(" | "));
      }
    }
  }
}

let report = "# Mission: " + mission + " . " + now + "\n\n";
report += "**Lane** " + lane + " . **Mode** " + mode + " . **Actor** " + actor + " . **Branch** " + branch + "\n\n";

report += "## What changed\n\n";
report += filesTouched + " files, +" + locDelta + " LOC";
if (sensitive.length) report += "\nSensitive paths: " + sensitive.join(", ");

report += "\n\n## Waves\n\n| Wave | Artifact | Verdict |\n|------|----------|---------|";
if (waveRows.length) {
  for (const r of waveRows) report += "\n| " + r.label + " | `" + r.file + "` | " + r.verdict + " |";
} else {
  report += "\n| (no wave artifacts found in `" + resultsDir + "`) | | |";
}

report += "\n\n## Review & blockers\n\n";
report += "Review + security files: " + (reviewFiles.length ? reviewFiles.join(", ") : "none") + "\n";
report += "Findings: " + reviewFindings + "\n";
report += "Blocker ledger rows: " + issueRows.length + (issueRows.length ? "\n" + issueRows.map(r => "- " + r).join("\n") : "");

report += "\n\n## State\n\n| Field | Value |\n|-------|-------|\n";
report += "| Wave | " + wave + " |\n";
report += "| Tasks | " + (tasks.done || 0) + "/" + (tasks.total || 0) + " done |\n";
report += "| Blockers open | " + blockers + " |\n";
report += "| Heal cycles | " + healCycle + " |\n";
report += "| Tokens used | " + tokens.toLocaleString() + " / " + budget.toLocaleString() + " |\n\n";

report += "## Evidence\n\n";
for (const e of evidence) report += "- " + e + "\n";

report += "\n## Updated\n\n" + updated + "\n";

fs.writeFileSync(reportFile, report);
console.log("\u2713 mission report: " + reportFile);
NODE
