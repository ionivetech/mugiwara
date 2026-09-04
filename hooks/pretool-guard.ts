#!/usr/bin/env bun
// hooks/pretool-guard.ts — PreToolUse on Bash: refuse irreversible commands.
//
// Luffy's rule 13 says the crew never creates a PR, merges, or deploys. That
// rule had zero mechanisms behind it; every other invariant in the repo has at
// least one. Prose enforcement measured 0-for-21 in this codebase. (E4)
//
// Fails OPEN on any internal error, like pipeline-guard: a fence that wedges a
// session gets disabled, and then it fences nothing.
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

const FORBIDDEN: Array<[RegExp, string]> = [
  [/\bgh\s+pr\s+(create|merge|ready)\b/, 'opening or merging a PR'],
  [/\bgh\s+release\s+create\b/, 'creating a release'],
  [/\bgit\s+merge\b/, 'merging a branch'],
  // Protected branches and force pushes only. A plain
  // `git push -u origin <feature-branch>` — the crew's own terminal step —
  // must stay allowed, so `main|master|...` is matched as a whole word.
  [/\bgit\s+push\b[^|;&]*\b(main|master|production|release)\b/, 'pushing to a protected branch'],
  [/\bgit\s+push\b[^|;&]*--force/, 'force-pushing'],
  [/\bnpm\s+publish\b|\byarn\s+publish\b|\bpnpm\s+publish\b/, 'publishing a package'],
  [/\bkubectl\s+(apply|delete|rollout)\b/, 'changing a cluster'],
  [/\bterraform\s+(apply|destroy)\b/, 'changing infrastructure'],
  [/\bdocker\s+push\b/, 'pushing an image'],
  [/\baws\s+\w+\s+(create|delete|update|put)\b/, 'changing cloud resources'],
];

type Enforce = 'off' | 'warn' | 'block';

function readEnforce(): Enforce {
  // Same key as pipeline-guard (off | warn | block, default block).
  for (const base of [cwd, homedir()]) {
    if (!base) continue;
    const file = join(base, '.mugiwara', 'config');
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const [k, v] = line.split('=').map((s) => s.trim());
      if (k !== 'enforce') continue;
      if (v === 'off' || v === 'warn' || v === 'block') return v;
      process.stderr.write(`mugiwara: unknown enforce="${v}" in ${file}, using "block"\n`);
      return 'block';
    }
  }
  return 'block';
}

async function main(): Promise<void> {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(input) as Record<string, unknown>; } catch { /* no payload — allow */ }
  try {
    const enforce = readEnforce();
    if (enforce === 'off') return;
    const toolInput = (payload.tool_input ?? {}) as Record<string, unknown>;
    const command = typeof toolInput.command === 'string' ? toolInput.command : '';
    if (!command) return;
    for (const [re, action] of FORBIDDEN) {
      if (!re.test(command)) continue;
      const reason =
        `Mugiwara: refusing to ${action}. The crew never creates a PR, merges, or ` +
        `deploys — the human does, from the branch and the verdict the crew hands over. ` +
        `Run it yourself, or set enforce=off in .mugiwara/config.`;
      if (enforce === 'warn') {
        process.stderr.write(`⚠ ${reason}\n`);
        return;
      }
      process.stdout.write(JSON.stringify({ decision: 'block', reason }));
      return;
    }
  } catch { /* fail open — never wedge a session */ }
}

main().catch(() => { /* a hook must never fail the turn */ });
