import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest';

vi.setConfig({ testTimeout: 30000 });
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parsePolicyYaml, loadPolicy, globToRegExp, matchedGlobs } from '../src/policy.ts';
import { checkTrail, formatIssues } from '../src/integrity.ts';
import { buildRollback } from '../src/rollback.ts';
import { buildNote, renderProvenanceMd, blamePath } from '../src/provenance.ts';
import { scorePath, rankFiles, renderRouting } from '../src/routing.ts';
import { measureContextChars, formatFootprint, readBudgetConfig } from '../src/budget.ts';
import { signArgs, verifyArgs } from '../src/sign.ts';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mugiwara-closure-'));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('policy as code', () => {
  it('parses the documented schema', () => {
    const y = parsePolicyYaml(`
# comment
lanes:
  force_full:
    - "src/auth/**"
    - "**/migrations/**"
gates:
  coverage:
    new: 95
    modified: 85
  require_human_approval:
    - "src/payments/**"
`);
    const lanes = y.lanes as Record<string, unknown>;
    const gates = y.gates as Record<string, unknown>;
    const cov = gates.coverage as Record<string, unknown>;
    expect(lanes.force_full).toEqual(['src/auth/**', '**/migrations/**']);
    expect(cov.new).toBe(95);
    expect(cov.modified).toBe(85);
    expect((gates.require_human_approval as string[])[0]).toBe('src/payments/**');
  });

  it('loadPolicy returns null when absent and throws on unknown keys', () => {
    expect(loadPolicy(dir)).toBeNull();
    writeFileSync(join(dir, 'mugiwara.policy.yml'), 'lanez:\n  force_full: ["src/**"]');
    let threw = '';
    try { loadPolicy(dir); } catch (e) { threw = (e as Error).message; }
    expect(threw).toContain('unknown policy key "lanez"');
    rmSync(join(dir, 'mugiwara.policy.yml'));
  });

  it('glob semantics: ** crosses separators, * stays within one', () => {
    expect(globToRegExp('src/auth/**').test('src/auth/login.ts')).toBe(true);
    expect(globToRegExp('src/auth/**').test('src/auth/deep/x.ts')).toBe(true);
    expect(globToRegExp('src/*/x.ts').test('src/a/b/x.ts')).toBe(false);
    expect(globToRegExp('src/*/x.ts').test('src/a/x.ts')).toBe(true);
    expect(matchedGlobs(['src/auth/x.ts'], ['src/payments/**', 'src/auth/**'])).toEqual(['src/auth/**']);
    expect(matchedGlobs(['src/app.ts'], ['src/auth/**'])).toEqual([]);
  });
});

describe('closure integrity gate', () => {
  it('flags dangling links, secrets, missing evidence', () => {
    mkdirSync(join(dir, '.mugiwara'), { recursive: true });
    writeFileSync(join(dir, 'report.md'), 'see [plan](plan.md) and [ghost](missing.md)');
    writeFileSync(join(dir, 'plan.md'), 'the plan');
    writeFileSync(join(dir, 'state.json'), JSON.stringify({ evidence: ['waves/03-quality.md'] }));
    const issues = checkTrail(dir, dir);
    const kinds = issues.map((i) => i.kind).sort();
    expect(kinds).toEqual(['dangling-path', 'evidence']);

    writeFileSync(join(dir, 'notes.md'), 'token = ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456 ok');
    const withSecret = checkTrail(dir, dir);
    expect(withSecret.some((i) => i.kind === 'secret' && i.detail.includes('GitHub token'))).toBe(true);

    // the allow marker whitelists a deliberate example line
    writeFileSync(join(dir, 'notes.md'), 'token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456" <!-- mugiwara:allow-secret -->');
    expect(checkTrail(dir, dir).some((i) => i.kind === 'secret')).toBe(false);

    // clean trail passes silently
    writeFileSync(join(dir, 'report.md'), 'see [plan](plan.md)');
    writeFileSync(join(dir, 'waves.md'), '');
    writeFileSync(join(dir, 'state.json'), JSON.stringify({ evidence: [] }));
    rmSync(join(dir, 'notes.md'));
    expect(checkTrail(dir, dir)).toEqual([]);

    const text = formatIssues([{ kind: 'secret', detail: 'x' }]);
    expect(text).toContain('[secret] x');
  });

  it('resolves repo-root paths cited by the report', () => {
    writeFileSync(join(dir, 'report.md'), '[gate](src/auth/gate.md)');
    mkdirSync(join(dir, 'src', 'auth'), { recursive: true });
    writeFileSync(join(dir, 'src', 'auth', 'gate.md'), 'real');
    expect(checkTrail(dir, dir).filter((i) => i.kind === 'dangling-path')).toEqual([]);
  });

  it('evidence-thin: PASS-cited evidence without command output is flagged', () => {
    writeFileSync(join(dir, 'report.md'), 'Verdict: PASS see [evidence](flows/04-gates.md)');
    mkdirSync(join(dir, 'flows'), { recursive: true });
    writeFileSync(join(dir, 'flows', '04-gates.md'), 'all good, no commands');
    writeFileSync(join(dir, 'state.json'), JSON.stringify({ evidence: ['flows/04-gates.md'] }));
    expect(checkTrail(dir, dir).some((i) => i.kind === 'evidence-thin')).toBe(true);

    // with backticked command or status token it passes
    writeFileSync(join(dir, 'flows', '04-gates.md'), 'ran `bun run test` → 3 passed, exit 0');
    expect(checkTrail(dir, dir).some((i) => i.kind === 'evidence-thin')).toBe(false);
  });
});

