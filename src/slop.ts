// src/slop.ts
// Phase 6 Stop-Slop Governor — slop taxonomy, detection signals, progress
// measurement, work-to-cost anomaly, intervention rules + 6 category detectors
// (Native Cost Governor, plan §51 Phase 6, §20–§24, §21).
//
// Boundary: pure verdict functions over explicit inputs (unit-testable), plus a
// record helper that persists via the sanitized recordOptDecision (§41). No new
// config keys; savepoint.sh/lane-base.sh untouched. The crew acts — this module
// records.

import { recordOptDecision } from './cost.ts';

// ── Slop taxonomy (§21) ──

export type SlopKind =
  | 'investigation'
  | 'context'
  | 'reasoning'
  | 'output'
  | 'code'
  | 'retry'
  | 'healing'
  | 'scope';

export const SLOP_TAXONOMY: Record<SlopKind, string> = {
  investigation: 'reading unrelated files / searching without narrowing / repeated exploration',
  context: 'repeated reads / duplicate content / irrelevant files',
  reasoning: 'speculative architecture / repeated reconsideration / hypothetical requirements',
  output: 'verbose output / duplicate explanations without compression',
  code: 'unnecessary abstraction / dependency / boilerplate without justification',
  retry: 'same action with same evidence repeatedly failing',
  healing: 'healing cycle with no fixes',
  scope: 'files outside declared scope without acceptance expansion',
};

/**
 * Classify a raw signal string into the §21 taxonomy via keyword match.
 * Returns null when the signal does not map to any known kind.
 */
export function classifySlop(signal: string): SlopKind | null {
  const s = signal.toLowerCase();
  if (s.includes('same command') || s.includes('same action') || s.includes('repeated command') || s.includes('retry') || s.includes('same evidence'))
    return 'retry';
  if (s.includes('healing') || s.includes('heal') || s.includes('fixes_in_cycle') || s.includes('no fixes'))
    return 'healing';
  if (s.includes('repeated file') || s.includes('repeated read') || s.includes('duplicate') || s.includes('irrelevant file') || s.includes('re-read'))
    return 'context';
  if (s.includes('unrelated file') || s.includes('exploration') || s.includes('investigation') || s.includes('searching without'))
    return 'investigation';
  if (s.includes('scope') || s.includes('out-of-scope') || s.includes('out of scope') || s.includes('declared scope') || s.includes('unrelated refactor'))
    return 'scope';
  if (s.includes('loc') || s.includes('boilerplate') || s.includes('abstraction') || s.includes('dependency') || s.includes('code slop'))
    return 'code';
  if (s.includes('speculative') || s.includes('reconsideration') || s.includes('hypothetical') || s.includes('reasoning slop'))
    return 'reasoning';
  if (s.includes('verbose') || s.includes('duplicate explanation') || s.includes('output slop') || s.includes('compress'))
    return 'output';
  return null;
}

// ── Detection signals (§22) ──

export type SlopSignal = { kind: SlopKind; signal: string; count: number; threshold: number };

export function detectSlopSignal(input: {
  kind: SlopKind;
  count: number;
  threshold: number;
  evidence_delta?: number;
}): { slop: boolean; reason: string } {
  const { kind, count, threshold, evidence_delta } = input;
  const hasGain = evidence_delta !== undefined && evidence_delta !== 0;
  const slop = count >= threshold && !hasGain;
  const reason = slop
    ? `slop: ${kind} — count ${count} ≥ threshold ${threshold} with no evidence gain`
    : `no slop: ${kind} — ${count < threshold ? `count ${count} < threshold ${threshold}` : `evidence gained (${evidence_delta})`}`;
  return { slop, reason };
}

// ── Progress measurement (§23) ──

export type ProgressSnapshot = {
  tokens_used: number;
  evidence_items: number;
  criteria_mapped: number;
  files_understood: number;
  tests_fixed: number;
  code_chars: number;
};

export function measureProgress(
  before: ProgressSnapshot,
  after: ProgressSnapshot,
): { progress: number; cost_delta: number; progress_per_cost: number; slop_signal: boolean; reason: string } {
  const evidenceDelta = after.evidence_items - before.evidence_items;
  const criteriaDelta = after.criteria_mapped - before.criteria_mapped;
  const testsDelta = after.tests_fixed - before.tests_fixed;
  const codeDelta = after.code_chars - before.code_chars;
  const codeProgress = codeDelta > 0 ? 1 : 0;
  const progress = evidenceDelta + criteriaDelta + testsDelta + codeProgress;
  const cost_delta = after.tokens_used - before.tokens_used;
  const progress_per_cost = cost_delta > 0 ? progress / cost_delta : 0;
  const slop_signal = cost_delta > 0 && progress === 0;
  const reason = slop_signal ? `slop — ${cost_delta} tokens with no progress` : `progress ${progress} over ${cost_delta} tokens`;
  return { progress, cost_delta, progress_per_cost, slop_signal, reason };
}

