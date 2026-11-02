// test/enforcement.test.ts — the pipeline guard's predicate, exercised through
// the BUILT hooks/*.js with synthetic payloads.
//
// Testing the built artifact, not the TypeScript source, is deliberate:
// hooks.json wires the .js files, and those files were untracked and stale for
// a whole release without anything noticing. A test against the .ts would have
// stayed green through exactly that failure.
import { initBaseRepo } from './helpers/git-fixture';
import { test, expect } from 'bun:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const GUARD = join(ROOT, 'hooks', 'pipeline-guard.js');
const MARKER = join(ROOT, 'hooks', 'engagement-marker.js');
const SAVEPOINT = join(ROOT, 'scripts', 'savepoint.sh');

function repo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-enforce-'));
  initBaseRepo(dir, { email: 'test@example.com', name: 'test' });
  mkdirSync(join(dir, '.mugiwara'), { recursive: true });
  // The guard defaults to enforce=warn; these tests exercise the blocking path.
  writeFileSync(join(dir, '.mugiwara', 'config'), 'enforce=block\n');
  return dir;
}

/** Run a hook with a JSON payload on stdin; return its stdout and stderr. */
function hook(script: string, cwd: string, payload: object): { out: string; err: string } {
  const r = spawnSync('node', [script], {
    cwd,
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
  });
  return { out: r.stdout ?? '', err: r.stderr ?? '' };
}

const engage = (dir: string, sessionId = 's1'): void => {
  hook(MARKER, dir, { tool_name: 'Skill', tool_input: { skill: 'mugiwara-orchestration' }, session_id: sessionId });
};
const touchSource = (dir: string): void => writeFileSync(join(dir, 'app.js'), 'code\n');
const blocked = (out: string): boolean => out.includes('"decision":"block"');

