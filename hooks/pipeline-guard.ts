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
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, lstatSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findBash } from '../src/run.ts';
import { readConfig } from '../src/config.ts';
import { dispatchedAgents, closingPending } from '../src/active-mission.ts';
import { reviewNextStep } from '../src/risk.ts';

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
      process.stderr.write(`mugiwara: unknown enforce="${v}" in ${file}, using "warn"\n`);
      return 'warn';
    }
  }
  // Default warn: block can force extra model turns (up to 8 continuations),
  // so it is opt-in via enforce=block.
  return 'warn';
}

/** Count each Stop block (a forced extra model turn) in a sibling of .engaged; `mugiwara cost` reads it. */
function countForcedContinuation(): void {
  try {
    const file = join(cwd, '.mugiwara', '.forced-continuations');
    const prev = existsSync(file) ? Number(readFileSync(file, 'utf8').trim()) : 0;
    mkdirSync(join(cwd, '.mugiwara'), { recursive: true });
    writeFileSync(file, `${(Number.isInteger(prev) && prev > 0 ? prev : 0) + 1}\n`);
  } catch { /* counter is best-effort; never wedge the hook */ }
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
function sourceChanged(ignoreInstallNoise = false): boolean {
  try {
    const out = execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out
      .split(/\r?\n/)
      .map((l) => l.slice(3).trim())
      .filter(Boolean)
      .some((p) => !p.startsWith('.mugiwara/') && !(ignoreInstallNoise && /^(\.claude\/|\.opencode\/|\.gitignore$)/.test(p)));
  } catch {
    return false; // not a git repo, or git unavailable — nothing to police
  }
}

/**
 * Session anchor for the session-scoped scans: first_seen, else touched_at,
 * else 0 (unknown). Shared by artifactWorkNow and bannerThisSession — one
 * definition, not two copies. Fail open.
 */
function sessionStartFrom(markerFile: string): number {
  try {
    const m = JSON.parse(readFileSync(markerFile, 'utf8')) as { first_seen?: string; touched_at?: string };
    return Date.parse(m.first_seen ?? '') || Date.parse(m.touched_at ?? '') || 0;
  } catch { return 0; }
}

/**
 * Artifact work in this session: files written under .mugiwara/missions,
 * .mugiwara/spec, or .mugiwara/plans since the session's first-seen marker.
 * Work is not only source edits — a brainstorm that produced a spec, a plan,
 * or a recommendation is work, and it escaped the source-only predicate. (E3)
 * Session-scoped like planTouched: an absent/unreadable marker means untouched,
 * never "everything counts". Fail open throughout.
 */
function artifactWorkNow(): boolean {
  const markerFile = join(cwd, '.mugiwara', '.engaged');
  if (!existsSync(markerFile)) return false;
  const sessionStart = sessionStartFrom(markerFile);
  if (!sessionStart) return false;
  try {
    const stack = ['missions', 'spec', 'plans']
      .map((s) => join(cwd, '.mugiwara', s))
      .filter((p) => existsSync(p));
    while (stack.length) {
      const cur = stack.pop() as string;
      for (const e of readdirSync(cur, { withFileTypes: true })) {
        const full = join(cur, e.name);
        try {
          // Symlink check first: a symlink dirent reports isDirectory()
          // false, so nesting this inside the directory branch never fires.
          if (e.isSymbolicLink()) continue;
          if (e.isDirectory()) { stack.push(full); continue; }
          // 1s tolerance, same as planTouched (FS granularity / clock skew)
          if (statSync(full).mtimeMs + 1000 >= sessionStart) return true;
        } catch { /* unreadable entry — skip */ }
      }
    }
  } catch { return false; }
  return false;
}

/**
 * The newest readable savepoint for any mission, or null when there is none.
 * Its existence IS the triage fact (check 1); its `lane` field is the input to
 * the write-boundary check (check 2).
 */
function newestMissionState(): { mission: string; lane: string; dir: string; sensitive: boolean } | null {
  const base = join(cwd, '.mugiwara', 'missions');
  if (!existsSync(base)) return null;
  let best: { mission: string; lane: string; dir: string; sensitive: boolean } | null = null;
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
          const s = JSON.parse(readFileSync(p, 'utf8')) as { mission?: unknown; lane?: unknown; sensitive_paths?: unknown };
          if (typeof s.mission !== 'string' || !s.mission) continue;
          const at = statSync(p).mtimeMs;
          if (at <= bestAt) continue;
          bestAt = at;
          best = { mission: s.mission, lane: typeof s.lane === 'string' ? s.lane : '', dir: e.name, sensitive: Array.isArray(s.sensitive_paths) && s.sensitive_paths.length > 0 };
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
      // 1s tolerance: file mtime can be ~7ms before first_seen due to FS granularity / clock skew
      const at = lstatSync(plan).mtimeMs;
      if (at + 1000 >= sessionStart) return true;
    }
  } catch { /* unreadable — treat as untouched */ }
  return false;
}

