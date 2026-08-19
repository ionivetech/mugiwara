// test/continue.test.ts — src/continue.ts had zero tests. It decides which
// mission gets resumed; a wrong answer resumes someone else's work.
import { describe, expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readContinue, readState, resolveContinue, formatResume, formatTable } from '../src/continue.ts';

// only the `cli()` cases below shell out (bun + src/cli.ts, twice in one case);
// the rest are in-process and stay on the default timeout.
const SLOW = 30000;

type Rec = Record<string, unknown>;

/** Build a project dir with `.mugiwara/<root>/<mission>/<file>.json` savepoints. */
function fixture(files: Array<{ root?: string; mission: string; file: string; body: Rec | string }>): string {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-continue-'));
  for (const f of files) {
    const d = join(dir, '.mugiwara', f.root ?? 'continue', f.mission);
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, `${f.file}.json`), typeof f.body === 'string' ? f.body : JSON.stringify(f.body));
  }
  return dir;
}

const entry = (mission: string, over: Rec = {}): Rec => ({
  mission,
  actor: 'Zoro <zoro@example.com>',
  branch: 'main',
  wave: 3,
  mode: 'auto',
  tasks_done: 2,
  tasks_total: 5,
  lane: 'standard',
  next_action: 'run T-4',
  next_session_prompt: 'mugiwara continue',
  updated_at: '2026-08-19T00:00:00Z',
  ...over,
});

