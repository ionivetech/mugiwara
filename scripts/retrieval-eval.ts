#!/usr/bin/env bun
// scripts/retrieval-eval.ts — offline retrieval ranking eval
// Builds TF-IDF index over skill descriptions, scores prompts, reports rank-1 + top_k.
// No model needed — pure string matching. Outputs JSON.

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from '../src/frontmatter.ts';

const root = join(import.meta.dirname, '..');
const skillsDir = join(root, 'content', 'skills');
const evalsDir = join(root, 'evals', 'cases');

// --- TF-IDF ---
type Index = { terms: Map<string, number>; docs: Map<string, Map<string, number>>; docCount: number };

function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !['the', 'and', 'for', 'use', 'when', 'that', 'with', 'this', 'from', 'its', 'not', 'are', 'has'].includes(t));
}

function buildIndex(): Index {
  const index: Index = { terms: new Map(), docs: new Map(), docCount: 0 };
  const dirs = readdirSync(skillsDir).filter(d => statSync(join(skillsDir, d)).isDirectory());

  for (const dir of dirs) {
    const file = join(skillsDir, dir, 'SKILL.md');
    if (!existsSync(file)) continue;

    const { data } = parseFrontmatter(readFileSync(file, 'utf8'));
    const desc = data.description ?? '';
    const tokens = tokenize(desc);
    const tf = new Map<string, number>();

    for (const t of tokens) {
      tf.set(t, (tf.get(t) || 0) + 1);
      index.terms.set(t, (index.terms.get(t) || 0) + 1);
    }

    index.docs.set(dir, tf);
    index.docCount++;
  }

  return index;
}

function tfidf(index: Index, doc: string, term: string): number {
  const tf = index.docs.get(doc)?.get(term) || 0;
  if (tf === 0) return 0;
  const df = index.terms.get(term) || 1;
  return tf * Math.log(index.docCount / df);
}

function score(index: Index, prompt: string): { skill: string; score: number }[] {
  const promptTerms = tokenize(prompt);
  const results: { skill: string; score: number }[] = [];

  for (const [doc] of index.docs) {
    let total = 0;
    for (const t of promptTerms) {
      total += tfidf(index, doc, t);
    }
    results.push({ skill: doc, score: total });
  }

  return results.sort((a, b) => b.score - a.score);
}

// --- case schema ---
interface CaseFile {
  name: string;
  skill: string;
  type?: string;
  task: string;
  rubric: string[];
  expect_lane?: string;
  trigger?: {
    positive?: { prompt: string; top_k?: number }[];
    negative?: { prompt: string }[];
  };
  behavioral?: { task: string; rubric: string[] }[];
}

interface Probe {
  kind: 'positive' | 'negative';
  skill: string;
  prompt: string;
  topK: number;
}

// --- build index ---
const index = buildIndex();

// --- load cases ---
const skills = readdirSync(skillsDir).filter(d => statSync(join(skillsDir, d)).isDirectory());
const files = readdirSync(evalsDir).filter(f => f.endsWith('.json'));
const probes: Probe[] = [];
const noSkillProbes: Probe[] = [];
const covered = new Set<string>();

for (const f of files) {
  let c: CaseFile;
  try {
    c = JSON.parse(readFileSync(join(evalsDir, f), 'utf8'));
  } catch (e) {
    throw new Error(`eval case ${f} is not valid JSON: ${e}`);
  }
  if (!c.skill) throw new Error(`eval case ${f} has no "skill"`);
  covered.add(c.skill);

  const target = c.skill === '_no-skill' ? noSkillProbes : probes;
  for (const p of c.trigger?.positive ?? [])
    target.push({ kind: 'positive', skill: c.skill, prompt: p.prompt, topK: p.top_k ?? 3 });
  for (const p of c.trigger?.negative ?? [])
    target.push({ kind: 'negative', skill: c.skill, prompt: p.prompt, topK: 3 });
}

// --- coverage gate ---
const missing = skills.filter(s => !covered.has(s));
if (missing.length) {
  console.error(`missing eval cases for ${missing.length} skills:`);
  for (const s of missing) console.error(`  ${s}`);
  process.exit(1);
}

// --- run probes ---
let rank1 = 0, inTopK = 0, negPass = 0, noSkillPass = 0;
const positives = probes.filter(p => p.kind === 'positive');
const negatives = probes.filter(p => p.kind === 'negative');
const nsPositives = noSkillProbes.filter(p => p.kind === 'positive');
const nsNegatives = noSkillProbes.filter(p => p.kind === 'negative');
const failures: string[] = [];
const results: Record<string, { rank: number; score: number; top_k: number; passed: boolean }> = {};

for (const p of positives) {
  const ranked = score(index, p.prompt);
  const rank = ranked.findIndex(r => r.skill === p.skill) + 1;
  const key = `${p.skill}: ${p.prompt}`;
  const entryScore = rank > 0 ? ranked[rank - 1].score : 0;
  results[key] = { rank, score: entryScore, top_k: p.topK, passed: rank > 0 && rank <= p.topK };
  if (rank === 1) rank1++;
  if (rank > 0 && rank <= p.topK) inTopK++;
  else failures.push(`positive "${p.prompt}" → ${p.skill} ranked ${rank || 'unranked'} (want <=${p.topK}), got ${ranked[0]?.skill ?? 'none'}`);
}

