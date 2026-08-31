import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  reserveBudget,
  projectBudget,
  evaluateExpansion,
  checkProgressiveThreshold,
  checkCircuitBreaker,
  detectBudgetAnomaly,
  recordBudgetDecision,
} from '../src/adaptive-budget.ts';

describe('reserveBudget', () => {
  it('reserves max and computes available', () => {
    expect(reserveBudget({ remaining: 14000, expected_max: 4000 })).toEqual({
      remaining: 14000,
      expected_max: 4000,
      reserved: 4000,
      available: 10000,
    });
  });
  it('zero-floors available', () => {
    expect(reserveBudget({ remaining: 1000, expected_max: 4000 }).available).toBe(0);
  });
  it('exact remaining', () => {
    expect(reserveBudget({ remaining: 4000, expected_max: 4000 }).available).toBe(0);
  });
});

describe('projectBudget', () => {
  it('projects min/max per §26', () => {
    expect(projectBudget({ current: 11200, remaining_required: 4000, expected_conditional: 500, possible_healing: 5000 })).toEqual({
      current: 11200,
      remaining_required: 4000,
      expected_conditional: 500,
      possible_healing: 5000,
      projected_min: 15700,
      projected_max: 20700,
    });
  });
  it('all-zero', () => {
    expect(projectBudget({ current: 0, remaining_required: 0, expected_conditional: 0, possible_healing: 0 })).toEqual({
      current: 0,
      remaining_required: 0,
      expected_conditional: 0,
      possible_healing: 0,
      projected_min: 0,
      projected_max: 0,
    });
  });
  it('no healing', () => {
    const p = projectBudget({ current: 10000, remaining_required: 2000, expected_conditional: 1000, possible_healing: 0 });
    expect(p.projected_min).toBe(13000);
    expect(p.projected_max).toBe(13000);
  });
});

describe('evaluateExpansion', () => {
  const validReasons = [
    'scope legitimately expanded',
    'security-sensitive path',
    'test surface larger',
    'architecture dependency',
    'legitimate healing',
  ] as const;
  const flagMap: Record<string, object> = {
    'scope legitimately expanded': { scope_expanded: true },
    'security-sensitive path': { security_path: true },
    'test surface larger': { test_surface_expanded: true },
    'architecture dependency': { architecture_dependency: true },
    'legitimate healing': { legitimate_healing: true },
  };
  for (const reason of validReasons) {
    it(`allows valid reason ${reason} with evidence and flag`, () => {
      expect(evaluateExpansion({ reason, has_evidence: true, ...flagMap[reason] } as any).allowed).toBe(true);
    });
  }
  it('denies without evidence', () => {
    expect(evaluateExpansion({ reason: 'scope legitimately expanded', has_evidence: false, scope_expanded: true }).allowed).toBe(false);
    expect(evaluateExpansion({ reason: 'scope legitimately expanded', has_evidence: false, scope_expanded: true }).reason).toMatch(/no evidence/);
  });
  it('denies invalid reason even with evidence', () => {
    expect(evaluateExpansion({ reason: 'agent was verbose', has_evidence: true, scope_expanded: true }).allowed).toBe(false);
    expect(evaluateExpansion({ reason: 'agent was verbose', has_evidence: true }).reason).toMatch(/invalid reason/);
  });
  it('denies empty reason', () => {
    expect(evaluateExpansion({ reason: '', has_evidence: true, scope_expanded: true }).allowed).toBe(false);
  });
  it('denies valid reason but no flag', () => {
    expect(evaluateExpansion({ reason: 'scope legitimately expanded', has_evidence: true }).allowed).toBe(false);
  });
  it('denies verbose with flag but invalid reason name', () => {
    expect(evaluateExpansion({ reason: 'agent explored unrelated', has_evidence: true, scope_expanded: true }).allowed).toBe(false);
  });
});

