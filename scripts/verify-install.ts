#!/usr/bin/env bun
// scripts/verify-install.ts — G1: prove the shipped prose does not lie.
//
// Three checks, all of which failed silently before:
//   A. pointer resolution  — every `references/*.md` pointer resolves after install
//   B. prose path validity — every `.mugiwara/…`, `scripts/…`, `docs/…` path a
//      skill or agent NAMES either exists in the repo or matches a declared
//      runtime shape. Four BLOCKER/MAJOR findings shared one root cause:
//      nothing verified that a path named in prose actually exists.
//   C. reference reachability — every reference file has an inbound pointer.
//      Unreachable files still install into every project.

import { existsSync, mkdtempSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { installTo } from '../src/installer.ts';
import { targets, TARGET_IDS } from '../src/targets/index.ts';

const repoRoot = join(import.meta.dirname, '..');
const fail: string[] = [];

function findMd(root: string, out: string[] = []): string[] {
  if (!existsSync(root)) return out;
  for (const ent of readdirSync(root, { withFileTypes: true })) {
    const p = join(root, ent.name);
    if (ent.isDirectory()) findMd(p, out);
    else if (ent.name.endsWith('.md')) out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------------------
// A. pointer resolution, across EVERY install target (was 3 of 9)
// ---------------------------------------------------------------------------
let pointers = 0;
let brokenPointers = 0;

for (const id of TARGET_IDS) {
  const target = targets[id];
  const dir = mkdtempSync(join(tmpdir(), `mugi-verify-${id}-`));
  try {
    installTo(target, { scope: 'project', projectDir: dir, dryRun: false, force: true });

    const skillsDir = target.paths({ scope: 'project', projectDir: dir, home: '' }).skillsDir;
    const mugiwaraRefsDir = join(dir, '.mugiwara', 'refs');

    const skillFiles = findMd(skillsDir).filter((f) => !f.replace(skillsDir, '').includes('/references/'));

    for (const file of skillFiles) {
      // Targets emit skills either as `<skillsDir>/<name>/SKILL.md` (claude) or
      // as a flat `<skillsDir>/<name>.instructions.md` (copilot). Both forms
      // must yield the skill name, because non-native targets store references
      // per-skill under `.mugiwara/refs/<name>/`.
      const relSkill = relative(skillsDir, file);
      const skillName = relSkill.includes('/') ? relSkill.split('/')[0] : basename(relSkill).split('.')[0];

      for (const m of readFileSync(file, 'utf8').matchAll(/`([^`]*references\/[^`]+\.md)`/g)) {
        pointers++;
        const pointer = m[1];
        const candidates = [
          join(dirname(file), pointer),
          join(mugiwaraRefsDir, pointer.replace(/^(?:_shared\/)?references\//, '')),
          ...(target.refsDir
            ? [join(target.refsDir({ scope: 'project', projectDir: dir, home: '' }, skillName), basename(pointer))]
            : []),
        ];
        if (!candidates.some((p) => existsSync(p))) {
          brokenPointers++;
          fail.push(`✗ [${id}] ${file.replace(dir + '/', '')}: \`${pointer}\` → not found`);
        }
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// B. prose path validity
// ---------------------------------------------------------------------------
// `.mugiwara/**` paths are written at RUNTIME — they never exist in a clone
// (`.mugiwara/` is gitignored), so existence proves nothing. What can be
// verified is the SHAPE: prose must name the same filename template the
// scripts actually write. This is the check that would have caught
// savepoint.sh globbing `issues/<mission>-blockers.md` while 15 prose sites
// mandated the dated `issues/YYYY-MM-DD-<mission>-blockers.md`.
const RUNTIME_SHAPES: RegExp[] = [
  /^\.mugiwara\/?(\*\*)?$/,                                       // bare mention of the dir
  /^~?\/?\.mugiwara\/config$/,                                    // project + global config
  /^\.mugiwara\/(state|continue)\/<mission>\/(\[member\]|state|<member>)\.json$/,
  /^\.mugiwara\/issues\/(YYYY-MM-DD-<mission>-blockers\.md)?$/,
  /^\.mugiwara\/logs\/(YYYY-MM-DD-<mission>\.md|lessons\.md)?$/,
  /^\.mugiwara\/(plans|spec|reports)\/(YYYY-MM-DD-<mission>\.md)?$/,
  /^\.mugiwara\/review\/(YYYY-MM-DD-<mission>-(review|security|verifier)\.md)?$/,
  /^\.mugiwara\/results\/<mission>\/([0-9]{2}-[a-z-]+|eval|resume|todos)\.md$/,
  /^\.mugiwara\/results\/?$/,
];

// Shape violations that exist today and are NOT fixed in this mission because
// another worker holds `content/**` prose this wave. Ratchet: a NEW violation
// fails the gate; these two are reported, then must be deleted from this list.
const KNOWN_SHAPE_DRIFT = new Map<string, string>([
  ['.mugiwara/review/<mission>-review.md', 'content/skills/mugiwara-gates/SKILL.md — undated, should be YYYY-MM-DD-<mission>-review.md'],
  ['.mugiwara/review/<mission>-security.md', 'content/skills/mugiwara-gates/SKILL.md — undated, should be YYYY-MM-DD-<mission>-security.md'],
]);

/** `[label](path)`, `bun scripts/x.ts --flag`, trailing punctuation → the bare path. */
function normalizePath(raw: string): string {
  let s = raw.trim();
  const link = s.match(/^\[[^\]]*\]\(([^)]+)\)$/);
  if (link) s = link[1];
  s = s.replace(/^(?:bun|bash|sh|npx|node)\s+/, '');
  s = s.split(/\s/)[0];
  return s.replace(/[.,;:]$/, '');
}

const PROSE_PATH = /`([^`\n]*?(?:\.mugiwara\/|scripts\/|docs\/)[^`\n]*?)`/g;
const proseFiles = [...findMd(join(repoRoot, 'content')), ...findMd(join(repoRoot, 'references'))];

let prosePaths = 0;
const drift: string[] = [];
for (const file of proseFiles) {
  const rel = relative(repoRoot, file);
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    for (const m of line.matchAll(PROSE_PATH)) {
      const p = normalizePath(m[1]);
      if (!p.includes('/')) continue;
      prosePaths++;
      const at = `${rel}:${i + 1}`;

      if (/(^|\/)\.mugiwara\//.test(p) || p === '.mugiwara/' || p === '.mugiwara/**') {
        if (RUNTIME_SHAPES.some((re) => re.test(p))) continue;
        if (KNOWN_SHAPE_DRIFT.has(p)) { drift.push(`  ${at}: \`${p}\` — ${KNOWN_SHAPE_DRIFT.get(p)}`); continue; }
        fail.push(`✗ ${at}: \`${p}\` → not a declared runtime path shape`);
        continue;
      }
      // scripts/ and docs/ are SHIPPED files — they must exist in the repo
      if (!existsSync(join(repoRoot, p))) fail.push(`✗ ${at}: \`${p}\` → file does not exist`);
    }
  });
}

// ---------------------------------------------------------------------------
// C. reference reachability (file → pointer, the inverse of check A)
// ---------------------------------------------------------------------------
// Ratchet, not a hard zero: 15 files are unreachable today. Deleting them is a
// content decision, not a gate decision — so the gate freezes the number and
// fails the moment a 16th appears.
const ORPHAN_BASELINE = 18;

const corpus = proseFiles.map((f) => ({ file: f, body: readFileSync(f, 'utf8') }));
const refFiles = proseFiles.filter((f) => f.includes('/references/') || relative(repoRoot, f).startsWith('references/'));
const orphans: string[] = [];
for (const rf of refFiles) {
  const needle = `references/${basename(rf)}`;
  const reachable = corpus.some((c) => c.file !== rf && c.body.includes(needle));
  if (!reachable) orphans.push(relative(repoRoot, rf));
}
if (orphans.length > ORPHAN_BASELINE) {
  fail.push(
    `✗ ${orphans.length} unreachable reference files (baseline ${ORPHAN_BASELINE}) — a new orphan was added:\n` +
      orphans.map((o) => `    ${o}`).join('\n'),
  );
}

// ---------------------------------------------------------------------------
console.log(`  ${pointers} pointers checked across ${TARGET_IDS.length} targets`);
console.log(`  ${prosePaths} prose paths checked in ${proseFiles.length} files`);
console.log(`  ${orphans.length}/${refFiles.length} reference files unreachable (baseline ${ORPHAN_BASELINE})`);
if (orphans.length) orphans.forEach((o) => console.log(`    orphan: ${o}`));
if (drift.length) { console.log('  known prose-path drift (owned elsewhere, must be fixed):'); drift.forEach((d) => console.log(d)); }

if (fail.length) {
  console.log('');
  fail.forEach((f) => console.log(f));
  console.log(`\n✗ verify-install: ${fail.length} problem(s) (${brokenPointers} broken pointers)`);
  process.exit(1);
}
console.log('✓ verify-install: pointers resolve, prose paths valid, no new orphans');
