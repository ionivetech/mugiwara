#!/usr/bin/env bun
// hooks/auto-savepoint.ts — Stop hook: refresh the active mission's savepoint.
//
// State used to depend on the model remembering the prose instruction "run
// scripts/savepoint.sh". It forgot, so state.json and continue.json stayed
// missing and everything reading them (resume, heal_cycle cap, lane-rise
// detection, the SessionStart auto-resume) was dead. This makes the write
// happen whether or not the crew remembers.
//
// Refreshes the CURRENT flow stage — it never advances one. Flow transitions
// stay an explicit crew action; this only keeps tasks/lane/blockers honest.
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
// Shared with `mugiwara run` — a second copy here drifted (it lacked the PATH
// probe), so the hook found no bash where the CLI did. One definition, bundled in.
import { findBash } from '../src/run.ts';
import { sumTranscriptUsage } from '../src/transcript-usage.ts';
import { activeMission } from '../src/active-mission.ts';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

/**
 * Stop-hook payload (Claude Code hooks docs: common fields session_id,
 * transcript_path, cwd, hook_event_name). Empty object when stdin is absent or
 * not JSON.
 */
async function readPayload(): Promise<Record<string, unknown>> {
  if (process.stdin.isTTY) return {};
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  try { return JSON.parse(input) as Record<string, unknown>; } catch { return {}; }
}

/**
 * Write the session's provider-reported usage (numbers only) where savepoint.sh
 * reads it. Returns the env to pass on, or {} when there is nothing to report
 * or the operator already chose a tokens file.
 */
function providerTokensEnv(payload: Record<string, unknown>): Record<string, string> {
  try {
    if (process.env.MUGIWARA_TOKENS_FILE) return {};
    const tp = payload.transcript_path;
    if (typeof tp !== 'string' || !tp) return {};
    const usage = sumTranscriptUsage(tp);
    if (!usage) return {};
    const dir = join(cwd, '.mugiwara');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'tokens.json');
    writeFileSync(`${file}.tmp`, JSON.stringify(usage) + '\n');
    renameSync(`${file}.tmp`, file);
    return { MUGIWARA_TOKENS_FILE: file };
  } catch {
    return {}; // fail open: the estimate stays
  }
}

try {
  const payload = await readPayload();
  const active = activeMission(cwd);
  const script = join(root, 'scripts', 'savepoint.sh');
  const bash = findBash();
  if (active && bash && existsSync(script)) {
    spawnSync(bash, [script, active.mission, active.member, active.wave, active.mode], {
      cwd,
      stdio: 'ignore',
      // Hook budget is 20 s (hooks.json); tests on a loaded machine raise it.
      timeout: Number(process.env.MUGIWARA_SAVEPOINT_TIMEOUT_MS) || 15_000,
      env: { ...process.env, ...providerTokensEnv(payload) },
    });
  }
} catch {
  // a Stop hook must never fail the turn
}
