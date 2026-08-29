// src/scope.ts
// Phase 4 Scope & Code Governor — verdict engine + decision trail
// (Native Cost Governor initiative, plan §51 Phase 4, spec §5.4/§14/§15/§16/§38/§41).
//
// Turns the shipped primitives into auditable scope/code verdicts: scope drift
// detection, existing-code reuse checks, abstraction justification, dependency
// justification, minimum sufficient implementation policy, code waste detection,
// and change-surface measurement. Honest boundary (same as Phase 3 work.ts):
// this module PRODUCES and RECORDS verdicts; the LLM crew (workflow skill, T2)
// is the only thing that acts on them. It makes the decision structured,
// auditable, and instructed — it does not pretend a TS function can force the
// model.
//
// Every verdict is a pure function of explicit inputs (unit-testable, parity
// locked by fixtures) and every drift/reuse/abstraction/dependency/sufficient/
// waste/surface decision lands in the trail via recordScopeDecision →
// recordOptDecision (§41, S2 sanitizer).
import { recordOptDecision } from './cost.ts';

// ── Scope drift detection (§14/§51-1) ───────────────────────────────────────

export type ScopeDriftInput = {
  change: string;
  declared_scope: string[];
  touched_files: string[];
};

export type ScopeDriftVerdict = {
  change: string;
  drift: boolean;
  reason: string;
  scope_score: number;
};

/**
 * Detect scope drift: a touched file is in scope when it includes any
 * `declared_scope` token (substring match). `scope_score` is the fraction of
 * touched files outside scope (0 when none); drift holds when any file is
 * outside. Reason names the outside files or 'within declared scope'.
 */
export function detectScopeDrift(input: ScopeDriftInput): ScopeDriftVerdict {
  const outside = input.touched_files.filter(
    (f) => !input.declared_scope.some((tok) => f.includes(tok)),
  );
  const scope_score = input.touched_files.length === 0 ? 0 : outside.length / input.touched_files.length;
  if (outside.length === 0) {
    return { change: input.change, drift: false, reason: 'within declared scope', scope_score };
  }
  return {
    change: input.change,
    drift: true,
    reason: `outside declared scope: ${outside.join(', ')}`,
    scope_score,
  };
}

// ── Existing-code reuse checks (§14/§51-2) ──────────────────────────────────

export type ReuseInput = {
  change: string;
  existing_symbol: boolean;
  existing_component: boolean;
  existing_utility: boolean;
  existing_module: boolean;
  local_modification_viable: boolean;
};

export type ReuseVerdict = { change: string; reuse: boolean; reason: string };

/**
 * Reuse holds only when some existing code is present AND local modification
 * is viable — the §14 default: prefer reuse + local modification over new
 * architecture. Never returns reuse:true just because code exists; the reason
 * names whether the gap is "no existing code" vs "not viable" otherwise.
 */
export function checkExistingCodeReuse(input: ReuseInput): ReuseVerdict {
  const anyExisting =
    input.existing_symbol ||
    input.existing_component ||
    input.existing_utility ||
    input.existing_module;
  if (anyExisting && input.local_modification_viable) {
    return { change: input.change, reuse: true, reason: 'existing code reusable via local modification' };
  }
  if (anyExisting) {
    return { change: input.change, reuse: false, reason: 'existing code present but local modification not viable' };
  }
  return { change: input.change, reuse: false, reason: 'no existing code solves this' };
}

// ── Abstraction justification (§15/§51-3) ───────────────────────────────────

export type AbstractionInput = {
  abstraction: string;
  used_in_places: number;
  reduces_duplication: boolean;
  required_by_contract: boolean;
  speculative: boolean;
};

export type AbstractionVerdict = {
  abstraction: string;
  justified: boolean;
  reason: string;
  use_count: number;
};

/**
 * An abstraction is justified only when it is not speculative AND it is either
 * required by contract or used in ≥2 places with a duplication benefit. Rejects
 * speculative abstractions for hypothetical requirements; single-use
 * abstractions with no contract and no duplication benefit are refused.
 */
