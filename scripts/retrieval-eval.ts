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

// --- eval cases ---
interface EvalCase {
  prompt: string;
  skill: string;
  type: 'positive' | 'negative';
  top_k?: number;
}

const index = buildIndex();

// Load existing case files
const cases: EvalCase[] = [];
if (existsSync(evalsDir)) {
  const files = readdirSync(evalsDir).filter(f => f.endsWith('.json'));
  for (const f of files) {
    try {
      const c = JSON.parse(readFileSync(join(evalsDir, f), 'utf8'));
      if (c.prompt && c.skill) {
        cases.push({ prompt: c.prompt, skill: c.skill, type: c.type || 'positive', top_k: c.top_k || 3 });
      }
    } catch { /* skip */ }
  }
}

// Add negative cases (must NOT rank first for irrelevant prompts)
const negativeCases: EvalCase[] = [
  { prompt: "tell me a joke about programmers", skill: "any", type: "negative", top_k: 1 },
  { prompt: "convert this image to webp format", skill: "any", type: "negative", top_k: 1 },
  { prompt: "schedule a meeting for next Tuesday", skill: "any", type: "negative", top_k: 1 },
  { prompt: "translate this document to Japanese", skill: "any", type: "negative", top_k: 1 },
];

const allCases = [...cases, ...negativeCases];

// --- run ---
let passed = 0;
let failed = 0;
const results: Record<string, { rank: number; score: number; top_k: number; passed: boolean }> = {};

for (const tc of allCases) {
  const rankings = score(index, tc.prompt);
  const rank = rankings.findIndex(r => r.skill === tc.skill) + 1;
  const entry = rankings[0];
  
  if (tc.type === 'negative') {
    const gotMugiwara = entry && entry.skill.startsWith('mugiwara-') && entry.score > 3.5;
    const p = !gotMugiwara;
    const k = tc.top_k ?? 1;
    results[tc.prompt] = { rank: 1, score: entry?.score ?? 0, top_k: k, passed: p };
    if (p) passed++; else { failed++; console.error(`FAIL negative: "${tc.prompt}" → rank 1: ${entry?.skill} (score ${entry?.score?.toFixed(2)})`); }
  } else {
    const k = tc.top_k ?? 3;
    const p = rank > 0 && rank <= k;
    results[`${tc.skill}: ${tc.prompt}`] = { rank, score: rankings[rank - 1]?.score ?? 0, top_k: k, passed: p };
    if (p) passed++; else { failed++; console.error(`FAIL: "${tc.prompt}" → "${tc.skill}" rank ${rank} (top ${k})`); }
  }
}

// --- report ---
const rank1Count = Object.values(results).filter(r => 'rank' in r && r.rank === 1).length;
const total = allCases.length;
const rank1Rate = total > 0 ? (rank1Count / total * 100).toFixed(1) : '0';

const report = {
  index_size: index.docCount,
  index_terms: index.terms.size,
  cases: total,
  passed,
  failed,
  rank1_count: rank1Count,
  rank1_rate: `${rank1Rate}%`,
  results,
};

// Output JSON for CI
const ciArg = process.argv.indexOf('--json');
if (ciArg !== -1) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Retrieval eval: ${passed}/${total} passed, ${rank1Rate} rank-1`);
  if (failed > 0) process.exit(1);
}
