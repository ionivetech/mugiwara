// src/work.ts
// Phase 3 Work Governor — verdict engine + decision trail
// (Native Cost Governor initiative, plan §51 Phase 3, spec §7/§8/§9/§19/§30/§41).
//
// Turns the Phase-2 signals into auditable skip/avoid/delegate/complete
// verdicts. Honest boundary (same as Phase 2 for investigation.ts): this
// module PRODUCES and RECORDS verdicts; the LLM crew (workflow skill, T4) is
// the only thing that acts on them. The module makes the decision structured
// and auditable — it does not pretend a TS function can force the model.
//
// Every verdict is a pure function of explicit inputs (unit-testable, parity
// locked by fixtures) and every skip/avoid/delegate/complete decision lands in
// the trail via recordWorkDecision → recordOptDecision (§41, S2 sanitizer).
import { delegateAt, laneBaseForLane, recordOptDecision } from './cost.ts';

// ── Stage classification (§7/§34) ───────────────────────────────────────────

export type StageClass = 'required' | 'conditional' | 'optional';

export type StageClassifyInput = {
  stage: string;
  requirement_kind: 'explicit' | 'exploratory' | 'ambiguous';
  uncertainty_high: boolean;
  provides_required_evidence: boolean;
  protects_quality_security: boolean;
};

export type StageClassifyVerdict = { stage: string; class: StageClass; reason: string };

/**
 * Classify a flow stage as required/conditional/optional. A stage that
 * protects quality/security or provides required evidence is `required`
 * (never skipped); a stage with high uncertainty or a non-explicit
 * requirement is `conditional`; everything else is `optional`.
 */
export function classifyStage(input: StageClassifyInput): StageClassifyVerdict {
  if (input.protects_quality_security) {
    return { stage: input.stage, class: 'required', reason: 'protects quality/security — required' };
  }
  if (input.provides_required_evidence) {
    return { stage: input.stage, class: 'required', reason: 'provides required evidence — required' };
  }
  if (input.uncertainty_high || input.requirement_kind !== 'explicit') {
    return { stage: input.stage, class: 'conditional', reason: 'uncertain or non-explicit requirement — conditional' };
  }
  return { stage: input.stage, class: 'optional', reason: 'explicit, no protection/evidence need — optional' };
}

// ── Evidence-backed stage skipping (§7/§13) ─────────────────────────────────

export type SkipInput = {
  stage: string;
  classification: StageClass;
  evidence_present: boolean;
  investigation_stopped: boolean;
  context_over: boolean;
};

export type SkipVerdict = { stage: string; skip: boolean; reason: string; evidence?: string };

/**
 * Decide whether a classified stage may be skipped on evidence. `required`
 * never skips (protects quality/security). `conditional` skips when evidence
 * already answers or the investigation stopped; `optional` skips when
 * evidence answers or the context is over budget. Every skip carries an
 * explicit reason (§7 — never skipped silently).
 */
export function shouldSkipStage(input: SkipInput): SkipVerdict {
  if (input.classification === 'required') {
    return { stage: input.stage, skip: false, reason: 'required — protects quality/security' };
  }
  if (input.classification === 'conditional') {
    if (input.evidence_present) {
      return { stage: input.stage, skip: true, reason: 'evidence already answers', evidence: input.stage };
    }
    if (input.investigation_stopped) {
      return { stage: input.stage, skip: true, reason: 'investigation stopped — no further value' };
    }
    return { stage: input.stage, skip: false, reason: 'conditional — no skip signal; run' };
  }
  // optional
  if (input.evidence_present) {
    return { stage: input.stage, skip: true, reason: 'evidence already answers', evidence: input.stage };
  }
  if (input.context_over) {
    return { stage: input.stage, skip: true, reason: 'context over budget — tighten, do not expand' };
  }
  return { stage: input.stage, skip: false, reason: 'optional — no skip signal; run' };
}

// ── Agent invocation control (§8) ───────────────────────────────────────────

export type InvocationInput = {
  agent: string;
  unique_responsibility: boolean;
  evidence_answers: boolean;
  stage_can_perform: boolean;
  expected_value_gt_cost: boolean;
};

export type InvocationVerdict = { agent: string; invoke: boolean; reason: string };

/**
 * Decide whether an agent earns invocation. Invoke only when the agent has
 * unique responsibility, evidence cannot answer, the stage cannot perform
 * itself, and expected value exceeds cost. Never invoke merely because the
 * agent exists in the crew. On refusal, name the first failing clause.
 */
export function evaluateInvocation(input: InvocationInput): InvocationVerdict {
  if (!input.unique_responsibility) {
    return { agent: input.agent, invoke: false, reason: 'no unique responsibility' };
  }
  if (input.evidence_answers) {
    return { agent: input.agent, invoke: false, reason: 'evidence already answers' };
  }
  if (input.stage_can_perform) {
    return { agent: input.agent, invoke: false, reason: 'stage can perform itself' };
  }
  if (!input.expected_value_gt_cost) {
    return { agent: input.agent, invoke: false, reason: 'expected value not greater than cost' };
  }
  return { agent: input.agent, invoke: true, reason: 'unique responsibility, evidence cannot answer, value exceeds cost' };
}

