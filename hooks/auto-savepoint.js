#!/usr/bin/env node
// @bun

// hooks/auto-savepoint.ts
import { existsSync, readFileSync, readdirSync } from "fs";
import { spawnSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
var root = join(dirname(fileURLToPath(import.meta.url)), "..");
var cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
var SAFE = /^[A-Za-z0-9._-]+$/;
function bootstrapMission() {
  for (const dir of ["plans", "spec", "logs"]) {
    const d = join(cwd, ".mugiwara", dir);
    if (!existsSync(d))
      continue;
    const files = readdirSync(d).filter((f) => f.endsWith(".md") && f !== "lessons.md").sort().reverse();
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
  const file = join(cwd, ".mugiwara", "config");
  if (!existsSync(file))
    return "guided";
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const [k, v] = line.split("=").map((s) => s.trim());
    if (k === "mode" && ["guided", "semi", "auto"].includes(v))
      return v;
  }
  return "guided";
}
function activeMission() {
  const base = join(cwd, ".mugiwara", "state");
  if (!existsSync(base))
    return bootstrapMission();
  let best = null;
  for (const e of readdirSync(base, { withFileTypes: true })) {
    if (!e.isDirectory() || !SAFE.test(e.name) || /^\.+$/.test(e.name))
      continue;
    for (const f of readdirSync(join(base, e.name))) {
      if (!f.endsWith(".json"))
        continue;
      const stem = f.slice(0, -5);
      const member = stem === "state" ? "" : stem;
      if (member && (!SAFE.test(member) || /^\.+$/.test(member)))
        continue;
      try {
        const s = JSON.parse(readFileSync(join(base, e.name, f), "utf8"));
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
function findBash() {
  const explicit = process.env.MUGIWARA_BASH?.trim();
  if (explicit)
    return existsSync(explicit) ? explicit : null;
  if (process.platform !== "win32")
    return "/bin/bash";
  for (const p of [
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
    join(process.env.LOCALAPPDATA ?? "", "Programs", "Git", "bin", "bash.exe")
  ]) {
    if (p && existsSync(p))
      return p;
  }
  return null;
}
try {
  const active = activeMission();
  const script = join(root, "scripts", "savepoint.sh");
  const bash = findBash();
  if (active && bash && existsSync(script)) {
    spawnSync(bash, [script, active.mission, active.member, active.wave, active.mode], {
      cwd,
      stdio: "ignore",
      timeout: 15000
    });
  }
} catch {}
