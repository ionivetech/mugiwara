#!/usr/bin/env node
// @bun

// hooks/auto-savepoint.ts
import { existsSync as existsSync3, mkdirSync, renameSync, writeFileSync } from "fs";
import { spawnSync as spawnSync2 } from "child_process";

// src/run.ts
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
var here = dirname(fileURLToPath(import.meta.url));
var SCRIPTS_DIR = join(here, "..", "scripts");
function findBash() {
  const explicit = process.env.MUGIWARA_BASH?.trim();
  if (explicit)
    return existsSync(explicit) ? explicit : null;
  const candidates = process.platform === "win32" ? [
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
    join(process.env.LOCALAPPDATA ?? "", "Programs", "Git", "bin", "bash.exe")
  ] : ["/bin/bash", "/usr/bin/bash", "/usr/local/bin/bash", "/opt/homebrew/bin/bash"];
  for (const p of candidates) {
    if (p && existsSync(p))
      return p;
  }
  const probe = spawnSync(process.platform === "win32" ? "where" : "which", ["bash"], {
    encoding: "utf8"
  });
  const first = probe.stdout?.split(/\r?\n/).find((l) => l.trim());
  return first?.trim() || null;
}

// src/transcript-usage.ts
import { readFileSync, statSync } from "node:fs";
var MAX_BYTES = 256 * 1024 * 1024;
var n = (v) => typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
function sumTranscriptUsage(path) {
  try {
    if (statSync(path).size > MAX_BYTES)
      return null;
    const byId = new Map;
    let anon = 0;
    for (const line of readFileSync(path, "utf8").split(`
`)) {
      if (!line.includes('"usage"'))
        continue;
      let o;
      try {
        o = JSON.parse(line);
      } catch {
        continue;
      }
      const u = o.message?.usage;
      if (o.type !== "assistant" || !u || typeof u !== "object")
        continue;
      byId.set(o.message?.id ?? o.uuid ?? `anon-${anon++}`, {
        input_tokens: n(u.input_tokens),
        output_tokens: n(u.output_tokens),
        cache_read_input_tokens: n(u.cache_read_input_tokens),
        cache_creation_input_tokens: n(u.cache_creation_input_tokens)
      });
    }
    if (!byId.size)
      return null;
    const total = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
    for (const u of byId.values())
      for (const k of Object.keys(total))
        total[k] += u[k];
    return total;
  } catch {
    return null;
  }
}

// src/active-mission.ts
import { existsSync as existsSync2, readFileSync as readFileSync2, readdirSync } from "node:fs";
import { join as join2 } from "node:path";
var SAFE = /^[A-Za-z0-9._-]+$/;
function bootstrapMission(cwd) {
  const base = join2(cwd, ".mugiwara", "missions");
  if (!existsSync2(base))
    return null;
  for (const e of readdirSync(base, { withFileTypes: true })) {
    if (!e.isDirectory() || !SAFE.test(e.name) || /^\.+$/.test(e.name))
      continue;
    const files = readdirSync(join2(base, e.name));
    const hasState = files.some((f) => {
      if (!f.endsWith(".json"))
        return false;
      const stem = f.slice(0, -5);
      return stem !== "continue" && !stem.startsWith("continue-");
    });
    const closed = files.includes("report.md") || files.includes("pr-verdict.md");
    const hasArtifacts = ["plan.md", "spec.md", "decisions.md"].some((f) => files.includes(f));
    if (!hasState && hasArtifacts && !closed) {
      const wave = files.includes("plan.md") ? "2" : files.includes("spec.md") ? "1" : "0";
      return { mission: e.name, member: "", wave, mode: readMode(cwd), updated: 0 };
    }
  }
  return null;
}
function readMode(cwd) {
  const file = join2(cwd, ".mugiwara", "config");
  if (!existsSync2(file))
    return "guided";
  for (const line of readFileSync2(file, "utf8").split(/\r?\n/)) {
    const [k, v] = line.split("=").map((s) => s.trim());
    if (k === "mode" && ["guided", "semi", "auto"].includes(v))
      return v;
  }
  return "guided";
}
function activeMission(cwd) {
  const base = join2(cwd, ".mugiwara", "missions");
  if (!existsSync2(base))
    return bootstrapMission(cwd);
  let best = null;
  for (const e of readdirSync(base, { withFileTypes: true })) {
    if (!e.isDirectory() || !SAFE.test(e.name) || /^\.+$/.test(e.name))
      continue;
    for (const f of readdirSync(join2(base, e.name))) {
      if (!f.endsWith(".json"))
        continue;
      const stem = f.slice(0, -5);
      if (stem === "continue" || stem.startsWith("continue-"))
        continue;
      const member = stem === "state" ? "" : stem;
      if (member && (!SAFE.test(member) || /^\.+$/.test(member)))
        continue;
      try {
        const s = JSON.parse(readFileSync2(join2(base, e.name, f), "utf8"));
        const updated = Date.parse(s.updated_at ?? "") || 0;
        if (best && updated <= best.updated)
          continue;
        const wave = String(s.flow ?? s.wave ?? "").replace(/\D/g, "") || "1";
        const mode = ["guided", "semi", "auto"].includes(s.mode) ? s.mode : "guided";
        best = { mission: e.name, member, wave, mode, updated };
      } catch {}
    }
  }
  return best ?? bootstrapMission(cwd);
}

// hooks/auto-savepoint.ts
import { dirname as dirname2, join as join3 } from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
var root = join3(dirname2(fileURLToPath2(import.meta.url)), "..");
var cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
async function readPayload() {
  if (process.stdin.isTTY)
    return {};
  let input = "";
  for await (const chunk of process.stdin)
    input += chunk;
  try {
    return JSON.parse(input);
  } catch {
    return {};
  }
}
function providerTokensEnv(payload) {
  try {
    if (process.env.MUGIWARA_TOKENS_FILE)
      return {};
    const tp = payload.transcript_path;
    if (typeof tp !== "string" || !tp)
      return {};
    const usage = sumTranscriptUsage(tp);
    if (!usage)
      return {};
    const dir = join3(cwd, ".mugiwara");
    mkdirSync(dir, { recursive: true });
    const file = join3(dir, "tokens.json");
    writeFileSync(`${file}.tmp`, JSON.stringify(usage) + `
`);
    renameSync(`${file}.tmp`, file);
    return { MUGIWARA_TOKENS_FILE: file };
  } catch {
    return {};
  }
}
try {
  const payload = await readPayload();
  const active = activeMission(cwd);
  const script = join3(root, "scripts", "savepoint.sh");
  const bash = findBash();
  if (active && bash && existsSync3(script)) {
    spawnSync2(bash, [script, active.mission, active.member, active.wave, active.mode], {
      cwd,
      stdio: "ignore",
      timeout: Number(process.env.MUGIWARA_SAVEPOINT_TIMEOUT_MS) || 15000,
      env: { ...process.env, ...providerTokensEnv(payload) }
    });
  }
} catch {}
