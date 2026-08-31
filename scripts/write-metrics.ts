#!/usr/bin/env bun
// scripts/write-metrics.ts — generate .metrics/latest.json from gate outputs
// Deterministic, no network. Runs retrieval-eval --json and verify-install --json.

import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');

function extractJson(output: string): any {
  const idx = output.indexOf('{');
  if (idx === -1) throw new Error('no JSON found in output: ' + output.slice(0, 200));
  return JSON.parse(output.slice(idx));
}

function runJson(cmd: string): any {
  // execSync returns stdout only; retrieval prints a rank line before JSON on stdout
  // so we slice from first '{'
  const out = execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  return extractJson(out);
}

// retrieval: need probes, rank1_rate, index_size
let ret: any;
let ver: any;
try {
  ret = runJson('bun scripts/retrieval-eval.ts --json');
} catch (e: any) {
  // if process exits non-zero, stdout still contains JSON + rank line; try to parse from error stdout
  const out = e.stdout?.toString() ?? e.message ?? '';
  if (out.includes('{')) ret = extractJson(out);
  else throw e;
}

try {
  ver = runJson('bun scripts/verify-install.ts --json');
} catch (e: any) {
  const out = e.stdout?.toString() ?? e.message ?? '';
  if (out.includes('{')) ver = extractJson(out);
  else throw e;
}

const rank1Str: string = ret.rank1_rate ?? ret.rank1 ?? '';
const rank1Num = typeof rank1Str === 'string' ? parseFloat(rank1Str.replace('%', '')) : Number(rank1Str);
const probes = ret.probes ?? ret.totalProbes ?? 0;
const pointersTotal = ver.pointers_total ?? ver.pointers ?? 0;
const pointersTargets = ver.pointers_targets ?? ver.targets ?? 0;
const indexSize = ret.index_size ?? 0;
const updated = new Date().toISOString().split('T')[0];

const metrics = {
  retrieval_rank1: rank1Num,
  retrieval_rank1_rate: rank1Str,
  retrieval_probes: probes,
  retrieval_rank1_count: ret.rank1_count ?? null,
  retrieval_positives: ret.positives ?? null,
  retrieval_negatives: ret.negatives ?? null,
  retrieval_index_size: indexSize,
  retrieval_index_terms: ret.index_terms ?? null,
  pointers_total: pointersTotal,
  pointers_targets: pointersTargets,
  pointers_broken: ver.pointers_broken ?? ver.broken_pointers ?? 0,
  index_size: indexSize,
  updated,
};

const outDir = join(root, '.metrics');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'latest.json');
writeFileSync(outPath, JSON.stringify(metrics, null, 2) + '\n');
console.log(`✓ wrote ${outPath}`);
console.log(JSON.stringify(metrics, null, 2));
