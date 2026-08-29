// src/adaptive-budget.ts
// Phase 7 Adaptive Budget & Circuit Breaker — reservation, projection,
// adaptive/expansion, progressive thresholds, circuit breaker, anomaly
// (Native Cost Governor, plan §51 Phase 7, §24–§29).
//
// Boundary: pure verdict functions over explicit inputs (unit-testable), plus a
// record helper that persists via the sanitized recordOptDecision (§41). No new
// config keys; savepoint.sh/lane-base.sh untouched. The crew acts — this module
// records.

import { recordOptDecision } from './cost.ts';

// ── Budget reservation (§25) ──

export type BudgetReservation = { remaining: number; expected_max: number; available: number; reserved: number };

export function reserveBudget(input: { remaining: number; expected_max: number }): BudgetReservation {
  const reserved = input.expected_max;
  const available = Math.max(0, input.remaining - reserved);
  return { remaining: input.remaining, expected_max: input.expected_max, available, reserved };
}

// ── Budget projection (§26) ──

export type BudgetProjection = {
  current: number;
  remaining_required: number;
  expected_conditional: number;
  possible_healing: number;
  projected_min: number;
  projected_max: number;
};

export function projectBudget(input: {
  current: number;
  remaining_required: number;
  expected_conditional: number;
  possible_healing: number;
}): BudgetProjection {
  const projected_min = input.current + input.remaining_required + input.expected_conditional;
  const projected_max = projected_min + input.possible_healing;
  return {
    current: input.current,
    remaining_required: input.remaining_required,
    expected_conditional: input.expected_conditional,
    possible_healing: input.possible_healing,
    projected_min,
    projected_max,
  };
}

// ── Evidence-backed expansion (§27) ──

export type ExpansionInput = {
  reason: string;
  has_evidence: boolean;
  scope_expanded?: boolean;
  security_path?: boolean;
  test_surface_expanded?: boolean;
  architecture_dependency?: boolean;
  legitimate_healing?: boolean;
};

export type ExpansionVerdict = { allowed: boolean; reason: string };

const VALID_REASONS = new Set([
  'scope legitimately expanded',
  'security-sensitive path',
  'test surface larger',
  'architecture dependency',
  'legitimate healing',
]);

function isValidReason(reason: string): boolean {
  return VALID_REASONS.has(reason);
}

function hasValidFlag(input: ExpansionInput): boolean {
  return !!(
    input.scope_expanded ||
    input.security_path ||
    input.test_surface_expanded ||
    input.architecture_dependency ||
    input.legitimate_healing
  );
}

export function evaluateExpansion(input: ExpansionInput): ExpansionVerdict {
  if (!input.has_evidence) {
    return { allowed: false, reason: 'deny — no evidence' };
  }
  if (!input.reason || !isValidReason(input.reason)) {
    return { allowed: false, reason: `deny — invalid reason: ${input.reason || '(empty)'}` };
  }
  if (!hasValidFlag(input)) {
    return { allowed: false, reason: `deny — valid reason ${input.reason} but no matching flag set` };
  }
  return { allowed: true, reason: `allow — ${input.reason} with evidence` };
}

// ── Progressive thresholds (§28) ──

export type AdaptiveStatus = 'ok' | 'optimize' | 'aggressive' | 'protect' | 'pause' | 'warning' | 'stop';

export function checkProgressiveThreshold(input: { budget: number; used: number }): { status: AdaptiveStatus; pct: number } {
  const pct = input.budget > 0 ? Math.round((input.used / input.budget) * 100) : 0;
  let status: AdaptiveStatus = 'ok';
  if (pct >= 300) status = 'stop';
  else if (pct >= 150) status = 'warning';
  else if (pct >= 100) status = 'pause';
  else if (pct >= 90) status = 'protect';
  else if (pct >= 75) status = 'aggressive';
  else if (pct >= 60) status = 'optimize';
  return { status, pct };
}

// ── Cost circuit breaker (§29) ──

export type CircuitBreakerInput = {
  expected: number;
  actual: number;
  progress_delta: number;
  scope_expanded: boolean;
  evidence_delta: number;
};

export type CircuitBreakerVerdict = { tripped: boolean; reason: string };

export function checkCircuitBreaker(input: CircuitBreakerInput): CircuitBreakerVerdict {
  // note: double-threshold (actual >= expected*2), tune if §29 needs finer signal
  const doubled = input.expected * 2;
  const noProgress = input.progress_delta === 0;
  const noScopeOrEvidence = !input.scope_expanded && input.evidence_delta === 0;
  const overDoubled = input.actual >= doubled;
  if (overDoubled && noProgress && noScopeOrEvidence) {
    return { tripped: true, reason: `breaker tripped — actual ${input.actual} ≥ 2× expected ${input.expected} with no progress/scope/evidence` };
  }
  if (!overDoubled) return { tripped: false, reason: `no breaker — actual ${input.actual} < 2× expected ${input.expected}` };
  if (!noProgress) return { tripped: false, reason: 'no breaker — progress made' };
  return { tripped: false, reason: 'no breaker — scope expanded or evidence gained' };
}

// ── Budget anomaly (§24, re-consumes slop 5k-zero-progress signal) ──

export type BudgetAnomalyInput = {
  progress_before: number;
  progress_after: number;
  tokens_before: number;
  tokens_after: number;
};

export type BudgetAnomaly = { anomaly: boolean; reason: string };

export function detectBudgetAnomaly(input: BudgetAnomalyInput): BudgetAnomaly {
  const tokens_delta = input.tokens_after - input.tokens_before;
  const progress_delta = input.progress_after - input.progress_before;
  if (tokens_delta >= 5000 && progress_delta === 0) {
    return { anomaly: true, reason: `anomaly — ${tokens_delta} tokens with no progress` };
  }
  if (tokens_delta < 5000 && progress_delta === 0) {
    return { anomaly: false, reason: `no anomaly — ${tokens_delta} tokens below 5k floor` };
  }
  return { anomaly: false, reason: `no anomaly — progress ${progress_delta} over ${tokens_delta} tokens` };
}

// ── Decision trail (§41) ──

export function recordBudgetDecision(
  missionDir: string,
  d: { decision: string; reason: string; evidence?: string },
): void {
  recordOptDecision(missionDir, {
    actor: 'budget-governor',
    decision: d.decision,
    reason: d.reason,
    evidence: d.evidence,
  });
}
