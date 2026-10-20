#!/usr/bin/env node
// @bun

// hooks/engagement-marker.ts
import { appendFileSync, existsSync as existsSync3, mkdirSync as mkdirSync2, readFileSync as readFileSync3, writeFileSync as writeFileSync2 } from "fs";
import { join as join3 } from "path";

// src/config.ts
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
var DEFAULT_CONFIG = [
  "mode=guided",
  "verbosity=normal",
  "branch=feature/{type}-{issue}-{slug}",
  "commit=conventional",
  "auto_commit=off",
  "coverage=85",
  "review_depth=full",
  "quality_depth=full",
  "delegate_threshold=60",
  "heal_max_cycles=3",
  "independent_review=on",
  "# lane_scope_glob=packages/api/**",
  "# context_budget_chars=150000",
  "# team=off",
  "# sign=auto",
  "# features=core+auto",
  "# enforce=warn"
].join(`
`) + `
`;
function ensureConfig(projectDir) {
  const file = join(projectDir, ".mugiwara", "config");
  let exists = false;
  try {
    exists = lstatSync(file).isFile() || lstatSync(file).isSymbolicLink();
  } catch {
    exists = false;
  }
  if (exists)
    return false;
  mkdirSync(join(projectDir, ".mugiwara"), { recursive: true });
  writeFileSync(file, DEFAULT_CONFIG);
  return true;
}

// src/active-mission.ts
import { existsSync as existsSync2, readFileSync as readFileSync2, readdirSync } from "node:fs";
import { join as join2 } from "node:path";
var SAFE = /^[A-Za-z0-9._-]+$/;
function bootstrapMission(cwd) {
  const base = join2(cwd, ".mugiwara", "missions");
  if (!existsSync2(base))
    return null;
  for (const e of readdirSync(base, { withFileTypes: true })) {
    if (!e.isDirectory() || !SAFE.test(e.name) || /^\.+$/.test(e.name))
      continue;
    const files = readdirSync(join2(base, e.name));
    const hasState = files.some((f) => {
      if (!f.endsWith(".json"))
        return false;
      const stem = f.slice(0, -5);
      return stem !== "continue" && !stem.startsWith("continue-");
    });
    const closed = files.includes("report.md") || files.includes("pr-verdict.md");
    const hasArtifacts = ["plan.md", "spec.md", "decisions.md"].some((f) => files.includes(f));
    if (!hasState && hasArtifacts && !closed) {
      const wave = files.includes("plan.md") ? "2" : files.includes("spec.md") ? "1" : "0";
      return { mission: e.name, member: "", wave, mode: readMode(cwd), updated: 0 };
    }
  }
  return null;
}
function readMode(cwd) {
  const file = join2(cwd, ".mugiwara", "config");
  if (!existsSync2(file))
    return "guided";
  for (const line of readFileSync2(file, "utf8").split(/\r?\n/)) {
    const [k, v] = line.split("=").map((s) => s.trim());
    if (k === "mode" && ["guided", "semi", "auto"].includes(v))
      return v;
  }
  return "guided";
}
function activeMission(cwd) {
  const base = join2(cwd, ".mugiwara", "missions");
  if (!existsSync2(base))
    return bootstrapMission(cwd);
  let best = null;
  for (const e of readdirSync(base, { withFileTypes: true })) {
    if (!e.isDirectory() || !SAFE.test(e.name) || /^\.+$/.test(e.name))
      continue;
    for (const f of readdirSync(join2(base, e.name))) {
      if (!f.endsWith(".json"))
        continue;
      const stem = f.slice(0, -5);
      if (stem === "continue" || stem.startsWith("continue-"))
        continue;
      const member = stem === "state" ? "" : stem;
      if (member && (!SAFE.test(member) || /^\.+$/.test(member)))
        continue;
      try {
        const s = JSON.parse(readFileSync2(join2(base, e.name, f), "utf8"));
        const updated = Date.parse(s.updated_at ?? "") || 0;
        if (best && updated <= best.updated)
          continue;
        const wave = String(s.flow ?? s.wave ?? "").replace(/\D/g, "") || "1";
        const mode = ["guided", "semi", "auto"].includes(s.mode) ? s.mode : "guided";
        best = { mission: e.name, member, wave, mode, updated };
      } catch {}
    }
  }
  return best ?? bootstrapMission(cwd);
}
var REVIEW_LEDGER = "review-dispatch.jsonl";

// hooks/engagement-marker.ts
var cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
var CREW = /(?:^|[^a-z-])(?:zoro-execution|nami-planner|robin-reviewer|jinbe-security|luffy-orchestrator|chopper-checkpoint|sanji-quality|franky-gates|brook-healing|usopp-brainstorm|skeptic-verifier|resume-coordinator|memory-keeper)(?![a-z-])/;
var REVIEW_AGENTS = new Set(["robin-reviewer", "jinbe-security", "skeptic-verifier"]);
async function main() {
  let input = "";
  for await (const chunk of process.stdin)
    input += chunk;
  let payload = {};
  try {
    payload = JSON.parse(input);
  } catch {}
  const toolName = typeof payload.tool_name === "string" ? payload.tool_name.toLowerCase() : "";
  const toolInput = payload.tool_input ?? {};
  const subagentType = typeof toolInput.subagent_type === "string" ? toolInput.subagent_type.toLowerCase() : "";
  const skillName = typeof toolInput.skill === "string" ? toolInput.skill.toLowerCase() : "";
  const agentField = `${toolName} ${subagentType} ${skillName}`;
  if (!agentField.includes("mugiwara") && !CREW.test(agentField))
    return;
  try {
    const agent = subagentType.replace(/^.*:/, "");
    if ((toolName === "task" || toolName === "agent") && REVIEW_AGENTS.has(agent)) {
      const sid = typeof payload.session_id === "string" ? payload.session_id : "";
      mkdirSync2(join3(cwd, ".mugiwara"), { recursive: true });
      appendFileSync(join3(cwd, ".mugiwara", REVIEW_LEDGER), JSON.stringify({
        agent,
        at: new Date().toISOString(),
        session_id: sid,
        mission: activeMission(cwd)?.mission ?? ""
      }) + `
`);
    }
  } catch {}
  const dispatched = /zoro-execution|brook-healing|mugiwara-execution|mugiwara-healing|mugiwara-execute|mugiwara-heal/.test(agentField);
  const planned = /nami-planner|mugiwara-planning|mugiwara-plan/.test(agentField);
  const dir = join3(cwd, ".mugiwara");
  const file = join3(dir, ".engaged");
  const sessionId = typeof payload.session_id === "string" ? payload.session_id : "";
  try {
    mkdirSync2(dir, { recursive: true });
    ensureConfig(cwd);
    const now = new Date().toISOString();
    let prev = {};
    if (existsSync3(file)) {
      try {
        prev = JSON.parse(readFileSync3(file, "utf8"));
      } catch {}
    }
    const prevSession = typeof prev.session_id === "string" ? prev.session_id : "";
    const base = !sessionId || !prevSession || prevSession === sessionId ? prev : {};
    writeFileSync2(file, JSON.stringify({
      last_banner_flow: null,
      ...base,
      session_id: sessionId || prevSession,
      first_seen: typeof base.first_seen === "string" ? base.first_seen : now,
      touched_at: now,
      executor_dispatched_at: dispatched ? now : typeof base.executor_dispatched_at === "string" ? base.executor_dispatched_at : "",
      planner_dispatched_at: planned ? now : typeof base.planner_dispatched_at === "string" ? base.planner_dispatched_at : ""
    }, null, 2) + `
`);
  } catch {}
}
main().catch(() => {});
