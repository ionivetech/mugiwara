#!/usr/bin/env node
// @bun

// hooks/auto-savepoint.ts
import { existsSync as existsSync2, readFileSync, readdirSync as readdirSync2 } from "fs";
import { spawnSync as spawnSync2 } from "child_process";

// src/run.ts
import { existsSync, readdirSync } from "node:fs";
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

// hooks/auto-savepoint.ts
import { dirname as dirname2, join as join2 } from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
var root = join2(dirname2(fileURLToPath2(import.meta.url)), "..");
var cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
var SAFE = /^[A-Za-z0-9._-]+$/;
function bootstrapMission() {
  for (const dir of ["plans", "spec", "logs"]) {
    const d = join2(cwd, ".mugiwara", dir);
    if (!existsSync2(d))
      continue;
    const files = readdirSync2(d).filter((f) => f.endsWith(".md") && f !== "lessons.md").sort().reverse();
    for (const f of files) {
      const name = f.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "");
      if (name && SAFE.test(name) && !/^\.+$/.test(name)) {
        return { mission: name, member: "", wave: "0", mode: readMode(), updated: 0 };
      }
    }
  }
  return null;
}
function readMode() {
  const file = join2(cwd, ".mugiwara", "config");
  if (!existsSync2(file))
    return "guided";
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const [k, v] = line.split("=").map((s) => s.trim());
    if (k === "mode" && ["guided", "semi", "auto"].includes(v))
      return v;
  }
  return "guided";
}
function activeMission() {
  const base = join2(cwd, ".mugiwara", "state");
  if (!existsSync2(base))
    return bootstrapMission();
  let best = null;
  for (const e of readdirSync2(base, { withFileTypes: true })) {
    if (!e.isDirectory() || !SAFE.test(e.name) || /^\.+$/.test(e.name))
      continue;
    for (const f of readdirSync2(join2(base, e.name))) {
      if (!f.endsWith(".json"))
        continue;
      const stem = f.slice(0, -5);
      const member = stem === "state" ? "" : stem;
      if (member && (!SAFE.test(member) || /^\.+$/.test(member)))
        continue;
      try {
        const s = JSON.parse(readFileSync(join2(base, e.name, f), "utf8"));
        const updated = Date.parse(s.updated_at ?? "") || 0;
        if (best && updated <= best.updated)
          continue;
        const wave = String(s.wave ?? "").replace(/\D/g, "") || "1";
        const mode = ["guided", "semi", "auto"].includes(s.mode) ? s.mode : "guided";
        best = { mission: e.name, member, wave, mode, updated };
      } catch {}
    }
  }
  return best ?? bootstrapMission();
}
try {
  const active = activeMission();
  const script = join2(root, "scripts", "savepoint.sh");
  const bash = findBash();
  if (active && bash && existsSync2(script)) {
    spawnSync2(bash, [script, active.mission, active.member, active.wave, active.mode], {
      cwd,
      stdio: "ignore",
      timeout: 15000
    });
  }
} catch {}
