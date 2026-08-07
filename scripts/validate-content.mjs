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
  const { data } = parsed;
  if (data.name !== wantName) errors.push(`${kind} ${file}: name "${data.name}" != "${wantName}"`);
  const d = data.description ?? '';
  if (kind === 'skill' && (d.length < 20 || d.length > 500)) errors.push(`skill ${file}: description must be 20-500 chars (got ${d.length})`);
  if (kind === 'agent' && d.length < 20) errors.push(`agent ${file}: description too short`);
  return data;
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
