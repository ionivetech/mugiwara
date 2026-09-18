import { describe, it, expect } from 'bun:test';
import { deriveStructuralIntents, CLOSE_FLOW } from '../src/intents.ts';
import type { StateEntry, ContinueEntry } from '../src/continue.ts';

// Minimal row factories — only the folded fields vary per case.
const state = (over: Partial<StateEntry> = {}): StateEntry => ({
  mission: 'm', member: null, actor: 'a', branch: 'b', flow: 0, mode: 'guided',
  tasks_done: 0, tasks_total: 0, lane: 'full', next_action: '', next_session_prompt: '',
  updated_at: '', lane_reason: '', lane_rose: false, lane_prev: '', lane_peak: '',
  base_sha: '', sensitive_paths: [], blockers_open: 0, heal_cycle: 0,
  heal_max_cycles: 3, heal_halt: false, delegate_threshold: 60, delegate_due: false,
  tokens_est: 0, budget: 0, budget_status: '', files_touched: 0, evidence: [],
  schema_version: 2, ...over,
});

const cont = (over: Partial<ContinueEntry> = {}): ContinueEntry => ({
  mission: 'm', member: null, actor: 'a', branch: 'b', flow: 0, mode: 'guided',
  tasks_done: 0, tasks_total: 0, lane: 'full', next_action: '', next_session_prompt: '',
  updated_at: '', ...over,
});

describe('deriveStructuralIntents', () => {
  it('close fires when any member sits at flow 8 (multi-member)', () => {
    expect(CLOSE_FLOW).toBe(8);
    const got = deriveStructuralIntents({
      mission: 'm',
      states: [state({ member: 'a', flow: 3 }), state({ member: 'b', flow: 8 })],
      continues: [], rosterSize: 1,
    });
    expect(got.close).toBe(true);
    const none = deriveStructuralIntents({
      mission: 'm',
      states: [state({ member: 'a', flow: 3 }), state({ member: 'b', flow: 7 })],
      continues: [], rosterSize: 1,
    });
    expect(none.close).toBe(false);
  });

  it('failure fires on heal_cycle alone', () => {
    const got = deriveStructuralIntents({
      mission: 'm', states: [state({ heal_cycle: 1, blockers_open: 0 })],
      continues: [], rosterSize: 1,
    });
    expect(got.failure).toBe(true);
  });

  it('failure fires on blockers_open alone', () => {
    const got = deriveStructuralIntents({
      mission: 'm', states: [state({ heal_cycle: 0, blockers_open: 2 })],
      continues: [], rosterSize: 1,
    });
    expect(got.failure).toBe(true);
  });

  it('failure stays off with clean heal/blocker rows', () => {
    const got = deriveStructuralIntents({
      mission: 'm', states: [state({ heal_cycle: 0, blockers_open: 0 })],
      continues: [], rosterSize: 1,
    });
    expect(got.failure).toBe(false);
  });

  it('interrupted pins orphan positive, solo null==null negative, team orphan positive', () => {
    const orphan = deriveStructuralIntents({
      mission: 'm', states: [state({ member: null })],
      continues: [cont({ member: 'x' })], rosterSize: 1,
    });
    expect(orphan.interrupted).toBe(true);
    const solo = deriveStructuralIntents({
      mission: 'm', states: [state({ member: null })],
      continues: [cont({ member: null })], rosterSize: 1,
    });
    expect(solo.interrupted).toBe(false);
    const teamOrphan = deriveStructuralIntents({
      mission: 'm', states: [state({ member: 'a' }), state({ member: 'b' })],
      continues: [cont({ member: 'a' }), cont({ member: 'c' })], rosterSize: 2,
    });
    expect(teamOrphan.interrupted).toBe(true);
  });

  it('rosterSize passes through 0/1/2 untouched', () => {
    for (const n of [0, 1, 2]) {
      const got = deriveStructuralIntents({ mission: 'm', states: [], continues: [], rosterSize: n });
      expect(got.rosterSize).toBe(n);
    }
  });

  it('judged fields always read false even with every structural signal lit', () => {
    const got = deriveStructuralIntents({
      mission: 'm',
      states: [state({ member: 'a', flow: 8, heal_cycle: 1, blockers_open: 1 })],
      continues: [cont({ member: 'ghost' })], rosterSize: 2,
    });
    expect([got.tests, got.vague, got.bug, got.gitOp, got.gatesPass, got.meta]).toEqual([false, false, false, false, false, false]);
  });

  it('empty states derive all-false with roster passthrough', () => {
    const got = deriveStructuralIntents({ mission: 'm', states: [], continues: [], rosterSize: 1 });
    expect(got).toEqual({
      close: false, tests: false, vague: false, bug: false, gitOp: false,
      failure: false, gatesPass: false, interrupted: false, meta: false, rosterSize: 1,
    });
  });
});
