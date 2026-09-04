#!/usr/bin/env bun
// scripts/validate-content.ts
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
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
    // gate_artifact (roadmap item 2): a declared artifact must name a
    // verifiable path (flows/ mission evidence, plan.md, or a references/
    // file that must actually exist beside the skill).
    const ga = (data as Record<string, unknown>).gate_artifact;
    if (ga !== undefined) {
      const v = String(ga).trim();
      if (!v) errors.push(`skill ${file}: gate_artifact declared but empty`);
      else if (!/(flows\/|plan\.md|references\/)/.test(v)) {
        errors.push(`skill ${file}: gate_artifact "${v}" must name a flows/, plan.md, or references/ path`);
      } else {
        const refMatch = v.match(/(references\/[\w./-]+\.md)/);
        if (refMatch) {
          const refPath = join(dirname(file), refMatch[1]);
          if (!existsSync(refPath)) errors.push(`skill ${file}: gate_artifact references "${refMatch[1]}" but file does not exist`);
        }
      }
    }
  }
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
  const text = readFileSync(join(agentDir, f), 'utf8');
  // Entry protocol: EVERY agent, Luffy included. Exempting him is what let a
  // captain with no pre-flight checklist ship. (E2)
  if (!text.includes('## Before you start')) errors.push(`agent ${f}: missing "## Before you start" entry protocol`);
  // Return-to-Luffy: every agent EXCEPT Luffy — he cannot return to himself.
  if (name !== 'luffy-orchestrator' && !text.includes('## Return to Luffy')) {
    errors.push(`agent ${f}: missing "## Return to Luffy" hub rule`);
  }
  // Luffy carries the routing counterpart instead.
  if (name === 'luffy-orchestrator' && !text.includes('Brainstorm is Usopp')) {
    errors.push('agent luffy-orchestrator: missing the "never do another crew member\'s work" routing rule');
  }
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

