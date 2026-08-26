#!/usr/bin/env bun
// scripts/policy-force.ts — policy-as-code helper for the bash lane logic.
// Reads changed file paths on stdin, prints the mugiwara.policy.yml
// `lanes.force_full` globs they match (comma-separated). Empty output = no
// policy hit. Exits 0 even when nothing matches; a missing bun skips the
// call site entirely (policy is optional by design).
import { readFileSync } from 'node:fs';
import { loadPolicy, matchedGlobs } from '../src/policy.ts';

const input = readFileSync(0, 'utf8');
const paths = input.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
if (!paths.length) process.exit(0);
let policy;
try {
  policy = loadPolicy(process.cwd());
} catch (e) {
  // Fail closed: an unreadable rule must not look like "no rule".
  console.error(`policy-force: ${(e as Error).message}`);
  process.exit(2);
}
const hits = policy?.lanes?.force_full?.length ? matchedGlobs(paths, policy.lanes.force_full) : [];
if (hits.length) process.stdout.write(hits.join(','));
