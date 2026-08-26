// src/installer.ts
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, copyFileSync, rmSync, lstatSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, type FrontmatterData } from './frontmatter.ts';
import type { Scope } from './manifest.ts';

export type ContentItem = {
  name: string;
  data: FrontmatterData;
  body: string;
  refs: { relPath: string; text: string }[];
  internal?: boolean;
};

export type InstallOptions = {
  scope: Scope;
  projectDir: string;
  dryRun?: boolean;
  force?: boolean;
  home?: string;
};

export type InstallResult = {
  written: string[];
  skipped: string[];
  backedUp: string[];
  notes: string[];
};

export type TransformOut = { relPath: string; text: string } | null;

export interface Target {
  id: string;
  label: string;
  native: boolean;
  tier?: 1 | 2 | 3;
  refPointerPrefix?: string;
  paths(opts: { scope: Scope; projectDir: string; home: string }): { skillsDir: string; agentsDir: string };
  transformSkill(data: FrontmatterData, body: string): TransformOut;
  transformAgent(data: FrontmatterData, body: string): TransformOut;
  refsDir?(opts: { scope: Scope; projectDir: string; home: string }, skillName: string): string;
  transformSkillFull?(data: FrontmatterData, body: string): TransformOut | null;
  transformAgentFull?(data: FrontmatterData, body: string): TransformOut | null;
  postInstall?(opts: { scope: Scope; projectDir: string; home: string; dryRun: boolean; files: string[] }): { written: string[]; notes: string[] };
  /**
   * Undo anything postInstall did to a file mugiwara does not own.
   *
   * Files listed in the manifest are deleted wholesale on uninstall, so a
   * shared file we merely EDITED (settings.json) must never be reported as
   * written — deleting it destroys the user's own configuration. Such files are
   * un-merged here instead.
   */
  postUninstall?(opts: { scope: Scope; projectDir: string; home: string; dryRun: boolean }): { changed: string[]; notes: string[] };
}

export const CONTENT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'content');
const pkg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8')) as { version: string };
export const VERSION = pkg.version;

export function collectContent(): { skills: ContentItem[]; agents: ContentItem[]; sharedRefs: { relPath: string; text: string }[] } {
  const skillNames = readdirSync(join(CONTENT_DIR, 'skills'), { withFileTypes: true })
    .filter(e => e.isDirectory()).map(e => e.name);
  const skills = skillNames.map(name => {
    const { data, body } = parseFrontmatter(readFileSync(join(CONTENT_DIR, 'skills', name, 'SKILL.md'), 'utf8'));
    return { name, data, body, refs: collectRefs(join(CONTENT_DIR, 'skills', name)) };
  });
  const agents = readdirSync(join(CONTENT_DIR, 'agents'))
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const { data, body } = parseFrontmatter(readFileSync(join(CONTENT_DIR, 'agents', f), 'utf8'));
      return { name: f.replace(/\.md$/, ''), data, body, refs: [] as { relPath: string; text: string }[], internal: data.internal === 'true' };
    });
  const sharedRefsDir = join(dirname(CONTENT_DIR), 'references');
  const sharedRefs: { relPath: string; text: string }[] = [];
  if (existsSync(sharedRefsDir)) {
    for (const f of readdirSync(sharedRefsDir)) {
      if (!f.endsWith('.md')) continue;
      sharedRefs.push({ relPath: f, text: readFileSync(join(sharedRefsDir, f), 'utf8') });
    }
  }
  return { skills, agents, sharedRefs };
}

function collectRefs(skillDir: string): { relPath: string; text: string }[] {
  const refsDir = join(skillDir, 'references');
  if (!existsSync(refsDir)) return [];
  return readdirSync(refsDir, { recursive: true }).map(f => String(f)).filter(f => f.endsWith('.md'))
    .map(rel => ({ relPath: rel, text: readFileSync(join(refsDir, rel), 'utf8') }));
}

