#!/usr/bin/env bun
// scripts/validate-content.ts
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parseFrontmatter } from '../src/frontmatter.ts';

const root = join(import.meta.dirname, '..', 'content');
const errors: string[] = [];

function checkFile(file: string, wantName: string, kind: 'skill' | 'agent'): Record<string, string> | null {
  let parsed;
  try { parsed = parseFrontmatter(readFileSync(file, 'utf8')); }
  catch (e) { errors.push(`${kind} ${file}: ${(e as Error).message}`); return null; }
  const { data, body } = parsed;
  if (data.name !== wantName) errors.push(`${kind} ${file}: name "${data.name}" != "${wantName}"`);
  const d = data.description ?? '';
  if (kind === 'skill' && (d.length < 20 || d.length > 220)) errors.push(`skill ${file}: description must be 20-220 chars (got ${d.length})`);
  if (kind === 'agent' && d.length < 20) errors.push(`agent ${file}: description too short`);
  if (kind === 'skill' && body.replace(/\r?\n$/, '').split(/\r?\n/).length > 120) errors.push(`skill ${file}: body exceeds 120 lines`);
  if (kind === 'skill' && !body.includes('## Skip when')) errors.push(`skill ${file}: missing required "## Skip when" block (≤4 lines, numeric threshold)`);
  if (kind === 'skill' && body.includes('## Skip when')) {
    const lines = body.split(/\r?\n/);
    const idx = lines.findIndex(l => l.startsWith('## Skip when'));
    const gateLines = lines.slice(idx + 1).findIndex(l => l.startsWith('## '));
    const end = gateLines === -1 ? lines.length : idx + 1 + gateLines;
    const bullets = lines.slice(idx + 1, end).filter(l => l.trim().startsWith('-'));
    if (bullets.length === 0) errors.push(`skill ${file}: "## Skip when" needs ≥1 bullet`);
    if (bullets.length > 4) errors.push(`skill ${file}: "## Skip when" block exceeds 4 bullets`);
  }
  if (kind === 'skill' && !body.includes('## Red flags')) errors.push(`skill ${file}: missing required "## Red flags" block`);
  if (kind === 'skill') {
    const lines = body.split(/\r?\n/);
    const headingRe = /^## /;
    const sections: { heading: string; start: number; end: number }[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (headingRe.test(lines[i])) sections.push({ heading: lines[i].replace(/^## /, ''), start: i, end: 0 });
    }
    for (let si = 0; si < sections.length; si++) {
      sections[si].end = si + 1 < sections.length ? sections[si + 1].start : lines.length;
      // count non-empty, non-table, non-code-fence content lines
      let inFence = false;
      let contentLines = 0;
      for (let li = sections[si].start; li < sections[si].end; li++) {
        const l = lines[li].trim();
        if (!l) continue;
        if (l.startsWith('```')) { inFence = !inFence; continue; }
        if (inFence) continue;
        if (l.startsWith('|') || l.startsWith('- |')) continue;
        contentLines++;
      }
      if (contentLines >= 20) errors.push(`skill ${file}: section "${sections[si].heading}" is ${contentLines} content lines (≥20) — move to references/`);
      else if (contentLines >= 15) console.warn(`⚠  skill ${file}: section "${sections[si].heading}" is ${contentLines} content lines (≥15, consider moving to references/)`);
    }
  }
  return data;
}

function listFiles(dir: string, prefix = ''): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listFiles(p, join(prefix, ent.name)));
    else out.push(join(prefix, ent.name));
  }
  return out;
}

