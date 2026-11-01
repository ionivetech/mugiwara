// Fault injection for corrupt mission state: the commands must name the bad
// file, print the exact fix and exit non-zero, never a stack trace.
import { describe, test, expect, afterEach } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cap } from './helpers/cli-capture.ts';
import { inspectMissions, formatProblems } from '../src/state-health.ts';

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

function repo(): string {
  const d = mkdtempSync(join(tmpdir(), 'mugi-corrupt-'));
  dirs.push(d);
  mkdirSync(join(d, '.mugiwara', 'missions', 'm1'), { recursive: true });
  return d;
}
const put = (d: string, name: string, body: string): void => writeFileSync(join(d, '.mugiwara', 'missions', 'm1', name), body);
const good = JSON.stringify({ mission: 'm1', flow: 3, tasks: { done: 1, total: 2 } });

describe('inspectMissions', () => {
  test('sound state is clean', () => {
    const d = repo(); put(d, 'state.json', good); put(d, 'continue.json', good);
    expect(inspectMissions(d)).toEqual([]);
  });
  test('no .mugiwara/missions is clean', () => {
    expect(inspectMissions(mkdtempSync(join(tmpdir(), 'mugi-none-')))).toEqual([]);
  });
  test('truncated JSON names the file and the fix', () => {
    const d = repo(); put(d, 'state.json', '{"mission":"m1","flo');
    const [p] = inspectMissions(d);
    expect(p.file).toBe(join('.mugiwara', 'missions', 'm1', 'state.json'));
    expect(p.problem).toBe('not valid JSON (truncated or corrupt)');
    expect(p.fix).toContain(`delete ${p.file}`);
  });
  test.each([
    ['array', '[]', 'expected a JSON object'],
    ['null', 'null', 'expected a JSON object'],
    ['number', '5', 'expected a JSON object'],
  ])('wrong top-level type: %s', (_n, body, problem) => {
    const d = repo(); put(d, 'continue.json', body);
    expect(inspectMissions(d)[0].problem).toBe(problem);
  });
  test('missing mission field', () => {
    const d = repo(); put(d, 'state.json', '{"flow":1}');
    expect(inspectMissions(d)[0].problem).toBe('"mission" field is null, expected "m1"');
  });
  test('mission field disagrees with its dir', () => {
    const d = repo(); put(d, 'state.json', '{"mission":"other"}');
    expect(inspectMissions(d)[0].problem).toBe('"mission" field is "other", expected "m1"');
  });
  test('tasks of the wrong type', () => {
    const d = repo(); put(d, 'state.json', '{"mission":"m1","tasks":"3/4"}');
    expect(inspectMissions(d)[0].problem).toBe('"tasks" must be an object with done and total');
  });
  test('numeric field of the wrong type', () => {
    const d = repo(); put(d, 'state.json', '{"mission":"m1","flow":"three"}');
    expect(inspectMissions(d)[0].problem).toBe('"flow" must be a number');
  });
  test('project tokens.json truncated', () => {
    const d = repo(); writeFileSync(join(d, '.mugiwara', 'tokens.json'), '{"input_tok');
    const [p] = inspectMissions(d);
    expect(p.file).toBe(join('.mugiwara', 'tokens.json'));
    expect(p.problem).toBe('not valid JSON (truncated or corrupt)');
  });
  test('tokens.json with any object is accepted', () => {
    const d = repo(); writeFileSync(join(d, '.mugiwara', 'tokens.json'), '{"a":"b"}');
    expect(inspectMissions(d)).toEqual([]);
  });
  test('empty mission dir is a problem only when named', () => {
    const d = repo(); mkdirSync(join(d, '.mugiwara', 'missions', 'empty'));
    expect(inspectMissions(d)).toEqual([]);
    const [p] = inspectMissions(d, 'empty');
    expect(p.problem).toBe('mission dir is empty');
    expect(p.fix).toContain('rmdir');
  });
  test('unsafe mission names and absent missions are skipped', () => {
    const d = repo();
    expect(inspectMissions(d, '..')).toEqual([]);
    expect(inspectMissions(d, 'nope')).toEqual([]);
  });
  const root = process.getuid?.() === 0;
  test.skipIf(root)('unreadable file', () => {
    const d = repo(); put(d, 'state.json', good);
    const f = join(d, '.mugiwara', 'missions', 'm1', 'state.json');
    chmodSync(f, 0o000);
    const [p] = inspectMissions(d);
    chmodSync(f, 0o600);
    expect(p.problem).toBe('cannot be read (EACCES)');
    expect(p.fix).toContain('chmod u+r');
  });
  test.skipIf(root)('unlistable mission dir and missions root', () => {
    const d = repo(); put(d, 'state.json', good);
    const m = join(d, '.mugiwara', 'missions');
    chmodSync(join(m, 'm1'), 0o000);
    const a = inspectMissions(d);
    chmodSync(join(m, 'm1'), 0o700);
    expect(a[0].problem).toBe('cannot be listed');
    chmodSync(m, 0o000);
    const b = inspectMissions(d);
    chmodSync(m, 0o700);
    expect(b[0].file).toBe(join('.mugiwara', 'missions'));
  });
  test('formatProblems prints file, problem and fix', () => {
    expect(formatProblems([{ file: 'f', problem: 'p', fix: 'x' }])).toBe('✗ f: p\n  fix: x');
  });
});

