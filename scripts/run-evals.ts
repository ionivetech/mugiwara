#!/usr/bin/env bun
// scripts/run-evals.ts — the mugiwara eval harness.
// Two modes:
//   bun scripts/run-evals.ts            validate the suite (structure + coverage). CI-safe, no model.
//   bun scripts/run-evals.ts --run [cmd]  execute each case against a model CLI and score the rubric.
//
// --run uses the command to invoke a model that prints only its answer to the
// task; the harness scores the answer against the rubric with a heuristic
// keyword match, then reports pass/fail per case and a rank-1 style score.
// The command defaults to "claude -p" — override with MUGIWARA_EVAL_CMD.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const casesDir = join(root, 'evals', 'cases');
const skillsDir = join(root, 'content', 'skills');
const errors: string[] = [];

type Case = {
  name: string;
  skill: string;
  type?: 'positive' | 'negative' | 'adversarial' | 'lane';
  task: string;
  rubric: string[];
  expect_lane?: string;
};

function listCases(dir: string, prefix = ''): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listCases(p, join(prefix, ent.name)));
    else if (ent.name.endsWith('.json')) out.push(join(prefix, ent.name));
  }
  return out;
}

function validateSuite(): Case[] {
  const cases: Case[] = [];
  const files = listCases(casesDir).sort();
  for (const rel of files) {
    let c: Case;
    try { c = JSON.parse(readFileSync(join(casesDir, rel), 'utf8')); }
    catch (e) { errors.push(`${rel}: invalid JSON (${(e as Error).message})`); continue; }
    if (!c.name || !c.skill || !c.task || !Array.isArray(c.rubric) || !c.rubric.length)
      errors.push(`${rel}: missing name/skill/task/nonempty rubric`);
    else if (!existsSync(join(skillsDir, c.skill))) errors.push(`${rel}: unknown skill "${c.skill}"`);
    if (c.type && !['positive', 'negative', 'adversarial', 'lane'].includes(c.type))
      errors.push(`${rel}: bad type "${c.type}"`);
    cases.push(c);
  }
  if (!cases.length) { errors.push('no cases in evals/cases/'); }

  // coverage gates: the suite must exercise routing in all directions.
  const types = new Set(cases.map(c => c.type).filter(Boolean));
  if (cases.filter(c => c.type === 'positive').length < 2) errors.push('need ≥2 positive cases');
  if (cases.filter(c => c.type === 'negative').length < 2) errors.push('need ≥2 negative cases');
  if (cases.filter(c => c.type === 'adversarial').length < 2) errors.push('need ≥2 adversarial cases');
  if (!types.has('lane')) errors.push('need ≥1 lane case');
  return cases;
}

function scoreRubric(answer: string, c: Case): { pass: number; total: number; matched: string[] } {
  const a = answer.toLowerCase();
  const matched = c.rubric.filter(r => {
    const terms = r.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3 && !['does', 'not', 'with', 'into', 'from'].includes(w));
    return terms.some(t => a.includes(t));
  });
  return { pass: matched.length, total: c.rubric.length, matched };
}

async function runCases(env: { execFileSync: typeof import('node:child_process').execFileSync; bin: string; pre: string[] }): Promise<void> {
  const cases = validateSuite();
  if (errors.length) { console.error(errors.map(e => `✗ ${e}`).join('\n')); process.exit(1); }
  const { execFileSync, bin, pre } = env;
  let total = 0, passed = 0;
  for (const c of cases) {
    const prompt = `Task: ${c.task}\n\nWhich mugiwara skill should run and why? Be concrete.`;
    let raw = '';
    try {
      raw = execFileSync(bin, [...pre, prompt], { encoding: 'utf8', timeout: 60000, maxBuffer: 10 * 1024 * 1024 });
    } catch (e: any) {
      raw = e.stdout?.toString?.() ?? String(e.message);
    }
    const { pass, total: t, matched } = scoreRubric(raw, c);
    total += t;
    passed += pass;
    const pct = Math.round((pass / t) * 100);
    console.log(`${pct >= 70 ? '✓' : '✗'} ${c.name} — ${pass}/${t} rubric (${pct}%)`);
    if (pass < t) {
      console.log(`    task: ${c.task}`);
      console.log(`    matched: ${matched.length ? matched.join('; ') : 'none'}`);
    }
  }
  const overall = Math.round((passed / total) * 100);
  console.log(`\nOVERALL ${passed}/${total} (${overall}%)`);
  if (overall < 70) process.exitCode = 1;
}

const runArg = process.argv.indexOf('--run');
if (runArg !== -1) {
  const { execFileSync } = require('node:child_process');
  const cmd = process.env.MUGIWARA_EVAL_CMD ?? 'claude -p';
  const [bin, ...pre] = cmd.split(' ');
  runCases({ execFileSync, bin, pre });
  process.exit(0);
}

const cases = validateSuite();
if (errors.length) { console.error(errors.map(e => `✗ ${e}`).join('\n')); process.exit(1); }
console.log(`✓ eval suite OK: ${cases.length} cases (${cases.filter(c => c.type === 'positive').length} positive, ${cases.filter(c => c.type === 'negative').length} negative, ${cases.filter(c => c.type === 'adversarial').length} adversarial, ${cases.filter(c => c.type === 'lane').length} lane)`);
for (const c of cases) console.log(`  ${c.name} [${c.type ?? 'default'}]`);
