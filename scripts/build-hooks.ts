#!/usr/bin/env bun
// scripts/build-hooks.ts — bundle hooks/*.ts into node-runnable hooks/*.js.
//
// The hook sources carry a `#!/usr/bin/env bun` shebang, but mugiwara installs
// via npx and only requires node (package.json engines, scripts/install.sh).
// A user without bun got `env: bun: No such file or directory` on every
// SessionStart — silently, because a failing hook does not surface. The .js
// build is what hooks.json and the installer actually wire up.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const HOOK_ENTRIES = ['session-start', 'mugiwara-mode-tracker', 'auto-savepoint', 'engagement-marker', 'pipeline-guard', 'pretool-guard'];

// --check verifies the committed .js files are present and current, without
// rewriting them. hooks.json points at the .js builds, so a missing or stale
// build means a plugin install wires three hooks to nonexistent files — the
// failure is silent, which is why it is a gate and not a convention.
const check = process.argv.includes('--check');

let failed = false;
for (const name of HOOK_ENTRIES) {
  const src = join(root, 'hooks', `${name}.ts`);
  const out = join(root, 'hooks', `${name}.js`);

  if (check && !existsSync(out)) {
    console.error(`missing build: hooks/${name}.js — run \`bun run build-hooks\` and commit it`);
    failed = true;
    continue;
  }

  const tmp = check ? `${out}.check` : out;
  const r = spawnSync('bun', ['build', src, '--outfile', tmp, '--target', 'node', '--format', 'esm'], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  if (r.status !== 0) { failed = true; continue; }
  // bun copies the source shebang verbatim — swap it for node, which is the
  // only runtime the install path guarantees.
  const built = `#!/usr/bin/env node\n${readFileSync(tmp, 'utf8').replace(/^#![^\n]*\n/, '')}`;

  if (check) {
    rmSync(tmp, { force: true });
    if (readFileSync(out, 'utf8') !== built) {
      console.error(`stale build: hooks/${name}.js does not match ${name}.ts — run \`bun run build-hooks\` and commit it`);
      failed = true;
    }
    continue;
  }

  writeFileSync(out, built);
  console.log(`built hooks/${name}.js`);
}
if (failed) process.exit(1);
if (check) console.log(`✓ ${HOOK_ENTRIES.length} hook builds current`);