/**
 * Flow-banner detection. The heading forms are `## <emoji> <Name> · <action> (n/N)` and the older
 * `## <emoji> Flow N — Crew (Role)`, so the match tolerates anything between `## ` and `Flow`. Warning only,
 * never a block: banner detection matches response text, and a false block on
 * a formatting variance is the outcome that gets the whole fence disabled.
 */
// Transcripts are JSONL: the banner sits mid-line inside an escaped string,
// so the transcript scan is not line-anchored. Warning-only, so a discussion
// *about* a banner counting as one is benign.
const TRANSCRIPT_BANNER_RE = /## .*Flow (\d+)\s*—/g;
// Current form: `## <emoji> <Name> · <action> (n/N)`; n is the stage position.
const CREW_BANNER_RE = /## \S+ (?:Luffy|Nami|Usopp|Zoro|Chopper|Sanji|Franky|Robin|Jinbe|Brook|Skeptic) · [^\n"]*?\((\d+)\/\d+\)/g;

/** Highest flow stage announced in text, or 0 when no banner is present. */
function extractBannerFlow(text: string): number {
  let best = 0;
  for (const re of [TRANSCRIPT_BANNER_RE, CREW_BANNER_RE]) {
    for (const m of text.matchAll(re)) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > best) best = n;
    }
  }
  return best;
}

/**
 * Record last_banner_flow in the engagement marker (schema owned by
 * engagement-marker.ts — this only writes its two fields, same-session
 * scoped like the dispatch facts). The marker itself never sees response
 * text (its payload is tool input), so the Stop hook — whose payload may
 * carry transcript_path — owns detection. Never throws.
 */
function recordBannerFlow(flow: number, sessionId: string): void {
  const file = join(cwd, '.mugiwara', '.engaged');
  try {
    const prev = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown> : {};
    const sameSession = !sessionId || typeof prev.session_id !== 'string' || prev.session_id === sessionId;
    if (!sameSession) return;
    writeFileSync(file, JSON.stringify({
      ...prev,
      touched_at: new Date().toISOString(),
      last_banner_flow: flow,
      last_banner_flow_at: new Date().toISOString(),
    }, null, 2) + '\n');
  } catch { /* fail open */ }
}

/** A banner recorded for this session (fresh scan already stored, or stored earlier). */
function bannerRecorded(sessionId: string): boolean {
  const file = join(cwd, '.mugiwara', '.engaged');
  if (!existsSync(file)) return false;
  try {
    const m = JSON.parse(readFileSync(file, 'utf8')) as { session_id?: string; last_banner_flow?: unknown; last_banner_flow_at?: string };
    if (typeof m.last_banner_flow !== 'number' || !m.last_banner_flow_at) return false;
    if (sessionId && m.session_id && m.session_id !== sessionId) return false;
    return Date.now() - (Date.parse(m.last_banner_flow_at) || 0) < MARKER_TTL_MS;
  } catch { return false; }
}

/**
 * Highest banner in the Stop-hook transcript. `null` = no transcript to read;
 * `0` = read it, no banner. Collapsing the two let a silent session pass.
 */
