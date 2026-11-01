#!/usr/bin/env node
// @bun

// hooks/mugiwara-mode-tracker.ts
import { existsSync as existsSync2, mkdirSync as mkdirSync2, readFileSync as readFileSync2, writeFileSync as writeFileSync2, renameSync } from "fs";

// src/config.ts
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
var DEFAULT_CONFIG = [
  "mode=guided",
  "verbosity=normal",
  "branch=feature/{type}-{issue}-{slug}",
  "commit=conventional",
  "auto_commit=off",
  "coverage=85",
  "review_depth=full",
  "quality_depth=full",
  "delegate_threshold=60",
  "heal_max_cycles=3",
  "independent_review=on",
  "# lane_scope_glob=packages/api/**",
  "# context_budget_chars=150000",
  "# team=off",
  "# sign=auto",
  "# features=core+auto",
  "# enforce=warn"
].join(`
`) + `
`;
function ensureConfig(projectDir) {
  const file = join(projectDir, ".mugiwara", "config");
  let exists = false;
  try {
    exists = lstatSync(file).isFile() || lstatSync(file).isSymbolicLink();
  } catch {
    exists = false;
  }
  if (exists)
    return false;
  mkdirSync(join(projectDir, ".mugiwara"), { recursive: true });
  writeFileSync(file, DEFAULT_CONFIG);
  return true;
}

// src/risk.ts
var RISK_WORDS = new RegExp("\\b(" + [
  "auth\\w*",
  "log[- ]?in",
  "sign[- ]?in",
  "password\\w*",
  "credential\\w*",
  "secrets?",
  "tokens?",
  "rbac",
  "roles?",
  "permissions?",
  "tenant\\w*",
  "multi-tenant",
  "payments?",
  "billing",
  "refund\\w*",
  "invoices?",
  "migrat\\w+",
  "schema",
  "ci/cd",
  "github actions",
  "izin",
  "hak akses",
  "otorisasi",
  "autentikasi",
  "masuk akun",
  "pembayaran",
  "penagihan",
  "pengembalian dana",
  "kata sandi",
  "sandi",
  "rahasia",
  "kunci api",
  "penyewa",
  "migrasi",
  "skema"
].join("|") + ")\\b", "i");
var RISK_PATH_PARTS = new Set(["auth", "payment", "payments", "billing", "migration", "migrations", "rbac", "permission", "permissions", "secret", "secrets"]);
function riskPath(text) {
  for (const tok of text.split(/[\s"'`()<>,;]+/)) {
    if (!tok.includes("/"))
      continue;
    for (const part of tok.toLowerCase().split(/[/\\_.\-]+/))
      if (RISK_PATH_PARTS.has(part))
        return tok;
  }
  return null;
}
function riskTerm(text) {
  if (typeof text !== "string")
    return null;
  const m = RISK_WORDS.exec(text);
  if (m)
    return m[1].toLowerCase();
  return riskPath(text)?.toLowerCase() ?? null;
}
function riskReminder(text) {
  const term = riskTerm(text.replace(/^\s*\/(?:mugiwara:)?mugiwara\b/i, ""));
  return term ? `Mugiwara: this request mentions "${term}", a risk area. Take the full process, not the direct path: load the mugiwara-orchestration skill and record the mission before you edit code. ` + "Before closing, dispatch Robin (robin-reviewer) and Jinbe (jinbe-security) as separate agents; a review written by the conversation that made the change does not count." : null;
}

// hooks/mugiwara-mode-tracker.ts
import { tmpdir } from "os";
import { join as join2 } from "path";
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
var NOT_A_REQUEST = new Set([
  "guided",
  "semi",
  "auto",
  "mode",
  "off",
  "archive",
  "clean",
  "continue",
  "status",
  "cost",
  "handoff",
  "sign",
  "lesson",
  "migrate",
  "crew",
  "features",
  "reset",
  "waste",
  "plan",
  "join",
  "list",
  "install",
  "update",
  "uninstall"
]);
function isExplicitCrewRequest(promptRaw) {
  if (typeof promptRaw !== "string")
    return false;
  const m = /^\/(?:mugiwara:)?mugiwara(?:[ \t]+(\S+)[\s\S]*)?$/i.exec(promptRaw.trim());
  return !!m && !!m[1] && !NOT_A_REQUEST.has(m[1].toLowerCase());
}
function recordExplicitCrew(sessionId) {
  try {
    const cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
    const dir = join2(cwd, ".mugiwara");
    const file = join2(dir, ".engaged");
    mkdirSync2(dir, { recursive: true });
    ensureConfig(cwd);
    let prev = {};
    try {
      prev = JSON.parse(readFileSync2(file, "utf8"));
    } catch {}
    const same = !sessionId || typeof prev.session_id !== "string" || !prev.session_id || prev.session_id === sessionId;
    const base = same ? prev : {};
    const now = new Date().toISOString();
    writeFileSync2(file, JSON.stringify({
      ...base,
      session_id: sessionId || (typeof base.session_id === "string" ? base.session_id : ""),
      first_seen: typeof base.first_seen === "string" ? base.first_seen : now,
      touched_at: now,
      explicit_crew_at: now
    }, null, 2) + `
`);
  } catch {}
}
function applyModeChange(mode) {
  if (!VALID_MODES.has(mode))
    return;
  const cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const dir = join2(cwd, ".mugiwara");
  const file = join2(dir, "config");
  mkdirSync2(dir, { recursive: true });
  const lines = [];
  if (existsSync2(file)) {
    for (const line of readFileSync2(file, "utf8").split(/\r?\n/)) {
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
  const tmp = join2(tmpdir(), `mugiwara-config-${process.pid}-${Date.now()}.tmp`);
  writeFileSync2(tmp, body);
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
  else if (isExplicitCrewRequest(prompt))
    recordExplicitCrew(typeof parsed.session_id === "string" ? parsed.session_id : "");
  const reminder = !change && isExplicitCrewRequest(prompt) ? riskReminder(prompt) : null;
  if (reminder) {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: reminder } }));
    return;
  }
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
