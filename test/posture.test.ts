// test/posture.test.ts — Phase B posture selection matrix (deterministic).
import { describe, it, expect } from 'bun:test';
import { selectPosture, type PostureInput } from '../src/posture.ts';

const base: PostureInput = {
  lane: 'standard',
  risk: 'low',
  independent_tasks: 0,
  order_dependent: true,
  context_pressure: false,
  team_members: 1, // roster-derived
  phases: 1,
  plan_lines: 200,
  governor: 'normal',
};

describe('selectPosture — deterministic matrix', () => {
  it('defaults to inline-sequential on ordinary work', () => {
    const r = selectPosture(base);
    expect(r.posture).toBe('inline-sequential');
    expect(r.pause).toBe(false);
    expect(r.reason).toContain('default inline');
    expect(r.evidence_refs).toContain('triage route');
  });

  it('governor stop → safe pause, keeps inline', () => {
    const r = selectPosture({ ...base, independent_tasks: 5, governor: 'stop' });
    expect(r.pause).toBe(true);
    expect(r.posture).toBe('inline-sequential');
    expect(r.reason).toContain('pause safely');
  });

  it('team > 1 → team-scoped', () => {
    const r = selectPosture({ ...base, team_members: 3, independent_tasks: 4 }); // roster-derived
    expect(r.posture).toBe('team-scoped');
    expect(r.evidence_refs).toContain('plan ownership map');
  });

  it('large campaign → phase-isolated', () => {
    const r = selectPosture({ ...base, phases: 4 });
    expect(r.posture).toBe('phase-isolated');
  });
  it('large campaign by plan lines → phase-isolated', () => {
    const r = selectPosture({ ...base, plan_lines: 2000 });
    expect(r.posture).toBe('phase-isolated');
  });

  it('context pressure + ordered → context-relief', () => {
    const r = selectPosture({ ...base, context_pressure: true, order_dependent: true });
    expect(r.posture).toBe('context-relief');
    expect(r.reason).toContain('order preserved');
  });

  // Dispatch floor: a worker costs ~132k against ~5k inline, so two small
  // independent tasks are cheaper batched than dispatched. Count alone does
  // not buy a worker — the mission has to be full-lane, or big enough in
  // task count that serial cost dominates the floor.
  it('2 independent tasks on a standard lane → inline-batched, not workers', () => {
    const r = selectPosture({ ...base, independent_tasks: 2 });
    expect(r.posture).toBe('inline-batched');
    expect(r.reason).toContain('dispatch floor');
  });

  it('2 independent tasks on a full lane → parallel-workers', () => {
    const r = selectPosture({ ...base, lane: 'full', independent_tasks: 2 });
    expect(r.posture).toBe('parallel-workers');
    expect(r.evidence_refs).toContain('Nami dependency map');
  });

  it('4 independent tasks clears the floor on any lane', () => {
    const r = selectPosture({ ...base, independent_tasks: 4 });
    expect(r.posture).toBe('parallel-workers');
    expect(r.evidence_refs).toContain('Nami dependency map');
  });

  it('independent tasks but context pressure takes precedence when ordered', () => {
    const r = selectPosture({ ...base, independent_tasks: 3, context_pressure: true, order_dependent: true });
    expect(r.posture).toBe('context-relief');
  });
});
