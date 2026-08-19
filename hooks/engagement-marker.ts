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
  const blob = JSON.stringify(payload).toLowerCase();
  if (!blob.includes('mugiwara')) return;

  // Executor dispatch is a second, narrower fact recorded in the same marker:
  // did the session hand source work to the only two roles allowed to write it
  // (Zoro / Brook)? Both the subagent form and the inline-embody skill form
  // count — on Codex-style harnesses embodying the role IS the dispatch.
  // The guard uses this to catch a captain implementing Lane 1+ work inline.
  const dispatched = /zoro-execution|brook-healing|mugiwara-execution|mugiwara-healing|mugiwara-execute|mugiwara-heal/.test(blob);

  const dir = join(cwd, '.mugiwara', 'state');
  const file = join(dir, '.engaged');
  // session_id scopes the marker when the payload carries one. Its presence on
  // every hook event is NOT verified, so the guard also accepts a recent mtime
  // — correct under both, rather than assuming a payload shape.
  const sessionId = typeof payload.session_id === 'string' ? payload.session_id : '';

  try {
    mkdirSync(dir, { recursive: true });
    // preserve the first engagement time; only refresh the touch timestamp
    let firstSeen = new Date().toISOString();
    let dispatchedAt = '';
    if (existsSync(file)) {
      try {
        const prev = JSON.parse(readFileSync(file, 'utf8')) as { session_id?: string; first_seen?: string; executor_dispatched_at?: string };
        if (typeof prev.first_seen === 'string') firstSeen = prev.first_seen;
        // A dispatch belongs to the session that made it. Carrying it into the
        // next session would excuse a captain who implements inline today
        // because Zoro ran yesterday.
        const sameSession = !sessionId || !prev.session_id || prev.session_id === sessionId;
        if (sameSession && typeof prev.executor_dispatched_at === 'string') dispatchedAt = prev.executor_dispatched_at;
      } catch { /* corrupt marker — rewrite it */ }
    }
    if (dispatched) dispatchedAt = new Date().toISOString();
    writeFileSync(file, JSON.stringify({
      session_id: sessionId,
      first_seen: firstSeen,
      touched_at: new Date().toISOString(),
      executor_dispatched_at: dispatchedAt,
    }, null, 2) + '\n');
  } catch {
    // cannot write (read-only fs, permissions) — stay silent, guard stays off
  }
}

main().catch(() => { /* a hook must never fail the turn */ });
