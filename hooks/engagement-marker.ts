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
    if (existsSync(file)) {
      try {
        const prev = JSON.parse(readFileSync(file, 'utf8')) as { first_seen?: string };
        if (typeof prev.first_seen === 'string') firstSeen = prev.first_seen;
      } catch { /* corrupt marker — rewrite it */ }
    }
    writeFileSync(file, JSON.stringify({ session_id: sessionId, first_seen: firstSeen, touched_at: new Date().toISOString() }, null, 2) + '\n');
  } catch {
    // cannot write (read-only fs, permissions) — stay silent, guard stays off
  }
}

main().catch(() => { /* a hook must never fail the turn */ });
