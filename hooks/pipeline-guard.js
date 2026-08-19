#!/usr/bin/env node
// @bun

// hooks/pipeline-guard.ts
import { existsSync, readFileSync, readdirSync } from "fs";
import { execFileSync } from "child_process";
import { join } from "path";
var cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
var MARKER_TTL_MS = 12 * 60 * 60 * 1000;
function readEnforce() {
  for (const base of [cwd, process.env.HOME ?? ""]) {
    if (!base)
      continue;
    const file = join(base, ".mugiwara", "config");
    if (!existsSync(file))
      continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const [k, v] = line.split("=").map((s) => s.trim());
      if (k !== "enforce")
        continue;
      if (v === "off" || v === "warn" || v === "block")
        return v;
      process.stderr.write(`mugiwara: unknown enforce="${v}" in ${file}, using "block"
`);
      return "block";
    }
  }
  return "block";
}
function engaged(sessionId) {
  const file = join(cwd, ".mugiwara", "state", ".engaged");
  if (!existsSync(file))
    return false;
  try {
    const m = JSON.parse(readFileSync(file, "utf8"));
    if (sessionId && m.session_id)
      return m.session_id === sessionId;
    const touched = Date.parse(m.touched_at ?? "") || 0;
    return Date.now() - touched < MARKER_TTL_MS;
  } catch {
    return false;
  }
}
function sourceChanged() {
  try {
    const out = execFileSync("git", ["status", "--porcelain"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return out.split(/\r?\n/).map((l) => l.slice(3).trim()).filter(Boolean).some((p) => !p.startsWith(".mugiwara/"));
  } catch {
    return false;
  }
}
function triageOnDisk() {
  const base = join(cwd, ".mugiwara", "state");
  if (!existsSync(base))
    return false;
  try {
    for (const e of readdirSync(base, { withFileTypes: true })) {
      if (!e.isDirectory())
        continue;
      for (const f of readdirSync(join(base, e.name))) {
        if (!f.endsWith(".json"))
          continue;
        try {
          const s = JSON.parse(readFileSync(join(base, e.name, f), "utf8"));
          if (typeof s.mission === "string" && s.mission)
            return true;
        } catch {}
      }
    }
  } catch {}
  return false;
}
async function main() {
  let input = "";
  for await (const chunk of process.stdin)
    input += chunk;
  let payload = {};
  try {
    payload = JSON.parse(input);
  } catch {}
  if (payload.stop_hook_active === true)
    return;
  const enforce = readEnforce();
  if (enforce === "off")
    return;
  const sessionId = typeof payload.session_id === "string" ? payload.session_id : "";
  if (!engaged(sessionId))
    return;
  if (!sourceChanged())
    return;
  if (triageOnDisk())
    return;
  const reason = "Mugiwara: source changed in this session but no Wave 0 triage is on disk. " + "Run Wave 0 (classify, size the lane, write the decision log) and record it with " + '`mugiwara savepoint <mission> "" 0 <mode>` \u2014 or, if this is Lane 0 trivial work, ' + "record a Lane 0 savepoint to say so. Set enforce=off in .mugiwara/config to disable this check.";
  if (enforce === "warn") {
    process.stderr.write(`\u26A0 ${reason}
`);
    return;
  }
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
}
main().catch(() => {});