// ── Skill loading control (§9) ──────────────────────────────────────────────

export type SkillInput = {
  skill: string;
  required_by_task: boolean;
  required_by_policy: boolean;
  required_by_dependency: boolean;
  failing_verification: boolean;
};

export type SkillVerdict = { skill: string; load: boolean; reason: string };

/**
 * Decide whether a skill earns loading — minimum sufficient set (§9): load
 * only when required by the task, by policy, by a dependency, or by a failing
 * verification. Else refuse with the standard reason.
 */
export function shouldLoadSkill(input: SkillInput): SkillVerdict {
  if (input.required_by_task) return { skill: input.skill, load: true, reason: 'required by task' };
  if (input.required_by_policy) return { skill: input.skill, load: true, reason: 'required by policy' };
  if (input.required_by_dependency) return { skill: input.skill, load: true, reason: 'required by dependency' };
  if (input.failing_verification) return { skill: input.skill, load: true, reason: 'required by failing verification' };
  return { skill: input.skill, load: false, reason: 'not required by task/policy/dependency/verification' };
}

// ── Delegation optimization (§30, consumes delegateAt + laneBaseForLane) ────

export type DelegationInput = {
  lane: string;
  budget: number;
  tokens_used: number;
  threshold_pct: number;
  independent_tasks: number;
  parallel_value: number;
  estimated_overhead: number;
};

export type DelegationVerdict = {
  delegate: boolean;
  reason: string;
  budget_at: number;
  lane_base: number;
  parallel_value: number;
  overhead: number;
};

/**
 * Decide whether delegation is worthwhile. Closes the Phase-2 Q1 remainder:
 * budget ceiling = delegateAt(budget, threshold_pct); overhead floor = one
 * delegate costs at least one agent's context load (laneBaseForLane). Delegate
 * only when there are ≥2 independent tasks, parallel value beats the overhead
 * floor, and usage is inside the delegation budget. Else refuse naming the
 * failing clause.
 */
export function evaluateDelegation(input: DelegationInput): DelegationVerdict {
  const budget_at = delegateAt(input.budget, input.threshold_pct);
  const lane_base = laneBaseForLane(input.lane);
  const overhead = Math.max(input.estimated_overhead, lane_base);
  if (input.independent_tasks < 2) {
    return {
      delegate: false,
      reason: 'not enough independent tasks (needs >= 2)',
      budget_at,
      lane_base,
      parallel_value: input.parallel_value,
      overhead,
    };
  }
  if (input.parallel_value <= overhead) {
    return {
      delegate: false,
      reason: 'parallel value not greater than overhead',
      budget_at,
      lane_base,
      parallel_value: input.parallel_value,
      overhead,
    };
  }
  if (input.tokens_used > budget_at) {
    return {
      delegate: false,
      reason: 'over delegation budget',
      budget_at,
      lane_base,
      parallel_value: input.parallel_value,
      overhead,
    };
  }
  return {
    delegate: true,
    reason: 'parallel value exceeds overhead and within budget',
    budget_at,
    lane_base,
    parallel_value: input.parallel_value,
    overhead,
  };
}

// ── Completion detection (§19) ──────────────────────────────────────────────

export type CompletionInput = {
  acceptance_satisfied: boolean;
  implementation_complete: boolean;
  tests_complete: boolean;
  quality_gates_complete: boolean;
  evidence_collected: boolean;
};

export type CompletionVerdict = { complete: boolean; missing: string[]; reason: string };

const COMPLETION_FIELDS: Array<keyof CompletionInput> = [
  'acceptance_satisfied',
  'implementation_complete',
  'tests_complete',
  'quality_gates_complete',
  'evidence_collected',
];

/**
 * A mission is complete only when all five §19 conditions hold. `missing`
 * lists every condition still open; `reason` is `ready for closure` or the
 * comma-joined missing list.
 */
export function completionCheck(input: CompletionInput): CompletionVerdict {
  const missing = COMPLETION_FIELDS.filter((f) => !input[f]);
  if (missing.length === 0) {
    return { complete: true, missing: [], reason: 'ready for closure' };
  }
  return { complete: false, missing, reason: `missing: ${missing.join(', ')}` };
}

// ── Decision trail (§41) ────────────────────────────────────────────────────

/**
 * Record any skip/avoid/delegate/complete verdict as an optimization decision
 * with the `work-governor` actor. Thin wrapper over the sanitized
 * recordOptDecision (S2 — newline/CR stripped, no markdown injection).
 */
export function recordWorkDecision(
  missionDir: string,
  d: { decision: string; reason: string; evidence?: string },
): void {
  recordOptDecision(missionDir, {
    actor: 'work-governor',
    decision: d.decision,
    reason: d.reason,
    ...(d.evidence ? { evidence: d.evidence } : {}),
  });
}
