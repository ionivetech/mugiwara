// src/targets/claude.ts
import { existsSync, readFileSync, mkdirSync, copyFileSync, chmodSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringifyFrontmatter, type FrontmatterData } from '../frontmatter.ts';
import type { Target } from '../installer.ts';

const here = dirname(fileURLToPath(import.meta.url));
const HOOKS_SRC = join(here, '..', '..', 'hooks');
const COMMANDS_SRC = join(here, '..', '..', '.claude', 'commands');

// Claude Code has no path-scoped permission. write-scope maps to a partial
// `tools:` list: artifacts agents lose Edit (cannot modify existing source)
// but keep Write (must create .mugiwara/**); source agents get the default set.
function toolsFromScope(scope?: string): string | undefined {
  if (scope === 'artifacts') return 'Read, Grep, Glob, Write, Bash, WebFetch, WebSearch';
  return undefined;
}

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
    else {
      const generated = toolsFromScope(data['write-scope']);
      if (generated) fm.tools = generated;
    }
    return { relPath: `${data.name}.md`, text: stringifyFrontmatter(fm, body) };
  },
  refsDir({ scope, projectDir, home }, skillName: string) {
    const root = scope === 'global' ? join(home, '.claude') : join(projectDir, '.claude');
    return join(root, 'skills', skillName, 'references');
  },
  postInstall({ scope, projectDir, home, dryRun }) {
    // Wire hook scripts (SessionStart + UserPromptSubmit) into the installed .claude dir.
    const root = scope === 'global' ? join(home, '.claude') : join(projectDir, '.claude');
    const written: string[] = [];
    const notes: string[] = [];
    if (dryRun) return { written: [], notes: [] };
    if (existsSync(HOOKS_SRC)) {
      for (const f of readdirSync(HOOKS_SRC)) {
        if (!f.endsWith('.ts')) continue;
        const dst = join(root, 'hooks', f);
        if (!existsSync(dst)) {
          mkdirSync(dirname(dst), { recursive: true });
          copyFileSync(join(HOOKS_SRC, f), dst);
          // /bin/sh executes hooks via shebang — a non-executable copy is a
          // "Permission denied" at first user prompt. chmod every hook file.
          chmodSync(dst, 0o755);
          written.push(dst);
        }
      }
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