test('guard: engaged + source changed + no triage → blocks', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    touchSource(dir);
    engage(dir);
    const { out } = hook(GUARD, dir, { session_id: 's1' });
    expect(blocked(out)).toBe(true);
    // the reason must tell the model what to actually do
    expect(out).toContain('mugiwara workflow');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('guard: never engaged → silent even with source changes', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    touchSource(dir);
    const { out } = hook(GUARD, dir, { session_id: 's1' });
    expect(out).toBe('');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('guard: stop_hook_active → silent (cannot loop)', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    touchSource(dir);
    engage(dir);
    const { out } = hook(GUARD, dir, { session_id: 's1', stop_hook_active: true });
    expect(out).toBe('');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// This is the case that makes enforce=block safe as a default: Lane 0 work
// legitimately skips the pipeline, and satisfies the invariant with a Lane 0
// savepoint. If this ever regresses, the guard starts punishing trivial work
// and users will disable it — at which point it enforces nothing.
test('guard: Lane 0 with a savepoint recorded → silent', { timeout: 30000 }, () => {
  const dir = repo();
  try {
    touchSource(dir);
    engage(dir);
    spawnSync('bash', [SAVEPOINT, 'trivial-fix', '', '0', 'guided'], { cwd: dir, stdio: 'ignore' });
    expect(existsSync(join(dir, '.mugiwara', 'missions', 'trivial-fix'))).toBe(true);
    const { out } = hook(GUARD, dir, { session_id: 's1' });
    expect(out).toBe('');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('guard: only .mugiwara/** changed → silent (bookkeeping is not source)', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    engage(dir);
    writeFileSync(join(dir, '.mugiwara', 'scratch.md'), 'note\n');
    const { out } = hook(GUARD, dir, { session_id: 's1' });
    expect(out).toBe('');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('guard: enforce=off disables entirely; warn reports without blocking', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    touchSource(dir);
    engage(dir);

    writeFileSync(join(dir, '.mugiwara', 'config'), 'enforce=off\n');
    expect(hook(GUARD, dir, { session_id: 's1' }).out).toBe('');

    writeFileSync(join(dir, '.mugiwara', 'config'), 'enforce=warn\n');
    const warn = hook(GUARD, dir, { session_id: 's1' });
    expect(warn.out).toBe('');
    expect(warn.err).toContain('Mugiwara');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('guard: default (no enforce key) warns, never blocks; enforce=block counts forced continuations', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    touchSource(dir);
    writeFileSync(join(dir, '.mugiwara', 'config'), 'mode=guided\n');
    engage(dir);
    const counter = join(dir, '.mugiwara', '.forced-continuations');
    const warn = hook(GUARD, dir, { session_id: 's1' });
    expect(blocked(warn.out)).toBe(false);
    expect(warn.err).toContain('Mugiwara');
    expect(existsSync(counter)).toBe(false);

    writeFileSync(join(dir, '.mugiwara', 'config'), 'enforce=block\n');
    expect(blocked(hook(GUARD, dir, { session_id: 's1' }).out)).toBe(true);
    expect(blocked(hook(GUARD, dir, { session_id: 's1' }).out)).toBe(true);
    expect(readFileSync(counter, 'utf8').trim()).toBe('2');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('guard: unknown enforce value falls back to warn, never to off', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    touchSource(dir);
    engage(dir);
    // a typo must not silently disarm the fence
    writeFileSync(join(dir, '.mugiwara', 'config'), 'enforce=blok\n');
    const r = hook(GUARD, dir, { session_id: 's1' });
    expect(blocked(r.out)).toBe(false);
    expect(r.err).toContain('unknown enforce');
    expect(r.err).toContain('using "warn"');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('marker: only mugiwara tool use counts as engagement', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    hook(MARKER, dir, { tool_name: 'Task', tool_input: { subagent_type: 'general-purpose' }, session_id: 's1' });
    expect(existsSync(join(dir, '.mugiwara', '.engaged'))).toBe(false);

    hook(MARKER, dir, { tool_name: 'Task', tool_input: { subagent_type: 'mugiwara:zoro-execution' }, session_id: 's1' });
    expect(existsSync(join(dir, '.mugiwara', '.engaged'))).toBe(true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('guard: a different session id does not inherit engagement', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    touchSource(dir);
    engage(dir, 'session-A');
    const { out } = hook(GUARD, dir, { session_id: 'session-B' });
    expect(out).toBe('');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ---------- check 2: the write boundary (Lane 1+ needs an executor) ----------
//
// The whole design in two assertions: same source edit, `lane: direct` → silent
// (Lane 0 skips dispatch by design); `lane: full` with no executor dispatch →
// fires. Warning-only for now — see the rationale in pipeline-guard.ts.

/** Write a savepoint-shaped state file with an explicit lane. */
function stateWithLane(dir: string, mission: string, lane: string): void {
  const d = join(dir, '.mugiwara', 'missions', mission);
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, 'state.json'), JSON.stringify({ mission, lane, wave: 3 }) + '\n');
}

const dispatchExecutor = (dir: string, sessionId = 's1'): void => {
  hook(MARKER, dir, { tool_name: 'Task', tool_input: { subagent_type: 'mugiwara:zoro-execution' }, session_id: sessionId });
};

const boundaryWarned = (err: string): boolean => err.includes('no builder agent');

test('guard: Lane 0 (direct) + inline source edit → silent, dispatch not required', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    touchSource(dir);
    engage(dir);
    stateWithLane(dir, 'small-fix', 'direct');
    const { out, err } = hook(GUARD, dir, { session_id: 's1' });
    expect(out).toBe('');
    expect(boundaryWarned(err)).toBe(false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('guard: Lane 3 (full) + source changed + no executor dispatched → warns', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    touchSource(dir);
    engage(dir);
    stateWithLane(dir, 'big-mission', 'full');
    const { out, err } = hook(GUARD, dir, { session_id: 's1' });
    expect(boundaryWarned(err)).toBe(true);
    expect(err).toContain('big-mission');
    // warning, not a block — the dispatch half of the predicate is an inference
    expect(out).toBe('');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('guard: Lane 3 with an executor dispatched → silent', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    touchSource(dir);
    engage(dir);
    dispatchExecutor(dir);
    stateWithLane(dir, 'big-mission', 'full');
    const { out, err } = hook(GUARD, dir, { session_id: 's1' });
    expect(out).toBe('');
    expect(boundaryWarned(err)).toBe(false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('guard: a dispatch from another session does not excuse this one', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    touchSource(dir);
    engage(dir, 's-old');
    dispatchExecutor(dir, 's-old');
    engage(dir, 's1');
    stateWithLane(dir, 'big-mission', 'full');
    expect(boundaryWarned(hook(GUARD, dir, { session_id: 's1' }).err)).toBe(true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('guard: boundary check respects enforce=off and stop_hook_active', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    touchSource(dir);
    engage(dir);
    stateWithLane(dir, 'big-mission', 'full');
    expect(boundaryWarned(hook(GUARD, dir, { session_id: 's1', stop_hook_active: true }).err)).toBe(false);
    writeFileSync(join(dir, '.mugiwara', 'config'), 'enforce=off\n');
    expect(boundaryWarned(hook(GUARD, dir, { session_id: 's1' }).err)).toBe(false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('guard: an absent lane is check 1 territory, never a Lane 0 exemption', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    touchSource(dir);
    engage(dir);
    // mission on disk but no lane field — malformed, so check 2 has no opinion
    // and must not treat it as `direct`. Check 1 is satisfied (mission exists),
    // so the turn is not blocked; the honest outcome is silence, not a guess.
    const d = join(dir, '.mugiwara', 'missions', 'weird');
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, 'state.json'), JSON.stringify({ mission: 'weird' }) + '\n');
    const { out, err } = hook(GUARD, dir, { session_id: 's1' });
    expect(out).toBe('');
    expect(boundaryWarned(err)).toBe(false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('marker: a non-executor subagent does not record a dispatch', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    touchSource(dir);
    hook(MARKER, dir, { tool_name: 'Task', tool_input: { subagent_type: 'mugiwara:nami-planner' }, session_id: 's1' });
    stateWithLane(dir, 'big-mission', 'full');
    expect(boundaryWarned(hook(GUARD, dir, { session_id: 's1' }).err)).toBe(true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ---------- check 3: the plan boundary (escape #2 — only Nami writes the plan) ----------

const planWarned = (err: string): boolean => err.includes('planner (nami-planner) was not started');

const touchPlan = (dir: string): void => {
  mkdirSync(join(dir, '.mugiwara', 'plans'), { recursive: true });
  mkdirSync(join(dir, '.mugiwara', 'missions', 'test-mission'), { recursive: true });
  writeFileSync(join(dir, '.mugiwara', 'missions', 'test-mission', 'plan.md'), '# Plan\n');
};

const dispatchPlanner = (dir: string, sessionId = 's1'): void => {
  hook(MARKER, dir, { tool_name: 'Task', tool_input: { subagent_type: 'mugiwara:nami-planner' }, session_id: sessionId });
};

test('guard: plan written + no planner dispatched → warns (escape #2 closed)', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    engage(dir);
    touchPlan(dir);
    stateWithLane(dir, 'test-mission', 'full');
    const { out, err } = hook(GUARD, dir, { session_id: 's1' });
    expect(planWarned(err)).toBe(true);
    expect(out).toBe(''); // warn, not block
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('guard: plan written + Nami dispatched → silent', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    engage(dir);
    dispatchPlanner(dir);
    touchPlan(dir);
    stateWithLane(dir, 'test-mission', 'full');
    const { out, err } = hook(GUARD, dir, { session_id: 's1' });
    expect(planWarned(err)).toBe(false);
    expect(out).toBe('');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('guard: no plan touched → silent even with no planner', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    engage(dir);
    stateWithLane(dir, 'test-mission', 'full');
    const { out, err } = hook(GUARD, dir, { session_id: 's1' });
    expect(planWarned(err)).toBe(false);
    expect(out).toBe('');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('guard: Lane 0 (direct) + no plan doc → silent (Lane 0 has no plan doc)', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    engage(dir);
    stateWithLane(dir, 'test-mission', 'direct');
    const { out, err } = hook(GUARD, dir, { session_id: 's1' });
    expect(planWarned(err)).toBe(false);
    expect(out).toBe('');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('guard: plan guard respects enforce=off and stop_hook_active', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    engage(dir);
    touchPlan(dir);
    stateWithLane(dir, 'test-mission', 'full');
    expect(planWarned(hook(GUARD, dir, { session_id: 's1', stop_hook_active: true }).err)).toBe(false);
    writeFileSync(join(dir, '.mugiwara', 'config'), 'enforce=off\n');
    expect(planWarned(hook(GUARD, dir, { session_id: 's1' }).err)).toBe(false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('marker: a planner dispatch records planner_dispatched_at, not executor', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    hook(MARKER, dir, { tool_name: 'Task', tool_input: { subagent_type: 'mugiwara:nami-planner' }, session_id: 's1' });
    const marker = JSON.parse(readFileSync(join(dir, '.mugiwara', '.engaged'), 'utf8'));
    expect(marker.planner_dispatched_at).toBeTruthy();
    expect(marker.executor_dispatched_at).toBeFalsy();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('marker: fresh repo without .mugiwara gets default config, not just .engaged', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    rmSync(join(dir, '.mugiwara'), { recursive: true, force: true });
    engage(dir);
    expect(existsSync(join(dir, '.mugiwara', '.engaged'))).toBe(true);
    const config = join(dir, '.mugiwara', 'config');
    expect(existsSync(config)).toBe(true);
    expect(readFileSync(config, 'utf8')).toContain('mode=');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('marker: existing custom config is never overwritten', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    writeFileSync(join(dir, '.mugiwara', 'config'), 'mode=semi\n');
    engage(dir);
    expect(readFileSync(join(dir, '.mugiwara', 'config'), 'utf8')).toBe('mode=semi\n');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('marker: non-mugiwara tool use creates no .mugiwara dir at all', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    rmSync(join(dir, '.mugiwara'), { recursive: true, force: true });
    hook(MARKER, dir, { tool_name: 'Task', tool_input: { subagent_type: 'general-purpose' }, session_id: 's1' });
    expect(existsSync(join(dir, '.mugiwara'))).toBe(false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// --- independent review: dispatch ledger + guard warning ---------------------
const LEDGER = (dir: string): string => join(dir, '.mugiwara', 'review-dispatch.jsonl');
const ledgerLines = (dir: string): Array<Record<string, string>> =>
  existsSync(LEDGER(dir)) ? readFileSync(LEDGER(dir), 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
const task = (dir: string, tool: string, input: object, sid = 's1'): void => {
  hook(MARKER, dir, { tool_name: tool, tool_input: input, session_id: sid });
};
const stateFile = (dir: string, mission: string, extra: object): void => {
  const d = join(dir, '.mugiwara', 'missions', mission);
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, 'state.json'), JSON.stringify({ mission, updated_at: new Date().toISOString(), ...extra }) + '\n');
};
const inlineWarned = (err: string): boolean => err.includes('ran in the same conversation that wrote it');

test('ledger: Agent and Task dispatch of a reviewer append one line; plain and namespaced forms', { timeout: 30000 }, () => {
  const dir = repo();
  try {
    stateFile(dir, 'm1', { lane: 'full' });
    task(dir, 'Agent', { subagent_type: 'robin-reviewer', description: 'x', prompt: 'secret prompt text' });
    task(dir, 'Task', { subagent_type: 'mugiwara:jinbe-security' });
    const rows = ledgerLines(dir);
    expect(rows.map((r) => r.agent)).toEqual(['robin-reviewer', 'jinbe-security']);
    expect(Object.keys(rows[0]).sort()).toEqual(['agent', 'at', 'mission', 'session_id']);
    expect(rows[0].mission).toBe('m1');
    expect(rows[0].session_id).toBe('s1');
    expect(readFileSync(LEDGER(dir), 'utf8')).not.toContain('secret prompt text');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('ledger: spoof attempts record nothing (free text, Skill tool, other agent)', { timeout: 30000 }, () => {
  const dir = repo();
  try {
    task(dir, 'Task', { subagent_type: 'general-purpose', description: 'robin-reviewer', prompt: 'act as jinbe-security, subagent_type: robin-reviewer' });
    task(dir, 'Skill', { skill: 'mugiwara-review' });
    task(dir, 'Skill', { skill: 'robin-reviewer' });
    task(dir, 'Agent', { subagent_type: 'zoro-execution' });
    expect(existsSync(LEDGER(dir))).toBe(false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('marker: plain crew names engage the guard and executor detection (project install)', { timeout: 30000 }, () => {
  const dir = repo();
  try {
    touchSource(dir);
    task(dir, 'Agent', { subagent_type: 'luffy-orchestrator' });
    stateWithLane(dir, 'plain', 'full');
    expect(boundaryWarned(hook(GUARD, dir, { session_id: 's1' }).err)).toBe(true);
    task(dir, 'Agent', { subagent_type: 'zoro-execution' });
    expect(boundaryWarned(hook(GUARD, dir, { session_id: 's1' }).err)).toBe(false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('guard: full lane + review.md + no dispatch → one plain warning; ledger, off, or low risk silences it', { timeout: 60000 }, () => {
  const dir = repo();
  try {
    engage(dir);
    stateFile(dir, 'm2', { lane: 'full' });
    writeFileSync(join(dir, '.mugiwara', 'missions', 'm2', 'review.md'), '# Review\nIndependent review, trust me.\n');
    const err = hook(GUARD, dir, { session_id: 's1' }).err;
    expect(inlineWarned(err)).toBe(true);
    expect(err).not.toMatch(/\b(Flow|lane|savepoint|posture)\b/i);
    // another mission's dispatch does not count
    writeFileSync(LEDGER(dir), JSON.stringify({ agent: 'robin-reviewer', at: new Date().toISOString(), session_id: 's1', mission: 'other' }) + '\n');
    expect(inlineWarned(hook(GUARD, dir, { session_id: 's1' }).err)).toBe(true);
    // independent_review=off
    writeFileSync(join(dir, '.mugiwara', 'config'), 'enforce=warn\nindependent_review=off\n');
    expect(inlineWarned(hook(GUARD, dir, { session_id: 's1' }).err)).toBe(false);
    writeFileSync(join(dir, '.mugiwara', 'config'), 'enforce=warn\n');
    // enforce=off
    writeFileSync(join(dir, '.mugiwara', 'config'), 'enforce=off\n');
    expect(inlineWarned(hook(GUARD, dir, { session_id: 's1' }).err)).toBe(false);
    writeFileSync(join(dir, '.mugiwara', 'config'), 'enforce=warn\n');
    // matching dispatch
    writeFileSync(LEDGER(dir), JSON.stringify({ agent: 'robin-reviewer', at: new Date().toISOString(), session_id: 's1', mission: 'm2' }) + '\n');
    expect(inlineWarned(hook(GUARD, dir, { session_id: 's1' }).err)).toBe(false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('guard: sensitive paths trigger it; a lean mission without them does not; no review file does not', { timeout: 60000 }, () => {
  const dir = repo();
  try {
    engage(dir);
    stateFile(dir, 'm3', { lane: 'lean', sensitive_paths: ['auth/login.ts'] });
    expect(inlineWarned(hook(GUARD, dir, { session_id: 's1' }).err)).toBe(false); // no review.md yet
    writeFileSync(join(dir, '.mugiwara', 'missions', 'm3', 'security.md'), '# Security\nok\n');
    expect(inlineWarned(hook(GUARD, dir, { session_id: 's1' }).err)).toBe(true);
    stateFile(dir, 'm3', { lane: 'lean', sensitive_paths: [] });
    expect(inlineWarned(hook(GUARD, dir, { session_id: 's1' }).err)).toBe(false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// --- explicit /mugiwara sessions ----------------------------------------------
const TRACKER = join(ROOT, 'hooks', 'mugiwara-mode-tracker.js');
const say = (dir: string, prompt: string, sid = 's1'): void => { hook(TRACKER, dir, { prompt, session_id: sid }); };
const marker = (dir: string): Record<string, unknown> => JSON.parse(readFileSync(join(dir, '.mugiwara', '.engaged'), 'utf8'));
const touchRisky = (dir: string): void => {
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(join(dir, 'src', 'rbac.js'), 'export const can = (r) => r === "admin";\n');
};
const explicitBlocked = (out: string): boolean => blocked(out) && out.includes('requested with /mugiwara');
const warnRepo = (): string => { const d = repo(); writeFileSync(join(d, '.mugiwara', 'config'), 'enforce=warn\n'); return d; };

test('tracker: explicit marker for a free-text request only', { timeout: 60000 }, () => {
  for (const [prompt, expected] of [
    ['/mugiwara add rbac', true], ['/mugiwara:mugiwara add rbac', true],
    ['/mugiwara status', false], ['/mugiwara auto', false], ['/mugiwara', false],
    ['/mugiwara-review x', false], ['/mugiwara-security x', false], ['hello', false],
  ] as Array<[string, boolean]>) {
    const dir = repo();
    try {
      say(dir, prompt);
      const has = existsSync(join(dir, '.mugiwara', '.engaged')) && typeof marker(dir).explicit_crew_at === 'string';
      expect([prompt, has]).toEqual([prompt, expected]);
      if (expected) expect(marker(dir).session_id).toBe('s1');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

test('tracker: a risky explicit request gets a full-process reminder, a small one does not', { timeout: 60000 }, () => {
  const dir = repo();
  try {
    const risky = hook(TRACKER, dir, { prompt: '/mugiwara add refunds for payments', session_id: 's1' }).out;
    expect(risky).toContain('additionalContext');
    expect(risky).toContain('full process');
    expect(hook(TRACKER, dir, { prompt: '/mugiwara add a csv parser', session_id: 's1' }).out).not.toContain('additionalContext');
    expect(hook(TRACKER, dir, { prompt: 'refund the order', session_id: 's1' }).out).not.toContain('additionalContext');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('marker writers preserve each other\'s fields; a new session starts fresh', { timeout: 60000 }, () => {
  const dir = repo();
  try {
    say(dir, '/mugiwara add rbac');
    task(dir, 'Agent', { subagent_type: 'zoro-execution' });
    let m = marker(dir);
    expect(typeof m.explicit_crew_at).toBe('string');
    expect(typeof m.executor_dispatched_at === 'string' && m.executor_dispatched_at).toBeTruthy();
    // tracker after marker keeps the dispatch fact
    writeFileSync(join(dir, '.mugiwara', '.engaged'), JSON.stringify({ ...m, explicit_blocks: 1, custom: 'keep' }));
    say(dir, '/mugiwara add more');
    m = marker(dir);
    expect(m.executor_dispatched_at).toBeTruthy();
    expect(m.explicit_blocks).toBe(1);
    expect(m.custom).toBe('keep');
    // marker after tracker keeps explicit fields
    task(dir, 'Agent', { subagent_type: 'nami-planner' });
    m = marker(dir);
    expect(typeof m.explicit_crew_at).toBe('string');
    expect(m.explicit_blocks).toBe(1);
    expect(m.custom).toBe('keep');
    // another session: nothing carries over
    task(dir, 'Agent', { subagent_type: 'sanji-quality' }, 's2');
    m = marker(dir);
    expect(m.explicit_crew_at).toBeUndefined();
    expect(m.explicit_blocks).toBeUndefined();
    expect(m.executor_dispatched_at).toBe('');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('explicit: risky change + no triage → blocks (default enforce), plain message, counts the continuation', { timeout: 60000 }, () => {
  const dir = warnRepo();
  try {
    say(dir, '/mugiwara add role-based access control');
    touchRisky(dir);
    const { out, err } = hook(GUARD, dir, { session_id: 's1', hook_event_name: 'Stop' });
    expect(explicitBlocked(out)).toBe(true);
    const reason = JSON.parse(out).reason as string;
    expect(reason).toContain('src/rbac.js');
    expect(reason).not.toMatch(/\b(Flow|lane|savepoint|posture|dispatch)/i);
    expect(reason.split(/(?<=\.)\s/).length).toBe(2); // two sentences: what is wrong + the one thing to do
    expect(err).toBe('');
    expect(readFileSync(join(dir, '.mugiwara', '.forced-continuations'), 'utf8').trim()).toBe('1');
    expect(marker(dir).explicit_blocks).toBe(1);
    // SubagentStop is not affected
    expect(blocked(hook(GUARD, dir, { session_id: 's1', hook_event_name: 'SubagentStop' }).out)).toBe(false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('explicit: small change (direct) never blocks; enforce=off is silent; non-explicit unchanged', { timeout: 60000 }, () => {
  const dir = warnRepo();
  try {
    say(dir, '/mugiwara fix typo');
    touchSource(dir);
    expect(explicitBlocked(hook(GUARD, dir, { session_id: 's1' }).out)).toBe(false);
    touchRisky(dir);
    writeFileSync(join(dir, '.mugiwara', 'config'), 'enforce=off\n');
    const r = hook(GUARD, dir, { session_id: 's1' });
    expect(r.out + r.err).toBe('');
  } finally { rmSync(dir, { recursive: true, force: true }); }
  const dir2 = warnRepo();
  try {
    engage(dir2); // implicit engagement, not /mugiwara
    touchRisky(dir2);
    expect(explicitBlocked(hook(GUARD, dir2, { session_id: 's1' }).out)).toBe(false);
  } finally { rmSync(dir2, { recursive: true, force: true }); }
});

test('explicit: mission exists, full lane — missing review blocks; independent review required unless off', { timeout: 90000 }, () => {
  const dir = warnRepo();
  try {
    say(dir, '/mugiwara add rbac');
    touchRisky(dir);
    stateFile(dir, 'm9', { lane: 'full', sensitive_paths: ['src/rbac.js'] });
    const md = join(dir, '.mugiwara', 'missions', 'm9');
    let out = hook(GUARD, dir, { session_id: 's1' }).out;
    expect(explicitBlocked(out)).toBe(true);
    expect(JSON.parse(out).reason).toContain('no review and no security check');
    writeFileSync(join(md, 'review.md'), '# Review\n');
    writeFileSync(join(md, 'security.md'), '# Security\n');
    out = hook(GUARD, dir, { session_id: 's1' }).out;
    expect(explicitBlocked(out)).toBe(true);
    expect(JSON.parse(out).reason).toContain('independent review');
    // third attempt: cap of 2 reached → degrades to a warning
    const r = hook(GUARD, dir, { session_id: 's1' });
    expect(blocked(r.out)).toBe(false);
    expect(r.err).toContain('independent review');
    expect(readFileSync(join(dir, '.mugiwara', '.forced-continuations'), 'utf8').trim()).toBe('2');
    // independent_review=off: only review.md and security.md are required; and a fresh counter
    writeFileSync(join(dir, '.mugiwara', 'config'), 'enforce=warn\nindependent_review=off\n');
    say(dir, '/mugiwara again', 's3');
    expect(explicitBlocked(hook(GUARD, dir, { session_id: 's3' }).out)).toBe(false);
    // on + ledger entry for this mission → allowed
    writeFileSync(join(dir, '.mugiwara', 'config'), 'enforce=warn\n');
    writeFileSync(LEDGER(dir), JSON.stringify({ agent: 'robin-reviewer', at: new Date().toISOString(), session_id: 's3', mission: 'm9' }) + '\n');
    expect(explicitBlocked(hook(GUARD, dir, { session_id: 's3' }).out)).toBe(false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('explicit: a mission archived this session (report.md, no state) is closure, never "no triage"', { timeout: 60000 }, () => {
  const dir = warnRepo();
  try {
    say(dir, '/mugiwara add rbac');
    touchRisky(dir);
    const d = join(dir, '.mugiwara', 'missions', 'rbac');
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, 'report.md'), '# Mission: rbac\n');
    expect(explicitBlocked(hook(GUARD, dir, { session_id: 's1' }).out)).toBe(false);
    // an old report from an earlier session does not excuse this session's untriaged work
    const old = new Date(Date.now() - 3 * 3600_000);
    require('node:fs').utimesSync(join(d, 'report.md'), old, old);
    expect(explicitBlocked(hook(GUARD, dir, { session_id: 's1' }).out)).toBe(true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('guard: missing-dispatch warning names the next step; closing files without report.md name the archive command', { timeout: 60000 }, () => {
  const dir = repo();
  try {
    engage(dir);
    stateFile(dir, 'm9', { lane: 'full' });
    const m = join(dir, '.mugiwara', 'missions', 'm9');
    writeFileSync(join(m, 'review.md'), '# Review\n');
    let err = hook(GUARD, dir, { session_id: 's1' }).err;
    expect(err).toContain('Robin (robin-reviewer) and Jinbe (jinbe-security) as separate agents for mission "m9"');
    expect(err).not.toContain('no report.md');
    mkdirSync(join(m, 'flows'), { recursive: true });
    writeFileSync(join(m, 'flows', '06-closure.md'), '# Closed\n');
    err = hook(GUARD, dir, { session_id: 's1' }).err;
    expect(err).toContain('Run `mugiwara archive m9` to write it.');
    writeFileSync(join(m, 'report.md'), '# Report\n');
    expect(hook(GUARD, dir, { session_id: 's1' }).err).not.toContain('mugiwara archive m9` to write');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('explicit: 5 plain source files (standard lane) are not held; 9 are', { timeout: 60000 }, () => {
  const dir = warnRepo();
  try {
    say(dir, '/mugiwara add a small feature');
    const many = (n: number): void => { for (let i = 0; i < n; i++) writeFileSync(join(dir, `f${i}.js`), `export const v${i} = ${i};\n`); };
    many(5);
    expect(explicitBlocked(hook(GUARD, dir, { session_id: 's1' }).out)).toBe(false);
    many(9);
    expect(explicitBlocked(hook(GUARD, dir, { session_id: 's1' }).out)).toBe(true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