export function installTo(target: Target, opts: InstallOptions): InstallResult {
  const { scope, projectDir, dryRun = false, force = false } = opts;
  const home = opts.home ?? homedir();
  const { skills, agents, sharedRefs } = collectContent();
  const dirs = target.paths({ scope, projectDir, home });
  const backupRoot = join(scope === 'global' ? home : projectDir, '.mugiwara');
  const result: InstallResult = { written: [], skipped: [], backedUp: [], notes: [] };

  const writeOne = (absPath: string, text: string) => {
    if (existsSync(absPath)) {
      if (readFileSync(absPath, 'utf8') === text) { result.skipped.push(absPath); return; }
      if (!force) {
        result.skipped.push(absPath);
        result.notes.push(`conflict (not overwritten; run update to replace with backup): ${absPath}`);
        return;
      }
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = absPath.replace(/[^a-zA-Z0-9]+/g, '_');
      const backupDir = join(backupRoot, 'backup', `${ts}-${target.id}`);
      const backupFile = join(backupDir, fileName);
      if (!dryRun) { mkdirSync(backupDir, { recursive: true }); copyFileSync(absPath, backupFile); }
      result.backedUp.push(absPath);
    }
    if (!dryRun) { mkdirSync(dirname(absPath), { recursive: true }); writeFileSync(absPath, text); }
    result.written.push(absPath);
  };

  for (const s of skills) {
    const out = target.transformSkill(s.data, s.body);
    if (out) {
      let text = out.text;
      if (target.refPointerPrefix !== undefined && target.refPointerPrefix !== '') {
        text = text.replace(/`_shared\/references\//g, '`' + target.refPointerPrefix + '_shared/references/');
      }
      writeOne(join(dirs.skillsDir, out.relPath), text);
    }
    if (target.transformSkillFull) {
      const full = target.transformSkillFull(s.data, s.body);
      if (full && target.refsDir) {
        let text = full.text;
        if (target.refPointerPrefix !== undefined && target.refPointerPrefix !== '') {
          text = text.replace(/`_shared\/references\//g, '`' + target.refPointerPrefix + '_shared/references/');
        }
        writeOne(join(target.refsDir({ scope, projectDir, home }, s.name), full.relPath), text);
      }
    }
    if (s.refs.length && target.refsDir) {
      const refsRoot = target.refsDir({ scope, projectDir, home }, s.name);
      for (const r of s.refs) writeOne(join(refsRoot, r.relPath), r.text);
    }
  }
  for (const a of agents) {
    const out = target.transformAgent({ ...a.data, ...(a.internal ? { 'internal-agent': 'true' } : {}) }, a.body);
    if (out) writeOne(join(dirs.agentsDir, out.relPath), out.text);
    if (target.transformAgentFull) {
      const full = target.transformAgentFull(a.data, a.body);
      if (full && target.refsDir) writeOne(join(target.refsDir({ scope, projectDir, home }, a.name), full.relPath), full.text);
    }
  }

  if (sharedRefs.length) {
    const sharedRoot = join(dirs.skillsDir, '_shared', 'references');
    for (const r of sharedRefs) writeOne(join(sharedRoot, r.relPath), r.text);
  }

  if (target.postInstall) {
    const post = target.postInstall({ scope, projectDir, home, dryRun, files: result.written });
    result.written.push(...post.written);
    result.notes.push(...post.notes);
  }

  // A fresh install must be immediately usable — write a default
  // .mugiwara/config so no key silently falls back. Only for project scope;
  // global installs don't own a project config. Never overwrite an existing
  // config.
  if (scope === 'project') {
    const configPath = join(projectDir, '.mugiwara', 'config');
    // lstat, not existsSync: a pre-created symlinked config must not be
    // followed and overwritten (TOCTOU / symlink defense-in-depth).
    let configExists = false;
    try { configExists = lstatSync(configPath).isFile() || lstatSync(configPath).isSymbolicLink(); } catch { configExists = false; }
    if (!configExists) {
      const body = [
        'mode=guided',
        'branch=feature/{type}-{issue}-{slug}',
        'commit=conventional',
        'auto_commit=on',
        'coverage_new=90',
        'coverage_modified=80',
        'review_depth=full',
        'quality_depth=full',
        'verify_merged=off',
        'delegate_threshold=60',
        'heal_max_cycles=3',
        'verbosity=normal',
      ].join('\n') + '\n';
      if (!dryRun) { mkdirSync(dirname(configPath), { recursive: true }); writeFileSync(configPath, body); }
      result.written.push(configPath);
      result.notes.push(`default config written: ${configPath} (edit it to customise)`);
    }
  }
  return result;
}

export function removeInstalled(manifest: { files: string[] }, { dryRun = false }: { dryRun?: boolean } = {}): string[] {
  const removed: string[] = [];
  for (const f of manifest.files) {
    if (existsSync(f)) { if (!dryRun) rmSync(f); removed.push(f); }
  }
  if (!dryRun) {
    for (const f of manifest.files) {
      let d = dirname(f);
      while (existsSync(d) && readdirSync(d).length === 0) {
        if (d.endsWith('/.mugiwara') || d === dirname(d)) break;
        rmSync(d, { recursive: true, force: true });
        d = dirname(d);
      }
    }
  }
  return removed;
}

function assertNotSymlink(file: string): void {
  if (!existsSync(file)) return;
  try {
    if (lstatSync(file).isSymbolicLink()) throw new Error(`refusing to follow symlink: ${file}`);
  } catch (e) {
    if ((e as { code?: string }).code === 'ENOENT') return;
    throw e;
  }
}

const GITIGNORE_BLOCK_START = '# >>> mugiwara >>>';
const GITIGNORE_BLOCK_END = '# <<< mugiwara <<<';
// legacy markers — pre-0.7 blocks ignored per-type dirs (.mugiwara/state/,
// .mugiwara/continue/) instead of the mission-first layout. Kept for
// detection so an old install is upgraded, not double-appended.
const GITIGNORE_LEGACY = ['.mugiwara/state/', '# mugiwara'];
const GITIGNORE_BLOCK = `# >>> mugiwara >>> — audit trail is the product: commit plan.md, flows/, review.md,
# decisions.md, blockers.md, report.md under .mugiwara/missions/. Ignore session state.
.mugiwara/missions/**/*.json
.mugiwara/index.md
.mugiwara/config
.mugiwara/refs/
# <<< mugiwara <<<
`;

export function ensureProjectGitignore(projectDir: string, opts: { dryRun?: boolean } = {}): { appended: boolean; notes: string[] } {
  const { dryRun = false } = opts;
  const path = join(projectDir, '.gitignore');
  assertNotSymlink(path);
  let existing = existsSync(path) ? readFileSync(path, 'utf8') : '';
  if (existing) {
    // Delimited block present with the current entries → nothing to do.
    if (existing.includes(GITIGNORE_BLOCK_START) && existing.includes('.mugiwara/missions/**/*.json')) {
      return { appended: false, notes: [] };
    }
    // Legacy (pre-0.7) or outdated delimited block → upgrade in place:
    // strip the old mugiwara entries, then append the new block.
    // Without this, upgraded projects keep committing per-wave state/continue
    // JSON to git — session state must stay ignored (Robin MAJOR, Jinbe Low).
    const hadOld = GITIGNORE_LEGACY.some((m) => existing.includes(m)) || existing.includes(GITIGNORE_BLOCK_START);
    if (hadOld) {
      const clean = removeProjectGitignore(projectDir, { dryRun });
      existing = clean.removed ? (existsSync(path) ? readFileSync(path, 'utf8') : '') : existing;
    }
  }
  const separator = existing.length && !existing.endsWith('\n') ? '\n' : '';
  if (!dryRun) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, existing + separator + GITIGNORE_BLOCK);
  }
  return { appended: true, notes: [`.gitignore ${dryRun ? 'would upgrade+append' : 'upgraded'} mugiwara audit-trail block`] };
}

