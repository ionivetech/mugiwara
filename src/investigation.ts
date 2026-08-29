// src/investigation.ts
// Phase 2 Context Governor — bounded investigation state machine
// (Native Cost Governor initiative, plan §51 Phase 2, spec §13).
//
// Honest boundary: Phase 2 produces the verdict + the audit record; the
// Phase-3+ consumer (Work Governor) supplies the inputs (pass state,
// acceptance/surface/path signals, unrelated files opened, repeated reads
// from the evidence registry) and acts on the verdict. Limits come from
// readInvestigationConfig (T3). Stop verdicts are emitted as optimization
// decision records via the sanitized recordOptDecision (T4's S2 fix).
import { recordOptDecision } from './cost.ts';

export type InvestigationStatus = {
  pass: number;
  stop: boolean;
  reason: '' | 'max passes' | 'max unrelated files' | 'repeated read' | 'objective met';
};

export type InvestigationInput = {
  pass: number;
  acceptance_mapped: boolean;
  surface_understood: boolean;
  path_established: boolean;
  unrelated_files_opened: number;
  repeated_reads: number;
  max_passes: number;
  max_unrelated_files: number;
  repeated_read_threshold: number;
};

/**
 * Evaluate the investigation against the three limits (spec §13) plus the
 * objective-met stop. Objective-met wins (stop condition first): when the
 * acceptance is mapped, the surface understood, and the path established,
 * the investigation stops regardless of the counters. Otherwise stop at the
 * first limit that fires — max passes (>=), max unrelated files (>), or
 * repeated reads (>= threshold). Else continue.
 */
export function evaluateInvestigation(input: InvestigationInput): InvestigationStatus {
  const { pass } = input;
  if (input.acceptance_mapped && input.surface_understood && input.path_established) {
    return { pass, stop: true, reason: 'objective met' };
  }
  if (pass >= input.max_passes) {
    return { pass, stop: true, reason: 'max passes' };
  }
  if (input.unrelated_files_opened > input.max_unrelated_files) {
    return { pass, stop: true, reason: 'max unrelated files' };
  }
  if (input.repeated_reads >= input.repeated_read_threshold) {
    return { pass, stop: true, reason: 'repeated read' };
  }
  return { pass, stop: false, reason: '' };
}

/**
 * Record a stop verdict as an optimization decision when status.stop.
 * Reuses recordOptDecision (sanitized, S2). Records nothing when not stopped.
 */
export function recordInvestigationStop(
  missionDir: string,
  status: InvestigationStatus,
  evidence?: string,
): void {
  if (!status.stop) return;
  recordOptDecision(missionDir, {
    actor: 'cost-governor',
    decision: 'stop investigation',
    reason: status.reason,
    ...(evidence ? { evidence } : {}),
  });
}
