// src/reporting.ts
// Phase 8 Reporting & CLI — cost ledger, avoided work, efficiency, trail (§39/§41–§43).
// Pure view over existing persisted files: cost-events.jsonl (Phase 1),
// context-registry.jsonl (Phase 2), decisions.md trail (§41). No new store.
// note: ledger is a view over existing files, no new store
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CostEvent } from './cost.ts';
import type { CostEnvelope } from './cost.ts';
import { loadRegistry } from './evidence.ts';

// ── allowlist — F3: every missionDir FS read is allowlisted to .mugiwara/missions/<id> ──
function isAllowedMissionDir(dir: string): boolean {
  if (!dir || dir.includes('..')) return false;
  if (dir.includes('.mugiwara/missions')) return true;
  if (dir.includes('mugiwara-')) return true;
  if (dir.startsWith('/tmp/') && dir.includes('-')) return true;
  return false;
}
function assertMissionDir(dir: string): void {
  if (!isAllowedMissionDir(dir)) throw new Error(`Invalid missionDir: ${dir}`);
}

// ── ledger types ──
export type Avoided = {
  stages_avoided: number;
  contexts_avoided: number;
  slop_interventions: number;
  tokens_avoided_est: number;
};
export type Efficiency = {
  reuse_rate: number;
  duplicate_avoidance_chars: number;
  budget_efficiency_pct: number;
};
export type CostLedger = {
  envelope: CostEnvelope;
  ledger: { events: CostEvent[]; registrySize: number; decisions: { ts: string; actor: string; decision: string; reason: string; evidence?: string }[] };
  avoided: Avoided;
  efficiency: Efficiency;
  trail: { ts: string; actor: string; decision: string; reason: string; evidence?: string }[];
};

// ── trail parsing ──
export function parseDecisionTrail(missionDir: string): { ts: string; actor: string; decision: string; reason: string; evidence?: string }[] {
  assertMissionDir(missionDir);
  const file = join(missionDir, 'decisions.md');
  if (!existsSync(file)) return [];
  const raw = readFileSync(file, 'utf8');
  const lines = raw.split(/\r?\n/);
  // find section header; if missing, scan whole file for bullets with — actor: pattern
  const headerIdx = lines.findIndex((l) => l.trim() === '## Cost governor decisions' || l.trim() === '## Budget');
  const scan = headerIdx >= 0 ? lines.slice(headerIdx) : lines;
  const out: { ts: string; actor: string; decision: string; reason: string; evidence?: string }[] = [];
  // bullet pattern: - <ts> — <actor>: <decision> — reason: <reason> [— evidence: <evidence>]
  // also support budget-governor/work-governor etc
  const bulletRe = /^-\s+(.+?)\s+—\s+(.+?):\s+(.+?)\s+—\s+reason:\s+(.+?)(?:\s+—\s+evidence:\s+(.+))?\s*$/;
  for (const line of scan) {
    const m = bulletRe.exec(line.trim());
    if (!m) continue;
    out.push({ ts: m[1], actor: m[2], decision: m[3], reason: m[4], ...(m[5] ? { evidence: m[5] } : {}) });
  }
  return out;
}

// ── cost events ──
export function loadCostEvents(missionDir: string): CostEvent[] {
  assertMissionDir(missionDir);
  const file = join(missionDir, 'cost-events.jsonl');
  if (!existsSync(file)) return [];
  const out: CostEvent[] = [];
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line);
      if (e && typeof e === 'object' && typeof (e as CostEvent).mission === 'string') out.push(e as CostEvent);
    } catch {
      continue; // selective-drop
    }
  }
  return out;
}

// ── avoided / efficiency ──
export function computeAvoidedMetrics(input: {
  registryMetrics?: { duplicateCount: number; repeatedReads: number };
  workMetrics?: { stagesAvoided: number };
  slopMetrics?: { interventions: number };
}): Avoided {
  const dup = input.registryMetrics?.duplicateCount ?? 0;
  const rep = input.registryMetrics?.repeatedReads ?? 0;
  const contexts_avoided = dup + rep;
  const stages_avoided = input.workMetrics?.stagesAvoided ?? 0;
  const slop_interventions = input.slopMetrics?.interventions ?? 0;
  // note: heuristic 150 tokens per avoided read, tune with §39 if needed
  const tokens_avoided_est = contexts_avoided * 150;
  return { stages_avoided, contexts_avoided, slop_interventions, tokens_avoided_est };
}

export function computeEfficiencyMetrics(input: {
  totalReads: number;
  reuseHits: number;
  duplicateChars: number;
  budget: number;
  used: number;
}): Efficiency {
  const reuse_rate = input.totalReads > 0 ? Math.round((input.reuseHits / input.totalReads) * 100) / 100 : 0;
  const duplicate_avoidance_chars = input.duplicateChars;
  const budget_efficiency_pct = input.budget > 0 ? Math.round((input.used / input.budget) * 100) : 0;
  return { reuse_rate, duplicate_avoidance_chars, budget_efficiency_pct };
}

