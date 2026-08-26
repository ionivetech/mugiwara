// src/targets/claude.ts
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, chmodSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringifyFrontmatter, type FrontmatterData } from '../frontmatter.ts';
import type { Target } from '../installer.ts';

const here = dirname(fileURLToPath(import.meta.url));
const HOOKS_SRC = join(here, '..', '..', 'hooks');
const COMMANDS_SRC = join(here, '..', '..', '.claude', 'commands');

// Claude Code has no path-scoped permission. write-scope maps to a partial
// `tools:` list — applied to internal subagent-only agents only: artifacts
// agents lose Edit (cannot modify existing source) but keep Write (must create
// .mugiwara/**). User-facing crew run inline in the main thread and keep the
// default toolset (incl. Edit); discipline is enforced by rules, not tools.
function toolsFromScope(scope?: string): string | undefined {
  if (scope === 'artifacts') return 'Read, Grep, Glob, Write, Bash, WebFetch, WebSearch';
  return undefined;
}

/**
 * Register the copied hooks in settings.json.
 *
 * Copying hook files into .claude/hooks/ is not enough — Claude Code only runs
 * a hook that settings.json names. Without this the CLI install left three
 * dead files on disk while the plugin install (which reads hooks/hooks.json
 * itself) worked, so the two install paths silently disagreed.
 *
 * Idempotent: an entry whose command already points at our hook is left alone,
 * and unrelated user hooks are never touched.
 */
const SCRIPTS_SRC = join(here, '..', '..', 'scripts');

/** Copy the harness shell scripts (and their shared lib) next to the hooks. */
function copyScripts(dstDir: string): string[] {
  if (!existsSync(SCRIPTS_SRC)) return [];
  const written: string[] = [];
  const copyDir = (src: string, dst: string): void => {
    if (!existsSync(src)) return;
    for (const f of readdirSync(src)) {
      // install.sh is the npx bootstrap, not a harness script — never shipped
      // into a project.
      if (!f.endsWith('.sh') || f === 'install.sh') continue;
      const to = join(dst, f);
      mkdirSync(dst, { recursive: true });
      copyFileSync(join(src, f), to);
      chmodSync(to, 0o755);
      written.push(to);
    }
  };
  copyDir(SCRIPTS_SRC, dstDir);
  copyDir(join(SCRIPTS_SRC, 'lib'), join(dstDir, 'lib'));
  return written;
}

type HookEntry = { type: string; command: string; timeout?: number };
type HookGroup = { matcher?: string; hooks: HookEntry[] };

function wireSettings(root: string, hooksDir: string): { written: string[]; notes: string[] } {
  const file = join(root, 'settings.json');
  const events: Record<string, { file: string; timeout: number; matcher?: string }> = {
    SessionStart: { file: 'session-start.js', timeout: 10 },
    UserPromptSubmit: { file: 'mugiwara-mode-tracker.js', timeout: 5 },
    Stop: { file: 'auto-savepoint.js', timeout: 20 },
    SubagentStop: { file: 'pipeline-guard.js', timeout: 15 },
    // matcher scopes the marker to crew invocations — without it the hook would
    // fire on every tool call in the session for no benefit
    PostToolUse: { file: 'engagement-marker.js', timeout: 5, matcher: 'Task|Skill' },
  };

  let settings: Record<string, unknown> = {};
  if (existsSync(file)) {
    try {
      settings = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    } catch {
      // a hand-broken settings.json is the user's to fix — never overwrite it
      return { written: [], notes: [`${file} is not valid JSON — add the mugiwara hooks manually`] };
    }
  }
  const hooks = (settings.hooks ?? {}) as Record<string, HookGroup[]>;
  let changed = false;
  for (const [event, spec] of Object.entries(events)) {
    const command = join(hooksDir, spec.file);
    if (!existsSync(command)) continue;
    const groups = Array.isArray(hooks[event]) ? hooks[event] : [];
    const already = groups.some((g) => g.hooks?.some((h) => h.command?.includes(spec.file)));
    if (already) continue;
    const group: HookGroup = { hooks: [{ type: 'command', command: JSON.stringify(command), timeout: spec.timeout }] };
    if (spec.matcher) group.matcher = spec.matcher;
    groups.push(group);
    hooks[event] = groups;
    changed = true;
  }
  if (!changed) return { written: [], notes: [] };
  settings.hooks = hooks;
  writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
  // NOT reported as `written`: the manifest is an uninstall delete-list, and
  // settings.json belongs to the user — we only merged into it. It is un-merged
  // by unwireSettings instead.
  return { written: [], notes: [`hooks registered in ${file}`] };
}

/**
 * Remove only the hook entries mugiwara added, leaving every other setting and
 * any user-authored hook untouched. Identified by their command pointing into
 * our hooks dir.
 */
function unwireSettings(root: string): { changed: string[]; notes: string[] } {
  const file = join(root, 'settings.json');
  if (!existsSync(file)) return { changed: [], notes: [] };
  let settings: Record<string, unknown>;
  try {
    settings = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  } catch {
    return { changed: [], notes: [`${file} is not valid JSON — left untouched`] };
  }
  const hooks = settings.hooks as Record<string, HookGroup[]> | undefined;
  if (!hooks) return { changed: [], notes: [] };

  const ours = new Set(['session-start.js', 'mugiwara-mode-tracker.js', 'auto-savepoint.js', 'pipeline-guard.js', 'engagement-marker.js']);
  const isOurs = (h: HookEntry): boolean =>
    [...ours].some((f) => h.command?.includes(join('hooks', f)) || h.command?.includes(`hooks/${f}`));

  let changed = false;
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) continue;
    const kept = groups
      .map((g) => ({ ...g, hooks: (g.hooks ?? []).filter((h) => !isOurs(h)) }))
      .filter((g) => g.hooks.length > 0);
    if (kept.length !== groups.length || kept.some((g, i) => g.hooks.length !== groups[i]?.hooks?.length)) {
      changed = true;
    }
    if (kept.length) hooks[event] = kept;
    else { delete hooks[event]; changed = true; }
  }
  if (!changed) return { changed: [], notes: [] };
  if (!Object.keys(hooks).length) delete settings.hooks;
  // an emptied settings.json still belongs to the user — rewrite, never remove
  writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
  return { changed: [file], notes: [] };
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
    else if (data['internal-agent'] === 'true') {
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
        // .js is what settings.json runs (node-only, no bun needed); .ts ships
        // beside it as the readable source. hooks.json is for plugin installs.
        if (!/\.(ts|js|json)$/.test(f)) continue;
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
      // The Stop hook shells out to savepoint.sh, resolved beside its own
      // directory. A plugin install already has <plugin>/scripts/; a CLI
      // install needs the shell scripts copied next to the hooks or the hook
      // finds nothing and mission state stays empty — the exact bug this
      // whole path exists to fix.
      written.push(...copyScripts(join(root, 'scripts')));
      const wired = wireSettings(root, join(root, 'hooks'));
      written.push(...wired.written);
      notes.push(...wired.notes);
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
  postUninstall({ scope, projectDir, home, dryRun }) {
    if (dryRun) return { changed: [], notes: [] };
    const root = scope === 'global' ? join(home, '.claude') : join(projectDir, '.claude');
    return unwireSettings(root);
  },
};
