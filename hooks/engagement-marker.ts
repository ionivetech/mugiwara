#!/usr/bin/env bun
// hooks/engagement-marker.ts — PostToolUse on Task|Skill: record that this
// session engaged the mugiwara crew.
//
// The pipeline guard only polices sessions that actually used mugiwara. Without
// this marker the guard would either police every session in every repo that
// happens to have a .mugiwara dir (infuriating, and users would disable it) or
// police nothing. Engagement is the scope.
//
// Never throws: a failed marker write degrades to "not engaged", which means
// the guard stays silent. Failing open is deliberate — an enforcement layer
// that can wedge a session gets turned off, and then it enforces nothing.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

async function main(): Promise<void> {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;

  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(input) as Record<string, unknown>; } catch { /* not JSON — treat as no payload */ }

  // Only mugiwara work counts as engagement. The tool input carries the agent
  // or skill name; anything else in the session is none of our business.
  // Match the STRUCTURED agent/skill-name field only — never free-text tool
  // input. A Task description that merely cites a skill, or a doc read that
  // mentions one, must not count as a dispatch (that would let the actor the
  // guard constrains spoof the marker and neuter the check).
  const toolName = typeof payload.tool_name === 'string' ? payload.tool_name.toLowerCase() : '';
  const toolInput = (payload.tool_input ?? {}) as Record<string, unknown>;
  const subagentType = typeof toolInput.subagent_type === 'string' ? toolInput.subagent_type.toLowerCase() : '';
  const skillName = typeof toolInput.skill === 'string' ? toolInput.skill.toLowerCase() : '';
  const agentField = `${toolName} ${subagentType} ${skillName}`;
  if (!agentField.includes('mugiwara')) return;

  // Executor dispatch is a second, narrower fact recorded in the same marker:
  // did the session hand source work to the only two roles allowed to write it
  // (Zoro / Brook)? Both the subagent form and the inline-embody skill form
  // count — on Codex-style harnesses embodying the role IS the dispatch.
  // The guard uses this to catch a captain implementing Lane 1+ work inline.
  const dispatched = /zoro-execution|brook-healing|mugiwara-execution|mugiwara-healing|mugiwara-execute|mugiwara-heal/.test(agentField);

  // Planner dispatch is a third fact: did the session hand plan-writing to the
  // only role allowed to write the plan doc (Nami)? Same two forms count —
  // subagent `nami-planner` and inline skill `mugiwara-planning`/`mugiwara-plan`.
  // The guard uses this to catch a captain (or anyone else) writing the plan
  // inline, which is escape #2: only Nami writes the plan.
  const planned = /nami-planner|mugiwara-planning|mugiwara-plan/.test(agentField);

  const dir = join(cwd, '.mugiwara', 'state');
  const file = join(dir, '.engaged');
  // session_id scopes the marker when the payload carries one. Its presence on
  // every hook event is NOT verified, so the guard also accepts a recent mtime
  // — correct under both, rather than assuming a payload shape.
  const sessionId = typeof payload.session_id === 'string' ? payload.session_id : '';

  try {
    mkdirSync(dir, { recursive: true });
    // preserve the first engagement time; only refresh the touch timestamp.
    // BUT: first_seen is the "this session" anchor for the plan guard's
    // planTouched() (a plan is "written this session" if its mtime >=
    // first_seen). A continuation session is a NEW session — carrying the old
    // first_seen forward would make every prior plan count as "written this
    // session" while the new session's planner dispatch is empty, warning on
    // every guard event. Reset first_seen when the session changes.
    let firstSeen = new Date().toISOString();
    let dispatchedAt = '';
    let plannedAt = '';
    if (existsSync(file)) {
      try {
        const prev = JSON.parse(readFileSync(file, 'utf8')) as { session_id?: string; first_seen?: string; executor_dispatched_at?: string; planner_dispatched_at?: string };
        const sameSession = !sessionId || !prev.session_id || prev.session_id === sessionId;
        if (sameSession && typeof prev.first_seen === 'string') firstSeen = prev.first_seen;
        // A dispatch belongs to the session that made it. Carrying it into the
        // next session would excuse a captain who implements inline today
        // because Zoro ran yesterday.
        if (sameSession && typeof prev.executor_dispatched_at === 'string') dispatchedAt = prev.executor_dispatched_at;
        if (sameSession && typeof prev.planner_dispatched_at === 'string') plannedAt = prev.planner_dispatched_at;
      } catch { /* corrupt marker — rewrite it */ }
    }
    if (dispatched) dispatchedAt = new Date().toISOString();
    if (planned) plannedAt = new Date().toISOString();
    writeFileSync(file, JSON.stringify({
      session_id: sessionId,
      first_seen: firstSeen,
      touched_at: new Date().toISOString(),
      executor_dispatched_at: dispatchedAt,
      planner_dispatched_at: plannedAt,
    }, null, 2) + '\n');
  } catch {
    // cannot write (read-only fs, permissions) — stay silent, guard stays off
  }
}

main().catch(() => { /* a hook must never fail the turn */ });
