#!/usr/bin/env node
// @bun

// hooks/engagement-marker.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
var cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
async function main() {
  let input = "";
  for await (const chunk of process.stdin)
    input += chunk;
  let payload = {};
  try {
    payload = JSON.parse(input);
  } catch {}
  const blob = JSON.stringify(payload).toLowerCase();
  if (!blob.includes("mugiwara"))
    return;
  const dir = join(cwd, ".mugiwara", "state");
  const file = join(dir, ".engaged");
  const sessionId = typeof payload.session_id === "string" ? payload.session_id : "";
  try {
    mkdirSync(dir, { recursive: true });
    let firstSeen = new Date().toISOString();
    if (existsSync(file)) {
      try {
        const prev = JSON.parse(readFileSync(file, "utf8"));
        if (typeof prev.first_seen === "string")
          firstSeen = prev.first_seen;
      } catch {}
    }
    writeFileSync(file, JSON.stringify({ session_id: sessionId, first_seen: firstSeen, touched_at: new Date().toISOString() }, null, 2) + `
`);
  } catch {}
}
main().catch(() => {});
