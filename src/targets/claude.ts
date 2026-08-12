// src/targets/claude.ts
import { existsSync, readFileSync, mkdirSync, copyFileSync, chmodSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringifyFrontmatter, type FrontmatterData } from '../frontmatter.ts';
import type { Target } from '../installer.ts';

const here = dirname(fileURLToPath(import.meta.url));
const HOOK_SRC = join(here, '..', '..', 'hooks', 'session-start.ts');
const COMMANDS_SRC = join(here, '..', '..', '.claude', 'commands');

export const target: Target = {
  id: 'claude',
  label: 'Claude Code',
  native: true,
  refPointerPrefix: '../',
  paths({ scope, projectDir, home }) {
    const root = scope === 'global' ? join(home, '.claude') : join(projectDir, '.claude');
    return { skillsDir: join(root, 'skills'), agentsDir: join(root, 'agents') };
  },
  transformSkill(data: FrontmatterData, body: string) {
    return {
      relPath: join(data.name, 'SKILL.md'),
      text: stringifyFrontmatter({ name: data.name, description: data.description }, body),
    };
  },
  transformAgent(data: FrontmatterData, body: string) {
    const fm: FrontmatterData = { name: data.name, description: data.description };
    if (data.tools) fm.tools = data.tools;
    return { relPath: `${data.name}.md`, text: stringifyFrontmatter(fm, body) };
  },
  refsDir({ scope, projectDir, home }, skillName: string) {
    const root = scope === 'global' ? join(home, '.claude') : join(projectDir, '.claude');
    return join(root, 'skills', skillName, 'references');
  },
  postInstall({ scope, projectDir, home, dryRun }) {
    // Wire the SessionStart hook (inline doctrine) into the installed .claude dir.
    const root = scope === 'global' ? join(home, '.claude') : join(projectDir, '.claude');
    const hookFile = join(root, 'hooks', 'session-start.ts');
    const written: string[] = [];
    const notes: string[] = [];
    if (dryRun) return { written: [], notes: [] };
    if (existsSync(HOOK_SRC) && !existsSync(hookFile)) {
      mkdirSync(dirname(hookFile), { recursive: true });
      copyFileSync(HOOK_SRC, hookFile);
      chmodSync(hookFile, 0o755);
      written.push(hookFile);
    }
    // Port the /mugiwara commands into the installed .claude dir.
    if (existsSync(COMMANDS_SRC)) {
      const dstDir = join(root, 'commands');
      mkdirSync(dstDir, { recursive: true });
      for (const f of readdirSync(COMMANDS_SRC)) {
        if (!f.endsWith('.md')) continue;
        const src = join(COMMANDS_SRC, f);
        const dst = join(dstDir, f);
        if (!existsSync(dst)) { copyFileSync(src, dst); written.push(dst); }
        else notes.push(`existing command kept: ${dst}`);
      }
    }
    return { written, notes };
  },
};
