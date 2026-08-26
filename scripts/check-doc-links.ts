#!/usr/bin/env bun
// scripts/check-doc-links.ts — every relative .md link in README, ROADMAP,
// docs/, and examples/ must resolve to a file. Born from a shipped defect:
// glossary linked provenance.md from reference/ and four broken links passed
// every other gate, because verify-install covers content/ pointers only.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = join(import.meta.dirname, "..");
function walk(d: string, out: string[] = []): string[] {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.md$/.test(e.name)) out.push(p);
  }
  return out;
}
const files: string[] = [];
for (const r of ["docs", "examples"]) files.push(...walk(join(root, r)));
for (const r of ["README.md", "ROADMAP.md"]) files.push(resolve(root, r));

let bad = 0;
for (const f of files) {
  const body = readFileSync(f, "utf8");
  for (const m of body.matchAll(/\]\(([^)\s]+)\)/g)) {
    const t = m[1];
    if (/^(https?:|mailto:|#|\/\/)/.test(t)) continue;
    const clean = t.split("#")[0];
    if (!clean.endsWith(".md")) continue;
    if (!existsSync(resolve(f, "..", clean))) {
      bad++;
      console.log(`✗ ${f.replace(root + "/", "")} → ${t}`);
    }
  }
}
if (bad) {
  console.log(`check-doc-links: ${bad} broken link(s)`);
  process.exit(1);
}
console.log("check-doc-links: all relative .md links resolve");