describe('rollback map', () => {
  it('reverts newest-first and lists touched files', () => {
    const body = buildRollback(
      { mission: 'invite', branch: 'feat/invite', baseSha: 'abc1234' },
      ['c3', 'c2', 'c1'],
      ['src/a.ts', 'test/a.test.ts'],
    );
    expect(body).toContain('# Rollback map for mission "invite"');
    expect(body.indexOf('c3')).toBeGreaterThan(body.indexOf('c1')); // newest listed last in continuation args
    expect(body).toMatch(/git revert --no-edit \\\n  c3 \\\n  c2 \\\n  c1/);
    expect(body).toContain('#   src/a.ts');
    expect(body.startsWith('#!/usr/bin/env bash')).toBe(true);
  });

  it('empty range produces a no-op script', () => {
    const body = buildRollback({ mission: 'docs', branch: 'b', baseSha: 'x' }, [], []);
    expect(body).toContain('No commits between base and HEAD');
  });

  it('squash-merged state (empty range, non-empty diff) emits unresolved-squash guidance, not "nothing to revert"', () => {
    const body = buildRollback(
      { mission: 'invite', branch: 'feat/invite', baseSha: 'abc1234' },
      [],
      ['src/a.ts', 'src/b.ts'],
    );
    expect(body).not.toContain('nothing to revert');
    expect(body).toContain('UNRESOLVED');
    expect(body).toContain('squash');
    expect(body).toContain(`--grep="invite"`); // search key: mission name
    expect(body).toContain('git revert <squash-commit>');
    expect(body).toContain('#   src/a.ts');
    expect(body).toContain('exit 1'); // hard-fail, never fake success
  });
});

describe('provenance', () => {
  const state = {
    mission: 'invitation-accepted', actor: 'zoro <z@x>', lane: 'full', mode: 'auto',
    branch: 'feat/invite', tasks_done: 5, tasks_total: 5,
    evidence: ['waves/04-gates.md'],
  };
  it('note carries agent, model, lane, evidence, review-pending', () => {
    const note = buildNote(state);
    expect(note).toContain('mission: invitation-accepted');
    expect(note).toContain('agent: zoro <z@x>');
    expect(note).toContain('lane full');
    expect(note).toContain('gates/evidence: waves/04-gates.md');
    expect(note).toContain('human review: pending');
    expect(note).toContain('tasks: 5/5');
  });
  it('md wrapper is PR-ready and honest about a missing sha', () => {
    const md = renderProvenanceMd(buildNote(state), null);
    expect(md).toContain('Commit: not recorded');
    expect(md).toContain('```');
  });
  it('note lists unique models when flow history records a switch', () => {
    const note = buildNote({ ...state, models: ['claude-x', 'fallback-y', 'claude-x'] });
    expect(note).toContain('model(s): claude-x, fallback-y');
    expect(note).not.toMatch(/· claude-x ·/); // single-env snapshot wording gone
  });
  it('no recorded models keeps the env-fallback wording', () => {
    const note = buildNote({ ...state, model: 'solo-model' });
    expect(note).toMatch(/· solo-model · lane full ·/);
  });
  it('blame degrades without git or notes', () => {
    expect(blamePath('/nonexistent-repo', 'x.ts')).toContain('not a git repository');
  });
});

describe('review routing', () => {
  const base = { mission: 'm', sensitive_paths: [] as string[], evidence: [] as string[] };
  it('sensitive > production > tests > docs; evidence gap bumps', () => {
    const ranked = rankFiles(
      ['README.md', 'src/auth/x.ts', 'src/auth/x.test.ts', 'src/payments/charge.ts'],
      { ...base, sensitive_paths: ['src/payments/**'] },
    );
    expect(ranked[0].path).toBe('src/payments/charge.ts');
    expect(ranked[0].reasons).toContain('sensitive path');
    expect(ranked[1].path).toBe('src/auth/x.ts');
    expect(ranked[3].path).toBe('README.md');
  });
  it('files absent from evidence get the bump', () => {
    const s = scorePath('src/new.ts', [], 'evidence mentions src/old.ts src/new.ts');
    const s2 = scorePath('src/unmentioned.ts', [], 'evidence mentions src/old.ts src/new.ts');
    expect(s2.score).toBeGreaterThan(s.score);
  });
  it('renders an ordered markdown section', () => {
    const md = renderRouting(rankFiles(['a.ts'], base), 'm');
    expect(md).toContain('## Review routing');
    expect(md).toContain('1. `a.ts`');
    expect(md).toContain('heuristic');
  });
});

describe('context budget', () => {
  it('measures md + flows bytes, legacy waves included', () => {
    writeFileSync(join(dir, 'report.md'), 'x'.repeat(10));
    mkdirSync(join(dir, 'flows'));
    mkdirSync(join(dir, 'waves'));
    writeFileSync(join(dir, 'flows', '01.md'), 'y'.repeat(5));
    writeFileSync(join(dir, 'waves', 'old.md'), 'z'.repeat(3));
    expect(measureContextChars(dir)).toBe(18);
  });
  it('format states over-budget plainly', () => {
    expect(formatFootprint(10, 0)).toContain('no budget configured');
    expect(formatFootprint(20, 10)).toContain('OVER budget 10');
    expect(formatFootprint(5, 10)).toContain('(budget 10)');
  });
  it('config unset = 0 (recorded, never enforced)', () => {
    expect(readBudgetConfig(dir)).toBe(0);
  });
});

describe('sign arg builders', () => {
  it('sign embeds secret key; verify omits -p without pubkey', () => {
    expect(signArgs('/r/report.md', '/k')).toEqual(['-Sm', '/r/report.md', '-s', '/k']);
    expect(verifyArgs('/r/report.md', null)).toEqual(['-Vm', '/r/report.md']);
    expect(verifyArgs('/r/report.md', '/pub')).toEqual(['-Vm', '/r/report.md', '-p', '/pub']);
  });
});
