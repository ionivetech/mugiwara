// src/cognition.ts
// Phase 5 Cognitive & Output Governor — focused reasoning, investigation
// termination, alternative limitation, output compression, duplicate detection,
// mission-focused output structure (Native Cost Governor, plan §51 Phase 5, §17/§18).
//
// Boundary: pure verdict functions over explicit inputs (unit-testable), plus a
// record helper that persists via the sanitized recordOptDecision (§41). No new
// config keys; savepoint.sh/lane-base.sh untouched. The crew acts — this module
// records.
import { fingerprint } from './evidence.ts';
import { recordOptDecision } from './cost.ts';

// ── Focused reasoning policy (§17) ──

export type ReasoningInput = {
  question: string;
  evidence_available: boolean;
  speculative_paths: number;
  reconsiderations: number;
  hypothetical_requirements: boolean;
  unrelated_implementations: number;
};

/**
 * Focused reasoning policy — Question→Evidence→Decision→Action.
 * Lists every §17 slop type present; focused only when none.
 */
export function isFocusedReasoning(input: ReasoningInput): {
  focused: boolean;
  reason: string;
  slop_types: string[];
} {
  const slop_types: string[] = [];
  if (input.speculative_paths > 0) slop_types.push('speculative_architecture');
  if (input.reconsiderations >= 2) slop_types.push('repeated_reconsideration');
  if (input.hypothetical_requirements) slop_types.push('hypothetical_requirements');
  if (input.unrelated_implementations > 0) slop_types.push('unrelated_implementations');
  const focused = slop_types.length === 0;
  const reason = focused
    ? 'Question→Evidence→Decision→Action — reasoning is focused'
    : `unfocused — ${slop_types.join(', ')}`;
  return { focused, reason, slop_types };
}

// ── Investigation termination (§13 re-consumed at cognition layer, §17) ──

export type CognitiveTerminationInput = {
  acceptance_mapped: boolean;
  surface_understood: boolean;
  path_established: boolean;
  passes: number;
  max_passes: number;
  unrelated_files_opened: number;
  repeated_reads: number;
  has_concrete_reason: boolean;
};

/**
 * Cognitive investigation termination — re-consumes the §13 triad at the
 * reasoning layer with a has_concrete_reason override. Triad-complete wins.
 */
export function shouldTerminateInvestigation(input: CognitiveTerminationInput): {
  terminate: boolean;
  reason: string;
} {
  if (input.acceptance_mapped && input.surface_understood && input.path_established) {
    return { terminate: true, reason: 'triad complete — terminate' };
  }
  if (input.passes >= input.max_passes) {
    if (input.has_concrete_reason) return { terminate: false, reason: 'continue — concrete reason present' };
    return { terminate: true, reason: 'max passes — terminate' };
  }
  if (input.unrelated_files_opened > 5) {
    if (input.has_concrete_reason) return { terminate: false, reason: 'continue — concrete reason present' };
    return { terminate: true, reason: 'max unrelated files — terminate' };
  }
  if (input.repeated_reads >= 2) {
    if (input.has_concrete_reason) return { terminate: false, reason: 'continue — concrete reason present' };
    return { terminate: true, reason: 'repeated read — terminate' };
  }
  if (input.has_concrete_reason) return { terminate: false, reason: 'continue — concrete reason present' };
  return { terminate: false, reason: 'continue — triad incomplete' };
}

// ── Alternative limitation (§17) ──

export type AlternativeInput = {
  alternatives: string[];
  evidence_backed: boolean[];
  max_alternatives: number;
};

/**
 * Bound alternatives to evidence-backed options within max_alternatives.
 * Dropped = beyond max OR without evidence backing when at least one backed exists.
 */
