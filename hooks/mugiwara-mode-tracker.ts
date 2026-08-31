#!/usr/bin/env bun
// hooks/mugiwara-mode-tracker.ts — UserPromptSubmit hook: intercepts
// /mugiwara <mode> commands in Claude Code chat and writes .mugiwara/config.
// Same logic as the OpenCode plugin's chat.message hook, standalone for
// Claude Code's hook process model.
//
// Input:  JSON on stdin with { prompt: "..." }
// Output: JSON on stdout with { prompt: "..." } (pass-through)

const VALID_MODES = new Set(['guided', 'semi', 'auto']);

function parseModeChange(promptRaw: string): string | null {
  if (typeof promptRaw !== 'string') return null;
  let prompt = promptRaw.trim();
  const wrapped = /^(["'`])([\s\S]*)\1$/.exec(prompt);
  if (wrapped) prompt = wrapped[2].trim();
  prompt = prompt.toLowerCase();
  if (!prompt) return null;

  const tplSet = /^(?:set |)mugiwara mode:[ \t]*(\S*)/.exec(prompt);
  if (tplSet && VALID_MODES.has(tplSet[1])) return tplSet[1];

  const slashMode = /^\/(?:mugiwara[-\s]?)?mode[ \t]+(\S*)/.exec(prompt);
  if (slashMode && VALID_MODES.has(slashMode[1])) return slashMode[1];

  const slashMain = /^\/mugiwara[ \t]+(\S*)/.exec(prompt);
  if (slashMain && VALID_MODES.has(slashMain[1])) return slashMain[1];

  const natural = /^mugiwara mode[ \t]+(\S*)/.exec(prompt);
  if (natural && VALID_MODES.has(natural[1])) return natural[1];

  return null;
}

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

function applyModeChange(mode: string) {
  if (!VALID_MODES.has(mode)) return;
  const cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const dir = join(cwd, '.mugiwara');
  const file = join(dir, 'config');
  mkdirSync(dir, { recursive: true });
  const lines: string[] = [];
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (t.startsWith('mode=')) continue;
      lines.push(line);
    }
  }
  lines.push(`mode=${mode}`);
  const body = lines.filter((_l, i) => !(lines[i] === '' && (i === lines.length - 1 || i === 0))).join('\n') + '\n';
  const tmp = join(tmpdir(), `mugiwara-config-${process.pid}-${Date.now()}.tmp`);
  writeFileSync(tmp, body);
  renameSync(tmp, file);
}

// Codex vs Claude: Codex UserPromptSubmit expects {} or {hookSpecificOutput:{hookEventName,additionalContext}}
// Claude expects {prompt:""} — Codex rejects "prompt" (additionalProperties:false).
// Detect Codex via env or input shape (turn_id/cwd/model are Codex-only).
function isCodexInput(parsed: Record<string, unknown>): boolean {
  if (process.env.CODEX_HOME || process.env.CODEX_THREAD_ID) return true;
  if (typeof parsed.turn_id === 'string') return true;
  if (typeof parsed.cwd === 'string' && typeof parsed.model === 'string') return true;
  return false;
}

// main
async function main() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  if (!input.trim()) {
    // empty stdin — Codex expects {}, Claude expects {prompt:""}
    // Emit Codex-safe empty ( {} ) — Claude also accepts {} as no-op (prompt passthrough)
    // but to keep Claude behavior, sniff env: if Codex-like env, emit {}, else prompt
    const codexEmpty = !!(process.env.CODEX_HOME || process.env.CODEX_THREAD_ID);
    process.stdout.write(JSON.stringify(codexEmpty ? {} : { prompt: '' }));
    return;
  }

  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(input) as Record<string, unknown>; } catch { parsed = { prompt: input }; }
  const prompt = typeof parsed.prompt === 'string' ? parsed.prompt : '';

  const change = parseModeChange(prompt);
  if (change) applyModeChange(change);

  const codex = isCodexInput(parsed);
  if (codex) {
    // Codex schema: additionalProperties:false — "prompt" is invalid. Use hookSpecificOutput or {}.
    if (change) {
      process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: `Mugiwara mode changed to ${change}` } }));
    } else {
      process.stdout.write(JSON.stringify({}));
    }
  } else {
    // Claude: pass-through prompt
    process.stdout.write(JSON.stringify({ prompt }));
  }
}

main().catch(() => {
  // silent — hook must never block the conversation
  // Codex-safe fallback: {} (valid for both, but Claude prefers prompt — however {} is also accepted as no-op)
  const codexFallback = !!(process.env.CODEX_HOME || process.env.CODEX_THREAD_ID);
  process.stdout.write(JSON.stringify(codexFallback ? {} : { prompt: '' }));
});
