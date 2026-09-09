#!/usr/bin/env node
// @bun

// hooks/engagement-marker.ts
import { existsSync as existsSync2, mkdirSync as mkdirSync2, readFileSync as readFileSync2, writeFileSync as writeFileSync2 } from "fs";
import { join as join2 } from "path";

// src/config.ts
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
var DEFAULT_CONFIG = [
  "# Mugiwara config. Project overrides ~/.mugiwara/config.",
  "# Every key here is read by code. Delete a line to take its default.",
  "",
  "# -- Autonomy ---------------------------------------------",
  "mode=guided                  # guided | semi | auto — how much the crew does without asking",
  "verbosity=normal             # normal | full — how much the crew echoes",
  "",
  "# -- Git --------------------------------------------------",
  "branch=feature/{type}-{issue}-{slug}",
  "commit=conventional",
  "auto_commit=off              # on | off — off hands you an uncommitted tree in guided/semi",
  "",
  "# -- Gates ------------------------------------------------",
  "coverage_new=85",
  "coverage_modified=90",
  "review_depth=full            # full | standard | quick",
  "quality_depth=full",
  "verify_merged=off",
  "",
  "# -- Limits -----------------------------------------------",
  "delegate_threshold=60        # % of budget before delegation is advised",
  "heal_max_cycles=3            # heal loop halts here and escalates",
  "",
  "# -- Monorepo ---------------------------------------------",
  "# lane_scope_glob=packages/api/**   # count only matching files when sizing the lane",
  "",
  "# -- Optional ---------------------------------------------",
  "# context_budget_chars=150000       # fail archive if the trail exceeds this",
  "# investigation_max_passes=2",
  "# investigation_max_unrelated_files=5",
  "# investigation_repeated_read_threshold=2",
  "# sign=auto                         # auto | minisign | pure | off",
  "# enforce=block                     # off | warn | block — pipeline-guard policy"
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

// hooks/engagement-marker.ts
var cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
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
  if (!agentField.includes("mugiwara"))
    return;
  const dispatched = /zoro-execution|brook-healing|mugiwara-execution|mugiwara-healing|mugiwara-execute|mugiwara-heal/.test(agentField);
  const planned = /nami-planner|mugiwara-planning|mugiwara-plan/.test(agentField);
  const dir = join2(cwd, ".mugiwara");
  const file = join2(dir, ".engaged");
  const sessionId = typeof payload.session_id === "string" ? payload.session_id : "";
  try {
    mkdirSync2(dir, { recursive: true });
    ensureConfig(cwd);
    let firstSeen = new Date().toISOString();
    let dispatchedAt = "";
    let plannedAt = "";
    let bannerFlow = null;
    let bannerFlowAt = "";
    if (existsSync2(file)) {
      try {
        const prev = JSON.parse(readFileSync2(file, "utf8"));
        const sameSession = !sessionId || !prev.session_id || prev.session_id === sessionId;
        if (sameSession && typeof prev.first_seen === "string")
          firstSeen = prev.first_seen;
        if (sameSession && typeof prev.executor_dispatched_at === "string")
          dispatchedAt = prev.executor_dispatched_at;
        if (sameSession && typeof prev.planner_dispatched_at === "string")
          plannedAt = prev.planner_dispatched_at;
        if (sameSession && typeof prev.last_banner_flow === "number")
          bannerFlow = prev.last_banner_flow;
        if (sameSession && typeof prev.last_banner_flow_at === "string")
          bannerFlowAt = prev.last_banner_flow_at;
      } catch {}
    }
    if (dispatched)
      dispatchedAt = new Date().toISOString();
    if (planned)
      plannedAt = new Date().toISOString();
    writeFileSync2(file, JSON.stringify({
      session_id: sessionId,
      first_seen: firstSeen,
      touched_at: new Date().toISOString(),
      executor_dispatched_at: dispatchedAt,
      planner_dispatched_at: plannedAt,
      last_banner_flow: bannerFlow,
      last_banner_flow_at: bannerFlowAt
    }, null, 2) + `
`);
  } catch {}
}
main().catch(() => {});
