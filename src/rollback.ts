// src/rollback.ts
// Executable rollback map: recovery you can run, not prose.
// Generated from git + state at closure; the human runs it, mugiwara never does.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type RollbackInput = {
  mission: string;
  branch: string;
  baseSha: string;
};

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

/**
 * Build the rollback script body. Pure given the inputs — the shas are read
 * from the repo by the caller so this stays unit-testable without git.
 */
export function buildRollback(input: RollbackInput, commitsNewestFirst: string[], filesTouched: string[]): string {
  const lines = [
    '#!/usr/bin/env bash',
    `# Rollback map for mission "${input.mission}" — generated at closure.`,
    '# Human-executed. Review before running; mugiwara never runs this.',
    `# Branch: ${input.branch}`,
    `# Base:   ${input.baseSha}`,
    '',
    'set -euo pipefail',
    '',
  ];
  if (!commitsNewestFirst.length && !filesTouched.length) {
    lines.push('# No commits between base and HEAD on this branch — nothing to revert.', '');
    return lines.join('\n');
  }
  if (!commitsNewestFirst.length) {
    // Squash-merge workflows: the branch's changes reached the base ref as one
    // squashed commit, so `rev-list base..branch` can come back empty while
    // `git diff base branch` is not. "Nothing to revert" would be a lie — the
    // changes are live. Emit loud, human-executable guidance and exit 1 so a
    // careless run fails instead of silently doing nothing.
    lines.push(
      '# UNRESOLVED: squash-merged state detected.',
      `# git rev-list ${input.baseSha}..${input.branch} is empty, but the diff`,
      `# ${input.baseSha}..${input.branch} touches ${filesTouched.length} file(s):`,
      '# the mission\'s changes were collapsed into commit(s) already on the base',
      '# ref. No per-commit revert list can be derived automatically.',
      '# Locate the squash commit, review it, then revert it:',
      `#   git log --oneline ${input.baseSha}..HEAD --grep="${input.mission}"`,
      '#   git revert <squash-commit>',
      '# Files carrying the squashed changes (verify each after reverting):',
      ...filesTouched.map((f) => `#   ${f}`),
      '',
      'echo "ROLLBACK INCOMPLETE: squash-merged state — locate and revert the squash commit manually" >&2',
      'exit 1',
      '',
    );
    return lines.join('\n');
  }
  lines.push(
    '# Revert newest-first so earlier reverts never conflict with later ones.',
    'git revert --no-edit \\',
    commitsNewestFirst.map((c) => `  ${c}`).join(' \\\n'),
    '',
  );
  if (filesTouched.length) {
    lines.push(
      '# Files this mission touched (verify the working tree is clean afterwards):',
      ...filesTouched.map((f) => `#   ${f}`),
      '',
    );
  }
  return lines.join('\n');
}

/** Read the repo for everything the script needs, then write rollback.sh. */
export function generateRollback(projectDir: string, missionDir: string, input: RollbackInput): { file: string; commits: number } | null {
  try {
    const range = `${input.baseSha}..${input.branch}`;
    const revList = git(projectDir, ['rev-list', '--reverse', range]).split(/\r?\n/).filter(Boolean);
    const commitsNewestFirst = [...revList].reverse();
    const filesTouched = input.baseSha === 'unknown'
      ? []
      : git(projectDir, ['diff', '--name-only', input.baseSha, input.branch]).split(/\r?\n/).filter(Boolean);
    const body = buildRollback(input, commitsNewestFirst, filesTouched);
    const file = join(missionDir, 'rollback.sh');
    writeFileSync(file, body, { mode: 0o755 });
    return { file: 'rollback.sh', commits: commitsNewestFirst.length };
  } catch {
    // No git, unknown base, or an empty branch — a rollback map cannot be
    // derived. Absent file beats a wrong one.
    return null;
  }
}
