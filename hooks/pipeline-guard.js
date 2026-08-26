#!/usr/bin/env node
// @bun

// hooks/pipeline-guard.ts
import { existsSync, readFileSync, readdirSync, statSync, lstatSync } from "fs";
import { execFileSync } from "child_process";
import { homedir } from "os";
import { join } from "path";
var cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
var MARKER_TTL_MS = 12 * 60 * 60 * 1000;
function readEnforce() {
  for (const base of [cwd, homedir()]) {
    if (!base)
      continue;
    const file = join(base, ".mugiwara", "config");
    if (!existsSync(file))
      continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const [k, v] = line.split("=").map((s) => s.trim());
      if (k !== "enforce")
        continue;
      if (v === "off" || v === "warn" || v === "block")
        return v;
      process.stderr.write(`mugiwara: unknown enforce="${v}" in ${file}, using "block"
`);
      return "block";
    }
  }
  return "block";
}
function engaged(sessionId) {
  const file = join(cwd, ".mugiwara", ".engaged");
  if (!existsSync(file))
    return false;
  try {
    const m = JSON.parse(readFileSync(file, "utf8"));
    if (sessionId && m.session_id)
      return m.session_id === sessionId;
    const touched = Date.parse(m.touched_at ?? "") || 0;
    return Date.now() - touched < MARKER_TTL_MS;
  } catch {
    return false;
  }
}
function sourceChanged() {
  try {
    const out = execFileSync("git", ["status", "--porcelain"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return out.split(/\r?\n/).map((l) => l.slice(3).trim()).filter(Boolean).some((p) => !p.startsWith(".mugiwara/"));
  } catch {
    return false;
  }
}
function newestMissionState() {
  const base = join(cwd, ".mugiwara", "missions");
  if (!existsSync(base))
    return null;
  let best = null;
  let bestAt = -1;
  try {
    for (const e of readdirSync(base, { withFileTypes: true })) {
      if (!e.isDirectory())
        continue;
      for (const f of readdirSync(join(base, e.name))) {
        const stem = f.replace(/\.json$/, "");
        if (!f.endsWith(".json") || stem === "continue" || stem.startsWith("continue-"))
          continue;
        const p = join(base, e.name, f);
        try {
          const s = JSON.parse(readFileSync(p, "utf8"));
          if (typeof s.mission !== "string" || !s.mission)
            continue;
          const at = statSync(p).mtimeMs;
          if (at <= bestAt)
            continue;
          bestAt = at;
          best = { mission: s.mission, lane: typeof s.lane === "string" ? s.lane : "" };
        } catch {}
      }
    }
  } catch {}
  return best;
}
var LANE_RANK = { direct: 0, lean: 1, standard: 2, full: 3, spike: 4 };
function executorDispatched(sessionId) {
  const file = join(cwd, ".mugiwara", ".engaged");
  if (!existsSync(file))
    return false;
  try {
    const m = JSON.parse(readFileSync(file, "utf8"));
    const at = Date.parse(m.executor_dispatched_at ?? "") || 0;
    if (!at)
      return false;
    if (sessionId && m.session_id && m.session_id !== sessionId)
      return false;
    return Date.now() - at < MARKER_TTL_MS;
  } catch {
    return false;
  }
}
function plannerDispatched(sessionId) {
  const file = join(cwd, ".mugiwara", ".engaged");
  if (!existsSync(file))
    return false;
  try {
    const m = JSON.parse(readFileSync(file, "utf8"));
    const at = Date.parse(m.planner_dispatched_at ?? "") || 0;
    if (!at)
      return false;
    if (sessionId && m.session_id && m.session_id !== sessionId)
      return false;
    return Date.now() - at < MARKER_TTL_MS;
  } catch {
    return false;
  }
}
function planTouched() {
  const missionsDir = join(cwd, ".mugiwara", "missions");
  if (!existsSync(missionsDir))
    return false;
  const markerFile = join(cwd, ".mugiwara", ".engaged");
  if (!existsSync(markerFile))
    return false;
  let sessionStart = 0;
  try {
    const m = JSON.parse(readFileSync(markerFile, "utf8"));
    sessionStart = Date.parse(m.first_seen ?? "") || 0;
  } catch {}
  if (!sessionStart)
    return false;
  try {
    for (const e of readdirSync(missionsDir, { withFileTypes: true })) {
      if (!e.isDirectory())
        continue;
      const plan = join(missionsDir, e.name, "plan.md");
      if (!existsSync(plan))
        continue;
      const at = lstatSync(plan).mtimeMs;
      if (at >= sessionStart)
        return true;
    }
  } catch {}
  return false;
}
async function main() {
  let input = "";
  for await (const chunk of process.stdin)
    input += chunk;
  let payload = {};
  try {
    payload = JSON.parse(input);
  } catch {}
  if (payload.stop_hook_active === true)
    return;
  const enforce = readEnforce();
  if (enforce === "off")
    return;
  const sessionId = typeof payload.session_id === "string" ? payload.session_id : "";
  if (!engaged(sessionId))
    return;
  const state = newestMissionState();
  const sourceChangedNow = sourceChanged();
  if (state) {
    const rank = LANE_RANK[state.lane] ?? -1;
    if (rank >= 1 && sourceChangedNow && !executorDispatched(sessionId)) {
      process.stderr.write(`\u26A0 Mugiwara: mission "${state.mission}" is sized Lane ${rank} (${state.lane}) and source changed, ` + "but no executor (zoro-execution / brook-healing) was dispatched or embodied this session. " + "Only Zoro and Brook write source \u2014 dispatch one, or re-triage as Lane 0 (direct) if the work " + `really is that small. Set enforce=off in .mugiwara/config to disable these checks.
`);
    }
    if (planTouched() && !plannerDispatched(sessionId)) {
      process.stderr.write("\u26A0 Mugiwara: a plan doc (missions/<mission>/plan.md) was written this session, " + "but no planner (nami-planner / mugiwara-planning) was dispatched or embodied. " + "Only Nami writes the plan \u2014 dispatch nami-planner, or record the plan as a " + `deliberate exception in the decision log. Set enforce=off in .mugiwara/config to disable.
`);
    }
    return;
  }
  if (!state) {
    if (!sourceChangedNow)
      return;
    const reason = "Mugiwara: source changed in this session but no Flow 0 triage is on disk. " + "Run Flow 0 (classify, size the lane, write the decision log) and record it with " + '`mugiwara savepoint <mission> "" 0 <mode>` \u2014 or, if this is Lane 0 trivial work, ' + "record a Lane 0 savepoint to say so. Set enforce=off in .mugiwara/config to disable this check.";
    if (enforce === "warn") {
      process.stderr.write(`\u26A0 ${reason}
`);
      return;
    }
    process.stdout.write(JSON.stringify({ decision: "block", reason }));
  }
}
main().catch(() => {});
