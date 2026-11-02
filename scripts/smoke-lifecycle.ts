#!/usr/bin/env bun
// scripts/smoke-lifecycle.ts — install -> verify -> upgrade -> uninstall, per target.
//
// Runs the repo's own src/cli.ts in a throwaway git repo with a throwaway HOME,
// so nothing touches the real home or git config. Portable: no bash needed.
// Usage: bun scripts/smoke-lifecycle.ts [claude opencode codex cursor]
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = join(import.meta.dirname, '..', 'src', 'cli.ts');
// Directory each target must have populated after install.
export const MARKERS: Record<string, string> = {
  claude: '.claude/skills',
  opencode: '.opencode/skills',
  codex: '.agents/skills',
  cursor: '.cursor/skills',
};

function mugi(cwd: string, home: string, args: string[]): { code: number; out: string } {
  const r = spawnSync(process.execPath, [cli, ...args, '--yes'], {
    cwd, encoding: 'utf8', timeout: 60_000,
    env: { ...process.env, HOME: home, USERPROFILE: home },
  });
  return { code: r.status ?? 1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

const manifestFiles = (dir: string): string[] =>
  (JSON.parse(readFileSync(join(dir, '.mugiwara', 'manifest.json'), 'utf8')).files as string[]).slice().sort();

function smokeTarget(id: string): string[] {
  const errs: string[] = [];
  const dir = mkdtempSync(join(tmpdir(), `mugi-smoke-${id}-`));
  const home = mkdtempSync(join(tmpdir(), `mugi-smoke-home-${id}-`));
  const check = (ok: boolean, msg: string) => { if (!ok) errs.push(`${id}: ${msg}`); };
  try {
    spawnSync('git', ['init', '-q'], { cwd: dir });
    const install = mugi(dir, home, ['install', '--target', id]);
    check(install.code === 0, `install exited ${install.code}: ${install.out.slice(-200)}`);
    if (errs.length) return errs;

    // verify: manifest non-empty, every recorded file present, marker dir populated
    const files = manifestFiles(dir);
    check(files.length > 0, 'manifest lists no files');
    check(files.every(f => existsSync(f)), 'a manifest file is missing on disk');
    check(existsSync(join(dir, MARKERS[id])), `${MARKERS[id]} missing`);

    // user data that must survive upgrade and uninstall
    const cfgPath = join(dir, '.mugiwara', 'config');
    writeFileSync(cfgPath, `${readFileSync(cfgPath, 'utf8')}\nmode=auto\n`);
    const userFile = join(dir, 'user-notes.txt');
    writeFileSync(userFile, 'mine');

    // upgrade: same command again, same file set, user config kept
    const again = mugi(dir, home, ['install', '--target', id]);
    check(again.code === 0, `second install exited ${again.code}`);
    check(JSON.stringify(manifestFiles(dir)) === JSON.stringify(files), 'file set changed on re-install');
    check(readFileSync(cfgPath, 'utf8').includes('mode=auto'), 'user edit to .mugiwara/config lost on upgrade');

    // uninstall: our files gone, user files untouched
    const un = mugi(dir, home, ['uninstall']);
    check(un.code === 0, `uninstall exited ${un.code}`);
    check(files.every(f => !existsSync(f)), 'a manifest file survived uninstall');
    check(!existsSync(join(dir, '.mugiwara', 'manifest.json')), 'manifest survived uninstall');
    check(existsSync(userFile) && readFileSync(userFile, 'utf8') === 'mine', 'user file touched by uninstall');
    check(existsSync(cfgPath) && readFileSync(cfgPath, 'utf8').includes('mode=auto'), 'user config removed by uninstall');
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
  return errs;
}

export function main(argv: string[]): number {
  const ids = argv.length ? argv : Object.keys(MARKERS);
  const unknown = ids.filter(i => !MARKERS[i]);
  if (unknown.length) { console.error(`unknown target: ${unknown.join(', ')}`); return 2; }
  let bad = 0;
  for (const id of ids) {
    const errs = smokeTarget(id);
    if (errs.length) { bad++; for (const e of errs) console.error(`FAIL ${e}`); }
    else console.log(`ok ${id}: install, upgrade, uninstall`);
  }
  return bad ? 1 : 0;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exit(main(process.argv.slice(2)));
}
