// src/budget.ts
// Context budget as a gate: a mission's trail is itself
// context the next reader must load. At archive time, measure the total
// footprint of the artifacts that survive and compare against the configured
// ceiling — a bloated trail is caught like a failed test, with a visible
// number in the report.
//
// Token telemetry stays honest elsewhere: the estimator remains the default;
// `tokens_source: reported` activates only where the harness exposes real
// usage (see docs/concepts/cost.md). This module does not estimate tokens.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readConfig } from './config.ts';

export function readBudgetConfig(projectDir: string): number {
  const cfg = readConfig(projectDir);
  const raw = cfg.context_budget_chars;
  if (raw === undefined || raw === '') return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Sum of bytes across the trail: top-level *.md + flows/* (legacy waves/* counts too). */
export function measureContextChars(missionDir: string): number {
  let total = 0;
  const add = (p: string): void => {
    try { total += statSync(p).size; } catch { /* vanished mid-measure */ }
  };
  for (const f of readdirSync(missionDir)) {
    if (/\.md$/.test(f)) add(join(missionDir, f));
  }
  for (const sub of ['flows', 'waves']) {
    const dir = join(missionDir, sub);
    if (existsSync(dir)) {
      for (const f of readdirSync(dir)) add(join(dir, f));
    }
  }
  return total;
}

export function formatFootprint(chars: number, budget: number): string {
  const base = `Context footprint: ${chars} chars`;
  if (!budget) return `${base} (no budget configured)`;
  return chars > budget
    ? `${base} — OVER budget ${budget}`
    : `${base} (budget ${budget})`;
}
