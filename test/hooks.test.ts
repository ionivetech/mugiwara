// test/hooks.test.ts — the enforcement surface test/enforcement.test.ts does NOT cover.
//
// enforcement.test.ts (22 cases) already pins the pipeline guard's source
// predicate, the write/plan boundaries, and the marker's planner facts. Every
// case here names the gap it closes; a case duplicating that file is a defect.
// Like that file, tests run the BUILT hooks/*.js — the wired artifact, never
// the .ts source.
import { test, expect } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const GUARD = join(ROOT, 'hooks', 'pipeline-guard.js');
const PRETOOL = join(ROOT, 'hooks', 'pretool-guard.js');
const MARKER = join(ROOT, 'hooks', 'engagement-marker.js');
const TRACKER = join(ROOT, 'hooks', 'mugiwara-mode-tracker.js');
const SAVEHOOK = join(ROOT, 'hooks', 'auto-savepoint.js');
const SAVEPOINT = join(ROOT, 'scripts', 'savepoint.sh');

function repo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-hooks-'));
  execFileSync('git', ['init', '-q', '.'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: dir });
  execFileSync('git', ['commit', '-q', '--allow-empty', '-m', 'init'], { cwd: dir });
  mkdirSync(join(dir, '.mugiwara'), { recursive: true });
  return dir;
}

/** Run a hook with a JSON payload on stdin; return stdout, stderr, exit code. */
function hook(script: string, cwd: string, payload: object): { out: string; err: string; status: number | null } {
  const r = spawnSync('node', [script], {
    cwd,
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
  });
  return { out: r.stdout ?? '', err: r.stderr ?? '', status: r.status };
}

const engage = (dir: string, sessionId = 's1'): void => {
  hook(MARKER, dir, { tool_name: 'Skill', tool_input: { skill: 'mugiwara-workflow' }, session_id: sessionId });
};
const bash = (dir: string, command: string): { out: string; err: string } => {
  const r = hook(PRETOOL, dir, { tool_name: 'Bash', tool_input: { command } });
  return { out: r.out, err: r.err };
};
const blocked = (out: string): boolean => out.includes('"decision":"block"');
const touchArtifact = (dir: string): void => {
  mkdirSync(join(dir, '.mugiwara', 'spec'), { recursive: true });
  writeFileSync(join(dir, '.mugiwara', 'spec', 'idea.md'), '# brainstorm output\n');
};

// ---------- gap E3: the guard fires on artifact work, not just source ----------

test('guard: source + artifacts, no triage → blocks naming artifacts', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    writeFileSync(join(dir, 'app.js'), 'code\n');
    touchArtifact(dir);
    engage(dir);
    const { out } = hook(GUARD, dir, { session_id: 's1' });
    expect(blocked(out)).toBe(true);
    expect(out).toContain('artifacts');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('guard: artifacts written, no source, no triage → blocks (E3 core)', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    touchArtifact(dir);
    engage(dir);
    const { out } = hook(GUARD, dir, { session_id: 's1' });
    expect(blocked(out)).toBe(true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('guard: engaged with no work at all → silent', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    engage(dir);
    const { out } = hook(GUARD, dir, { session_id: 's1' });
    expect(out).toBe('');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('guard: corrupt state.json + source → blocks (malformed is not triage)', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    writeFileSync(join(dir, 'app.js'), 'code\n');
    engage(dir);
    const d = join(dir, '.mugiwara', 'missions', 'broken');
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, 'state.json'), '{not json\n');
    const { out } = hook(GUARD, dir, { session_id: 's1' });
    expect(blocked(out)).toBe(true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('guard: corrupt .engaged marker → silent, exit 0 (fail open)', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    writeFileSync(join(dir, 'app.js'), 'code\n');
    writeFileSync(join(dir, '.mugiwara', '.engaged'), '{corrupt\n');
    const r = hook(GUARD, dir, { session_id: 's1' });
    expect(r.out).toBe('');
    expect(r.status).toBe(0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('guard: artifact violation under enforce=warn → warns, exit 0', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    touchArtifact(dir);
    engage(dir);
    writeFileSync(join(dir, '.mugiwara', 'config'), 'enforce=warn\n');
    const r = hook(GUARD, dir, { session_id: 's1' });
    expect(r.out).toBe('');
    expect(r.err).toContain('Mugiwara');
    expect(r.status).toBe(0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ---------- gap E4: the PreToolUse guard (no test file touched it before) ----------

test('pretool: gh pr create → denies, names the action and the human', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    const { out } = bash(dir, 'gh pr create --fill');
    expect(blocked(out)).toBe(true);
    expect(out).toContain('opening or merging a PR');
    expect(out).toContain('human');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('pretool: git push origin main → denies the protected branch', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    expect(blocked(bash(dir, 'git push origin main').out)).toBe(true);
    expect(blocked(bash(dir, 'git push origin master').out)).toBe(true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('pretool: git merge → denies', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    expect(blocked(bash(dir, 'git merge feat/x').out)).toBe(true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('pretool: feature-branch push stays allowed (over-correction guard)', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    // Blocking this would break the crew's own terminal step — the guard
    // would be disabled on day one. This case matters as much as the denies.
    expect(bash(dir, 'git push -u origin feature/MKR-412').out).toBe('');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('pretool: reads stay allowed (over-correction guard)', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    expect(bash(dir, 'terraform plan').out).toBe('');
    expect(bash(dir, 'gh pr view 42').out).toBe('');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('pretool: enforce=off allows everything, warn reports without blocking', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    writeFileSync(join(dir, '.mugiwara', 'config'), 'enforce=off\n');
    expect(bash(dir, 'gh pr create --fill').out).toBe('');
    writeFileSync(join(dir, '.mugiwara', 'config'), 'enforce=warn\n');
    const r = hook(PRETOOL, dir, { tool_name: 'Bash', tool_input: { command: 'terraform apply' } });
    expect(r.out).toBe('');
    expect(r.err).toContain('Mugiwara');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ---------- gap E7-rest: mode-tracker, auto-savepoint, executor fact ----------

test('savepoint hook: config mode=auto + plan, no state → state records auto', { timeout: 30000 }, () => {
  const dir = repo();
  try {
    writeFileSync(join(dir, '.mugiwara', 'config'), 'mode=auto\n');
    const d = join(dir, '.mugiwara', 'missions', 'm');
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, 'plan.md'), '# Plan\n');
    const r = hook(SAVEHOOK, dir, {});
    expect(r.status).toBe(0);
    const state = JSON.parse(readFileSync(join(d, 'state.json'), 'utf8'));
    expect(state.mode).toBe('auto');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('tracker: "mugiwara mode semi" in a turn → config updated', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    const r = hook(TRACKER, dir, { prompt: 'mugiwara mode semi' });
    expect(r.status).toBe(0);
    expect(readFileSync(join(dir, '.mugiwara', 'config'), 'utf8')).toContain('mode=semi');
    expect(existsSync(join(dir, '.mugiwara', 'missions'))).toBe(false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('marker: a zoro dispatch records the executor fact, not the planner one', { timeout: 20000 }, () => {
  const dir = repo();
  try {
    hook(MARKER, dir, { tool_name: 'Task', tool_input: { subagent_type: 'mugiwara:zoro-execution' }, session_id: 's1' });
    const marker = JSON.parse(readFileSync(join(dir, '.mugiwara', '.engaged'), 'utf8'));
    expect(marker.executor_dispatched_at).toBeTruthy();
    expect(marker.planner_dispatched_at).toBeFalsy();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
