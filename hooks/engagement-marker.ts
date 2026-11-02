#!/usr/bin/env bun
// hooks/engagement-marker.ts — PostToolUse on Task|Agent|Skill: record that this
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
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureConfig } from '../src/config.ts';
import { REVIEW_LEDGER, activeMission } from '../src/active-mission.ts';

const cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

// A project install registers agents under their plain names, so the crew is
// recognized by name as well as by the `mugiwara` namespace/prefix.
const CREW = /(?:^|[^a-z-])(?:zoro-execution|nami-planner|robin-reviewer|jinbe-security|luffy-orchestrator|chopper-checkpoint|sanji-quality|franky-gates|brook-healing|usopp-brainstorm|skeptic-verifier|resume-coordinator|memory-keeper)(?![a-z-])/;
// Agents whose dispatch proves an independent (fresh-context) review.
const REVIEW_AGENTS = new Set(['robin-reviewer', 'jinbe-security', 'skeptic-verifier']);

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
  if (!agentField.includes('mugiwara') && !CREW.test(agentField)) return;

  // Review-dispatch ledger: a real SUBAGENT dispatch (Claude Code names the tool
  // Task or Agent) with a structured subagent_type. Never the Skill tool (the
  // inline form) and never free text. Numbers and names only; fail open.
  try {
    const agent = subagentType.replace(/^.*:/, '');
    if ((toolName === 'task' || toolName === 'agent') && REVIEW_AGENTS.has(agent)) {
      const sid = typeof payload.session_id === 'string' ? payload.session_id : '';
      mkdirSync(join(cwd, '.mugiwara'), { recursive: true });
      appendFileSync(join(cwd, '.mugiwara', REVIEW_LEDGER), JSON.stringify({
        agent, at: new Date().toISOString(), session_id: sid, mission: activeMission(cwd)?.mission ?? '',
      }) + '\n');
    }
  } catch { /* fail open */ }

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

  const dir = join(cwd, '.mugiwara');
  const file = join(dir, '.engaged');
  // session_id scopes the marker when the payload carries one. Its presence on
  // every hook event is NOT verified, so the guard also accepts a recent mtime
  // — correct under both, rather than assuming a payload shape.
  const sessionId = typeof payload.session_id === 'string' ? payload.session_id : '';

  try {
    mkdirSync(dir, { recursive: true });
    // A fresh engagement must leave a usable project behind: default config
    // when missing, never overwriting an existing file or following a symlink
    // (guaranteed inside ensureConfig). Without this the first session ends up
    // with .engaged but no config, and every key silently falls back.
    ensureConfig(cwd);
    // preserve the first engagement time; only refresh the touch timestamp.
    // BUT: first_seen is the "this session" anchor for the plan guard's
    // planTouched() (a plan is "written this session" if its mtime >=
    // first_seen). A continuation session is a NEW session — carrying the old
    // first_seen forward would make every prior plan count as "written this
    // session" while the new session's planner dispatch is empty, warning on
    // every guard event. Reset first_seen when the session changes.
    // Merge, never rewrite wholesale: other hooks own fields in this file
    // (explicit_crew_at from the prompt tracker; banner and block counters from
    // the guard). A same-session marker keeps all of them; a new session starts
    // fresh, because those facts belong to the session that made them.
    // first_seen is the "this session" anchor for the plan guard's planTouched().
    const now = new Date().toISOString();
    let prev: Record<string, unknown> = {};
    if (existsSync(file)) {
      try { prev = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>; } catch { /* corrupt marker — rewrite it */ }
    }
    const prevSession = typeof prev.session_id === 'string' ? prev.session_id : '';
    const base = !sessionId || !prevSession || prevSession === sessionId ? prev : {};
    writeFileSync(file, JSON.stringify({
      last_banner_flow: null,
      ...base,
      session_id: sessionId || prevSession,
      first_seen: typeof base.first_seen === 'string' ? base.first_seen : now,
      touched_at: now,
      executor_dispatched_at: dispatched ? now : (typeof base.executor_dispatched_at === 'string' ? base.executor_dispatched_at : ''),
      planner_dispatched_at: planned ? now : (typeof base.planner_dispatched_at === 'string' ? base.planner_dispatched_at : ''),
    }, null, 2) + '\n');
  } catch {
    // cannot write (read-only fs, permissions) — stay silent, guard stays off
  }
}

main().catch(() => { /* a hook must never fail the turn */ });