// ── Work-to-cost anomaly (§24) ──

export type AnomalyInput = { progress_per_cost: number; baseline_per_cost: number; drop_threshold?: number };

export function detectAnomaly(input: AnomalyInput): { anomaly: boolean; reason: string } {
  const threshold = input.drop_threshold ?? 0.5;
  if (input.baseline_per_cost <= 0) {
    return { anomaly: false, reason: 'no anomaly — baseline 0 or above threshold' };
  }
  const anomaly = input.progress_per_cost < input.baseline_per_cost * threshold;
  if (anomaly) {
    const pct = Math.round((1 - input.progress_per_cost / input.baseline_per_cost) * 100);
    return { anomaly: true, reason: `anomaly — ${pct}% drop below baseline` };
  }
  return { anomaly: false, reason: 'no anomaly — baseline 0 or above threshold' };
}

// ── Intervention rules (§20) ──

export type Intervention = 'tolerate' | 'stop' | 'compress' | 'escalate';
export type InterventionInput = {
  kind: SlopKind;
  slop: boolean;
  severity: 'harmless' | 'wasteful' | 'harmful';
  progress_stalled: boolean;
};

export function decideIntervention(input: InterventionInput): { intervention: Intervention; reason: string } {
  if (!input.slop) return { intervention: 'tolerate', reason: `tolerate — no slop for ${input.kind}` };
  if (input.severity === 'harmful') return { intervention: 'escalate', reason: `escalate — ${input.kind} harmful slop` };
  if (input.severity === 'wasteful') return { intervention: 'stop', reason: `stop — ${input.kind} wasteful slop` };
  // harmless
  if (input.progress_stalled) return { intervention: 'compress', reason: `compress — ${input.kind} harmless but stalled` };
  return { intervention: 'tolerate', reason: `tolerate — ${input.kind} harmless slop` };
}

// ── Retry slop (§21.6/§31) ──

export type RetryInput = {
  action: string;
  evidence_fingerprint: string;
  outcome: 'fail' | 'pass';
  history: { action: string; evidence_fingerprint: string; outcome: string }[];
};

export function detectRetrySlop(input: RetryInput): { slop: boolean; reason: string; kind: SlopKind } {
  const kind: SlopKind = 'retry';
  if (input.outcome !== 'fail') return { slop: false, reason: 'no slop — outcome is pass', kind };
  const found = input.history.some((h) => h.action === input.action && h.evidence_fingerprint === input.evidence_fingerprint && h.outcome === 'fail');
  if (found) return { slop: true, reason: `slop: retry — same action ${input.action} with same evidence ${input.evidence_fingerprint} repeatedly failing`, kind };
  return { slop: false, reason: 'no slop — no matching failed history', kind };
}

// ── Healing slop (§21.7/§32) ──

export type HealingInput = { cycle: number; fixes_in_cycle: number; history_fixes: number[]; max_cycles?: number };

export function detectHealingSlop(input: HealingInput): { slop: boolean; reason: string; kind: SlopKind } {
  const kind: SlopKind = 'healing';
  const max = input.max_cycles ?? 3;
  const hasZeroHistory = input.history_fixes.some((n) => n === 0);
  if (input.fixes_in_cycle === 0 && hasZeroHistory) {
    return { slop: true, reason: `slop: healing — no fixes in cycle ${input.cycle} with previous zero-fix cycle`, kind };
  }
  if (input.cycle >= max && input.fixes_in_cycle === 0) {
    return { slop: true, reason: `slop: healing — cycle ${input.cycle} ≥ max ${max} with no fixes`, kind };
  }
  return { slop: false, reason: 'no slop — healing making progress', kind };
}

// ── Scope slop (§21.8) ──

export type ScopeSlopInput = {
  files_changed: string[];
  declared_scope: string[];
  acceptance_expanded: boolean;
  unrelated_refactors: string[];
};

export function detectScopeSlop(input: ScopeSlopInput): { slop: boolean; reason: string; kind: SlopKind } {
  const kind: SlopKind = 'scope';
  const outOfScope = input.files_changed.filter((f) => !input.declared_scope.includes(f));
  const hasScopeDrift = outOfScope.length > 0 || input.unrelated_refactors.length > 0;
  if (hasScopeDrift && !input.acceptance_expanded) {
    const names = [...outOfScope, ...input.unrelated_refactors].join(', ');
    return { slop: true, reason: `slop: scope — out-of-scope ${names} without acceptance expansion`, kind };
  }
  return { slop: false, reason: 'no scope slop — within declared scope or acceptance expanded', kind };
}

// ── Context slop (§21.2/§12) ──

export type ContextSlopInput = {
  repeated_reads: number;
  repeated_read_threshold: number;
  duplicate_chars: number;
  irrelevant_files: string[];
};

