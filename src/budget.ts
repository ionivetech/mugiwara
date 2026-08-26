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
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function readBudgetConfig(projectDir: string): number {
  for (const base of [projectDir, homedir()]) {
    const file = join(base, '.mugiwara', 'config');
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      if (t.slice(0, eq).trim() !== 'context_budget_chars') continue;
      const n = Number(t.slice(eq + 1).trim());
      return Number.isFinite(n) && n > 0 ? n : 0;
    }
  }
  return 0; // unset — measurement still recorded, never enforced
}

/** Sum of bytes across the trail: top-level *.md + waves/*.*. */
export function measureContextChars(missionDir: string): number {
  let total = 0;
  const add = (p: string): void => {
    try { total += statSync(p).size; } catch { /* vanished mid-measure */ }
  };
  for (const f of readdirSync(missionDir)) {
    if (/\.md$/.test(f)) add(join(missionDir, f));
  }
  const waves = join(missionDir, 'waves');
  if (existsSync(waves)) {
    for (const f of readdirSync(waves)) add(join(waves, f));
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