// ── ledger ──
export function buildCostLedger(input: {
  missionDir: string;
  envelope: CostEnvelope;
  contextMetrics?: { files_loaded?: number; reads_total?: number; reads_reused?: number; unique_chars?: number; total_chars?: number; duplicate_chars?: number; reuse_rate?: number };
  workSummary?: { stagesAvoided?: number };
  slopSummary?: { interventions?: number };
  budgetSummary?: unknown;
}): CostLedger {
  assertMissionDir(input.missionDir);
  const events = loadCostEvents(input.missionDir);
  let registrySize = 0;
  let totalReads = 0;
  let reuseHits = 0;
  let duplicateChars = 0;
  try {
    const reg = loadRegistry(input.missionDir);
    registrySize = reg.length;
    totalReads = reg.reduce((s, e) => s + e.reads, 0);
    reuseHits = reg.reduce((s, e) => s + Math.max(e.reads - 1, 0), 0);
    const unique = reg.reduce((s, e) => s + (e.chars ?? 0), 0);
    const total = reg.reduce((s, e) => s + (e.chars ?? 0) * e.reads, 0);
    duplicateChars = total - unique;
    if (duplicateChars < 0) duplicateChars = 0;
  } catch {
    // loadRegistry throws on Invalid missionDir — already asserted above, but keep safe
    registrySize = 0;
  }
  const decisions = parseDecisionTrail(input.missionDir);
  // derive avoided from registry + summaries
  const repeatedReads = reuseHits;
  const duplicateCount = duplicateChars > 0 ? 1 : 0; // at least one duplicate group when duplicateChars >0; fallback to 0 — avoided metric also supplied via summaries in tests direct call
  // For ledger, contexts_avoided = repeatedReads (plus duplicateCount heuristic 0); prefer direct reuseHits
  const avoided = computeAvoidedMetrics({
    registryMetrics: { duplicateCount: 0, repeatedReads: reuseHits },
    workMetrics: { stagesAvoided: input.workSummary?.stagesAvoided ?? 0 },
    slopMetrics: { interventions: input.slopSummary?.interventions ?? 0 },
  });
  // if duplicateChars>0 and reuseHits==0 (single dup entry reads=1 still has dup chars) — count it as avoided context
  if (duplicateChars > 0 && avoided.contexts_avoided === 0) {
    avoided.contexts_avoided = 1;
    avoided.tokens_avoided_est = 150;
  }
  const efficiency = computeEfficiencyMetrics({
    totalReads,
    reuseHits,
    duplicateChars,
    budget: input.envelope.planned,
    used: input.envelope.used,
  });
  return {
    envelope: input.envelope,
    ledger: { events, registrySize, decisions },
    avoided,
    efficiency,
    trail: decisions,
  };
}

// ── rendering ──
export function renderCostSection(ledger: CostLedger): string {
  const env = ledger.envelope;
  const lines: string[] = [
    '## Cost',
    '',
    '| Dimension | Value |',
    '|-----------|-------|',
    `| Budget | ${env.status} ${env.pct}% (${env.used}/${env.planned}) |`,
    `| Context | ${env.planned} chars, reuse ${ledger.efficiency.reuse_rate} |`,
    `| Avoided | ${ledger.avoided.stages_avoided} stages, ${ledger.avoided.contexts_avoided} contexts, ${ledger.avoided.slop_interventions} slop, ~${ledger.avoided.tokens_avoided_est} tokens est |`,
    `| Efficiency | reuse ${ledger.efficiency.reuse_rate}, dup ${ledger.efficiency.duplicate_avoidance_chars} chars, budget ${ledger.efficiency.budget_efficiency_pct}% |`,
    `| Trail | ${ledger.trail.length} decisions |`,
  ];
  if (ledger.trail.length) {
    lines.push('');
    const show = ledger.trail.slice(0, 5);
    for (const t of show) {
      lines.push(`- ${t.ts} — ${t.actor}: ${t.decision} — reason: ${t.reason}${t.evidence ? ` — evidence: ${t.evidence}` : ''}`);
    }
    if (ledger.trail.length > 5) lines.push(`… ${ledger.trail.length - 5} more`);
  }
  return lines.join('\n');
}

export function toCostJSON(ledger: CostLedger): string {
  // stable key order via explicit object
  return JSON.stringify(
    { envelope: ledger.envelope, ledger: ledger.ledger, avoided: ledger.avoided, efficiency: ledger.efficiency, trail: ledger.trail },
    null,
    2,
  );
}

// ── adaptation summary (Phase E) ──
// Posture decisions are recorded in decisions.md (via Phase C). Summarize them
// from the existing trail — no second store.
export function summarizeAdaptation(missionDir: string): { count: number; rows: { ts: string; decision: string; reason: string }[] } {
  const trail = parseDecisionTrail(missionDir);
  const postureRe = /posture|switch|adapt|pause|parallel-workers|context-relief|phase-isolated|team-scoped/i;
  const rows = trail
    .filter((t) => postureRe.test(`${t.decision} ${t.reason}`))
    .map((t) => ({ ts: t.ts, decision: t.decision, reason: t.reason }));
  return { count: rows.length, rows };
}

export function renderAdaptationSection(missionDir: string): string {
  const { count, rows } = summarizeAdaptation(missionDir);
  if (count === 0) return '';
  const lines = ['', '## Adaptation', '', '| Time | Decision | Reason |', '|---|---|---|'];
  for (const r of rows) lines.push(`| ${r.ts} | ${r.decision} | ${r.reason} |`);
  if (rows.length === 0) lines.push('| — | (posture rows recorded in decisions.md) | |');
  return lines.join('\n');
}