export function detectContextSlop(input: ContextSlopInput): { slop: boolean; reason: string; kind: SlopKind } {
  const kind: SlopKind = 'context';
  const signals: string[] = [];
  if (input.repeated_reads >= input.repeated_read_threshold) signals.push(`repeated reads ${input.repeated_reads} ≥ ${input.repeated_read_threshold}`);
  if (input.duplicate_chars > 0) signals.push(`duplicate chars ${input.duplicate_chars}`);
  if (input.irrelevant_files.length > 0) signals.push(`irrelevant files ${input.irrelevant_files.join(', ')}`);
  if (signals.length > 0) return { slop: true, reason: `slop: context — ${signals.join('; ')}`, kind };
  return { slop: false, reason: 'no context slop', kind };
}

// ── Investigation slop (§21.1/§13) ──

export type InvestigationSlopInput = {
  unrelated_files_opened: number;
  max_unrelated_files: number;
  repeated_reads: number;
  repeated_read_threshold: number;
  exploration_passes: number;
  max_passes: number;
  acceptance_mapped: boolean;
  has_concrete_reason: boolean;
};

export function detectInvestigationSlop(input: InvestigationSlopInput): { slop: boolean; reason: string; kind: SlopKind } {
  const kind: SlopKind = 'investigation';
  if (input.has_concrete_reason) return { slop: false, reason: 'no investigation slop — concrete reason present', kind };
  const breaches: string[] = [];
  if (input.unrelated_files_opened > input.max_unrelated_files) breaches.push(`unrelated files ${input.unrelated_files_opened} > ${input.max_unrelated_files}`);
  if (input.repeated_reads >= input.repeated_read_threshold) breaches.push(`repeated reads ${input.repeated_reads} ≥ ${input.repeated_read_threshold}`);
  if (input.exploration_passes >= input.max_passes) breaches.push(`passes ${input.exploration_passes} ≥ ${input.max_passes}`);
  if (breaches.length > 0) return { slop: true, reason: `slop: investigation — ${breaches.join('; ')}`, kind };
  return { slop: false, reason: 'no investigation slop', kind };
}

// ── Code slop (§21.5/§15) ──

export type CodeSlopInput = {
  new_abstractions: number;
  new_dependencies: number;
  loc_added: number;
  acceptance_expanded: boolean;
  justification_provided: boolean;
  boilerplate_chars: number;
};

export function detectCodeSlop(input: CodeSlopInput): { slop: boolean; reason: string; kind: SlopKind } {
  const kind: SlopKind = 'code';
  if (input.acceptance_expanded || input.justification_provided) {
    return { slop: false, reason: 'no code slop — acceptance expanded or justified', kind };
  }
  const signals: string[] = [];
  if (input.new_abstractions > 0) signals.push(`abstractions ${input.new_abstractions}`);
  if (input.new_dependencies > 0) signals.push(`dependencies ${input.new_dependencies}`);
  if (input.boilerplate_chars > 0) signals.push(`boilerplate ${input.boilerplate_chars} chars`);
  if (input.loc_added > 100) signals.push(`loc ${input.loc_added}`);
  if (signals.length > 0) return { slop: true, reason: `slop: code — ${signals.join('; ')} without acceptance or justification`, kind };
  return { slop: false, reason: 'no code slop', kind };
}

// ── Decision trail (§41) ──

export function recordSlopDecision(
  missionDir: string,
  d: { decision: string; reason: string; evidence?: string; kind?: SlopKind },
): void {
  const prefix = d.kind ? `[${d.kind}] ` : '';
  recordOptDecision(missionDir, {
    actor: 'slop-governor',
    decision: `${prefix}${d.decision}`,
    reason: d.reason,
    evidence: d.evidence,
  });
}

// ── Live wiring (§3.3) ──
// Runs the existing detectors over state already available at ledger-build time
// (state.json heal cycle, context-registry repeated reads). One call site feeds
// the ledger's slopMetrics.interventions so it stops reading 0. Per-crew
// attribution: healing → Brook (Flow 8), context → all.
export type LiveSlopResult = {
  interventions: number;
  perRole: Record<string, number>;
  rows: { role: string; kind: SlopKind; reason: string }[];
};

export function computeLiveSlop(input: {
  heal_cycle: number;
  repeated_reads: number;
  repeated_read_threshold?: number;
  max_heal_cycles?: number;
}): LiveSlopResult {
  const rows: { role: string; kind: SlopKind; reason: string }[] = [];
  const thr = input.repeated_read_threshold ?? 3;
  const heal = detectHealingSlop({ cycle: input.heal_cycle, fixes_in_cycle: 0, history_fixes: [], max_cycles: input.max_heal_cycles ?? 3 });
  if (heal.slop) rows.push({ role: 'Brook', kind: 'healing', reason: heal.reason });
  if (input.repeated_reads >= thr) rows.push({ role: 'all', kind: 'context', reason: `repeated reads ${input.repeated_reads} ≥ ${thr}` });
  const perRole: Record<string, number> = {};
  for (const r of rows) perRole[r.role] = (perRole[r.role] ?? 0) + 1;
  return { interventions: rows.length, perRole, rows };
}
