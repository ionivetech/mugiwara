// src/installer.ts
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
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
  paths(opts: { scope: Scope; projectDir: string; home: string }): { skillsDir: string; agentsDir: string };
  transformSkill(data: FrontmatterData, body: string): TransformOut;
  transformAgent(data: FrontmatterData, body: string): TransformOut;
  refsDir?(opts: { scope: Scope; projectDir: string; home: string }, skillName: string): string;
  transformSkillFull?(data: FrontmatterData, body: string): TransformOut | null;
  transformAgentFull?(data: FrontmatterData, body: string): TransformOut | null;
  postInstall?(opts: { scope: Scope; projectDir: string; home: string; dryRun: boolean; files: string[] }): { written: string[]; notes: string[] };
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
      return { name: f.replace(/\.md$/, ''), data, body, refs: [] as { relPath: string; text: string }[] };
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
    if (out) writeOne(join(dirs.skillsDir, out.relPath), out.text);
    if (target.transformSkillFull) {
      const full = target.transformSkillFull(s.data, s.body);
      if (full && target.refsDir) writeOne(join(target.refsDir({ scope, projectDir, home }, s.name), full.relPath), full.text);
    }
    if (s.refs.length && target.refsDir) {
      const refsRoot = target.refsDir({ scope, projectDir, home }, s.name);
      for (const r of s.refs) writeOne(join(refsRoot, r.relPath), r.text);
    }
  }
  for (const a of agents) {
    const out = target.transformAgent(a.data, a.body);
    if (out) writeOne(join(dirs.agentsDir, out.relPath), out.text);
    if (target.transformAgentFull) {
      const full = target.transformAgentFull(a.data, a.body);
      if (full && target.refsDir) writeOne(join(target.refsDir({ scope, projectDir, home }, a.name), full.relPath), full.text);
    }
  }

  if (sharedRefs.length) {
    const sharedRoot = target.tier && target.tier >= 2
      ? join(target.refsDir!({ scope, projectDir, home }, skills[0]?.name ?? ''), '_shared')
      : join(dirs.skillsDir, '_shared', 'references');
    for (const r of sharedRefs) writeOne(join(sharedRoot, r.relPath), r.text);
  }

  if (target.postInstall) {
    const post = target.postInstall({ scope, projectDir, home, dryRun, files: result.written });
    result.written.push(...post.written);
    result.notes.push(...post.notes);
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
