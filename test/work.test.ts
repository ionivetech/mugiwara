// test/work.test.ts
// Phase 3 Work Governor — src/work.ts unit tests.
// Six verdict capabilities (§51 Phase 3): required/conditional/optional stage
// classification, evidence-backed stage skipping, agent invocation control,
// skill loading control, delegation optimization (consumes delegateAt +
// laneBaseForLane — closes the Phase-2 Q1 remainder), and completion detection.
// Every verdict family is a pure function with exact-value assertions.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  classifyStage,
  shouldSkipStage,
  evaluateInvocation,
  shouldLoadSkill,
  evaluateDelegation,
  completionCheck,
  recordWorkDecision,
} from '../src/work.ts';

describe('classifyStage — required/conditional/optional (§7)', () => {
  const base = {
    stage: 'execute',
    requirement_kind: 'explicit' as const,
    uncertainty_high: false,
    provides_required_evidence: false,
    protects_quality_security: false,
  };

  it('protects_quality_security → required even when evidence present', () => {
    const r = classifyStage({ ...base, protects_quality_security: true, provides_required_evidence: true });
    expect(r.class).toBe('required');
    expect(r.stage).toBe('execute');
  });

  it('provides_required_evidence → required', () => {
    const r = classifyStage({ ...base, provides_required_evidence: true });
    expect(r.class).toBe('required');
  });

  it('uncertainty_high → conditional', () => {
    const r = classifyStage({ ...base, uncertainty_high: true });
    expect(r.class).toBe('conditional');
  });

  it('explicit + no evidence + no protection + no uncertainty → optional', () => {
    const r = classifyStage(base);
    expect(r.class).toBe('optional');
  });

  it('exploratory requirement without protection/evidence → conditional', () => {
    const r = classifyStage({ ...base, requirement_kind: 'exploratory' });
    expect(r.class).toBe('conditional');
  });
});

describe('shouldSkipStage — evidence-backed skipping (§7/§13)', () => {
  const base = { stage: 'brainstorm', classification: 'optional' as const, evidence_present: false, investigation_stopped: false, context_over: false };

  it('required never skips, reason names the protection', () => {
    const r = shouldSkipStage({ ...base, classification: 'required', evidence_present: true });
    expect(r.skip).toBe(false);
    expect(r.reason).toContain('required');
  });

  it('conditional + evidence_present → skip', () => {
    const r = shouldSkipStage({ ...base, classification: 'conditional', evidence_present: true });
    expect(r.skip).toBe(true);
    expect(r.reason).toContain('evidence');
  });

  it('conditional + investigation_stopped → skip', () => {
    const r = shouldSkipStage({ ...base, classification: 'conditional', investigation_stopped: true });
    expect(r.skip).toBe(true);
    expect(r.reason).toContain('investigation');
  });

  it('conditional with no signal → run', () => {
    const r = shouldSkipStage({ ...base, classification: 'conditional' });
    expect(r.skip).toBe(false);
  });

  it('optional + context_over → skip', () => {
    const r = shouldSkipStage({ ...base, classification: 'optional', context_over: true });
    expect(r.skip).toBe(true);
    expect(r.reason).toContain('context');
  });

  it('optional + evidence_present → skip', () => {
    const r = shouldSkipStage({ ...base, classification: 'optional', evidence_present: true });
    expect(r.skip).toBe(true);
    expect(r.reason).toContain('evidence');
  });

  it('optional with no signal → run, non-empty reason', () => {
    const r = shouldSkipStage(base);
    expect(r.skip).toBe(false);
    expect(r.reason.length).toBeGreaterThan(0);
  });

  it('every skip has a non-empty reason (§7 — explicit)', () => {
    for (const cls of ['conditional', 'optional'] as const) {
      const r = shouldSkipStage({ ...base, classification: cls, evidence_present: true });
      expect(r.skip).toBe(true);
      expect(r.reason.length).toBeGreaterThan(0);
    }
  });
});

describe('evaluateInvocation — agent invocation control (§8)', () => {
  const base = { agent: 'skeptic', unique_responsibility: true, evidence_answers: false, stage_can_perform: false, expected_value_gt_cost: true };

  it('all four conditions pass → invoke', () => {
    const r = evaluateInvocation(base);
    expect(r.invoke).toBe(true);
    expect(r.agent).toBe('skeptic');
  });

  it('unique + evidence answers → refuse on evidence clause', () => {
    const r = evaluateInvocation({ ...base, evidence_answers: true });
    expect(r.invoke).toBe(false);
    expect(r.reason).toMatch(/evidence/);
  });

  it('unique + no evidence + stage can perform → refuse on stage clause', () => {
    const r = evaluateInvocation({ ...base, stage_can_perform: true });
    expect(r.invoke).toBe(false);
    expect(r.reason).toMatch(/stage/);
  });

  it('no unique responsibility → refuse on unique clause', () => {
    const r = evaluateInvocation({ ...base, unique_responsibility: false });
    expect(r.invoke).toBe(false);
    expect(r.reason).toMatch(/unique/);
  });

  it('expected value not greater than cost → refuse on value clause', () => {
    const r = evaluateInvocation({ ...base, expected_value_gt_cost: false });
    expect(r.invoke).toBe(false);
    expect(r.reason).toMatch(/value/);
  });

  it('refused invocation still names the agent', () => {
    const r = evaluateInvocation({ ...base, evidence_answers: true });
    expect(r.agent).toBe('skeptic');
  });
});