const syncArg = process.argv.indexOf('--check-sync');
if (syncArg !== -1) {
  const pairs = [['content/skills', 'skills'], ['content/agents', 'agents']] as const;
  const diffs: string[] = [];
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
const names = new Map<string, string>();
const usedSkills = new Set<string>();

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

// --- write-scope gate (F2): every agent declares a scope; only executors may write source ---
const SOURCE_SCOPED = new Set(['zoro-execution', 'brook-healing']);
for (const f of agentFiles) {
  const name = f.replace(/\.md$/, '');
  const parsed = parseFrontmatter(readFileSync(join(agentDir, f), 'utf8'));
  const scope = parsed.data['write-scope'];
  if (!scope) { errors.push(`agent ${f}: missing write-scope (artifacts | source)`); continue; }
  if (scope !== 'artifacts' && scope !== 'source') errors.push(`agent ${f}: write-scope must be artifacts | source (got "${scope}")`);
  if (scope === 'source' && !SOURCE_SCOPED.has(name)) errors.push(`agent ${f}: only zoro-execution and brook-healing may declare write-scope: source`);
}

// --- write-boundary gate (W1): the hub skill must carry the refusal rule ---
const hubFile = join(root, 'skills', 'mugiwara-orchestration', 'SKILL.md');
if (existsSync(hubFile) && !readFileSync(hubFile, 'utf8').includes('## Write boundary')) {
  errors.push('skill mugiwara-orchestration: missing "## Write boundary" section (non-executors refuse source writes)');
}

// --- agent-count gate (F14): user-facing/internal split derivable from content/agents/ ---
const internalAgents = agentFiles.filter(f => {
  const parsed = parseFrontmatter(readFileSync(join(agentDir, f), 'utf8'));
  return parsed.data.internal === 'true';
});
const canonicalCount = `${agentFiles.length - internalAgents.length} agents (+${internalAgents.length} internal)`;
for (const doc of ['README.md', 'docs/index.md', 'docs/concepts/agents.md']) {
  const p = join(import.meta.dirname, '..', doc);
  if (existsSync(p) && !readFileSync(p, 'utf8').includes(canonicalCount)) {
    errors.push(`${doc}: missing canonical agent count "${canonicalCount}"`);
  }
}

// --- hub-rule gate (F3): every non-Luffy agent carries both hub sections ---
for (const f of agentFiles) {
  const name = f.replace(/\.md$/, '');
  if (name === 'luffy-orchestrator') continue;
  const text = readFileSync(join(agentDir, f), 'utf8');
  if (!text.includes('## Before you start')) errors.push(`agent ${f}: missing "## Before you start" entry protocol`);
  if (!text.includes('## Return to Luffy')) errors.push(`agent ${f}: missing "## Return to Luffy" hub rule`);
}

// --- hub-skill gate (F3): every agent lists mugiwara-orchestration (the hub rule's home) ---
for (const f of agentFiles) {
  const parsed = parseFrontmatter(readFileSync(join(agentDir, f), 'utf8'));
  const skills = (parsed.data.skills ?? '').split(',').map(s => s.trim());
  if (!skills.includes('mugiwara-orchestration')) errors.push(`agent ${f}: missing mugiwara-orchestration in skills (hub rule lives there)`);
}

// --- handoff-target gate (F4): a body naming another crew member as a handoff
// target without Luffy in the same line fails CI ---
const HANDOFF_CREW = ['usopp', 'nami', 'zoro', 'chopper', 'sanji', 'franky', 'robin', 'jinbe', 'brook', 'skeptic', 'memory-keeper', 'resume-coordinator', 'eval-runner'];
// Verb class covers direct handoff language plus synonyms (route/send/pass/
// escalate/delegate/transfer) so the F4 gate does not leak through paraphrase.
const handoffRe = new RegExp(`\\b(hand to|hand off to|dispatch|route to|send to|pass to|escalate to|delegate to|transfer to)\\s+(?:a\\s+|another\\s+|the\\s+)?(?:crew members?|${HANDOFF_CREW.join('|')})`, 'i');
// Negation must DIRECTLY precede the handoff verb, not sit anywhere in the
// line ("do not hand off" later in the same line is a different clause).
const NEGATION_VERB = /\b(never|not|no|don't|do not)\s+(hand|dispatch|route|send|pass|escalate|delegate|transfer)\b/i;
for (const f of [...agentFiles, ...skillDirs.map(d => join(root, 'skills', d, 'SKILL.md'))]) {
  if (!existsSync(f)) continue;
  const text = readFileSync(f, 'utf8');
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = handoffRe.exec(line);
    if (!m) continue;
    // clause boundary: only the clause containing the handoff verb counts
    const clauseStart = line.lastIndexOf('.', m.index) + 1;
    const clause = line.slice(clauseStart, m.index + m[0].length);
    if (NEGATION_VERB.test(clause)) continue;      // "never dispatch X" — constraint
    if (/\bLuffy\b|to Luffy\b/.test(line)) continue; // hub named in same line ("main thread" is NOT the hub — Luffy is)
    errors.push(`handoff leak ${f.replace(root + '/', '')}:${i + 1}: "${line.trim()}" — handoff target must be Luffy or name Luffy in the same line`);
  }
}

// --- manifest-sync check: every marketplace plugin.json set-equal content/ ---
const manifestArg = process.argv.indexOf('--check-manifest');
if (manifestArg !== -1) {
  const manifests = [
    '.claude-plugin/plugin.json',
    '.codex-plugin/plugin.json',
    '.cursor-plugin/plugin.json',
    '.kimi-plugin/plugin.json',
  ];
  let manifestErrors = 0;

  for (const mp of manifests) {
    const mpath = join(import.meta.dirname, '..', mp);
    if (!existsSync(mpath)) { errors.push(`manifest ${mp}: file not found`); continue; }
    let mdata;
    try { mdata = JSON.parse(readFileSync(mpath, 'utf8')); }
    catch (e) { errors.push(`manifest ${mp}: invalid JSON`); continue; }

    const mSkills = mdata?.metadata?.skills;
    const mAgents = mdata?.metadata?.agents;
    if (!Array.isArray(mSkills)) { errors.push(`manifest ${mp}: missing metadata.skills array`); }
    if (!Array.isArray(mAgents)) { errors.push(`manifest ${mp}: missing metadata.agents array`); }
    if (!mSkills || !mAgents) continue;

    const mSkillSet = new Set(mSkills);
    const mAgentSet = new Set(mAgents);

    // every skill in content/ must be in manifest
    for (const dir of skillDirs) {
      if (!mSkillSet.has(dir)) {
        errors.push(`manifest ${mp}: missing skill "${dir}"`);
        manifestErrors++;
      }
    }
    // no stale entries in manifest
    for (const s of mSkills) {
      if (!skillDirs.includes(s)) {
        errors.push(`manifest ${mp}: stale skill "${s}" (not in content/skills/)`);
        manifestErrors++;
      }
    }
    // every agent in content/ must be in manifest
    for (const f of agentFiles) {
      const name = f.replace(/\.md$/, '');
      if (!mAgentSet.has(name)) {
        errors.push(`manifest ${mp}: missing agent "${name}"`);
        manifestErrors++;
      }
    }
    for (const a of mAgents) {
      if (!agentFiles.includes(`${a}.md`)) {
        errors.push(`manifest ${mp}: stale agent "${a}" (not in content/agents/)`);
        manifestErrors++;
      }
    }
  }

  if (manifestErrors === 0) console.log('✓ manifest in sync with content/');
}

// --- index budget gate ---
const INDEX_BUDGET = 5500; // chars, all skill + agent descriptions combined
let totalDescChars = 0;
for (const dir of skillDirs) {
  const file = join(root, 'skills', dir, 'SKILL.md');
  if (!existsSync(file)) continue;
  const parsed = parseFrontmatter(readFileSync(file, 'utf8'));
  totalDescChars += (parsed.data.description ?? '').length;
}
for (const f of agentFiles) {
  const parsed = parseFrontmatter(readFileSync(join(agentDir, f), 'utf8'));
  totalDescChars += (parsed.data.description ?? '').length;
}
if (totalDescChars > INDEX_BUDGET) {
  errors.push(`index budget exceeded: ${totalDescChars}/${INDEX_BUDGET} chars (skill + agent descriptions)`);
} else {
  console.log(`✓ index budget: ${totalDescChars}/${INDEX_BUDGET} chars`);
}

// --- docs-drift check: docs/skills.md and docs/agents.md must reference all content/ entries ---
const docsArg = process.argv.indexOf('--check-docs');
if (docsArg !== -1) {
  const docsDir = join(import.meta.dirname, '..', 'docs');
const skillsDoc = join(docsDir, 'concepts', 'skills.md');
const agentsDoc = join(docsDir, 'concepts', 'agents.md');
  let docErrors = 0;

  if (existsSync(skillsDoc)) {
    const content = readFileSync(skillsDoc, 'utf8');
    for (const dir of skillDirs) {
      if (!content.includes(dir)) {
        errors.push(`docs/concepts/skills.md: missing skill "${dir}"`);
        docErrors++;
      }
    }
  } else {
    errors.push('docs/concepts/skills.md: file not found');
    docErrors++;
  }

  if (existsSync(agentsDoc)) {
    const content = readFileSync(agentsDoc, 'utf8');
    for (const f of agentFiles) {
      const name = f.replace(/\.md$/, '');
      if (!content.includes(name)) {
        errors.push(`docs/concepts/agents.md: missing agent "${name}"`);
        docErrors++;
      }
    }
  } else {
    errors.push('docs/concepts/agents.md: file not found');
    docErrors++;
  }

  if (docErrors === 0) console.log('✓ docs in sync with content/');
}

// --- doc-integrity check: documented thresholds must match source constants ---
// Docs are claims; a claim that drifts from the source is a lie. LANE_BASE +
// BUDGET live in scripts/lib/lane-base.sh (validated by lane-base.ts); the
// cost docs must cite the same numbers. Evidence logs carry an exit code /
// verdict claim — a test must back it (lane-integrity cases 22-24).
const integrityArg = process.argv.indexOf('--check-doc-integrity');
if (integrityArg !== -1) {
  const src = join(import.meta.dirname, '..', 'scripts', 'lib', 'lane-base.sh');
  if (!existsSync(src)) {
    errors.push('doc-integrity: scripts/lib/lane-base.sh not found — cannot verify thresholds');
  } else {
    const constants = readFileSync(src, 'utf8');
    const docs = ['docs/concepts/cost.md', 'docs/concepts/lanes.md', 'README.md'];
    const expected: [string, string][] = [
      ['lean', '7,000'], ['standard', '13,000'], ['full', '23,000'],
      ['lean', '12,000'], ['standard', '25,000'], ['full', '50,000'],
    ];
    for (const doc of docs) {
      const p = join(import.meta.dirname, '..', doc);
      if (!existsSync(p)) { errors.push(`doc-integrity: ${doc} not found`); continue; }
      const text = readFileSync(p, 'utf8');
      for (const [lane, num] of expected) {
        // each doc must cite the budget/LANE_BASE number for that lane; accept
        // both the comma form (7,000) and the k-shorthand (7k / ~7k)
        const compact = num.replace(',', '').replace(/0+$/, '');
        const kForm = /^(\d+)000$/.exec(num);
        const variants = [num, compact, ...(kForm ? [`${kForm[1]}k`, `~${kForm[1]}k`] : [])];
        if (!variants.some(v => text.includes(v))) {
          errors.push(`doc-integrity: ${doc} missing ${lane} threshold ${num} (source: ${src})`);
        }
      }
      // warn/stop are 1.5x / 3x of BUDGET (code: WARN_AT=BUDGET*3/2,
      // STOP_AT=BUDGET*3) — presence is not enough, the arithmetic must be
      // right. A doc claiming 1.5x/3x of LANE_BASE is the exact lie this gate
      // exists to catch. Checked on the authoritative cost doc only.
      if (doc === 'docs/concepts/cost.md') {
        const budgets: [string, number][] = [['lean', 12000], ['standard', 25000], ['full', 50000]];
        for (const [lane, budget] of budgets) {
          const warn = budget * 3 / 2;
          const stop = budget * 3;
          const warnForms = [`${warn}`, `${Math.round(warn / 1000)}k`, `${warn.toLocaleString()}`, `${warn / 1000}k`];
          const stopForms = [`${stop}`, `${stop / 1000}k`, `${stop.toLocaleString()}`];
          const hasWarn = warnForms.some(f => text.includes(f));
          const hasStop = stopForms.some(f => text.includes(f));
          if (!hasWarn || !hasStop) {
            errors.push(`doc-integrity: ${doc} ${lane} warn/stop must be 1.5x/3x of budget ${budget} (warn ${warn}, stop ${stop})`);
          }
        }
      }
    }
    if (!constants.includes('LANE_BASE_lean=7000')) errors.push('doc-integrity: source lane-base.sh lean base drifted (expected 7000)');
    if (!constants.includes('BUDGET_full=50000')) errors.push('doc-integrity: source lane-base.sh full budget drifted (expected 50000)');
  }
  // evidence exit-code claim must be test-backed
  const evTest = join(import.meta.dirname, '..', 'test', 'lane-integrity.test.ts');
  const testText = existsSync(evTest) ? readFileSync(evTest, 'utf8') : '';
  if (!testText.includes('# Exit:') || !testText.includes('# Verdict:')) {
    errors.push('doc-integrity: audit-trail claims evidence logs carry exit code + verdict, but no test asserts them');
  }
}

// Conditional-assertion guard: an expect() reachable only inside a truthiness
// check silently passes when the value is absent. This class produced 9 defects.
// Allowed: checks keyed on a declared invariant (tier, fixture keys).
const ALLOWED_COND = /if \((?:t\.tier === 3|keys\.length|label === 'exact'|fx\.expect\.(?:lane|sensitive_paths_(?:min|max)))/;
const repoRoot = join(import.meta.dirname, '..');
for (const f of readdirSync(join(repoRoot, 'test')).filter(x => x.endsWith('.test.ts'))) {
  const src = readFileSync(join(repoRoot, 'test', f), 'utf8');
  // matches both braced and brace-less conditionals whose body reaches an expect()
  for (const m of src.matchAll(/if \([^)]+\)(?:\s*\{[^}]{0,400}?)?expect\(/gs)) {
    if (!ALLOWED_COND.test(m[0])) {
      errors.push(`test/${f}: expect() inside a conditional — assert presence explicitly instead:\n    ${m[0].slice(0, 80)}`);
    }
  }
}

if (errors.length) { console.error(errors.map(e => `✗ ${e}`).join('\n')); process.exit(1); }
console.log(`✓ content valid: ${skillDirs.length} skills, ${agentFiles.length} agents`);