export function evaluateAbstraction(input: AbstractionInput): AbstractionVerdict {
  if (input.speculative) {
    return { abstraction: input.abstraction, justified: false, reason: 'speculative — no concrete requirement', use_count: input.used_in_places };
  }
  if (input.required_by_contract) {
    return { abstraction: input.abstraction, justified: true, reason: 'required by contract', use_count: input.used_in_places };
  }
  if (input.used_in_places >= 2 && input.reduces_duplication) {
    return { abstraction: input.abstraction, justified: true, reason: 'used in >= 2 places and reduces duplication', use_count: input.used_in_places };
  }
  return { abstraction: input.abstraction, justified: false, reason: 'single use, no contract, no duplication benefit', use_count: input.used_in_places };
}

// ── Dependency justification (§16/§51-4) ────────────────────────────────────

export type DependencyInput = {
  dependency: string;
  equivalent_available: boolean;
  solvable_with_existing: boolean;
  long_term_value: boolean;
  maintenance_cost: number;
  removed_cost: number;
};

export type DependencyVerdict = { dependency: string; justified: boolean; reason: string };

/**
 * A dependency is justified only when no equivalent is available, it is not
 * solvable with existing code, it carries long-term value, and its maintenance
 * cost does not exceed the cost of removing it (§16). Never justified merely
 * because it is convenient — the reason names the first failing clause.
 */
export function evaluateDependency(input: DependencyInput): DependencyVerdict {
  if (input.equivalent_available) {
    return { dependency: input.dependency, justified: false, reason: 'equivalent available' };
  }
  if (input.solvable_with_existing) {
    return { dependency: input.dependency, justified: false, reason: 'solvable with existing code' };
  }
  if (!input.long_term_value) {
    return { dependency: input.dependency, justified: false, reason: 'no long-term value' };
  }
  if (input.maintenance_cost > input.removed_cost) {
    return { dependency: input.dependency, justified: false, reason: 'maintenance cost exceeds removal cost' };
  }
  return { dependency: input.dependency, justified: true, reason: 'no equivalent, not solvable with existing, long-term value, maintenance within removal cost' };
}

// ── Minimum sufficient implementation policy (§15/§38/§51-5) ────────────────

export type SufficientInput = {
  change: string;
  necessary_complexity: number;
  incidental_complexity: number;
  verifiable: boolean;
  coverage_satisfied: boolean;
};

export type SufficientVerdict = {
  change: string;
  status: 'under' | 'over' | 'sufficient';
  sufficient: boolean;
  reason: string;
};

/**
 * Minimum sufficient implementation: `under` when required verification or
 * coverage is missing (never sacrifice quality — §38); `over` when incidental
 * complexity is added without need (§15 waste); else `sufficient`. Necessary
 * complexity is not penalized — this never optimizes for minimum LOC at the
 * expense of maintainability.
 */
export function minimumSufficientCheck(input: SufficientInput): SufficientVerdict {
  if (!input.verifiable) {
    return { change: input.change, status: 'under', sufficient: false, reason: 'not verifiable — under minimum' };
  }
  if (!input.coverage_satisfied) {
    return { change: input.change, status: 'under', sufficient: false, reason: 'coverage not satisfied — under minimum' };
  }
  if (input.incidental_complexity > 0) {
    return { change: input.change, status: 'over', sufficient: false, reason: 'incidental complexity added without need — over minimum' };
  }
  return { change: input.change, status: 'sufficient', sufficient: true, reason: 'minimum sufficient — verification and coverage satisfied, no incidental complexity' };
}

// ── Code waste detection (§15/§51-6) ────────────────────────────────────────

export type WasteInput = {
  change: string;
  unnecessary_helper: boolean;
  unnecessary_abstraction: boolean;
  unnecessary_wrapper: boolean;
  unnecessary_interface: boolean;
  unnecessary_config: boolean;
  unnecessary_dependency: boolean;
  unnecessary_generated_code: boolean;
  unnecessary_refactor: boolean;
};

export type WasteVerdict = { change: string; waste: boolean; reason: string; waste_types: string[] };

