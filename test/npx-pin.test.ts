import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const version = (JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string }).version;

// Stamped by `bun run sync-version`: the npx fallback must name the installed
// version, never @latest (supply chain). A failure here means run sync-version.
const FILES = [
  '.claude/commands/mugiwara.md',
  '.claude/commands/mugiwara-continue.md',
  '.opencode/commands/mugiwara.md',
  '.opencode/commands/mugiwara-continue.md',
  'content/skills/mugiwara-orchestration/references/cli-ladder.md',
  'content/skills/mugiwara-orchestration/references/state-router.md',
];

for (const f of FILES) {
  test(`npx fallback is pinned to package version: ${f}`, () => {
    const text = readFileSync(join(ROOT, f), 'utf8');
    expect(text).not.toContain('npx -y @ionivetech/mugiwara@latest');
    expect(text).toContain(`npx -y @ionivetech/mugiwara@${version}`);
  });
}
