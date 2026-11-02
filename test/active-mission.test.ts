import { afterEach, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { activeMission, dispatchedAgents, REVIEW_LEDGER } from '../src/active-mission.ts';

const dirs: string[] = [];
const repo = () => { const d = mkdtempSync(join(tmpdir(), 'mugi-active-')); dirs.push(d); return d; };
afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });
const put = (cwd: string, rel: string, body: string) => {
  const p = join(cwd, '.mugiwara', rel);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, body);
};
const state = (cwd: string, mission: string, file: string, s: object) => put(cwd, `missions/${mission}/${file}`, JSON.stringify(s));

describe('activeMission', () => {
  it('is null with no .mugiwara dir or an empty missions dir', () => {
    const d = repo();
    expect(activeMission(d)).toBeNull();
    mkdirSync(join(d, '.mugiwara', 'missions'), { recursive: true });
    expect(activeMission(d)).toBeNull();
  });
  it('reads a solo state.json: flow digits, mode, timestamp', () => {
    const d = repo();
    state(d, 'm1', 'state.json', { flow: 'wave-3', mode: 'auto', updated_at: '2026-01-02T00:00:00Z' });
    expect(activeMission(d)).toEqual({ mission: 'm1', member: '', wave: '3', mode: 'auto', updated: Date.parse('2026-01-02T00:00:00Z') });
  });
  it('falls back to wave, then 1, and to guided for an unknown mode', () => {
    const d = repo();
    state(d, 'a', 'state.json', { wave: 2, mode: 'weird' });
    expect(activeMission(d)).toMatchObject({ wave: '2', mode: 'guided', updated: 0 });
    state(d, 'a', 'state.json', {});
    expect(activeMission(d)).toMatchObject({ wave: '1', mode: 'guided' });
  });
  it('picks the most recently updated across missions and team member files', () => {
    const d = repo();
    state(d, 'old', 'state.json', { flow: 1, updated_at: '2026-01-01T00:00:00Z' });
    state(d, 'new', 'zoro.json', { flow: 2, mode: 'semi', updated_at: '2026-03-01T00:00:00Z' });
    state(d, 'new', 'sanji.json', { flow: 4, updated_at: '2026-02-01T00:00:00Z' });
    expect(activeMission(d)).toMatchObject({ mission: 'new', member: 'zoro', wave: '2', mode: 'semi' });
  });
  it('ignores continue files, unsafe names, non-json and corrupt savepoints', () => {
    const d = repo();
    state(d, 'm', 'continue.json', { updated_at: '2030-01-01T00:00:00Z' });
    state(d, 'm', 'continue-zoro.json', { updated_at: '2030-01-01T00:00:00Z' });
    state(d, 'm', 'bad name.json', { updated_at: '2030-01-01T00:00:00Z' });
    state(d, 'm', '...json', { updated_at: '2030-01-01T00:00:00Z' });
    put(d, 'missions/m/state.json', '{not json');
    put(d, 'missions/m/notes.md', 'x');
    state(d, 'bad dir', 'state.json', { updated_at: '2030-01-01T00:00:00Z' });
    put(d, 'missions/loose-file.txt', 'x'); // a file, not a mission dir
    expect(activeMission(d)).toBeNull();
    state(d, 'ok', 'state.json', { flow: 1, updated_at: '2026-01-01T00:00:00Z' });
    expect(activeMission(d)?.mission).toBe('ok');
  });
  it('keeps the first of two equal timestamps', () => {
    const d = repo();
    state(d, 'a', 'state.json', { updated_at: '2026-01-01T00:00:00Z' });
    state(d, 'b', 'state.json', { updated_at: '2026-01-01T00:00:00Z' });
    expect(['a', 'b']).toContain(activeMission(d)!.mission);
  });

  describe('bootstrap from artifacts when no state exists', () => {
    it('seeds wave 2 from plan.md, 1 from spec.md, 0 from decisions.md; mode from config', () => {
      const d = repo();
      put(d, 'config', 'junk\nmode = auto\n');
      put(d, 'missions/p/plan.md', '#');
      expect(activeMission(d)).toEqual({ mission: 'p', member: '', wave: '2', mode: 'auto', updated: 0 });
      rmSync(join(d, '.mugiwara', 'missions', 'p'), { recursive: true });
      put(d, 'missions/s/spec.md', '#');
      expect(activeMission(d)).toMatchObject({ wave: '1' });
      rmSync(join(d, '.mugiwara', 'missions', 's'), { recursive: true });
      put(d, 'missions/d/decisions.md', '#');
      expect(activeMission(d)).toMatchObject({ mission: 'd', wave: '0' });
    });
    it('defaults mode to guided with no config or an invalid mode', () => {
      const d = repo();
      put(d, 'missions/p/plan.md', '#');
      expect(activeMission(d)?.mode).toBe('guided');
      put(d, 'config', 'mode=turbo\n');
      expect(activeMission(d)?.mode).toBe('guided');
    });
    it('treats a closed mission (report.md or pr-verdict.md) or an artifact-less one as not active', () => {
      const d = repo();
      put(d, 'missions/done/plan.md', '#');
      put(d, 'missions/done/report.md', '#');
      put(d, 'missions/merged/spec.md', '#');
      put(d, 'missions/merged/pr-verdict.md', '#');
      put(d, 'missions/empty/other.md', '#');
      put(d, 'missions/bad name/plan.md', '#');
      put(d, 'missions/loose.txt', 'x');
      expect(activeMission(d)).toBeNull();
    });
    it('a mission with state is not bootstrapped, and continue-only json does not count as state', () => {
      const d = repo();
      put(d, 'missions/c/plan.md', '#');
      state(d, 'c', 'continue.json', {});
      expect(activeMission(d)).toMatchObject({ mission: 'c', wave: '2', updated: 0 });
      state(d, 'c', 'state.json', { flow: 5, updated_at: '2026-01-01T00:00:00Z' });
      expect(activeMission(d)).toMatchObject({ wave: '5' });
    });
  });
});

