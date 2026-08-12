#!/usr/bin/env bun
// scripts/verify-install.ts — G1: verify all references/*.md pointers resolve after install.
// Installs to temp dir for one target per tier, then checks every pointer.

import { existsSync, mkdtempSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { installTo } from '../src/installer.ts';
import { targets } from '../src/targets/index.ts';

const tierTargets = [
  { id: 'claude', tier: 1 },
  { id: 'codex', tier: 2 },
  { id: 'kilo', tier: 3 },
];

let total = 0;
let broken = 0;

for (const tt of tierTargets) {
  const target = targets[tt.id];
  if (!target) { console.log(`⚠  target ${tt.id} not found, skipping`); continue; }
  const dir = mkdtempSync(join(tmpdir(), `mugi-verify-${tt.id}-`));
  try {
    installTo(target, { scope: 'project', projectDir: dir, dryRun: false, force: true });

    const skillsDir = target.paths({ scope: 'project', projectDir: dir, home: '' }).skillsDir;
    const mugiwaraRefsDir = join(dir, '.mugiwara', 'refs');

    function findSkillFiles(root: string): string[] {
      const out: string[] = [];
      if (!existsSync(root)) return out;
      for (const ent of readdirSync(root, { withFileTypes: true })) {
        const p = join(root, ent.name);
        if (ent.isDirectory()) out.push(...findSkillFiles(p));
        else if (ent.name.endsWith('.md')) out.push(p);
      }
      return out;
    }

    const skillFiles = findSkillFiles(skillsDir)
      .filter(f => !f.replace(skillsDir, '').includes('/references/'));

    for (const file of skillFiles) {
      const body = readFileSync(file, 'utf8');
      const refs = [...body.matchAll(/`([^`]*references\/[^`]+\.md)`/g)];

      for (const m of refs) {
        total++;
        const pointer = m[1];
        const localResolve = join(dirname(file), pointer);
        const sharedResolve = join(skillsDir, pointer);
        const mugiwaraResolve = join(mugiwaraRefsDir, pointer.replace(/^(?:_shared\/)?references\//, ''));
        const resolved = [localResolve, sharedResolve, mugiwaraResolve].find(p => existsSync(p));

        if (!resolved) {
          broken++;
          const relFile = file.replace(dir + '/', '');
          console.log(`✗ ${relFile}: \`${pointer}\` → not found`);
        }
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (broken > 0) {
  console.log(`\n✗ ${broken}/${total} pointers cannot resolve after install`);
  process.exit(1);
}

console.log(`✓ ${total} pointers checked across ${tierTargets.length} targets — all resolve`);