// The measured index size is published in docs/concepts/cost.md. A measured
// number in prose that drifted from reality is a defect (it survived one
// release: cost.md claimed 5,437 chars after the prune measured 4,688).
// Gate the doc against the measurement so the class stays closed.
const costDoc = join(root, '..', 'docs', 'concepts', 'cost.md');
if (existsSync(costDoc)) {
  const m = readFileSync(costDoc, 'utf8').match(/\*\*Current:\*\* (\d[\d,]*) chars/);
  if (!m) {
    errors.push('docs/concepts/cost.md: missing "**Current:** <n> chars" line for the measured index size');
  } else {
    const stated = parseInt(m[1].replace(/,/g, ''), 10);
    if (stated !== totalDescChars) {
      errors.push(`docs/concepts/cost.md states ${stated} index chars but content measures ${totalDescChars} — update the doc`);
    } else {
      console.log(`✓ cost.md index chars match measurement (${stated})`);
    }
  }
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
      ['lean', '8,000'], ['standard', '13,000'], ['full', '22,000'],
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
  if (!constants.includes('LANE_BASE_lean=8421')) errors.push('doc-integrity: source lane-base.sh lean base drifted (expected 8421)');
  if (!constants.includes('BUDGET_full=50000')) errors.push('doc-integrity: source lane-base.sh full budget drifted (expected 50000)');
  // W12 stale path check: obsolete layout must not appear
  const staleChecks: [string, string[]][] = [
    ['state/<mission>', ['docs/concepts/comparison.md', 'docs/concepts/features.md', 'references/multi-actor.md', 'README.md']],
    ['continue/<mission>', ['docs/concepts/comparison.md', 'docs/concepts/features.md', 'references/multi-actor.md', 'README.md']],
    ['plans/<mission>', ['docs/concepts/comparison.md', 'docs/concepts/features.md', 'references/multi-actor.md', 'README.md']],
    ['logs/lessons', ['docs/concepts/comparison.md', 'docs/concepts/features.md', 'references/multi-actor.md', 'README.md']],
  ];
  for (const [pat, docs] of staleChecks) {
    for (const doc of docs) {
      const p = join(import.meta.dirname, '..', doc);
      if (existsSync(p) && readFileSync(p, 'utf8').includes(pat)) {
        errors.push(`doc-integrity: ${doc} contains obsolete path "${pat}" — use missions/<mission>/ layout`);
      }
    }
  }
  // W17 metrics must come from .metrics/latest.json — check for hardcoded stale numbers not in metrics
  const metricsPath2 = join(import.meta.dirname, '..', '.metrics/latest.json');
  if (existsSync(metricsPath2)) {
    const m2 = JSON.parse(readFileSync(metricsPath2, 'utf8'));
    const readme2 = readFileSync(join(import.meta.dirname, '..', 'README.md'), 'utf8');
    // ensure README rank-1 and pointers match metrics (also checked in --check-readme-metrics, but this is integrity)
    const rankMatch2 = readme2.match(/Retrieval routing rank-1[^\n]*?(\d+\.\d+)%/);
    if (rankMatch2 && parseFloat(rankMatch2[1]) !== Number(m2.retrieval_rank1)) {
      errors.push(`doc-integrity: README rank-1 ${rankMatch2[1]}% != metrics ${m2.retrieval_rank1}%`);
    }
  }
  // N4: a skill that instructs `mugiwara <cmd>` when the CLI has no such case is an
  // instruction the agent cannot follow. This is how `initiative` shipped as a
  // dangling reference. Cases are read from the CLI source, not hardcoded.
  const cliSrc = readFileSync(join(import.meta.dirname, '..', 'src', 'cli.ts'), 'utf8');
  // In-session phrases, not CLI verbs — see mugiwara-workflow.
  const IN_SESSION = new Set(['mode', 'off']);
  const referenced = new Set<string>();
  const walkMarkdown = (dir: string): string[] =>
    listFiles(dir).filter((f) => f.endsWith('.md')).map((f) => join(dir, f));
  for (const dir of ['content', 'docs', 'references']) {
    for (const file of walkMarkdown(join(import.meta.dirname, '..', dir))) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/`mugiwara ([a-z-]+)/g)) referenced.add(m[1]);
    }
  }
  // Also scan repo-root markdown (README, AGENTS) — same defect class.
  for (const file of ['README.md', 'AGENTS.md']) {
    const p = join(import.meta.dirname, '..', file);
    if (!existsSync(p)) continue;
    for (const m of readFileSync(p, 'utf8').matchAll(/`mugiwara ([a-z-]+)/g)) referenced.add(m[1]);
  }
  for (const cmd of referenced) {
    if (IN_SESSION.has(cmd)) continue;
    if (cmd.startsWith('--')) continue;
    if (!cliSrc.includes(`case '${cmd}'`)) {
      errors.push(`doc-integrity: docs instruct "mugiwara ${cmd}" but src/cli.ts has no case '${cmd}'`);
    }
  }
  // N2 banner-format: no raw ANSI escapes in model-facing instructions. The
  // colour table in wave-banners.md is data for the plugin, not an
  // instruction — it holds hex, never escapes, so no exemption is needed.
  // N8 in-session phrases must never read as slash commands.
  const proseFiles: string[] = [];
  for (const dir of ['content', 'docs', 'references']) {
    proseFiles.push(...walkMarkdown(join(import.meta.dirname, '..', dir)));
  }
  for (const file of ['README.md', 'AGENTS.md']) {
    const p = join(import.meta.dirname, '..', file);
    if (existsSync(p)) proseFiles.push(p);
  }
  for (const file of proseFiles) {
    const text = readFileSync(file, 'utf8');
    if (/\\x1b\[|38;2;|38;5;/.test(text)) {
      errors.push(`doc-integrity: ${file} instructs raw ANSI escapes the model cannot emit — banners are plain headings`);
    }
    // `/mugiwara continue` is a real CLI verb and out of scope — only the mode
    // switch is an in-session phrase, so only its slash forms are flagged.
    if (/`\/(mugiwara mode|mugiwara (guided|semi|auto))/.test(text)) {
      errors.push(`doc-integrity: ${file} writes the in-session mode phrase as a slash command — say "mugiwara mode <level>" in session, no slash, no CLI flag`);
    }
  }
  // N5: the flow-summary contract must exist — it is what keeps normal
  // verbosity to one line per stage.
  const orchSkill = readFileSync(join(import.meta.dirname, '..', 'content', 'skills', 'mugiwara-orchestration', 'SKILL.md'), 'utf8');
  if (!orchSkill.includes('## Flow summary line')) {
    errors.push('doc-integrity: mugiwara-orchestration SKILL.md lost its "## Flow summary line" contract');
  }
  // N9: the platform count must stay qualified — 9 installable + 3 marketplace.
  const readme = readFileSync(join(import.meta.dirname, '..', 'README.md'), 'utf8');
  if (readme.includes('12 platforms') && !readme.includes('via marketplace manifest')) {
    errors.push('doc-integrity: README "12 platforms" is unqualified — split 9 via install + 3 via marketplace manifest');
  }
}
}

// --- config drift gate (W11): every key code reads must appear in DEFAULT_CONFIG and docs, and vice versa ---
if (process.argv.includes('--check-config')) {
  const cfgSrc = readFileSync(join(import.meta.dirname, '..', 'src/config.ts'), 'utf8');
  const m = cfgSrc.match(/DEFAULT_CONFIG\s*=\s*\[([\s\S]*?)\]\.join/);
  let defaultKeys: string[] = [];
  if (m) {
    const block = m[1];
    for (const line of block.split(/\r?\n/)) {
      const t = line.trim();
      if (!t) continue;
      // extract string content between quotes
      const q = t.match(/['"`]([^'"`]*?)['"`]/);
      if (!q) continue;
      let s = q[1].trim();
      if (!s) continue;
      if (s.startsWith('#')) s = s.slice(1).trim();
      if (!s) continue;
      const eq = s.indexOf('=');
      if (eq === -1) continue;
      const key = s.slice(0, eq).trim();
      if (key) defaultKeys.push(key);
    }
  }
  // docs keys from config.md table (only the ## Keys section, not template examples)
  const docPath = join(import.meta.dirname, '..', 'docs/concepts/config.md');
  let docKeys: string[] = [];
  if (existsSync(docPath)) {
    const docText = readFileSync(docPath, 'utf8');
    const keysSectionMatch = docText.match(/## Keys([\s\S]*?)(?:\n## |\n#|$)/);
    const keysSection = keysSectionMatch ? keysSectionMatch[1] : docText;
    for (const line of keysSection.split(/\r?\n/)) {
      const cm = line.match(/\|\s*`([^`]+)`\s*\|/);
      if (cm) {
        const k = cm[1].trim();
        if (k && !docKeys.includes(k)) docKeys.push(k);
      }
    }
  } else {
    errors.push('config-drift: docs/concepts/config.md not found');
  }
  // code keys: scan src/*.ts, scripts/*.sh, hooks/*.ts for key patterns
  const codeRoots = [
    join(import.meta.dirname, '..', 'src'),
    join(import.meta.dirname, '..', 'scripts'),
    join(import.meta.dirname, '..', 'hooks'),
  ];
  const codeTextAll = codeRoots.map(r => {
    if (!existsSync(r)) return '';
    const files = readdirSync(r, { withFileTypes: true }).filter(e => e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.sh'))).map(e => readFileSync(join(r, e.name), 'utf8')).join('\n');
    // also need subdirectories
    let sub = '';
    try {
      for (const e of readdirSync(r, { withFileTypes: true })) {
        if (e.isDirectory()) {
          const subdir = join(r, e.name);
          for (const f of readdirSync(subdir, { withFileTypes: true }).filter(x => x.isFile() && (x.name.endsWith('.ts') || x.name.endsWith('.sh')))) {
            sub += readFileSync(join(subdir, f.name), 'utf8') + '\n';
          }
        }
      }
    } catch {}
    return files + sub;
  }).join('\n');
  // check each default key appears in code
  for (const k of defaultKeys) {
    if (!codeTextAll.includes(k)) {
      errors.push(`config-drift: DEFAULT_CONFIG key "${k}" not found in code (src/*.ts, scripts/*.sh, hooks/*.ts)`);
    }
    if (!docKeys.includes(k)) {
      errors.push(`config-drift: DEFAULT_CONFIG key "${k}" missing from docs/concepts/config.md`);
    }
  }
  for (const k of docKeys) {
    if (!defaultKeys.includes(k)) {
      errors.push(`config-drift: docs/concepts/config.md key "${k}" not in DEFAULT_CONFIG`);
    }
    if (!codeTextAll.includes(k)) {
      errors.push(`config-drift: docs key "${k}" not found in code`);
    }
  }
  // N6: key parity is not value parity. A documented enum value the code rejects
  // falls back silently — the user gets the default and no error. Compare both
  // directions. (auto_commit is advisory-only by design — no code allowlist
  // exists, so there is nothing to compare.)
  const configMd = existsSync(docPath) ? readFileSync(docPath, 'utf8') : '';
  const savepointSh = readFileSync(join(import.meta.dirname, '..', 'scripts', 'savepoint.sh'), 'utf8');
  const parseDocumentedValues = (key: string): string[] => {
    const m = configMd.match(new RegExp(`^\\|\\s*\`${key}\`\\s*\\|\\s*([^|]+)\\|`, 'm'));
    if (!m) return [];
    return m[1].split('/').map((v) => v.trim()).filter(Boolean);
  };
  const parseShellAllowlist = (varName: string): string[] => {
    const m = savepointSh.match(new RegExp(`case "\\$${varName}" in\\s*([^)]+)\\)`));
    if (!m) return [];
    return m[1].split(/[|\s]+/).map((v) => v.trim()).filter(Boolean);
  };
  const parseTsUnion = (file: string, typeName: string, extra: string[] = [], exclude: RegExp | null = null): string[] => {
    const p = join(import.meta.dirname, '..', file);
    if (!existsSync(p)) return [];
    const src = readFileSync(p, 'utf8');
    const m = src.match(new RegExp(`type ${typeName} = ([^;]+);`));
    if (!m) return [];
    const vals = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    return [...new Set([...vals, ...extra])].filter((v) => !(exclude && exclude.test(v)));
  };
  const ENUM_CHECKS: Array<{ key: string; accepted: string[] }> = [
    { key: 'mode', accepted: parseShellAllowlist('MODE') },
    { key: 'verbosity', accepted: parseShellAllowlist('VERBOSITY') },
    { key: 'review_depth', accepted: parseShellAllowlist('DEPTH_REVIEW') },
    { key: 'quality_depth', accepted: parseShellAllowlist('DEPTH_QUALITY') },
    { key: 'verify_merged', accepted: parseShellAllowlist('DEPTH_VERIFY') },
    // sign allowlist lives in TypeScript: read the exported union, not grep.
    // 'minisign-fail' is internal (never a valid config value); 'auto' is an
    // explicit resolveBackend case, so it counts as accepted.
    { key: 'sign', accepted: parseTsUnion('src/sign.ts', 'BackendChoice', ['auto'], /-fail$/) },
    { key: 'enforce', accepted: parseTsUnion('hooks/pipeline-guard.ts', 'Enforce') },
  ];
  for (const { key, accepted } of ENUM_CHECKS) {
    const documented = parseDocumentedValues(key);
    if (!documented.length || !accepted.length) continue;
    const missing = documented.filter((v) => !accepted.includes(v));
    const undocumented = accepted.filter((v) => !documented.includes(v));
    if (missing.length) errors.push(`config ${key}: documented but rejected by code: ${missing.join(', ')}`);
    if (undocumented.length) errors.push(`config ${key}: accepted by code but undocumented: ${undocumented.join(', ')}`);
  }
  if (!errors.some(e => e.startsWith('config-drift') || e.startsWith('config '))) {
    console.log(`✓ config in sync: ${defaultKeys.length} keys (${defaultKeys.join(', ')})`);
  }
}

// --- wiring gate (W7): every src module must be imported somewhere ---
if (process.argv.includes('--check-wiring')) {
  const srcDir = join(import.meta.dirname, '..', 'src');
  const ENTRY = new Set(['cli.ts', 'index.ts', 'installer.ts']);
  const srcFiles = readdirSync(srcDir).filter(n => n.endsWith('.ts'));
  const searchDirs = [srcDir, join(import.meta.dirname, '..', 'hooks'), join(import.meta.dirname, '..', 'scripts')];
  const allFiles: string[] = [];
  for (const d of searchDirs) {
    if (!existsSync(d)) continue;
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.js') || e.name.endsWith('.sh') || e.name.endsWith('.mjs'))) {
          allFiles.push(full);
        }
      }
    };
    walk(d);
  }
  for (const f of srcFiles) {
    if (ENTRY.has(f)) continue;
    const stem = f.slice(0, -3);
    let found = false;
    for (const full of allFiles) {
      if (full.endsWith(`/src/${f}`) || full === join(srcDir, f)) continue;
      try {
        const txt = readFileSync(full, 'utf8');
        // hooks import shared code as '../src/<stem>' (bundled by build-hooks)
        // — that is a first-class wire, not a dangling module.
        if (txt.includes(`'./${stem}`) || txt.includes(`"./${stem}`) || txt.includes(`'./${stem}.ts'`) || txt.includes(`"./${stem}.ts"`) || txt.includes(`'../src/${stem}.ts'`) || txt.includes(`"../src/${stem}.ts"`)) {
          found = true;
          break;
        }
      } catch {}
    }
    if (!found) {
      errors.push(`src/${f}: imported by nothing — wire it, or delete it with its tests and its features.md claim`);
    }
  }
  if (!errors.some(e => e.includes('imported by nothing'))) {
    console.log(`✓ wiring: all src modules imported`);
  }
}

// --- README metrics gate (D3): README table must match .metrics/latest.json ---
if (process.argv.includes('--check-readme-metrics')) {
  const metricsPath = join(import.meta.dirname, '..', '.metrics', 'latest.json');
  if (!existsSync(metricsPath)) {
    errors.push(`README metrics: ${metricsPath} not found — run bun scripts/write-metrics.ts`);
  } else {
    let metrics: any;
    try { metrics = JSON.parse(readFileSync(metricsPath, 'utf8')); }
    catch (e) { errors.push(`README metrics: invalid JSON in ${metricsPath}: ${e}`); }
    if (metrics) {
      const readmePath = join(import.meta.dirname, '..', 'README.md');
      if (!existsSync(readmePath)) {
        errors.push('README metrics: README.md not found');
      } else {
        const readme = readFileSync(readmePath, 'utf8');
        // rank-1: **95.9%**, 216 probes
        const rankMatch = readme.match(/Retrieval routing rank-1[^\n]*?(\d+\.\d+)%[^\n]*?(\d+)\s+probes/i);
        if (!rankMatch) {
          errors.push('README metrics: could not parse Retrieval routing rank-1 row (expected "**X.Y%**, N probes")');
        } else {
          const readmeRank = parseFloat(rankMatch[1]);
          const readmeProbes = parseInt(rankMatch[2], 10);
          const wantRank = Number(metrics.retrieval_rank1);
          const wantProbes = Number(metrics.retrieval_probes);
          if (Math.abs(readmeRank - wantRank) > 0.05) {
            errors.push(`README metrics: rank-1 ${readmeRank}% != metrics ${wantRank}% (probes ${readmeProbes} vs ${wantProbes}) — run bun scripts/write-metrics.ts and update README`);
          }
          if (readmeProbes !== wantProbes) {
            errors.push(`README metrics: probes ${readmeProbes} != metrics ${wantProbes} (rank ${readmeRank}% vs ${wantRank}%) — run bun scripts/write-metrics.ts and update README`);
          }
        }
        // pointers: **286/286**, 9 targets (or tiers)
        const ptrMatch = readme.match(/Reference pointers resolve[^\n]*?\*\*(\d+)\/(\d+)\*\*[^\n]*?(\d+)\s+(tiers|targets)/i);
        if (!ptrMatch) {
          errors.push('README metrics: could not parse Reference pointers row (expected "**N/N**, M targets")');
        } else {
          const a = parseInt(ptrMatch[1], 10);
          const b = parseInt(ptrMatch[2], 10);
          const count = parseInt(ptrMatch[3], 10);
          const wantTotal = Number(metrics.pointers_total);
          const wantTargets = Number(metrics.pointers_targets);
          if (a !== wantTotal || b !== wantTotal) {
            errors.push(`README metrics: pointers ${a}/${b} != metrics ${wantTotal}/${wantTotal} — run bun scripts/write-metrics.ts and update README`);
          }
          if (count !== wantTargets) {
            errors.push(`README metrics: targets/tiers ${count} != metrics ${wantTargets} — run bun scripts/write-metrics.ts and update README (expected ${wantTargets} targets)`);
          }
        }
        // sanity: table still claims "Nothing in this table is an estimate"
        if (!readme.includes('Nothing in this table is an estimate')) {
          errors.push('README metrics: missing "Nothing in this table is an estimate" line');
        }
        if (errors.filter(e => e.startsWith('README metrics:')).length === 0) {
          console.log(`✓ README metrics match .metrics/latest.json (rank-1 ${metrics.retrieval_rank1}% ${metrics.retrieval_probes} probes, ${metrics.pointers_total}/${metrics.pointers_total} pointers, ${metrics.pointers_targets} targets)`);
        }
      }
    }
  }
}

// --- invariant-mechanism gate (E-gaps 5.2): every never/always/MUST has a mechanism ---
// A rule with no machine behind it and no prose-only entry is a gap, not a
// rule. Concepts live in docs/concepts/enforcement.md; each concept below
// must have its anchor there, and every never/always/MUST line in content/
// must match at least one concept. Adding a rule = table row + concept here
// + mutation in gate-selftest.ts.
if (process.argv.includes('--check-invariants')) {
  const enfPath = join(import.meta.dirname, '..', 'docs', 'concepts', 'enforcement.md');
  const enf = existsSync(enfPath) ? readFileSync(enfPath, 'utf8') : '';
  if (!enf) errors.push('invariant gate: docs/concepts/enforcement.md is missing');
  const CONCEPTS: Array<{ id: string; re: RegExp; anchor: string }> = [
    { id: 'INV-triage', re: /triage|savepoint|flow 0/i, anchor: 'hooks/pipeline-guard.js' },
    { id: 'INV-write-scope', re: /write-scope|delegat.*zoro|another crew member|crew member's (work|job)|dispatch another crew|one role at a time|embodies one|never.*mutat|mode: all|subagent|never forward|never dispatch|never.*route|never execute source/i, anchor: 'INV-write-scope' },
    { id: 'INV-luffy-hub', re: /return to luffy|luffy routes?|routes? .*luffy|orchestrator|route reasons|check-in|decision log|next_action|flow stage|omitted|in-flight|exits 2/i, anchor: 'INV-hub' },
    { id: 'INV-plan-nami', re: /only nami|nami's|without a GO|executor without/i, anchor: 'INV-plan-nami' },
    { id: 'INV-banner', re: /banner/i, anchor: 'INV-banner' },
    { id: 'INV-no-deploy', re: /deploys?|merging?|creates a PR|gh pr|push.*branch|terminal step|reaches a user|ship.*user/i, anchor: 'hooks/pretool-guard.js' },
    { id: 'INV-heal-cap', re: /heal|4-phase|reproduce.*localize/i, anchor: 'INV-heal-cap' },
    { id: 'INV-lane', re: /\blane\b|mission split|sub-mission|parallel.*safe|never.*parallel|\[PARALLEL\]|shortcut|full pipeline/i, anchor: 'INV-lane' },
    { id: 'INV-evidence', re: /evidence|re-run|re run|claim|never validate|doubt|fresh (context|agent)|adversarial|no pass/i, anchor: 'INV-evidence' },
    { id: 'INV-mode', re: /auto.?commit|auto mode|guided|semi|mode.*flip|steps cap|verbosity|auto never|never.*auto|never ask/i, anchor: 'INV-mode' },
    { id: 'INV-quality', re: /weaken|threshold|coverage|lint|fake pass|silent.*pass|duplicat|complexity|dead code|strict|sonar|maintainability|assert green|failing suite|default-on|trigger|may raise|fixed numbers|invent tooling/i, anchor: 'INV-quality' },
    { id: 'INV-tests', re: /\btdd\b|failing first|immutable|oracle|user.?test|flaky|intermittent|never.*test\b|gherkin|feature file|banned|translate-or-command|long unreachable|can never prove|never saw|small steps|never create inte|integration tests/i, anchor: 'INV-tests' },
    { id: 'INV-resume', re: /restart|resume|continue\.json|continue from|never restarts?|never scan|state proves/i, anchor: 'INV-resume' },
    { id: 'INV-english', re: /always english|one language only|conversational language/i, anchor: 'INV-english' },
    { id: 'INV-plan-discipline', re: /zero-question|unverified path|\btbd\b|plan above or below|40-file|task index|stranger must|plan.*hole|regression|correctness.*break|never.*plan|never appended|2000\+ lines/i, anchor: 'INV-plan-discipline' },
    { id: 'INV-security-contract', re: /secret|sanitiz|authz|\.safeParse|trust|inject|data, never|finding, not|dangerouslySetInnerHTML|owasp|stride|exploit|permission|pii|never trust|minor by default|severity|gets the matrix|expiry|revoke/i, anchor: 'INV-security-contract' },
    { id: 'INV-git-hygiene', re: /commit|git add|revert|broken tree|staging|micro-commit|never.*tree|force-add|gitignore/i, anchor: 'INV-git-hygiene' },
    { id: 'INV-conduct', re: /ego|yes-man|interrogat|trade-off|assume silently|batched question|sparring|recommendation|reconsider|pushes back|silently defer|verdict only/i, anchor: 'INV-conduct' },
    { id: 'INV-mirror', re: /todo.*mirror|same response|transcript.*sufficient|task N\/M|echoing raw|compact.*table|report table|evidence link|never changes|always visible|audit surface|audit trail|never narrows|one-liner|mid-argument|overwrite|detailed summary|lags|never seeded|list never|must always see|never depends/i, anchor: 'INV-mirror' },
    { id: 'INV-trust', re: /redefine.*rule|artifact trust|untrusted|HIGH trust|LOW-trust|instruction.*data|verbatim instructions|lesson/i, anchor: 'INV-trust' },
    { id: 'INV-role', re: /never implements|never fixes|outside your role|luffy's, always|who never|never does what|11th member|finding yourself|coordinator|auditor/i, anchor: 'INV-role' },
    { id: 'INV-role-conduct', re: /never refuse|never file|not verdicts|input, not|plain |generic assistant|embodies roles|fix the SKILL, never/i, anchor: 'INV-role-conduct' },
    { id: 'INV-execution-misc', re: /inline.*main thread|worker|sequential|main thread IS the crew|frame persists|never drop the roles|inspection.*only|no network|no shell|read-only|pre-flow|never dispatch|wave|dispatch.*flow|never create config|never print|control-command|mid-task|posture/i, anchor: 'INV-execution-model' },
    { id: 'INV-debug', re: /repro|root cause|symptom|minimal change|one theory|no debugging/i, anchor: 'INV-debug' },
    { id: 'INV-a11y', re: /alt=|outline|aria|reduced-motion|contrast|gray-100|role\/label|focus|color-only/i, anchor: 'INV-a11y' },
    { id: 'INV-code-facts', re: /operator|operand|almost always a bug|≠/i, anchor: 'INV-code-facts' },
    { id: 'INV-contract', re: /contract|additive|versions|bump|deprecated/i, anchor: 'INV-contract' },
    { id: 'INV-backend', re: /migration|ad-hoc|atomic|pagination|unbounded|N\+1|eager-load|invalidation|buffer whole|timeouts|cancellation|hang/i, anchor: 'INV-backend' },
  ];
  for (const c of CONCEPTS) {
    if (enf && !enf.includes(c.anchor)) errors.push(`invariant gate: concept ${c.id} has no mechanism row in enforcement.md (anchor "${c.anchor}")`);
  }
  // The matrix documents the per-tier side of the hook concepts — a removed
  // guard row must fail this gate, not slip through as prose.
  for (const row of ['Irreversible-command guard', 'Turn-end enforcement']) {
    const matrix = readFileSync(join(import.meta.dirname, '..', 'docs', 'reference', 'harness-matrix.md'), 'utf8');
    if (!matrix.includes(row)) errors.push(`invariant gate: harness-matrix.md lost its "${row}" row`);
  }
  const lineRe = /\bnever\b|\balways\b|MUST/;
  const scanRoots = [join(root, 'skills'), join(root, 'agents')];
  const unreg: string[] = [];
  const seen = new Set<string>();
  const walkInv = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) { walkInv(full); continue; }
      if (!e.name.endsWith('.md')) continue;
      for (const line of readFileSync(full, 'utf8').split(/\r?\n/)) {
        if (!lineRe.test(line)) continue;
        const key = line.trim();
        if (seen.has(key)) continue;
        seen.add(key);
        if (!CONCEPTS.some((c) => c.re.test(line))) unreg.push(`${full.replace(root + '/', '')}: ${key.slice(0, 100)}`);
      }
    }
  };
  for (const d of scanRoots) walkInv(d);
  for (const u of unreg) errors.push(`invariant without mechanism: ${u} — add a concept row in enforcement.md + a bucket above`);
  if (!unreg.length && enf) console.log(`✓ invariants: every never/always/MUST maps to a mechanism row`);
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
