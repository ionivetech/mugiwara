// test/enforcement.test.ts — the pipeline guard's predicate, exercised through
// the BUILT hooks/*.js with synthetic payloads.
//
// Testing the built artifact, not the TypeScript source, is deliberate:
// hooks.json wires the .js files, and those files were untracked and stale for
// a whole release without anything noticing. A test against the .ts would have
// stayed green through exactly that failure.
import { test, expect } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const GUARD = join(ROOT, 'hooks', 'pipeline-guard.js');
const MARKER = join(ROOT, 'hooks', 'engagement-marker.js');
const SAVEPOINT = join(ROOT, 'scripts', 'savepoint.sh');

function repo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-enforce-'));
  execFileSync('git', ['init', '-q', '.'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: dir });
  execFileSync('git', ['commit', '-q', '--allow-empty', '-m', 'init'], { cwd: dir });
  mkdirSync(join(dir, '.mugiwara'), { recursive: true });
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
  hook(MARKER, dir, { tool_name: 'Skill', tool_input: { skill: 'mugiwara-plan' }, session_id: sessionId });
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
    expect(out).toContain('savepoint');
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
    expect(existsSync(join(dir, '.mugiwara', 'state', 'trivial-fix'))).toBe(true);
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

test('guard: unknown enforce value falls back to block, never to off', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    touchSource(dir);
    engage(dir);
    // a typo must not silently disarm the fence
    writeFileSync(join(dir, '.mugiwara', 'config'), 'enforce=blok\n');
    const r = hook(GUARD, dir, { session_id: 's1' });
    expect(blocked(r.out)).toBe(true);
    expect(r.err).toContain('unknown enforce');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('marker: only mugiwara tool use counts as engagement', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    hook(MARKER, dir, { tool_name: 'Task', tool_input: { subagent_type: 'general-purpose' }, session_id: 's1' });
    expect(existsSync(join(dir, '.mugiwara', 'state', '.engaged'))).toBe(false);

    hook(MARKER, dir, { tool_name: 'Task', tool_input: { subagent_type: 'mugiwara:zoro-execution' }, session_id: 's1' });
    expect(existsSync(join(dir, '.mugiwara', 'state', '.engaged'))).toBe(true);
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