const WASTE_TYPES: Array<{ flag: keyof WasteInput; name: string }> = [
  { flag: 'unnecessary_helper', name: 'helper' },
  { flag: 'unnecessary_abstraction', name: 'abstraction' },
  { flag: 'unnecessary_wrapper', name: 'wrapper' },
  { flag: 'unnecessary_interface', name: 'interface' },
  { flag: 'unnecessary_config', name: 'config' },
  { flag: 'unnecessary_dependency', name: 'dependency' },
  { flag: 'unnecessary_generated_code', name: 'generated code' },
  { flag: 'unnecessary_refactor', name: 'refactor' },
];

/**
 * Detect §15 code waste: every true flag is named in `waste_types` (helper,
 * abstraction, wrapper, interface, config, dependency, generated code,
 * refactor). `waste` holds when any type is present; the reason joins them.
 */
export function detectCodeWaste(input: WasteInput): WasteVerdict {
  const waste_types = WASTE_TYPES.filter((t) => input[t.flag]).map((t) => t.name);
  if (waste_types.length === 0) {
    return { change: input.change, waste: false, reason: 'no code waste', waste_types: [] };
  }
  return { change: input.change, waste: true, reason: `unnecessary: ${waste_types.join(', ')}`, waste_types };
}

// ── Change-surface measurement (§5.4/§51-7) ─────────────────────────────────

export type SurfaceInput = {
  change: string;
  files_changed: number;
  loc_added: number;
  loc_removed: number;
  new_abstractions: number;
  new_dependencies: number;
  new_files: number;
  generated_boilerplate: number;
  within_declared_scope: boolean;
};

export type ChangeSurface = {
  files_changed: number;
  loc_added: number;
  loc_removed: number;
  loc_changed: number;
  new_abstractions: number;
  new_dependencies: number;
  new_files: number;
  generated_boilerplate: number;
  within_declared_scope: boolean;
};

export type SurfaceVerdict = {
  change: string;
  surface: ChangeSurface;
  justified: boolean;
  reason: string;
};

/**
 * Measure the change surface: `loc_changed = loc_added + loc_removed`. The
 * surface is justified only when the change stays inside the declared scope
 * and introduces no new abstractions or dependencies. This produces the §5.4
 * metric block the Phase-8 ledger consumes — this task measures, Phase 8
 * renders.
 */
export function measureChangeSurface(input: SurfaceInput): SurfaceVerdict {
  const surface: ChangeSurface = {
    files_changed: input.files_changed,
    loc_added: input.loc_added,
    loc_removed: input.loc_removed,
    loc_changed: input.loc_added + input.loc_removed,
    new_abstractions: input.new_abstractions,
    new_dependencies: input.new_dependencies,
    new_files: input.new_files,
    generated_boilerplate: input.generated_boilerplate,
    within_declared_scope: input.within_declared_scope,
  };
  if (!input.within_declared_scope) {
    return { change: input.change, surface, justified: false, reason: 'outside declared scope' };
  }
  if (input.new_abstractions > 0) {
    return { change: input.change, surface, justified: false, reason: 'introduces new abstraction' };
  }
  if (input.new_dependencies > 0) {
    return { change: input.change, surface, justified: false, reason: 'introduces new dependency' };
  }
  return { change: input.change, surface, justified: true, reason: 'proportional to declared scope — no new abstraction or dependency' };
}

// ── Decision trail (§41) ────────────────────────────────────────────────────

/**
 * Record any drift/reuse/abstraction/dependency/sufficient/waste/surface
 * verdict as an optimization decision with the `scope-governor` actor. Thin
 * wrapper over the sanitized recordOptDecision (S2 — newline/CR stripped, no
 * markdown injection).
 */
export function recordScopeDecision(
  missionDir: string,
  d: { decision: string; reason: string; evidence?: string },
): void {
  recordOptDecision(missionDir, {
    actor: 'scope-governor',
    decision: d.decision,
    reason: d.reason,
    ...(d.evidence ? { evidence: d.evidence } : {}),
  });
}
