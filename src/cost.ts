// src/cost.ts
// Cost Governor — Phase 1 foundation (Native Cost Governor initiative, plan §51).
//
// Centralizes the budget/threshold math that was duplicated across the repo:
// scripts/lib/lane-base.sh owns the constants for the SHELL runtime
// (savepoint.sh reads it and cannot import TS), and this module is the single
// TS-side mirror — consumed by src/mission.ts (archive cost section) and the
// record helpers below. A drift between the two is a CI failure, not a
// display nit: test/cost.test.ts asserts every constant against lane-base.sh
// (D5, same pattern as scripts/lane-base.ts).
//
// Also introduces the two record primitives later phases build on:
//   - cost events        → append-only JSONL per mission (cost-events.jsonl)
//   - optimization decisions → structured rows in decisions.md
//     (## Cost governor decisions section — the trail plan §41 asks for)
//
// Pure functions first; I/O helpers at the bottom. Nothing here estimates
// tokens — token telemetry stays in savepoint.sh (estimator or reported).
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ContextMetrics } from './context.ts';

// ── Lane constants (MUST equal scripts/lib/lane-base.sh — enforced by test) ──

export const LANE_BASE: Record<string, number> = {
  lean: 8421,
  standard: 13325,
  full: 22016,
  spike: 5411,
};

export const LANE_BUDGET: Record<string, number> = {
  lean: 12000,
  standard: 25000,
  full: 50000,
  spike: 3000,
};

/** Token estimate for skills/agents loaded in this lane (0 for unknown/direct). */
export function laneBaseForLane(lane: string): number {
  return LANE_BASE[lane] ?? 0;
}

/** Budget for this lane (0 for unknown/direct — matches savepoint.sh). */
export function budgetForLane(lane: string): number {
  return LANE_BUDGET[lane] ?? 0;
}

// ── Thresholds — savepoint.sh exact integer math (`BUDGET * 3 / 2`, `BUDGET * 3`) ──

/** Warn threshold: integer division `budget * 3 / 2` — same as `$(( BUDGET * 3 / 2 ))`. */
export function warnAt(budget: number): number {
  return Math.floor((budget * 3) / 2);
}

/** Stop threshold: `budget * 3` — same as `$(( BUDGET * 3 ))`. */
export function stopAt(budget: number): number {
  return budget * 3;
}

/** Token budget gate — replicating savepoint.sh: stop at 3×, warn at 1.5×, else ok. Budget 0 → ok. */
export function budgetStatus(budget: number, tokens: number): 'ok' | 'warn' | 'stop' {
  if (budget > 0 && tokens >= stopAt(budget)) return 'stop';
  if (budget > 0 && tokens >= warnAt(budget)) return 'warn';
  return 'ok';
}

/** Delegation threshold — same as `$(( BUDGET * DELEGATE_THRESHOLD / 100 ))`. */
export function delegateAt(budget: number, thresholdPct: number): number {
  // clamp threshold to [1,100] before the integer division — matches
  // savepoint.sh's clamp (DELEGATE_THRESHOLD clamped 1..100, scripts/savepoint.sh)
  const t = Math.min(100, Math.max(1, thresholdPct));
  return Math.floor((budget * t) / 100);
}

// ── Normalized cost envelope (computed, never stored — state.json convention) ──

export type CostEnvelopeInput = { lane?: string; budget?: number; tokens_est?: number };

export type CostEnvelope = {
  planned: number;
  used: number;
  remaining: number;
  pct: number;
  warn_at: number;
  stop_at: number;
  status: 'ok' | 'warn' | 'stop';
};

/** Normalize stored primitives (tokens_est, budget, lane) into one read model. */
export function costEnvelope(state: CostEnvelopeInput): CostEnvelope {
  const planned = typeof state.budget === 'number' && state.budget > 0
    ? state.budget
    : budgetForLane(state.lane ?? '');
  const used = typeof state.tokens_est === 'number' ? state.tokens_est : 0;
  const remaining = Math.max(planned - used, 0);
  const pct = planned > 0 ? Math.round((used / planned) * 100) : 0;
  return {
    planned,
    used,
    remaining,
    pct,
    warn_at: warnAt(planned),
    stop_at: stopAt(planned),
    status: budgetStatus(planned, used),
  };
}

// ── Cost events — append-only JSONL per mission ──

export type CostEvent = {
  ts: string;
  kind: string; // 'closure' | 'savepoint' | … future kinds
  mission: string;
  tokens_est: number;
  budget: number;
  status: string;
  context_chars?: number;
  // Phase 2 (T6): context budget status (chars gate) + efficiency metrics,
  // kept apart from the token `status` — C2 never conflates the two budgets.
  context_status?: 'ok' | 'over';
  context_metrics?: ContextMetrics;
};

const COST_EVENTS_FILE = 'cost-events.jsonl';

function isAllowedMissionDir(dir: string): boolean {
  if (!dir || dir.includes('..')) return false;
  if (dir.includes('.mugiwara/missions')) return true;
  if (dir.includes('mugiwara-')) return true;
  return false;
}
function assertMissionDir(dir: string): void {
  if (!isAllowedMissionDir(dir)) throw new Error(`Invalid missionDir: ${dir}`);
}

/**
 * Append one cost event as a single JSON line. Append-only: no
 * read-modify-write, so concurrent writers never clobber each other. The
 * file lives next to the mission state and folds into report.md at archive.
 */
export function appendCostEvent(missionDir: string, event: Omit<CostEvent, 'ts'>): void {
  assertMissionDir(missionDir);
  mkdirSync(missionDir, { recursive: true });
  const line: CostEvent = Object.assign({ ts: new Date().toISOString() }, event);
  appendFileSync(join(missionDir, COST_EVENTS_FILE), JSON.stringify(line) + '\n', 'utf8');
}

// ── Optimization decision records — structured rows in decisions.md ──

export type OptDecision = {
  ts: string;
  actor: string;
  decision: string;
  reason: string;
  evidence?: string;
};

const DECISIONS_FILE = 'decisions.md';
const OPT_SECTION = '## Cost governor decisions';

/**
 * Append one optimization decision as a bullet under the
 * `## Cost governor decisions` section of decisions.md. Existing content is
 * never modified — only appended to. Creates the section header on first use.
 */
export function recordOptDecision(missionDir: string, d: Omit<OptDecision, 'ts'>): void {
  assertMissionDir(missionDir);
  mkdirSync(missionDir, { recursive: true });
  const file = join(missionDir, DECISIONS_FILE);
  let hasSection = false;
  try {
    hasSection = readFileSync(file, 'utf8').split(/\r?\n/).some((l) => l.trim() === OPT_SECTION);
  } catch { /* first write */ }
  const ts = new Date().toISOString();
  // flat fields by contract — strip newlines so no markdown/line injection
  // into decisions.md → report.md (S2). CR/LF become spaces.
  const flat = (s: string): string => s.replace(/[\r\n]+/g, ' ');
  const ev = d.evidence ? ` — evidence: ${flat(d.evidence)}` : '';
  const bullet = `- ${ts} — ${flat(d.actor)}: ${flat(d.decision)} — reason: ${flat(d.reason)}${ev}`;
  const body = hasSection ? `\n${bullet}\n` : `\n${OPT_SECTION}\n\n${bullet}\n`;
  appendFileSync(file, body, 'utf8');
}
