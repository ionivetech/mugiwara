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

// main
async function main() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  if (!input.trim()) { process.stdout.write(JSON.stringify({ prompt: '' })); return; }

  let parsed: { prompt?: string };
  try { parsed = JSON.parse(input); } catch { parsed = { prompt: input }; }
  const prompt = parsed.prompt ?? '';

  const change = parseModeChange(prompt);
  if (change) applyModeChange(change);

  // pass-through — always return the prompt unchanged
  process.stdout.write(JSON.stringify({ prompt }));
}

main().catch(() => {
  // silent — hook must never block the conversation
  process.stdout.write(JSON.stringify({ prompt: '' }));
});