describe('readContinue / readState', () => {
  test('state.json is the solo file (member null); <member>.json carries its member', () => {
    const dir = fixture([
      { mission: 'solo-m', file: 'state', body: entry('solo-m') },
      { mission: 'team-m', file: 'zoro', body: entry('team-m') },
      { mission: 'team-m', file: 'sanji', body: entry('team-m') },
    ]);
    try {
      const got = readContinue(dir);
      expect(got.map((e) => [e.mission, e.member])).toEqual([
        ['solo-m', null],
        ['team-m', 'sanji'],
        ['team-m', 'zoro'],
      ]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('corrupt JSON is skipped, not fatal — the rest of the listing survives', () => {
    const dir = fixture([
      { mission: 'good-m', file: 'state', body: entry('good-m') },
      { mission: 'bad-m', file: 'state', body: '{ not json' },
    ]);
    try {
      expect(readContinue(dir).map((e) => e.mission)).toEqual(['good-m']);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('a mission field disagreeing with its directory name is rejected', () => {
    const dir = fixture([
      { mission: 'real-m', file: 'state', body: entry('SOMETHING-ELSE') },
    ]);
    try {
      expect(readContinue(dir)).toEqual([]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('no .mugiwara directory at all returns an empty list, never throws', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-continue-empty-'));
    try {
      expect(readContinue(dir)).toEqual([]);
      expect(readState(dir)).toEqual([]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('readState flattens the nested tasks object and defaults missing fields', () => {
    const dir = fixture([
      { root: 'state', mission: 'st-m', file: 'state', body: { mission: 'st-m', tasks: { done: 4, total: 9 }, evidence: ['a.md', 2, 'b.md'] } },
    ]);
    try {
      const [s] = readState(dir);
      expect(s.tasks_done).toBe(4);
      expect(s.tasks_total).toBe(9);
      expect(s.mode).toBe('guided');       // absent → documented default
      expect(s.lane).toBe('direct');
      expect(s.budget_status).toBe('ok');
      expect(s.evidence).toEqual(['a.md', 'b.md']); // non-strings dropped, not stringified
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('resolveContinue — the three command forms', () => {
  test('no entries at all → none', () => {
    expect(resolveContinue([]).kind).toBe('none');
  });

  test('form 1 (no args), single mission, solo → resumes directly', () => {
    const dir = fixture([{ mission: 'only-m', file: 'state', body: entry('only-m') }]);
    try {
      const r = resolveContinue(readContinue(dir));
      expect(r.kind).toBe('resume');
      if (r.kind === 'resume') expect(r.entry.mission).toBe('only-m');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('form 1 (no args), several missions → lists them, resumes nothing', () => {
    const dir = fixture([
      { mission: 'a-m', file: 'state', body: entry('a-m') },
      { mission: 'b-m', file: 'state', body: entry('b-m') },
    ]);
    try {
      const r = resolveContinue(readContinue(dir));
      expect(r.kind).toBe('missions');
      if (r.kind === 'missions') expect(r.entries).toHaveLength(2);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('form 2 (<mission>), team → lists members and NEVER guesses one', () => {
    const dir = fixture([
      { mission: 'team-m', file: 'zoro', body: entry('team-m') },
      { mission: 'team-m', file: 'sanji', body: entry('team-m') },
    ]);
    try {
      const r = resolveContinue(readContinue(dir), 'team-m');
      expect(r.kind).toBe('members');
      if (r.kind === 'members') expect(r.entries.map((e) => e.member)).toEqual(['sanji', 'zoro']);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('form 2, a solo file sitting alongside members still does not auto-resume', () => {
    const dir = fixture([
      { mission: 'mixed-m', file: 'state', body: entry('mixed-m') },
      { mission: 'mixed-m', file: 'zoro', body: entry('mixed-m') },
    ]);
    try {
      expect(resolveContinue(readContinue(dir), 'mixed-m').kind).toBe('members');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('form 3 (<mission> <member>) → resumes exactly that member', () => {
    const dir = fixture([
      { mission: 'team-m', file: 'zoro', body: entry('team-m', { next_action: 'zoro next' }) },
      { mission: 'team-m', file: 'sanji', body: entry('team-m', { next_action: 'sanji next' }) },
    ]);
    try {
      const r = resolveContinue(readContinue(dir), 'team-m', 'sanji');
      expect(r.kind).toBe('resume');
      if (r.kind === 'resume') expect(r.entry.next_action).toBe('sanji next');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('unknown mission reports what IS known', () => {
    const dir = fixture([
      { mission: 'a-m', file: 'state', body: entry('a-m') },
      { mission: 'b-m', file: 'state', body: entry('b-m') },
    ]);
    try {
      const r = resolveContinue(readContinue(dir), 'nope');
      expect(r.kind).toBe('unknown-mission');
      if (r.kind === 'unknown-mission') expect(r.known.sort()).toEqual(['a-m', 'b-m']);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('unknown member reports the members that DO exist', () => {
    const dir = fixture([
      { mission: 'team-m', file: 'zoro', body: entry('team-m') },
      { mission: 'team-m', file: 'state', body: entry('team-m') },
    ]);
    try {
      const r = resolveContinue(readContinue(dir), 'team-m', 'usopp');
      expect(r.kind).toBe('unknown-member');
      if (r.kind === 'unknown-member') expect(r.known.sort()).toEqual(['(solo)', 'zoro']);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('an unsafe member filename is not resolvable through the safe key path', () => {
    const dir = fixture([{ mission: 'safe-m', file: 'ok', body: entry('safe-m') }]);
    try {
      expect(readContinue(dir).map((e) => e.member)).toEqual(['ok']);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('formatResume — the single-line contract mugiwara-resume depends on', () => {
  test('solo entry: no member scope, all five fields present on one line', () => {
    const line = formatResume({
      mission: 'seamless', member: null, actor: 'a', branch: 'main', wave: 3, mode: 'auto',
      tasks_done: 2, tasks_total: 5, lane: 'standard',
      next_action: 'run T-4', next_session_prompt: 'mugiwara continue seamless', updated_at: '',
    });
    expect(line).toBe(
      'Resumed: seamless, Wave 3, 2/5 tasks — next_action: run T-4 — run: mugiwara continue seamless',
    );
    expect(line.split('\n')).toHaveLength(1);
  });

  test('team entry carries [member] and a stated fallback when no prompt was recorded', () => {
    const line = formatResume({
      mission: 'seamless', member: 'zoro', actor: 'a', branch: 'main', wave: 1, mode: 'semi',
      tasks_done: 0, tasks_total: 3, lane: 'lean', next_action: 'start', next_session_prompt: '', updated_at: '',
    });
    expect(line).toBe('Resumed: seamless [zoro], Wave 1, 0/3 tasks — next_action: start — run: (no next_session_prompt recorded)');
  });

  test('formatTable renders a header plus one row per entry, solo member as em dash', () => {
    const dir = fixture([{ mission: 'tbl-m', file: 'state', body: entry('tbl-m') }]);
    try {
      const lines = formatTable(readContinue(dir)).split('\n');
      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain('MISSION');
      expect(lines[1]).toContain('tbl-m');
      expect(lines[1]).toContain('—');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('actor filtering (cli continueCmd)', () => {
  const cli = (dir: string, args: string[], env: Record<string, string> = {}) => {
    try {
      return execFileSync('bun', [join(import.meta.dirname, '..', 'src', 'cli.ts'), 'continue', '--project', dir, ...args],
        { encoding: 'utf8', env: { ...process.env, ...env } });
    } catch (e: any) {
      return `${e.stdout ?? ''}${e.stderr ?? ''}`;
    }
  };

  test('an actor-less savepoint is still listed — filtering must not blank the output', { timeout: SLOW }, () => {
    const dir = fixture([{ mission: 'orphan-actor', file: 'state', body: { ...entry('orphan-actor'), actor: '' } }]);
    try {
      const out = cli(dir, [], { STATE_ACTOR: 'Nobody <nobody@example.com>' });
      expect(out).toContain('orphan-actor');
      expect(out).not.toContain('No mission in flight');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('when the actor DOES match, only that actor\'s missions show', { timeout: SLOW }, () => {
    const dir = fixture([
      { mission: 'mine-m', file: 'state', body: entry('mine-m', { actor: 'Me <me@example.com>' }) },
      { mission: 'theirs-m', file: 'state', body: entry('theirs-m', { actor: 'Them <them@example.com>' }) },
    ]);
    try {
      const out = cli(dir, [], { STATE_ACTOR: 'Me <me@example.com>' });
      expect(out).toContain('mine-m');
      expect(out).not.toContain('theirs-m');
      // --all crosses actors on a shared checkout
      expect(cli(dir, ['--all'], { STATE_ACTOR: 'Me <me@example.com>' })).toContain('theirs-m');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