for (const p of negatives) {
  const ranked = score(index, p.prompt);
  const pass = ranked[0]?.skill !== p.skill;
  const key = `!${p.skill}: ${p.prompt}`;
  results[key] = { rank: 0, score: ranked[0]?.score ?? 0, top_k: 3, passed: pass };
  if (pass) negPass++;
  else failures.push(`negative "${p.prompt}" wrongly ranked ${p.skill} first`);
}

for (const p of nsPositives) {
  const ranked = score(index, p.prompt);
  const top = ranked[0];
  const pass = !top || top.score < 3.5;
  const key = `_no-skill+: ${p.prompt}`;
  results[key] = { rank: 0, score: top?.score ?? 0, top_k: 3, passed: pass };
  if (pass) noSkillPass++;
  else failures.push(`no-skill positive "${p.prompt}" → ${top.skill} score ${top.score.toFixed(2)} (want <3.5)`);
}

for (const p of nsNegatives) {
  const ranked = score(index, p.prompt);
  const top = ranked[0];
  const pass = !!top && top.skill.startsWith('mugiwara-') && top.score >= 3.5;
  const key = `_no-skill-: ${p.prompt}`;
  results[key] = { rank: 0, score: top?.score ?? 0, top_k: 3, passed: pass };
  if (pass) noSkillPass++;
  else failures.push(`no-skill negative "${p.prompt}" → ${top?.skill ?? 'none'} score ${top?.score?.toFixed(2) ?? '0'} (want mugiwara skill >=3.5)`);
}

// --- compute rates ---
const rank1Rate = positives.length ? (rank1 / positives.length) * 100 : 0;
const topKRate  = positives.length ? (inTopK / positives.length) * 100 : 0;
const negRate   = negatives.length ? (negPass / negatives.length) * 100 : 0;
const nsTotal   = nsPositives.length + nsNegatives.length;
const nsRate    = nsTotal ? (noSkillPass / nsTotal) * 100 : 100;

const allPassed = Object.values(results).filter(r => r.passed).length;
const allFailed = Object.values(results).filter(r => !r.passed).length;
const totalProbes = Object.keys(results).length;

// --- floor / ratchet ---
const floorPath = join(root, 'evals', 'floor.json');
const updateFloor = process.argv.includes('--update-floor');

if (!existsSync(floorPath)) {
  if (updateFloor) {
    const initial = { rank1: Math.round(rank1Rate * 10) / 10, topk: Math.round(topKRate * 10) / 10, negatives: Math.round(negRate * 10) / 10, updated: new Date().toISOString().split('T')[0] };
    writeJson(floorPath, initial);
  }
} else {
  const floor = JSON.parse(readFileSync(floorPath, 'utf8'));
  const TOL = 0.5;

  if (updateFloor) {
    floor.rank1 = Math.round(rank1Rate * 10) / 10;
    floor.topk = Math.round(topKRate * 10) / 10;
    floor.negatives = Math.round(negRate * 10) / 10;
    floor.updated = new Date().toISOString().split('T')[0];
    writeJson(floorPath, floor);
  } else {
    const regressions: string[] = [];
    if (rank1Rate < floor.rank1 - TOL) regressions.push(`rank-1 ${rank1Rate.toFixed(1)}% < floor ${floor.rank1}%`);
    if (topKRate < floor.topk - TOL) regressions.push(`top-k ${topKRate.toFixed(1)}% < floor ${floor.topk}%`);
    if (negRate < floor.negatives - TOL) regressions.push(`negatives ${negRate.toFixed(1)}% < floor ${floor.negatives}%`);

    console.log(`rank-1 ${rank1Rate.toFixed(1)}%  top-3 ${topKRate.toFixed(1)}%  negatives ${negRate.toFixed(1)}%  no-skill ${nsRate.toFixed(1)}%  (${positives.length}p / ${negatives.length}n / ${nsTotal}ns over ${skills.length} skills)`);
    for (const f of failures) console.error(`  FAIL ${f}`);
    if (regressions.length) {
      regressions.forEach(r => console.error(`REGRESSION: ${r}`));
      process.exit(1);
    }
  }
}

// --- report ---
const ciArg = process.argv.indexOf('--json');
if (ciArg !== -1) {
  const report = {
    index_size: index.docCount,
    index_terms: index.terms.size,
    probes: totalProbes,
    positives: positives.length,
    negatives: negatives.length,
    no_skill: nsTotal,
    rank1_count: rank1,
    rank1_rate: `${rank1Rate.toFixed(1)}%`,
    topk_count: inTopK,
    topk_rate: `${topKRate.toFixed(1)}%`,
    negative_pass: negPass,
    negative_rate: `${negRate.toFixed(1)}%`,
    no_skill_pass: noSkillPass,
    no_skill_rate: `${nsRate.toFixed(1)}%`,
    passed: allPassed,
    failed: allFailed,
    failures: failures.length > 0 ? failures : undefined,
    results,
  };
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`\nRetrieval eval: ${allPassed}/${totalProbes} passed, rank-1 ${rank1Rate.toFixed(1)}%, top-3 ${topKRate.toFixed(1)}%, neg ${negRate.toFixed(1)}%, ns ${nsRate.toFixed(1)}%`);
  if (failures.length > 0) {
    console.error(`\n${failures.length} failures:`);
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }
}

function writeJson(path: string, obj: object) {
  const { writeFileSync } = require('node:fs');
  writeFileSync(path, JSON.stringify(obj, null, 2) + '\n');
}
