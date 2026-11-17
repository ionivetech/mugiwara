// src/gitignore.ts — the mugiwara .gitignore block markers and the pure strip used by
// uninstall and by `record` (to tell an install edit from a mission edit). Kept out of
// installer.ts so the hook bundles that import record.ts stay small.
export const GITIGNORE_BLOCK_START = '# >>> mugiwara >>>';
export const GITIGNORE_BLOCK_END = '# <<< mugiwara <<<';

/** .gitignore text without mugiwara's block (current or legacy), normalized. Null on mismatched delimiters. */
export function stripGitignoreBlock(current: string): string | null {
  let cleaned = current;
  if (current.includes(GITIGNORE_BLOCK_START)) {
    // strip everything between (and including) the delimiters. Both
    // delimiters must be present — a missing END (hand-edit) with end=-1
    // would slice() from char 18 and truncate the user's file.
    const start = current.indexOf(GITIGNORE_BLOCK_START);
    const end = current.indexOf(GITIGNORE_BLOCK_END);
    if (end < start) return null;
    cleaned = current.slice(0, start) + current.slice(end + GITIGNORE_BLOCK_END.length);
  } else if (current.includes('# mugiwara')) {
    // legacy (pre-0.7): strip the exact undelimited block — the header, the
    // explanatory comment, and the known lines. Prefix-matching would
    // delete user-owned lines that merely start with a mugiwara path.
    const LEGACY_LINES = new Set([
      '.mugiwara/state.json',
      '.mugiwara/state-*.json',
      '.mugiwara/config',
      '.mugiwara/state/',
      '.mugiwara/continue/',
      '.mugiwara/continue.md',
      '.mugiwara/refs/',
    ]);
    const lines = current.split('\n').filter(l => {
      const t = l.trim();
      if (t.startsWith('# mugiwara')) return false; // header + comment
      return !LEGACY_LINES.has(t);
    });
    cleaned = lines.join('\n');
  }
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').replace(/\n+$/, '\n');
  return cleaned.trim() === '' ? '' : cleaned;
}
