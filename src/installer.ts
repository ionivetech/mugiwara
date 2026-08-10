// src/installer.ts
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { parseFrontmatter, type FrontmatterData } from './frontmatter.ts';
import type { Scope } from './manifest.ts';

export type ContentItem = { name: string; data: FrontmatterData; body: string };

export type InstallOptions = {
  scope: Scope;
  projectDir: string;
  type: string;
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
  paths(opts: { scope: Scope; projectDir: string; home: string }): { skillsDir: string; agentsDir: string };
  transformSkill(data: FrontmatterData, body: string): TransformOut;
  transformAgent(data: FrontmatterData, body: string): TransformOut;
  postInstall?(opts: { scope: Scope; projectDir: string; home: string; dryRun: boolean; files: string[] }): { written: string[]; notes: string[] };
}

export const CONTENT_DIR = join(import.meta.dirname, '..', 'content');
const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8')) as { version: string };
export const VERSION = pkg.version;

export function collectContent({ includeFrontend }: { includeFrontend: boolean }): { skills: ContentItem[]; agents: ContentItem[] } {
  const skillNames = readdirSync(join(CONTENT_DIR, 'skills'), { withFileTypes: true })
    .filter(e => e.isDirectory()).map(e => e.name)
    .filter(name => includeFrontend || name !== 'mugiwara-frontend');
  const skills = skillNames.map(name => {
    const { data, body } = parseFrontmatter(readFileSync(join(CONTENT_DIR, 'skills', name, 'SKILL.md'), 'utf8'));
    return { name, data, body };
  });
  const agents = readdirSync(join(CONTENT_DIR, 'agents'))
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const { data, body } = parseFrontmatter(readFileSync(join(CONTENT_DIR, 'agents', f), 'utf8'));
      return { name: f.replace(/\.md$/, ''), data, body };
    });
  return { skills, agents };
}

export function installTo(target: Target, opts: InstallOptions): InstallResult {
  const { scope, projectDir, type, dryRun = false, force = false } = opts;
  const home = opts.home ?? homedir();
  const { skills, agents } = collectContent({ includeFrontend: type === 'frontend' || type === 'fullstack' });
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
      const backupFile = join(backupRoot, 'backup', ts, absPath.replace(/[^a-zA-Z0-9]+/g, '_'));
      if (!dryRun) { mkdirSync(dirname(backupFile), { recursive: true }); copyFileSync(absPath, backupFile); }
      result.backedUp.push(absPath);
    }
    if (!dryRun) { mkdirSync(dirname(absPath), { recursive: true }); writeFileSync(absPath, text); }
    result.written.push(absPath);
  };

  for (const s of skills) {
    const out = target.transformSkill(s.data, s.body);
    if (out) writeOne(join(dirs.skillsDir, out.relPath), out.text);
  }
  for (const a of agents) {
    const out = target.transformAgent(a.data, a.body);
    if (out) writeOne(join(dirs.agentsDir, out.relPath), out.text);
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
        rmSync(d, { recursive: true });
        const parent = dirname(d);
        if (parent === d) break;
        d = parent;
      }
    }
  }
  return removed;
}
