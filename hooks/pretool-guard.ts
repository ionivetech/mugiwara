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
import { checkCommand, refusalMessage } from '../src/guards.ts';

const cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

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
    const action = checkCommand(command);
    if (action) {
      const reason = refusalMessage(action);
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
