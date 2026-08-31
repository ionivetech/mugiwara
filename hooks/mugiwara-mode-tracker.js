#!/usr/bin/env node
// @bun

// hooks/mugiwara-mode-tracker.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
var VALID_MODES = new Set(["guided", "semi", "auto"]);
function parseModeChange(promptRaw) {
  if (typeof promptRaw !== "string")
    return null;
  let prompt = promptRaw.trim();
  const wrapped = /^(["'`])([\s\S]*)\1$/.exec(prompt);
  if (wrapped)
    prompt = wrapped[2].trim();
  prompt = prompt.toLowerCase();
  if (!prompt)
    return null;
  const tplSet = /^(?:set |)mugiwara mode:[ \t]*(\S*)/.exec(prompt);
  if (tplSet && VALID_MODES.has(tplSet[1]))
    return tplSet[1];
  const slashMode = /^\/(?:mugiwara[-\s]?)?mode[ \t]+(\S*)/.exec(prompt);
  if (slashMode && VALID_MODES.has(slashMode[1]))
    return slashMode[1];
  const slashMain = /^\/mugiwara[ \t]+(\S*)/.exec(prompt);
  if (slashMain && VALID_MODES.has(slashMain[1]))
    return slashMain[1];
  const natural = /^mugiwara mode[ \t]+(\S*)/.exec(prompt);
  if (natural && VALID_MODES.has(natural[1]))
    return natural[1];
  return null;
}
function applyModeChange(mode) {
  if (!VALID_MODES.has(mode))
    return;
  const cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const dir = join(cwd, ".mugiwara");
  const file = join(dir, "config");
  mkdirSync(dir, { recursive: true });
  const lines = [];
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (t.startsWith("mode="))
        continue;
      lines.push(line);
    }
  }
  lines.push(`mode=${mode}`);
  const body = lines.filter((_l, i) => !(lines[i] === "" && (i === lines.length - 1 || i === 0))).join(`
`) + `
`;
  const tmp = join(tmpdir(), `mugiwara-config-${process.pid}-${Date.now()}.tmp`);
  writeFileSync(tmp, body);
  renameSync(tmp, file);
}
function isCodexInput(parsed) {
  if (process.env.CODEX_HOME || process.env.CODEX_THREAD_ID)
    return true;
  if (typeof parsed.turn_id === "string")
    return true;
  if (typeof parsed.cwd === "string" && typeof parsed.model === "string")
    return true;
  return false;
}
async function main() {
  let input = "";
  for await (const chunk of process.stdin)
    input += chunk;
  if (!input.trim()) {
    const codexEmpty = !!(process.env.CODEX_HOME || process.env.CODEX_THREAD_ID);
    process.stdout.write(JSON.stringify(codexEmpty ? {} : { prompt: "" }));
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(input);
  } catch {
    parsed = { prompt: input };
  }
  const prompt = typeof parsed.prompt === "string" ? parsed.prompt : "";
  const change = parseModeChange(prompt);
  if (change)
    applyModeChange(change);
  const codex = isCodexInput(parsed);
  if (codex) {
    if (change) {
      process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: `Mugiwara mode changed to ${change}` } }));
    } else {
      process.stdout.write(JSON.stringify({}));
    }
  } else {
    process.stdout.write(JSON.stringify({ prompt }));
  }
}
main().catch(() => {
  const codexFallback = !!(process.env.CODEX_HOME || process.env.CODEX_THREAD_ID);
  process.stdout.write(JSON.stringify(codexFallback ? {} : { prompt: "" }));
});
