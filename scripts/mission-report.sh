#!/usr/bin/env bash
# scripts/mission-report.sh — generate aggregate mission report from state.json
# + per-mission wave artifacts. Usage: mission-report.sh <mission>
# Output: .mugiwara/reports/YYYY-MM-DD-<mission>.md — one-file summary of all waves.
# Enriched: mission header, token budget (WARN/STOP flag), tasks (state or plan
# doc fallback), gate/quality excerpt from 06-closure.md, evidence file list.
# Every section degrades to n/a when state.json or results/ artifacts are absent.
set -u

MISSION="${1:-}"
[ -z "$MISSION" ] && { echo "usage: mission-report.sh <mission>" >&2; exit 1; }
case "$MISSION" in
  *[!a-zA-Z0-9._-]*) echo "mission-report: invalid mission name \"$MISSION\" (allowlist: [a-zA-Z0-9._-])" >&2; exit 1 ;;
esac
if [[ "$MISSION" =~ ^\.+$ ]]; then
  echo "mission-report: invalid mission name \"$MISSION\" (allowlist: [a-zA-Z0-9._-], not a dot-path)" >&2; exit 1
fi

MUGIWARA_DIR="${MUGIWARA_DIR:-.mugiwara}"
# state lives per (mission, member): solo = state/<mission>/state.json;
# MEMBER env selects a team member's state, else the solo state.
MEMBER="${MEMBER:-}"
case "$MEMBER" in
  *[!a-zA-Z0-9._-]*) echo "mission-report: invalid member \"$MEMBER\" (allowlist: [a-zA-Z0-9._-])" >&2; exit 1 ;;
esac
if [ -n "$MEMBER" ]; then
  STATE_FILE="$MUGIWARA_DIR/state/$MISSION/$MEMBER.json"
else
  STATE_FILE="$MUGIWARA_DIR/state/$MISSION/state.json"
fi
REPORT_DIR="$MUGIWARA_DIR/reports"
RESULTS_DIR="$MUGIWARA_DIR/results/$MISSION"
REVIEW_DIR="$MUGIWARA_DIR/review"
ISSUES_DIR="$MUGIWARA_DIR/issues"

export STATE_FILE REPORT_DIR RESULTS_DIR REVIEW_DIR ISSUES_DIR MISSION MUGIWARA_DIR
node << 'NODE'
const fs = require('fs');
const path = require('path');

const stateFile = process.env.STATE_FILE || ".mugiwara/state/unknown/state.json";
const reportDir = process.env.REPORT_DIR || ".mugiwara/reports";
const resultsDir = process.env.RESULTS_DIR || ".mugiwara/results/unknown";
const reviewDir = process.env.REVIEW_DIR || ".mugiwara/review";
const issuesDir = process.env.ISSUES_DIR || ".mugiwara/issues";
const mugiDir = process.env.MUGIWARA_DIR || ".mugiwara";
const mission = process.env.MISSION || "unknown";

fs.mkdirSync(reportDir, { recursive: true });

