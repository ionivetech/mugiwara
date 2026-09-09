// src/home.ts
// One home-directory resolution for every consumer. Bun's node:os
// homedir() ignores runtime assignments to process.env.HOME (verified:
// `process.env.HOME='/tmp/x'; homedir()` still prints the startup home),
// which breaks per-test HOME isolation. On POSIX os.homedir() is itself
// $HOME-based, so preferring a non-empty $HOME is identity on Node and a
// fix on Bun. Windows excluded: git-bash sets $HOME to a bash-style path
// (/c/Users/...) that node:fs cannot join, so homedir() stays authoritative.
import { homedir } from 'node:os';

export function homeDir(): string {
  if (process.platform !== 'win32') {
    const h = process.env.HOME?.trim();
    if (h) return h;
  }
  return homedir();
}
