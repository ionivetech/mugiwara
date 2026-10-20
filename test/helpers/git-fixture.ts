// Shared git fixture: build one template repo per (identity, branch) per
// process, then copy its .git into each test dir. Replaces `git init` + two
// `git config` + `git commit` (4 process spawns) per test with one cpSync.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const templates = new Map<string, string>();

function git(cwd: string, ...args: string[]) {
  execFileSync('git', args, { cwd, stdio: 'pipe' });
}

/** Turn an empty `dir` into a repo with one "base" commit (empty, or holding `files`), optionally on `branch`. */
export function initBaseRepo(
  dir: string,
  opts: { email?: string; name?: string; branch?: string; files?: Record<string, string> } = {},
): void {
  const { email = 'test@test.com', name = 'Test', branch, files } = opts;
  const key = JSON.stringify([email, name, branch ?? '', files ?? {}]);
  let tpl = templates.get(key);
  if (!tpl) {
    tpl = mkdtempSync(join(tmpdir(), 'mugi-gitfx-'));
    git(tpl, 'init', '-q');
    git(tpl, 'config', 'user.email', email);
    git(tpl, 'config', 'user.name', name);
    for (const [path, body] of Object.entries(files ?? {})) {
      mkdirSync(join(tpl, path, '..'), { recursive: true });
      writeFileSync(join(tpl, path), body);
    }
    git(tpl, 'add', '-A');
    git(tpl, 'commit', '-q', '--allow-empty', '-m', 'base');
    if (branch) git(tpl, 'checkout', '-q', '-b', branch);
    templates.set(key, tpl);
    const made = tpl;
    process.on('exit', () => rmSync(made, { recursive: true, force: true }));
  }
  cpSync(join(tpl, '.git'), join(dir, '.git'), { recursive: true });
  for (const [path, body] of Object.entries(files ?? {})) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), body);
  }
}
