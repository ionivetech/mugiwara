// src/context.ts
// Phase 2 Context Governor — context accounting, budget gate, and efficiency
// metrics (Native Cost Governor initiative, plan §51 Phase 2, spec §10/§52).
//
// Boundary: savepoint.sh measures TOKENS (and gates the lane token budget); it
// does NOT measure context. There is no shell-side context measurement to
// mirror, so this TS module is the single definition of context accounting.
// The chars→tokens estimate here is deliberately separate from the lane token
// budget: `contextStatus` gates on `context_budget_chars`, never on tokens
// (C2 — never conflate the two budgets).
import { measureContextChars as budgetMeasureContextChars } from './budget.ts';

/**
 * Trail character count — REUSED from src/budget.ts, never re-implemented
 * (single implementation; test locks the equality). Sum of bytes across the
 * trail's markdown artifacts, i.e. the context a future reader must load.
 */
export const measureContextChars = budgetMeasureContextChars;

/**
 * Estimate chars→tokens at a documented 4 chars / token ratio.
 * note: coarse fixed ratio; refine when the harness exposes provider
 * token telemetry for the actual loaded context.
 */
export function estContextTokens(chars: number): number {
  return Math.round(chars / 4);
}

/**
 * Context budget gate on `context_budget_chars`. Mirrors the archive-time
 * closure throw (chars > budget) as a pure, tested gate. Budget 0 (not
 * configured) → 'ok'. This is a CHAR threshold — never compare token `est`
 * against it (C2).
 */
export function contextStatus(budgetChars: number, chars: number): 'ok' | 'over' {
  return budgetChars > 0 && chars > budgetChars ? 'over' : 'ok';
}

export type ContextMetrics = {
  files_loaded: number;
  repeated_reads: number;
  duplicate_chars: number;
  reuse_rate: number;
  read_avoidance_chars: number;
};

export type ContextMetricStats = {
  files_loaded: number;
  reads_total: number;
  reads_reused: number;
  unique_chars: number;
  total_chars: number;
  repeated_reads: number;
};

/**
 * Context-efficiency metrics from the evidence registry + accounting stats.
 * reuse_rate = reads_reused / reads_total (0 when total 0 — never NaN/Infinity).
 * duplicate_chars = total − unique (bytes re-read); read_avoidance = duplicate
 * (bytes not reloaded by reuse). Pure.
 */
export function computeContextMetrics(stats: ContextMetricStats): ContextMetrics {
  const reuse_rate = stats.reads_total > 0 ? stats.reads_reused / stats.reads_total : 0;
  const duplicate_chars = stats.total_chars - stats.unique_chars;
  return {
    files_loaded: stats.files_loaded,
    repeated_reads: stats.repeated_reads,
    duplicate_chars,
    reuse_rate,
    read_avoidance_chars: duplicate_chars,
  };
}
