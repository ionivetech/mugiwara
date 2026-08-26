#!/usr/bin/env node
// @bun

// hooks/engagement-marker.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
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
  const dir = join(cwd, ".mugiwara");
  const file = join(dir, ".engaged");
  const sessionId = typeof payload.session_id === "string" ? payload.session_id : "";
  try {
    mkdirSync(dir, { recursive: true });
    let firstSeen = new Date().toISOString();
    let dispatchedAt = "";
    let plannedAt = "";
    if (existsSync(file)) {
      try {
        const prev = JSON.parse(readFileSync(file, "utf8"));
        const sameSession = !sessionId || !prev.session_id || prev.session_id === sessionId;
        if (sameSession && typeof prev.first_seen === "string")
          firstSeen = prev.first_seen;
        if (sameSession && typeof prev.executor_dispatched_at === "string")
          dispatchedAt = prev.executor_dispatched_at;
        if (sameSession && typeof prev.planner_dispatched_at === "string")
          plannedAt = prev.planner_dispatched_at;
      } catch {}
    }
    if (dispatched)
      dispatchedAt = new Date().toISOString();
    if (planned)
      plannedAt = new Date().toISOString();
    writeFileSync(file, JSON.stringify({
      session_id: sessionId,
      first_seen: firstSeen,
      touched_at: new Date().toISOString(),
      executor_dispatched_at: dispatchedAt,
      planner_dispatched_at: plannedAt
    }, null, 2) + `
`);
  } catch {}
}
main().catch(() => {});
