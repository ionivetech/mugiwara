#!/usr/bin/env bun
// hooks/pipeline-guard.ts — Stop + SubagentStop: refuse to end a turn that
// changed source while the mission has no triage on disk.
//
// Why this exists, precisely: in the session that produced this file, a
// luffy-orchestrator subagent ran, stopped, and the main thread then did hours
// of source work with no Flow 0, no plan, no decision log and no savepoint.
// Nobody noticed until the user asked. 21 files under content/ instruct the
// model to run savepoint.sh; production executions before that day: 0. Prose
// enforcement measured 0-for-21, so this is a machine check instead.
//
// Two invariants, both narrow:
//   1. **triage happened and is on disk** — NOT "the whole pipeline ran".
//      Lane 0 satisfies it with a Lane 0 savepoint, so no exception list is
//      needed and the check is safe to default on. Blocks.
//   2. **Lane 1+ source work went through an executor.** Lane 0 is exempt from
//      this one (it skips dispatch by design); an ABSENT lane is not — that is
//      check 1's territory, never a Lane 0 exemption. Warns only, see below.
//
// Fails OPEN on any internal error. A fence that can wedge a session gets
// disabled by its users, and then it fences nothing.
import { existsSync, readFileSync, readdirSync, statSync, lstatSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

const cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const MARKER_TTL_MS = 12 * 60 * 60 * 1000; // 12h — a stale marker must not police tomorrow's session

type Enforce = 'off' | 'warn' | 'block';

function readEnforce(): Enforce {
  // homedir(), not $HOME: Windows sets USERPROFILE and leaves HOME unset, so
  // the global ~/.mugiwara/config was never read there.
  for (const base of [cwd, homedir()]) {
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
  const file = join(cwd, '.mugiwara', '.engaged');
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

/**
 * The newest readable savepoint for any mission, or null when there is none.
 * Its existence IS the triage fact (check 1); its `lane` field is the input to
 * the write-boundary check (check 2).
 */
function newestMissionState(): { mission: string; lane: string } | null {
  const base = join(cwd, '.mugiwara', 'missions');
  if (!existsSync(base)) return null;
  let best: { mission: string; lane: string } | null = null;
  let bestAt = -1;
  try {
    for (const e of readdirSync(base, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      for (const f of readdirSync(join(base, e.name))) {
        // state.json (solo) or <member>.json (team) — never continue*.json
        const stem = f.replace(/\.json$/, '');
        if (!f.endsWith('.json') || stem === 'continue' || stem.startsWith('continue-')) continue;
        const p = join(base, e.name, f);
        try {
          const s = JSON.parse(readFileSync(p, 'utf8')) as { mission?: unknown; lane?: unknown };
          if (typeof s.mission !== 'string' || !s.mission) continue;
          const at = statSync(p).mtimeMs;
          if (at <= bestAt) continue;
          bestAt = at;
          best = { mission: s.mission, lane: typeof s.lane === 'string' ? s.lane : '' };
        } catch { /* corrupt savepoint is not triage */ }
      }
    }
  } catch { /* unreadable — treat as absent */ }
  return best;
}

// Lane 0 (`direct`) is the ONLY lane that legitimately skips dispatch: it is
// still inside mugiwara (it has a savepoint — that is check 1), it just runs
// minimum process. From `lean` up, the lane itself says the work should have
// been handed to an executor.
const LANE_RANK: Record<string, number> = { direct: 0, lean: 1, standard: 2, full: 3, spike: 4 };

/** An executor (Zoro/Brook) was dispatched or embodied in this session. */
function executorDispatched(sessionId: string): boolean {
  const file = join(cwd, '.mugiwara', '.engaged');
  if (!existsSync(file)) return false;
  try {
    const m = JSON.parse(readFileSync(file, 'utf8')) as { session_id?: string; executor_dispatched_at?: string };
    const at = Date.parse(m.executor_dispatched_at ?? '') || 0;
    if (!at) return false;
    if (sessionId && m.session_id && m.session_id !== sessionId) return false;
    return Date.now() - at < MARKER_TTL_MS;
  } catch {
    return false;
  }
}

/** A planner (Nami) was dispatched or embodied in this session. */
function plannerDispatched(sessionId: string): boolean {
  const file = join(cwd, '.mugiwara', '.engaged');
  if (!existsSync(file)) return false;
  try {
    const m = JSON.parse(readFileSync(file, 'utf8')) as { session_id?: string; planner_dispatched_at?: string };
    const at = Date.parse(m.planner_dispatched_at ?? '') || 0;
    if (!at) return false;
    if (sessionId && m.session_id && m.session_id !== sessionId) return false;
    return Date.now() - at < MARKER_TTL_MS;
  } catch {
    return false;
  }
}

/**
 * A plan doc (missions/<mission>/plan.md) was created or modified in this
 * session. .mugiwara/ is gitignored, so git status cannot see plan files —
 * read the filesystem directly and compare mtimes against the session's
 * first-seen marker. Only a mission plan.md counts — the plan doc is the
 * artifact only Nami may write.
 */
function planTouched(): boolean {
  const missionsDir = join(cwd, '.mugiwara', 'missions');
  if (!existsSync(missionsDir)) return false;
  // session start = the marker's first_seen; anything newer is this session's work.
  // An ABSENT marker means the session never engaged — treat as untouched, never
  // as "every plan counts" (a 0 fallback would flag every pre-existing plan).
  const markerFile = join(cwd, '.mugiwara', '.engaged');
  if (!existsSync(markerFile)) return false;
  let sessionStart = 0;
  try {
    const m = JSON.parse(readFileSync(markerFile, 'utf8')) as { first_seen?: string };
    sessionStart = Date.parse(m.first_seen ?? '') || 0;
  } catch { /* corrupt marker — treat as untouched */ }
  if (!sessionStart) return false;
  try {
    for (const e of readdirSync(missionsDir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const plan = join(missionsDir, e.name, 'plan.md');
      if (!existsSync(plan)) continue;
      // lstat, not stat: a symlinked plan pointing outside .mugiwara/
      // must not count as a plan write.
      const at = lstatSync(plan).mtimeMs;
      if (at >= sessionStart) return true;
    }
  } catch { /* unreadable — treat as untouched */ }
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

  const state = newestMissionState();
  const sourceChangedNow = sourceChanged();

  // --- check 2: the write boundary -----------------------------------------
  // Triage exists and sized the mission Lane 1+, source changed, and no
  // executor was ever dispatched or embodied this session. That is the captain
  // implementing work the lane says should have been handed to Zoro or Brook.
  //
  // Reported as a WARNING even under enforce=block. Half the predicate is a
  // crisp on-disk fact (the lane field); the other half infers from the ABSENCE
  // of a dispatch marker, and absence has failure modes the lane does not —
  // a harness whose PostToolUse payload omits the agent name, or a dispatch
  // that happened in an earlier session. Those produce false positives, and a
  // false block is the one outcome that gets the whole fence switched off.
  // Raise to block once dispatch recording is proven across harnesses.
  if (state) {
    const rank = LANE_RANK[state.lane] ?? -1; // unknown/absent lane → no opinion
    if (rank >= 1 && sourceChangedNow && !executorDispatched(sessionId)) {
      process.stderr.write(
        `⚠ Mugiwara: mission "${state.mission}" is sized Lane ${rank} (${state.lane}) and source changed, ` +
        'but no executor (zoro-execution / brook-healing) was dispatched or embodied this session. ' +
        'Only Zoro and Brook write source — dispatch one, or re-triage as Lane 0 (direct) if the work ' +
        'really is that small. Set enforce=off in .mugiwara/config to disable these checks.\n',
      );
    }
    // --- check 3: the plan boundary (escape #2) ------------------------------
    // A plan doc was written this session but no planner (Nami) was dispatched.
    // Only Nami writes the plan. Lane 0 cannot trigger this (no plan doc); an
    // ABSENT lane is check 1's territory, never a Lane 0 exemption. Warn-only
    // for now — raise together with check 2 once dispatch recording is proven
    // across harnesses.
    if (planTouched() && !plannerDispatched(sessionId)) {
      process.stderr.write(
        '⚠ Mugiwara: a plan doc (missions/<mission>/plan.md) was written this session, ' +
        'but no planner (nami-planner / mugiwara-planning) was dispatched or embodied. ' +
        'Only Nami writes the plan — dispatch nami-planner, or record the plan as a ' +
        'deliberate exception in the decision log. Set enforce=off in .mugiwara/config to disable.\n',
      );
    }
    return;
  }

  // --- check 1: triage on disk ---------------------------------------------
  // No mission state at all and source changed → no triage happened. This is
  // the original invariant and it BLOCKS (the triage fact is a crisp on-disk
  // check, no absence-inference). Only fires when source actually changed.
  if (!state) {
    if (!sourceChangedNow) return;
    const reason =
      'Mugiwara: source changed in this session but no Flow 0 triage is on disk. ' +
      'Run Flow 0 (classify, size the lane, write the decision log) and record it with ' +
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
}

main().catch(() => { /* fail open — never wedge a session */ });
