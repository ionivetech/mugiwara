#!/usr/bin/env node
// @bun

// hooks/pretool-guard.ts
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// src/guards.ts
var FORBIDDEN = [
  [/\bgh\s+pr\s+(create|merge|ready)\b/, "opening or merging a PR"],
  [/\bgh\s+release\s+create\b/, "creating a release"],
  [/\bgit\s+merge\b/, "merging a branch"],
  [/\bgit\s+push\b[^|;&]*\b(main|master|production|release)\b/, "pushing to a protected branch"],
  [/\bgit\s+push\b[^|;&]*--force/, "force-pushing"],
  [/\bnpm\s+publish\b|\byarn\s+publish\b|\bpnpm\s+publish\b/, "publishing a package"],
  [/\bkubectl\s+(apply|delete|rollout)\b/, "changing a cluster"],
  [/\bterraform\s+(apply|destroy)\b/, "changing infrastructure"],
  [/\bdocker\s+push\b/, "pushing an image"],
  [/\baws\s+\w+\s+(create|delete|update|put)\b/, "changing cloud resources"]
];
function checkCommand(command) {
  for (const [re, action] of FORBIDDEN) {
    if (re.test(command))
      return action;
  }
  return null;
}
function refusalMessage(action) {
  return `Mugiwara: refusing to ${action}. The crew never creates a PR, merges, or ` + `deploys — the human does, from the branch and the verdict the crew hands over. ` + `Run it yourself, or set enforce=off in .mugiwara/config.`;
}

// hooks/pretool-guard.ts
var cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
function readEnforce() {
  for (const base of [cwd, homedir()]) {
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
async function main() {
  let input = "";
  for await (const chunk of process.stdin)
    input += chunk;
  let payload = {};
  try {
    payload = JSON.parse(input);
  } catch {}
  try {
    const enforce = readEnforce();
    if (enforce === "off")
      return;
    const toolInput = payload.tool_input ?? {};
    const command = typeof toolInput.command === "string" ? toolInput.command : "";
    if (!command)
      return;
    const action = checkCommand(command);
    if (action) {
      const reason = refusalMessage(action);
      if (enforce === "warn") {
        process.stderr.write(`\u26A0 ${reason}
`);
        return;
      }
      process.stdout.write(JSON.stringify({ decision: "block", reason }));
      return;
    }
  } catch {}
}
main().catch(() => {});