describe('shouldLoadSkill — skill loading control (§9)', () => {
  const base = { skill: 'mugiwara-git', required_by_task: false, required_by_policy: false, required_by_dependency: false, failing_verification: false };

  it('required_by_task alone → load', () => {
    expect(shouldLoadSkill({ ...base, required_by_task: true }).load).toBe(true);
  });
  it('required_by_policy alone → load', () => {
    expect(shouldLoadSkill({ ...base, required_by_policy: true }).load).toBe(true);
  });
  it('required_by_dependency alone → load', () => {
    expect(shouldLoadSkill({ ...base, required_by_dependency: true }).load).toBe(true);
  });
  it('failing_verification alone → load', () => {
    expect(shouldLoadSkill({ ...base, failing_verification: true }).load).toBe(true);
  });
  it('none → load:false with the standard reason', () => {
    const r = shouldLoadSkill(base);
    expect(r.load).toBe(false);
    expect(r.reason).toContain('not required');
  });
});

describe('evaluateDelegation — delegation optimization (§30, Q1 remainder)', () => {
  const base = {
    lane: 'full',
    budget: 25000,
    tokens_used: 6000,
    threshold_pct: 60,
    independent_tasks: 2,
    parallel_value: 40000,
    estimated_overhead: 5000,
  };

  it('independent_tasks:1 → never delegate regardless of value', () => {
    const r = evaluateDelegation({ ...base, independent_tasks: 1, parallel_value: 999999 });
    expect(r.delegate).toBe(false);
    expect(r.reason).toMatch(/independent/);
  });

  it('overhead floors at lane_base — value below floor refuses delegation', () => {
    const r = evaluateDelegation({ ...base, lane: 'full', parallel_value: 5000, estimated_overhead: 4000 });
    expect(r.lane_base).toBe(22016);
    expect(r.overhead).toBe(22016); // max(4000, 22016) floor
    expect(r.delegate).toBe(false);
    expect(r.parallel_value).toBe(5000);
  });

  it('value exceeds floor and within budget → delegate (budget_at = threshold math)', () => {
    const r = evaluateDelegation({ ...base, lane: 'full' });
    expect(r.budget_at).toBe(15000); // delegateAt(25000, 60)
    expect(r.overhead).toBe(22016); // max(5000, 22016) floor
    expect(r.delegate).toBe(true);
  });

  it('tokens_used above budget_at → refuse delegation (over threshold)', () => {
    const r = evaluateDelegation({ ...base, lane: 'full', tokens_used: 16000 });
    expect(r.budget_at).toBe(15000);
    expect(r.delegate).toBe(false);
    expect(r.reason).toMatch(/budget/);
  });
});

describe('completionCheck — completion detection (§19)', () => {
  const base = {
    acceptance_satisfied: true,
    implementation_complete: true,
    tests_complete: true,
    quality_gates_complete: true,
    evidence_collected: true,
  };

  it('all five conditions → complete, empty missing', () => {
    const r = completionCheck(base);
    expect(r.complete).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.reason).toBe('ready for closure');
  });

  it('one false → complete:false with that item missing', () => {
    const r = completionCheck({ ...base, tests_complete: false });
    expect(r.complete).toBe(false);
    expect(r.missing).toEqual(['tests_complete']);
    expect(r.reason).toContain('tests_complete');
  });

  it('multiple false → all listed in missing', () => {
    const r = completionCheck({ ...base, acceptance_satisfied: false, evidence_collected: false });
    expect(r.complete).toBe(false);
    expect(r.missing).toEqual(['acceptance_satisfied', 'evidence_collected']);
  });
});

describe('recordWorkDecision — decision trail (§41)', () => {
  it('writes a single ## Cost governor decisions bullet with work-governor actor', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugiwara-work-'));
    recordWorkDecision(dir, { decision: 'skip brainstorm', reason: 'evidence already answers', evidence: 'E001' });
    const body = readFileSync(join(dir, 'decisions.md'), 'utf8');
    expect(body.split(/\r?\n/).filter((l) => l.trim() === '## Cost governor decisions')).toHaveLength(1);
    const bullets = body.split(/\r?\n/).filter((l) => l.startsWith('- '));
    expect(bullets).toHaveLength(1);
    expect(bullets[0]).toContain('work-governor');
    expect(bullets[0]).toContain('skip brainstorm');
    expect(bullets[0]).toContain('reason: evidence already answers');
    expect(bullets[0]).toContain('E001');
  });

  it('sanitizes a newline-injected reason (S2 reuse)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugiwara-work-'));
    recordWorkDecision(dir, { decision: 'skip\n## fake', reason: 'a\r\nb' });
    const body = readFileSync(join(dir, 'decisions.md'), 'utf8');
    const bullets = body.split(/\r?\n/).filter((l) => l.startsWith('- '));
    expect(bullets).toHaveLength(1);
    expect(bullets[0]).not.toContain('\n');
    expect(bullets[0]).not.toContain('\r');
    expect(body.split(/\r?\n/).some((l) => l.trim().startsWith('## fake'))).toBe(false);
  });

  it('creates the mission dir when missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugiwara-work-'));
    const nested = join(dir, 'missions', 'demo');
    recordWorkDecision(nested, { decision: 'complete', reason: 'ready for closure' });
    expect(existsSync(join(nested, 'decisions.md'))).toBe(true);
  });
});
