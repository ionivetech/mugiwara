#!/usr/bin/env bun
// hooks/pipeline-guard.ts — Stop + SubagentStop: refuse to end a turn that
// changed source while the mission has no triage on disk.
//
// Why this exists, precisely: in the session that produced this file, a
// luffy-orchestrator subagent ran, stopped, and the main thread then did hours
// of source work with no Wave 0, no plan, no decision log and no savepoint.
// Nobody noticed until the user asked. 21 files under content/ instruct the
// model to run savepoint.sh; production executions before that day: 0. Prose
// enforcement measured 0-for-21, so this is a machine check instead.
//
// The enforced invariant is deliberately narrow: **triage happened and is on
// disk** — NOT "the whole pipeline ran". Lane 0 satisfies it with a Lane 0
// savepoint, so no exception list is needed and the check is safe to default on.
//
// Fails OPEN on any internal error. A fence that can wedge a session gets
// disabled by its users, and then it fences nothing.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const MARKER_TTL_MS = 12 * 60 * 60 * 1000; // 12h — a stale marker must not police tomorrow's session

type Enforce = 'off' | 'warn' | 'block';

function readEnforce(): Enforce {
  for (const base of [cwd, process.env.HOME ?? '']) {
    if (!base) continue;
    const file = join(base, '.mugiwara', 'config');
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const [k, v] = line.split('=').map((s) => s.trim());
      if (k !== 'enforce') continue;
      if (v === 'off' || v === 'warn' || v === 'block') return v;
      // A typo must not silently disable the fence — fall through to the
      // default rather than treating an unknown value as "off".
      process.stderr.write(`mugiwara: unknown enforce="${v}" in ${file}, using "block"\n`);
      return 'block';
    }
  }
  return 'block'; // user decision at the Lane 3 escalation
}

/** Engaged = a mugiwara agent or skill ran in this session. */
function engaged(sessionId: string): boolean {
  const file = join(cwd, '.mugiwara', 'state', '.engaged');
  if (!existsSync(file)) return false;
  try {
    const m = JSON.parse(readFileSync(file, 'utf8')) as { session_id?: string; touched_at?: string };
    if (sessionId && m.session_id) return m.session_id === sessionId;
    // no session_id on either side — fall back to recency (Q1 fallback)
    const touched = Date.parse(m.touched_at ?? '') || 0;
    return Date.now() - touched < MARKER_TTL_MS;
  } catch {
    return false;
  }
}

/**
 * Source changed in the working tree, ignoring mugiwara's own bookkeeping.
 * Reads git directly and NEVER state.json's `files_touched` — that field was
 * blind to the working tree (reporting 0 against 13 real files), and a fence
 * built on it would be a silent no-op.
 */
function sourceChanged(): boolean {
  try {
    const out = execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out
      .split(/\r?\n/)
      .map((l) => l.slice(3).trim())
      .filter(Boolean)
      .some((p) => !p.startsWith('.mugiwara/'));
  } catch {
    return false; // not a git repo, or git unavailable — nothing to police
  }
}

/** Triage on disk = at least one readable savepoint for some mission. */
function triageOnDisk(): boolean {
  const base = join(cwd, '.mugiwara', 'state');
  if (!existsSync(base)) return false;
  try {
    for (const e of readdirSync(base, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      for (const f of readdirSync(join(base, e.name))) {
        if (!f.endsWith('.json')) continue;
        try {
          const s = JSON.parse(readFileSync(join(base, e.name, f), 'utf8')) as { mission?: unknown };
          if (typeof s.mission === 'string' && s.mission) return true;
        } catch { /* corrupt savepoint is not triage */ }
      }
    }
  } catch { /* unreadable — treat as absent */ }
  return false;
}

async function main(): Promise<void> {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(input) as Record<string, unknown>; } catch { /* no payload */ }

  // Loop protection. Non-negotiable: without this the block would re-fire on
  // the turn it itself caused.
  if (payload.stop_hook_active === true) return;

  const enforce = readEnforce();
  if (enforce === 'off') return;

  const sessionId = typeof payload.session_id === 'string' ? payload.session_id : '';
  if (!engaged(sessionId)) return;
  if (!sourceChanged()) return;
  if (triageOnDisk()) return;

  const reason =
    'Mugiwara: source changed in this session but no Wave 0 triage is on disk. ' +
    'Run Wave 0 (classify, size the lane, write the decision log) and record it with ' +
    '`mugiwara savepoint <mission> "" 0 <mode>` — or, if this is Lane 0 trivial work, ' +
    'record a Lane 0 savepoint to say so. Set enforce=off in .mugiwara/config to disable this check.';

  if (enforce === 'warn') {
    process.stderr.write(`⚠ ${reason}\n`);
    return;
  }
  // `block` renders as a hook error in the transcript, which is what genuine
  // drift should look like. The 8-consecutive-continuation cap bounds the cost
  // of a wrong predicate.
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
}

main().catch(() => { /* fail open — never wedge a session */ });
