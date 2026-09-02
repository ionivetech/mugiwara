#!/usr/bin/env bun
// scripts/lane-base.ts — G5: validate LANE_BASE constants against measured
// content instruction load. Each lane loads a fixed set of skills + agents
// (wave owners from docs/concepts/workflow.md). The honest base is the sum of
// their body word-sums × 1.35 tokens/word. A constant that drifts more than
// the tolerance from that load fails — content growth must be reflected in
// lane-base.sh, or the estimate is a lie (D5).
//
// Run: bun scripts/lane-base.ts        — validate (CI gate)
//      bun scripts/lane-base.ts --show — print computed load per lane

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const skills = join(root, 'content', 'skills');
const agents = join(root, 'content', 'agents');

// wave → owning skill + agent (workflow.md rows)
const WAVE_OWNER: Record<string, [string, string]> = {
  '0': ['mugiwara-orchestration', 'luffy-orchestrator'],
  '1': ['mugiwara-brainstorm', 'usopp-brainstorm'],
  '2': ['mugiwara-planning', 'nami-planner'],
  '3': ['mugiwara-execution', 'zoro-execution'],
  '4': ['mugiwara-checkpoint', 'chopper-checkpoint'],
  '4.5': ['mugiwara-claim-audit', 'skeptic-verifier'],
  '5': ['mugiwara-quality', 'sanji-quality'],
  '6': ['mugiwara-gates', 'franky-gates'],
  '7': ['mugiwara-review', 'robin-reviewer'],
  '8': ['mugiwara-healing', 'brook-healing'],
};

// skills always loaded regardless of lane: none — resume/lessons only load
// mid-mission on interruption, too cheap to count as a lane base.
const ALWAYS: Array<[string, string]> = [];

const LANE_WAVES: Record<string, string[]> = {
  direct: [],
  lean: ['0', '3', '5'],
  standard: ['0', '2', '3', '4', '7'],
  full: ['0', '1', '2', '3', '4', '4.5', '5', '6', '7', '8'],
  spike: ['0', '1'],
};

const TOKENS_PER_WORD = 1.35;
const TOLERANCE = 0.2; // ±20% — a real drift, not rounding

function wordCount(file: string): number {
  if (!existsSync(file)) return 0;
  return readFileSync(file, 'utf8').split(/\s+/).filter(Boolean).length;
}

function laneLoad(lane: string): number {
  const waves = LANE_WAVES[lane] ?? [];
  const owners: Array<[string, string]> = [...ALWAYS];
  for (const w of waves) {
    if (WAVE_OWNER[w]) owners.push(WAVE_OWNER[w]);
  }
  let words = 0;
  for (const [skill, agent] of owners) {
    words += wordCount(join(skills, skill, 'SKILL.md'));
    words += wordCount(join(agents, agent + '.md'));
  }
  return Math.round(words * TOKENS_PER_WORD);
}

// constants live in scripts/lib/lane-base.sh — parse them, not hardcode
function parseConstants(): Record<string, { base: number; budget: number }> {
  const text = readFileSync(join(root, 'scripts', 'lib', 'lane-base.sh'), 'utf8');
  const out: Record<string, { base: number; budget: number }> = {};
  for (const lane of ['lean', 'standard', 'full', 'spike']) {
    const base = text.match(new RegExp(`LANE_BASE_${lane}=(\\d+)`));
    const budget = text.match(new RegExp(`BUDGET_${lane}=(\\d+)`));
    out[lane] = {
      base: base ? parseInt(base[1], 10) : 0,
      budget: budget ? parseInt(budget[1], 10) : 0,
    };
  }
  return out;
}

const SHOW = process.argv.includes('--show');
const lanes = ['direct', 'lean', 'standard', 'full', 'spike'];
let failures = 0;

const constants = parseConstants();
for (const lane of lanes) {
  const computed = laneLoad(lane);
  const declared = constants[lane]?.base ?? 0;
  if (SHOW) {
    console.log(`${lane.padEnd(9)} computed=${computed.toString().padEnd(6)} declared=${declared} budget=${constants[lane]?.budget ?? 0}`);
  }
  // direct runs no pipeline — base 0 is correct by design, skip
  if (lane === 'direct') continue;
  // spike is a deliberate floor (resize lane, brainstorm only) — not
  // content-derived, never validated
  if (lane === 'spike') continue;
  if (declared === 0) {
    console.log(`  ✗ ${lane}: LANE_BASE is 0 — missing constant in lane-base.sh`);
    failures++;
    continue;
  }
  const drift = Math.abs(computed - declared) / declared;
  if (drift > TOLERANCE) {
    console.log(`  ✗ ${lane}: LANE_BASE ${declared} drifts ${(drift * 100).toFixed(0)}% from computed load ${computed} — update lane-base.sh`);
    failures++;
  }
}

// A lane whose base exceeds its budget is born in `warn` — the budget is then
// noise rather than a signal. (B5)
for (const lane of ['lean', 'standard', 'full', 'spike']) {
  const base = constants[lane]?.base ?? 0;
  const budget = constants[lane]?.budget ?? 0;
  if (base >= budget) {
    console.log(`  ✗ LANE_BASE_${lane} (${base}) >= BUDGET_${lane} (${budget}) — every mission starts over budget`);
    failures++;
  }
  const pct = budget ? Math.round((base / budget) * 100) : 100;
  if (pct > 80) {
    console.log(`  ✗ LANE_BASE_${lane} is ${pct}% of BUDGET_${lane} — leaves no headroom (target ≤70%)`);
    failures++;
  }
}

if (failures > 0) {
  console.log(`\nlane-base: ${failures} constant(s) drifted from content load`);
  process.exit(1);
}
console.log('\nlane-base: constants match content load');