describe('checkProgressiveThreshold', () => {
  it('ok below 60', () => expect(checkProgressiveThreshold({ budget: 10000, used: 5900 }).status).toBe('ok'));
  it('optimize at 60', () => expect(checkProgressiveThreshold({ budget: 10000, used: 6000 }).status).toBe('optimize'));
  it('aggressive at 75', () => expect(checkProgressiveThreshold({ budget: 10000, used: 7500 }).status).toBe('aggressive'));
  it('protect at 90', () => expect(checkProgressiveThreshold({ budget: 10000, used: 9000 }).status).toBe('protect'));
  it('pause at 100', () => expect(checkProgressiveThreshold({ budget: 10000, used: 10000 }).status).toBe('pause'));
  it('warning at 150', () => expect(checkProgressiveThreshold({ budget: 10000, used: 15000 }).status).toBe('warning'));
  it('stop at 300', () => expect(checkProgressiveThreshold({ budget: 10000, used: 30000 }).status).toBe('stop'));
  it('pct computed', () => expect(checkProgressiveThreshold({ budget: 20000, used: 10000 }).pct).toBe(50));
  it('budget 0 → pct 0 ok', () => expect(checkProgressiveThreshold({ budget: 0, used: 9999 })).toEqual({ pct: 0, status: 'ok' }));
  it('boundary 74 → optimize not aggressive', () => expect(checkProgressiveThreshold({ budget: 10000, used: 7400 }).status).toBe('optimize'));
  it('boundary 89 → aggressive not protect', () => expect(checkProgressiveThreshold({ budget: 10000, used: 8900 }).status).toBe('aggressive'));
  it('boundary 99 → protect not pause', () => expect(checkProgressiveThreshold({ budget: 10000, used: 9900 }).status).toBe('protect'));
  it('boundary 149 → pause not warning', () => expect(checkProgressiveThreshold({ budget: 10000, used: 14900 }).status).toBe('pause'));
  it('boundary 299 → warning not stop', () => expect(checkProgressiveThreshold({ budget: 10000, used: 29900 }).status).toBe('warning'));
});

describe('checkCircuitBreaker', () => {
  it('trips at 2x with no progress/scope/evidence', () => {
    expect(checkCircuitBreaker({ expected: 13000, actual: 26000, progress_delta: 0, scope_expanded: false, evidence_delta: 0 }).tripped).toBe(true);
  });
  it('no trip with evidence', () => {
    expect(checkCircuitBreaker({ expected: 13000, actual: 26000, progress_delta: 0, scope_expanded: false, evidence_delta: 1 }).tripped).toBe(false);
  });
  it('no trip with scope', () => {
    expect(checkCircuitBreaker({ expected: 13000, actual: 26000, progress_delta: 0, scope_expanded: true, evidence_delta: 0 }).tripped).toBe(false);
  });
  it('no trip with progress', () => {
    expect(checkCircuitBreaker({ expected: 13000, actual: 26000, progress_delta: 1, scope_expanded: false, evidence_delta: 0 }).tripped).toBe(false);
  });
  it('no trip below 2x', () => {
    expect(checkCircuitBreaker({ expected: 13000, actual: 25999, progress_delta: 0, scope_expanded: false, evidence_delta: 0 }).tripped).toBe(false);
  });
  it('no trip well below', () => {
    expect(checkCircuitBreaker({ expected: 13000, actual: 15000, progress_delta: 0, scope_expanded: false, evidence_delta: 0 }).tripped).toBe(false);
  });
});

describe('detectBudgetAnomaly', () => {
  it('5k zero-progress → anomaly', () => {
    expect(detectBudgetAnomaly({ progress_before: 0, progress_after: 0, tokens_before: 10000, tokens_after: 15000 }).anomaly).toBe(true);
  });
  it('4.9k zero-progress → no anomaly', () => {
    expect(detectBudgetAnomaly({ progress_before: 0, progress_after: 0, tokens_before: 10000, tokens_after: 14900 }).anomaly).toBe(false);
  });
  it('5k with progress → no anomaly', () => {
    expect(detectBudgetAnomaly({ progress_before: 0, progress_after: 1, tokens_before: 10000, tokens_after: 15000 }).anomaly).toBe(false);
  });
  it('10k zero-progress → anomaly', () => {
    expect(detectBudgetAnomaly({ progress_before: 2, progress_after: 2, tokens_before: 0, tokens_after: 10000 }).anomaly).toBe(true);
  });
});

describe('recordBudgetDecision', () => {
  it('writes bullet with budget-governor actor and sanitizes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugiwara-adaptive-'));
    try {
      recordBudgetDecision(dir, { decision: 'pause\ninjection', reason: 'over budget', evidence: 'E001' });
      const content = readFileSync(join(dir, 'decisions.md'), 'utf8');
      expect(content).toContain('budget-governor:');
      expect(content).toContain('Cost governor decisions');
      expect(content).not.toContain('pause\ninjection');
      expect(content).toContain('pause injection');
      // second record appends
      recordBudgetDecision(dir, { decision: 'stop', reason: 'breaker' });
      const content2 = readFileSync(join(dir, 'decisions.md'), 'utf8');
      expect(content2.split('budget-governor:').length).toBe(3); // header + 2 bullets
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