function bannerFromTranscript(payload: Record<string, unknown>): number | null {
  const p = payload.transcript_path;
  if (typeof p !== 'string' || !p) return null;
  try {
    if (!existsSync(p)) return null;
    return extractBannerFlow(readFileSync(p, 'utf8'));
  } catch { return null; }
}
function bannerThisSession(): boolean {
  const markerFile = join(cwd, '.mugiwara', '.engaged');
  if (!existsSync(markerFile)) return true; // no session anchor — no opinion
  const sessionStart = sessionStartFrom(markerFile);
  if (!sessionStart) return true;
  const re = /^## .*Flow (\d+)\s*—/m;
  try {
    const missionsDir = join(cwd, '.mugiwara', 'missions');
    for (const e of readdirSync(missionsDir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const files = [`${join(missionsDir, e.name)}/decisions.md`];
      const flowsDir = join(missionsDir, e.name, 'flows');
      if (existsSync(flowsDir)) {
        for (const f of readdirSync(flowsDir)) {
          if (f.endsWith('.md')) files.push(join(flowsDir, f));
        }
      }
      for (const f of files) {
        try {
          if (!existsSync(f)) continue;
          if (statSync(f).mtimeMs + 1000 < sessionStart) continue;
          if (re.test(readFileSync(f, 'utf8'))) return true;
        } catch { /* unreadable entry — skip */ }
      }
    }
  } catch { return true; }
  return false;
}

// --- explicit crew sessions ---------------------------------------------------
// The user typed `/mugiwara <request>` (the prompt tracker recorded
// explicit_crew_at in the marker). That is a request for the crew, so the
// process is enforced against the REAL diff: a model that decides on its own
// that the change is too small must not be able to skip it. Blocks (bounded);
// only enforce=off disables it.
const EXPLICIT_MAX_BLOCKS = 2;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readMarker(): Record<string, unknown> {
  try { return JSON.parse(readFileSync(join(cwd, '.mugiwara', '.engaged'), 'utf8')) as Record<string, unknown>; } catch { return {}; }
}

/** The marker says this session asked for the crew explicitly. */
function explicitSession(sessionId: string): boolean {
  const m = readMarker() as { session_id?: string; touched_at?: string; explicit_crew_at?: string };
  if (!m.explicit_crew_at) return false;
  if (sessionId && m.session_id) return m.session_id === sessionId;
  return Date.now() - (Date.parse(m.touched_at ?? '') || 0) < MARKER_TTL_MS;
}

/** Lane and sensitive paths of the real diff, from scripts/lane.sh. null = unavailable (fail open). */
function computedLane(): { lane: string; sensitive: string[]; files: number } | null {
  try {
    const bash = findBash();
    const script = join(root, 'scripts', 'lane.sh');
    if (!bash || !existsSync(script)) return null;
    const r = spawnSync(bash, [script, 'main', '--json'], { cwd, encoding: 'utf8', timeout: 15_000, stdio: ['ignore', 'pipe', 'ignore'] });
    if (r.status !== 0) return null;
    const j = JSON.parse(r.stdout) as { lane?: unknown; sensitive_paths?: unknown; files_touched?: unknown };
    if (typeof j.lane !== 'string') return null;
    return {
      lane: j.lane,
      sensitive: Array.isArray(j.sensitive_paths) ? j.sensitive_paths.filter((x): x is string => typeof x === 'string') : [],
      files: typeof j.files_touched === 'number' ? j.files_touched : 0,
    };
  } catch { return null; }
}

/**
 * A mission was closed (archived) in this session: it has report.md or
 * pr-verdict.md (archive removes state.json, so "no state" must not read as
 * "never triaged") and that file was written since the session's first_seen,
 * or the ledger shows this session dispatched a reviewer for that mission.
 * Closure is guarded by the archive gate itself, so this never triggers check (a).
 */
function closedThisSession(sessionId: string): boolean {
  try {
    const base = join(cwd, '.mugiwara', 'missions');
    if (!existsSync(base)) return false;
    const start = sessionStartFrom(join(cwd, '.mugiwara', '.engaged'));
    let ledger: Array<{ mission?: unknown; session_id?: unknown }> = [];
    try {
      ledger = readFileSync(join(cwd, '.mugiwara', 'review-dispatch.jsonl'), 'utf8').split(/\r?\n/).filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
    } catch { /* no ledger */ }
    for (const e of readdirSync(base, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const closed = ['report.md', 'pr-verdict.md'].map((f) => join(base, e.name, f)).filter((f) => existsSync(f));
      if (!closed.length) continue;
      if (start && closed.some((f) => statSync(f).mtimeMs + 1000 >= start)) return true;
      if (ledger.some((x) => x.mission === e.name && (!sessionId || !x.session_id || x.session_id === sessionId))) return true;
    }
  } catch { /* fail open below */ }
  return false;
}

/** The reason to hold the session open, or null when the process ran (or there is no opinion). */
function explicitProblem(sessionId: string): string | null {
  if (!sourceChanged(true)) return null;
  const lane = computedLane();
  if (!lane || lane.lane === 'direct') return null;
  const state = newestMissionState();
  if (!state) {
    if (closedThisSession(sessionId)) return null;
    // Same line as the /mugiwara fast path: only a full-lane diff (9+ files) or a risky path is held.
    if (!(lane.lane === 'full' || lane.sensitive.length)) return null;
    const what = lane.sensitive.length
      ? `a risky area (${lane.sensitive.slice(0, 3).join(', ')}${lane.sensitive.length > 3 ? `, and ${lane.sensitive.length - 3} more` : ''})`
      : `${lane.files} files`;
    return `Mugiwara: this change touches ${what}, and the crew's process was requested with /mugiwara but has not run. ` +
      'Size and record the work, then plan, build, review and check security before finishing; if the crew was not wanted, tell the user that instead of continuing.';
  }
  if (!(lane.lane === 'full' || state.sensitive || lane.sensitive.length)) return null;
  const dir = join(cwd, '.mugiwara', 'missions', state.dir);
  const missing: string[] = [];
  if (!existsSync(join(dir, 'review.md'))) missing.push('review');
  if (!existsSync(join(dir, 'security.md'))) missing.push('security check');
  if (missing.length) {
    return `Mugiwara: this change has no ${missing.join(' and no ')}, and the crew's process was requested with /mugiwara. ` +
      `Run the ${missing.join(' and the ')} now and write the result into the mission folder before finishing.`;
  }
  if (readConfig(cwd).independent_review !== 'off' && dispatchedAgents(cwd, state.mission).size === 0) {
    return 'Mugiwara: the review of this change ran in the same conversation that wrote it, and the crew\'s process was requested with /mugiwara. ' +
      'Ask the crew to run the independent review (Robin and Jinbe as separate agents) before finishing, or tell the user you are skipping it. ' + reviewNextStep(state.mission);
  }
  return null;
}

/** True when the session was held open (block emitted); beyond the cap it only warns. */
function explicitCheck(sessionId: string): boolean {
  const reason = explicitProblem(sessionId);
  if (!reason) return false;
  const marker = readMarker();
  const blocks = typeof marker.explicit_blocks === 'number' ? marker.explicit_blocks : 0;
  if (blocks >= EXPLICIT_MAX_BLOCKS) {
    process.stderr.write(`⚠ ${reason}\n`);
    return false;
  }
  try {
    writeFileSync(join(cwd, '.mugiwara', '.engaged'), JSON.stringify({ ...marker, explicit_blocks: blocks + 1 }, null, 2) + '\n');
  } catch { /* counter is best-effort */ }
  countForcedContinuation();
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
  return true;
}

async function main(): Promise<void> {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(input) as Record<string, unknown>; } catch { /* no payload */ }

  // Explicit /mugiwara sessions: Stop only (SubagentStop is unaffected). Runs
  // before the stop_hook_active return below because it has its own cap
  // (EXPLICIT_MAX_BLOCKS per session); otherwise the continuation it causes
  // would exempt the very next Stop from the check.
  const sid0 = typeof payload.session_id === 'string' ? payload.session_id : '';
  if (payload.hook_event_name !== 'SubagentStop' && explicitSession(sid0) && readEnforce() !== 'off' && explicitCheck(sid0)) return;

  // Loop protection. Non-negotiable: without this the block would re-fire on
  // the turn it itself caused.
  if (payload.stop_hook_active === true) return;

  const enforce = readEnforce();
  if (enforce === 'off') return;

  const sessionId = typeof payload.session_id === 'string' ? payload.session_id : '';
  if (!engaged(sessionId)) return;

  const state = newestMissionState();
  const sourceChangedNow = sourceChanged();

  // Closing artifacts exist but no report.md and no archive: headless runs end here.
  const pending = closingPending(cwd);
  if (pending) process.stderr.write(`Mugiwara: mission "${pending}" has its closing files but no report.md. Run \`mugiwara archive ${pending}\` to write it.\n`);

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
        `⚠ Mugiwara: source files changed in mission "${state.mission}" but no builder agent (zoro-execution or brook-healing) was started this session. ` +
        'Start one, or set enforce=off in .mugiwara/config to stop these warnings.\n',
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
        '⚠ Mugiwara: a plan was written this session but the planner (nami-planner) was not started. ' +
        'Start nami-planner to write it, or set enforce=off in .mugiwara/config to stop these warnings.\n',
      );
    }
    // --- check 5: independent review (warning only) -----------------------
    // A high-risk mission (full lane or sensitive paths) has a review/security
    // write-up but the dispatch ledger holds no separate reviewer agent for it:
    // the "review" was the writing conversation re-reading its own work.
    try {
      const risky = state.lane === 'full' || state.sensitive;
      const reviewed = ['review.md', 'security.md'].some((f) => existsSync(join(cwd, '.mugiwara', 'missions', state.dir, f)));
      if (risky && reviewed && readConfig(cwd).independent_review !== 'off' && dispatchedAgents(cwd, state.mission).size === 0) {
        process.stderr.write(
          'Mugiwara: the review of this change ran in the same conversation that wrote it. ' +
          'Ask the crew to run the independent review (Robin and Jinbe as separate agents), or set independent_review=off if you accept an inline review. ' + reviewNextStep(state.mission, dispatchedAgents(cwd, state.mission)) + '\n',
        );
      }
    } catch { /* fail open */ }
    // --- check 4: the banner signal (warning only) -----------------------
    // Work recorded with state on disk but no flow banner this session. The
    // banner is the only visible signal the pipeline ran — its absence is how
    // an off-pipeline session goes unnoticed. Warning, never a block.
    // Signal order: fresh transcript scan (recorded to the marker) →
    // marker's same-session record → mission-file fallback.
    const transcriptFlow = bannerFromTranscript(payload);
    if (transcriptFlow !== null && transcriptFlow > 0) recordBannerFlow(transcriptFlow, sessionId);
    // The transcript is what the user saw; when readable it is the whole
    // answer. A heading in decisions.md proves a file was written, not that
    // anything reached the thread. Mission files are the no-transcript fallback.
    const bannerShown = transcriptFlow !== null
      ? transcriptFlow > 0
      : bannerRecorded(sessionId) || bannerThisSession();
    if ((sourceChangedNow || planTouched()) && !bannerShown) {
      process.stderr.write(
        '⚠ Mugiwara: work was recorded but no crew banner was shown this session. ' +
        'Open each stage with its crew banner (see references/flow-banners.md) so the user can see the crew ran.\n',
      );
    }
    return;
  }

  // --- check 1: triage on disk ---------------------------------------------
  // No mission state at all and source changed → no triage happened. This is
  // the original invariant and it BLOCKS (the triage fact is a crisp on-disk
  // check, no absence-inference). Only fires when source actually changed.
  if (!state) {
    // Any work at all — source edits OR artifacts written — with no triage on
    // disk is the escape this guard exists to close. (E3)
    if (!sourceChangedNow && !artifactWorkNow()) return;
    const reason =
      'Mugiwara: this session changed source or mission artifacts but no mission was started to size the work. ' +
      'Start the mugiwara workflow first (it also records trivial work), or set enforce=off in .mugiwara/config to stop this check.';

    if (enforce === 'warn') {
      process.stderr.write(`⚠ ${reason}\n`);
      return;
    }
    // `block` renders as a hook error in the transcript, which is what genuine
    // drift should look like. The 8-consecutive-continuation cap bounds the cost
    // of a wrong predicate.
    countForcedContinuation();
    process.stdout.write(JSON.stringify({ decision: 'block', reason }));
  }
}

main().catch(() => { /* fail open — never wedge a session */ });