describe('commands survive corrupt state', () => {
  const stack = /\n\s+at /;
  for (const [label, args] of [
    ['continue m1', ['continue', 'm1']],
    ['continue', ['continue']],
    ['status', ['status']],
    ['cost m1', ['cost', 'm1']],
    ['cost', ['cost']],
    ['archive m1', ['archive', 'm1']],
  ] as const) {
    test(`${label}: truncated state.json exits 1 with the fix`, async () => {
      const d = repo(); put(d, 'state.json', '{"mission":"m1","flo');
      const r = await cap([...args, '--project', d]);
      expect(r.code).toBe(1);
      expect(r.err).toContain(join('.mugiwara', 'missions', 'm1', 'state.json'));
      expect(r.err).toContain('fix: delete');
      expect(r.err).not.toMatch(stack);
    });
  }
  test('continue: truncated continue.json is named', async () => {
    const d = repo(); put(d, 'state.json', good); put(d, 'continue.json', '');
    const r = await cap(['continue', 'm1', '--project', d]);
    expect(r.code).toBe(1);
    expect(r.err).toContain('continue.json: not valid JSON');
  });
  test('cost: truncated tokens.json is named', async () => {
    const d = repo(); put(d, 'state.json', good); writeFileSync(join(d, '.mugiwara', 'tokens.json'), '{');
    const r = await cap(['cost', 'm1', '--project', d]);
    expect(r.code).toBe(1);
    expect(r.err).toContain('tokens.json: not valid JSON');
  });
  test('empty mission dir: archive and continue name it', async () => {
    const d = repo(); mkdirSync(join(d, '.mugiwara', 'missions', 'e'));
    for (const a of [['archive', 'e'], ['continue', 'e'], ['cost', 'e']]) {
      const r = await cap([...a, '--project', d]);
      expect(r.code).toBe(1);
      expect(r.err).toContain('mission dir is empty');
    }
  });
  test('empty mission dir does not break status', async () => {
    const d = repo(); mkdirSync(join(d, '.mugiwara', 'missions', 'e'));
    expect((await cap(['status', '--project', d])).code).toBe(0);
  });
  test('wrong-typed field stops status with the field named', async () => {
    const d = repo(); put(d, 'state.json', '{"mission":"m1","tasks":7}');
    const r = await cap(['status', '--project', d]);
    expect(r.code).toBe(1);
    expect(r.err).toContain('"tasks" must be an object');
  });
});
