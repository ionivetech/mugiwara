#!/usr/bin/env node
// scripts/validate-content.mjs
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parseFrontmatter } from '../src/frontmatter.js';

const root = join(import.meta.dirname, '..', 'content');
const errors = [];

function checkFile(file, wantName, kind) {
  let parsed;
  try { parsed = parseFrontmatter(readFileSync(file, 'utf8')); }
  catch (e) { errors.push(`${kind} ${file}: ${e.message}`); return null; }
  const { data, body } = parsed;
  if (data.name !== wantName) errors.push(`${kind} ${file}: name "${data.name}" != "${wantName}"`);
  const d = data.description ?? '';
  if (kind === 'skill' && (d.length < 20 || d.length > 500)) errors.push(`skill ${file}: description must be 20-500 chars (got ${d.length})`);
  if (kind === 'agent' && d.length < 20) errors.push(`agent ${file}: description too short`);
  if (kind === 'skill' && body.split(/\r?\n/).length > 120) errors.push(`skill ${file}: body exceeds 120 lines`);
  return data;
}

function listFiles(dir, prefix = '') {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listFiles(p, join(prefix, ent.name)));
    else out.push(join(prefix, ent.name));
  }
  return out;
}

const syncArg = process.argv.indexOf('--check-sync');
if (syncArg !== -1) {
  const pairs = [['content/skills', 'skills'], ['content/agents', 'agents']];
  const diffs = [];
  for (const [from, to] of pairs) {
    const fromRoot = join(import.meta.dirname, '..', from);
    const toRoot = join(import.meta.dirname, '..', to);
    const fromFiles = listFiles(fromRoot).sort();
    const toFiles = listFiles(toRoot).sort();
    for (const rel of fromFiles) {
      const f = join(fromRoot, rel), t = join(toRoot, rel);
      if (!existsSync(t)) diffs.push(`missing copy: ${to}/${rel} (run .claude-plugin/sync.sh)`);
      else if (readFileSync(f, 'utf8') !== readFileSync(t, 'utf8')) diffs.push(`out of sync: ${to}/${rel}`);
    }
    for (const rel of toFiles) {
      if (!fromFiles.includes(rel)) diffs.push(`stale copy: ${to}/${rel} (not in content/, run .claude-plugin/sync.sh)`);
    }
  }
  if (diffs.length) { console.error(diffs.map(d => `✗ ${d}`).join('\n')); process.exit(1); }
  console.log('✓ plugin copies in sync with content/');
  process.exit(0);
}

const skillDirs = existsSync(join(root, 'skills'))
  ? readdirSync(join(root, 'skills')).filter(d => statSync(join(root, 'skills', d)).isDirectory())
  : [];
const names = new Map();
const usedSkills = new Set();

const checkArg = process.argv.indexOf('--check');
if (checkArg !== -1) {
  const file = process.argv[checkArg + 1];
  const isSkill = file.includes('skills');
  const want = isSkill ? basename(join(file, '..')) : basename(file).replace(/\.md$/, '');
  checkFile(file, want, isSkill ? 'skill' : 'agent');
  if (errors.length) { console.error(errors.map(e => `✗ ${e}`).join('\n')); process.exit(1); }
  console.log(`✓ ${file}`);
  process.exit(0);
}

for (const dir of skillDirs) {
  const file = join(root, 'skills', dir, 'SKILL.md');
  if (!existsSync(file)) { errors.push(`skill ${dir}: missing SKILL.md`); continue; }
  const data = checkFile(file, dir, 'skill');
  if (data) {
    if (names.has(data.name)) errors.push(`duplicate name: ${data.name}`);
    names.set(data.name, file);
  }
}

const agentDir = join(root, 'agents');
const agentFiles = existsSync(agentDir) ? readdirSync(agentDir).filter(f => f.endsWith('.md')) : [];
for (const f of agentFiles) {
  const data = checkFile(join(agentDir, f), f.replace(/\.md$/, ''), 'agent');
  if (!data) continue;
  if (names.has(data.name)) errors.push(`duplicate name: ${data.name}`);
  names.set(data.name, f);
  const skills = (data.skills ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (skills.length === 0) errors.push(`agent ${f}: skills field missing/empty`);
  for (const s of skills) {
    usedSkills.add(s);
    if (!skillDirs.includes(s)) errors.push(`agent ${f}: unknown skill "${s}"`);
  }
}

for (const dir of skillDirs) {
  if (dir !== 'mugiwara-workflow' && !usedSkills.has(dir)) errors.push(`skill ${dir}: not referenced by any agent`);
}

if (errors.length) { console.error(errors.map(e => `✗ ${e}`).join('\n')); process.exit(1); }
console.log(`✓ content valid: ${skillDirs.length} skills, ${agentFiles.length} agents`);