export function limitAlternatives(input: AlternativeInput): {
  alternatives: string[];
  limited: boolean;
  reason: string;
  dropped: string[];
} {
  const max = input.max_alternatives ?? 3;
  const hasBacked = input.evidence_backed.some(Boolean);
  const kept: string[] = [];
  const dropped: string[] = [];
  for (let i = 0; i < input.alternatives.length; i++) {
    const alt = input.alternatives[i];
    const backed = input.evidence_backed[i] ?? false;
    if (i >= max) {
      dropped.push(alt);
    } else if (hasBacked && !backed) {
      dropped.push(alt);
    } else {
      kept.push(alt);
    }
  }
  const limited = dropped.length > 0;
  const reason = limited
    ? `bounded to ${kept.length} evidence-backed alternatives`
    : 'all alternatives within bound';
  return { alternatives: kept, limited, reason, dropped };
}

// ── Output compression (§18) ──

export type CompressionInput = {
  output: string;
  essential_sections: string[];
};

export function compressOutput(input: CompressionInput): {
  compressed: string;
  saved_chars: number;
  reason: string;
  well_structured: boolean;
} {
  const well_structured = input.essential_sections.length >= 2;
  const lines = input.output.split('\n');
  const headingIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (input.essential_sections.some((h) => lines[i].includes(h))) headingIndices.push(i);
  }
  let compressed: string;
  if (headingIndices.length === 0) {
    compressed = '';
  } else {
    const kept: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const near = headingIndices.some((hi) => Math.abs(i - hi) <= 2);
      if (near) kept.push(lines[i]);
    }
    compressed = kept.join('\n');
  }
  const saved_chars = input.output.length - compressed.length;
  const reason =
    saved_chars > 0
      ? `compressed — saved ${saved_chars} chars`
      : well_structured
        ? 'compressed — well structured'
        : 'no compression — not well structured';
  return { compressed, saved_chars, reason, well_structured };
}

// ── Duplicate explanation detection (§17/§18, reuses fingerprint) ──

export type DuplicateInput = {
  explanations: string[];
};

export function detectDuplicateExplanation(input: DuplicateInput): {
  duplicate: boolean;
  reason: string;
  duplicate_groups: string[][];
} {
  const groups = new Map<string, string[]>();
  for (const exp of input.explanations) {
    const fp = fingerprint(exp);
    const arr = groups.get(fp);
    if (arr) arr.push(exp);
    else groups.set(fp, [exp]);
  }
  const duplicate_groups: string[][] = [];
  for (const arr of groups.values()) {
    if (arr.length >= 2) duplicate_groups.push(arr);
  }
  const duplicate = duplicate_groups.length > 0;
  const reason = duplicate
    ? `${duplicate_groups.length} duplicate group(s) — ${duplicate_groups.length} duplicate explanation(s) found`
    : 'no duplicate explanations';
  return { duplicate, reason, duplicate_groups };
}

// ── Mission-focused output structure (§18) ──

export type StructureInput = {
  output: string;
  has_decision: boolean;
  has_action: boolean;
  has_result: boolean;
  has_evidence: boolean;
  has_blocker: boolean;
};

export function structureOutput(input: StructureInput): {
  well_structured: boolean;
  missing: string[];
  reason: string;
} {
  const missing: string[] = [];
  if (!input.has_decision) missing.push('Decision');
  if (!input.has_evidence) missing.push('Evidence');
  // Action/Result/Blocker are optional — only Decision+Evidence are required
  // for well_structured (matches acceptance: Decision+Evidence present → true).
  const well_structured = missing.length === 0;
  const reason = well_structured
    ? 'Decision/Action/Result/Evidence/Blocker — mission-focused'
    : `missing: ${missing.join(', ')}`;
  return { well_structured, missing, reason };
}

// ── Decision trail (§41) ──

export function recordCognitiveDecision(
  missionDir: string,
  d: { decision: string; reason: string; evidence?: string },
): void {
  recordOptDecision(missionDir, {
    actor: 'cognitive-governor',
    decision: d.decision,
    reason: d.reason,
    ...(d.evidence ? { evidence: d.evidence } : {}),
  });
}