describe('dispatchedAgents', () => {
  const ledger = (d: string, lines: string[]) => put(d, REVIEW_LEDGER, lines.join('\n'));
  it('exports the ledger file name', () => expect(REVIEW_LEDGER).toBe('review-dispatch.jsonl'));
  it('is empty for no mission, an absent ledger or an empty ledger', () => {
    const d = repo();
    expect(dispatchedAgents(d, '').size).toBe(0);
    expect(dispatchedAgents(d, 'm1').size).toBe(0);
    ledger(d, ['', '  ']);
    expect(dispatchedAgents(d, 'm1').size).toBe(0);
    expect(dispatchedAgents(d, '').size).toBe(0);
  });
  it('collects agents for the exact mission only, across multiple missions', () => {
    const d = repo();
    ledger(d, [
      JSON.stringify({ mission: 'm1', agent: 'robin-reviewer' }),
      JSON.stringify({ mission: 'm2', agent: 'jinbe-security' }),
      JSON.stringify({ mission: 'm1', agent: 'jinbe-security' }),
      JSON.stringify({ mission: 'm1', agent: 'robin-reviewer' }),
      JSON.stringify({ mission: '', agent: 'orphan' }),
      JSON.stringify({ agent: 'no-mission' }),
    ]);
    expect([...dispatchedAgents(d, 'm1')].sort()).toEqual(['jinbe-security', 'robin-reviewer']);
    expect([...dispatchedAgents(d, 'm2')]).toEqual(['jinbe-security']);
    expect(dispatchedAgents(d, 'm3').size).toBe(0);
  });
  it('skips torn/corrupt lines and non-string agents, keeps the good ones, reads CRLF', () => {
    const d = repo();
    put(d, REVIEW_LEDGER, [
      '{"mission":"m1","agent":"a"', // torn
      'garbage',
      JSON.stringify({ mission: 'm1', agent: 42 }),
      JSON.stringify({ mission: 'm1', agent: 'good' }),
    ].join('\r\n') + '\r\n');
    expect([...dispatchedAgents(d, 'm1')]).toEqual(['good']);
  });
  it('an unreadable ledger (a directory) means no dispatch, never a throw', () => {
    const d = repo();
    mkdirSync(join(d, '.mugiwara', REVIEW_LEDGER), { recursive: true });
    expect(dispatchedAgents(d, 'm1').size).toBe(0);
  });
});