// remove the delimited mugiwara block, preserving user lines. Handles both
// the current delimited block and the legacy undelimited block (v0.6.2).
export function removeProjectGitignore(projectDir: string, { dryRun = false }: { dryRun?: boolean } = {}): { removed: boolean; notes: string[] } {
  const path = join(projectDir, '.gitignore');
  assertNotSymlink(path);
  if (!existsSync(path)) return { removed: false, notes: [] };
  const current = readFileSync(path, 'utf8');

  const delimited = current.includes(GITIGNORE_BLOCK_START);
  let cleaned: string;
  if (delimited) {
    // strip everything between (and including) the delimiters. Both
    // delimiters must be present — a missing END (hand-edit) with end=-1
    // would slice() from char 18 and truncate the user's file.
    const start = current.indexOf(GITIGNORE_BLOCK_START);
    const end = current.indexOf(GITIGNORE_BLOCK_END);
    if (end < start) return { removed: false, notes: ['delimiter mismatch — .gitignore left untouched'] };
    cleaned = current.slice(0, start) + current.slice(end + GITIGNORE_BLOCK_END.length);
  } else if (current.includes('# mugiwara')) {
    // legacy (pre-0.7): strip the exact undelimited block — the header, the
    // explanatory comment, and the known lines. Prefix-matching would
    // delete user-owned lines that merely start with a mugiwara path.
    const LEGACY_LINES = new Set([
      '.mugiwara/state.json',
      '.mugiwara/state-*.json',
      '.mugiwara/config',
      '.mugiwara/state/',
      '.mugiwara/continue/',
      '.mugiwara/continue.md',
      '.mugiwara/refs/',
    ]);
    const lines = current.split('\n').filter(l => {
      const t = l.trim();
      if (t.startsWith('# mugiwara')) return false; // header + comment
      return !LEGACY_LINES.has(t);
    });
    cleaned = lines.join('\n');
  } else {
    return { removed: false, notes: [] };
  }

  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').replace(/\n+$/, '\n');
  if (cleaned.trim() === '') cleaned = '';
  if (cleaned === current) return { removed: false, notes: [] };
  if (!dryRun) writeFileSync(path, cleaned);
  return { removed: true, notes: [`.gitignore ${dryRun ? 'would strip' : 'stripped'} mugiwara block`] };
}