// state.json is optional — degrade gracefully, never hard-exit
let s = null;
if (fs.existsSync(stateFile)) {
  try {
    s = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch (e) {
    console.error("mission-report: warning: " + stateFile + " unreadable — degraded report");
  }
} else {
  console.error("mission-report: warning: " + stateFile + " not found — degraded report");
}

const val = (obj, key, dflt) => {
  if (!s || !obj) return dflt;
  const v = obj[key];
  return (v === undefined || v === null || v === "") ? dflt : v;
};

const now = new Date().toISOString().slice(0, 10);
const reportFile = path.join(reportDir, now + "-" + mission + ".md");
const lane = val(s, 'lane', 'n/a');
const lanePeak = val(s, 'lane_peak', 'n/a');
const laneRose = val(s, 'lane_rose', false);
const laneReason = val(s, 'lane_reason', 'n/a');
const mode = val(s, 'mode', 'n/a');
const actor = val(s, 'actor', 'n/a');
const branch = val(s, 'branch', 'n/a');
const wave = val(s, 'wave', 'n/a');
const filesTouched = val(s, 'files_touched', 0);
const locDelta = val(s, 'loc_delta', 0);
const locChurn = val(s, 'loc_churn', 0);
const sensitive = s ? (s.sensitive_paths || []) : [];
const tasks = s ? (s.tasks || {}) : {};
const blockers = val(s, 'blockers_open', 0);
const healCycle = val(s, 'heal_cycle', 1);
const tokens = Number(val(s, 'tokens_est', 0)) || 0;
const tokensSource = val(s, 'tokens_source', 'n/a');
const budget = Number(val(s, 'budget', 0)) || 0;
const budgetStatus = val(s, 'budget_status', 'n/a');
const evidence = s ? (s.evidence || []) : [];
const updated = val(s, 'updated_at', now);

// --- wave artifact scan: results/<mission>/NN-*.md with verdict sniffing ---
const WAVE_LABEL = {
  "01-execution": "Execute (Flow 3)",
  "02-audit": "Checkpoint (Flow 4)",
  "03-quality": "Quality (Flow 5)",
  "04-gates": "Gates (Flow 6)",
  "05-healing": "Healing (Flow 8)",
  "06-closure": "Closure (Flow 9)",
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

// --- tasks: state.json counts, plan-doc fallback (savepoint-style counting) ---
function findPlan(mDir, m) {
  const plansDir = path.join(mDir, 'plans');
  if (!fs.existsSync(plansDir)) return null;
  const direct = path.join(plansDir, m + '.md');
  if (fs.existsSync(direct)) return direct;
  const matches = fs.readdirSync(plansDir).filter(f => f.endsWith('-' + m + '.md'));
  return matches.length ? path.join(plansDir, matches.sort()[0]) : null;
}

let tasksDone = tasks.done || 0;
let tasksTotal = tasks.total || 0;
let tasksSource = "state.json";
if (tasksTotal === 0) {
  const plan = findPlan(mugiDir, mission);
  if (plan) {
    const lines = fs.readFileSync(plan, 'utf8').split(/\r?\n/);
    const done = lines.filter(l => l.includes('[x]')).length;
    const total = done + lines.filter(l => l.includes('[ ]')).length;
    if (total > 0) {
      tasksDone = done;
      tasksTotal = total;
      tasksSource = "plan doc";
    }
  }
}
if (tasksDone === 0 && tasksTotal === 0) { tasksDone = 'n/a'; tasksTotal = 'n/a'; }

// --- token budget flag: WARN/STOP line when status is not ok ---
let budgetFlag = "";
if (budgetStatus === "warn" || budgetStatus === "stop") {
  const warnAt = Math.floor(budget * 3 / 2);
  const stopAt = budget * 3;
  if (budgetStatus === "stop") {
    budgetFlag = "🛑 STOP: tokens " + tokens.toLocaleString() + " ≥ 3× budget " + budget.toLocaleString() + " (stop at " + stopAt.toLocaleString() + ") — halt; escalate to Luffy";
  } else {
    budgetFlag = "⚠ WARN: tokens " + tokens.toLocaleString() + " ≥ 1.5× budget " + budget.toLocaleString() + " (warn at " + warnAt.toLocaleString() + ") — checkpoint before continuing";
  }
}

// --- gate/quality excerpt: headings + body from 06-closure.md, as-is ---
function sectionExcerpt(file, heading) {
  if (!fs.existsSync(file)) return null;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  let collecting = false;
  let content = 0;
  const out = [];
  for (const l of lines) {
    if (/^##\s/.test(l)) {
      if (collecting) break;
      if (l.trim() === heading) { collecting = true; out.push(l); continue; }
    } else if (collecting) {
      if (l.trim()) {
        out.push(l);
        content++;
        if (content >= 20) break; // cap excerpt
      }
    }
  }
  return collecting ? out : null;
}

const closureFile = path.join(resultsDir, "06-closure.md");
const gateSec = sectionExcerpt(closureFile, "## Gate verdicts");
const testsSec = sectionExcerpt(closureFile, "## Tests");

// --- evidence file list: all .md artifacts in results/<mission>/ ---
let evidenceFiles = [];
if (fs.existsSync(resultsDir)) {
  evidenceFiles = fs.readdirSync(resultsDir).filter(f => f.endsWith('.md')).sort();
}

// --- assemble report ---
let report = "# Mission: " + mission + " . " + now + "\n\n";

report += "## Mission header\n\n| Field | Value |\n|-------|-------|\n";
report += "| Mission | " + mission + " |\n";
report += "| Branch | " + branch + " |\n";
report += "| Lane | " + lane + (laneRose ? " ⬆ ROSE" : "") + " |\n";
report += "| Lane peak | " + lanePeak + " |\n";
report += "| Lane reason | " + laneReason + " |\n";
report += "| Mode | " + mode + " |\n";
report += "| Wave | " + wave + " |\n";
report += "| Actor | " + actor + " |\n\n";

report += "## Token budget\n\n| Field | Value |\n|-------|-------|\n";
report += "| Tokens (est) | " + tokens.toLocaleString() + " |\n";
report += "| Tokens source | " + tokensSource + " |\n";
report += "| Budget | " + budget.toLocaleString() + " |\n";
report += "| Budget status | " + budgetStatus + " |\n";
if (budgetFlag) report += "\n" + budgetFlag;
report += "\n\n";

report += "## Tasks\n\n| Field | Value |\n|-------|-------|\n";
report += "| Done | " + tasksDone + " |\n";
report += "| Total | " + tasksTotal + " |\n";
report += "| Source | " + tasksSource + " |\n\n";

report += "## What changed\n\n";
report += filesTouched + " files, +" + locDelta + " LOC (" + locChurn + " churn)";
if (sensitive.length) report += "\nSensitive paths: " + sensitive.join(", ");
report += "\n\n";

report += "## Waves\n\n| Wave | Artifact | Verdict |\n|------|----------|---------|";
if (waveRows.length) {
  for (const r of waveRows) report += "\n| " + r.label + " | `" + r.file + "` | " + r.verdict + " |";
} else {
  report += "\n| (no wave artifacts found in `" + resultsDir + "`) | | |";
}
report += "\n\n";

report += "## Gate & quality\n\n";
if (gateSec) report += gateSec.join("\n") + "\n";
if (testsSec) report += (gateSec ? "\n" : "") + testsSec.join("\n") + "\n";
if (!gateSec && !testsSec) report += "n/a\n";
report += "\n";

report += "## Evidence files\n\n";
report += evidenceFiles.length ? evidenceFiles.map(f => "- " + f).join("\n") : "n/a";
report += "\n\n";

report += "## Review & blockers\n\n";
report += "Review + security files: " + (reviewFiles.length ? reviewFiles.join(", ") : "none") + "\n";
report += "Findings: " + reviewFindings + "\n";
report += "Blocker ledger rows: " + issueRows.length + (issueRows.length ? "\n" + issueRows.map(r => "- " + r).join("\n") : "");
report += "\n\n";

report += "## State\n\n| Field | Value |\n|-------|-------|\n";
report += "| Wave | " + wave + " |\n";
report += "| Tasks | " + (tasks.done || 0) + "/" + (tasks.total || 0) + " done |\n";
report += "| Blockers open | " + blockers + " |\n";
report += "| Heal cycles | " + healCycle + " |\n";
report += "| Tokens used | " + tokens.toLocaleString() + " / " + budget.toLocaleString() + " |\n\n";

report += "## Evidence\n\n";
report += evidence.length ? evidence.map(e => "- " + e).join("\n") : "n/a";
report += "\n\n## Updated\n\n" + updated + "\n";

fs.writeFileSync(reportFile, report);
console.log("\u2713 mission report: " + reportFile);
NODE
