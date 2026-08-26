// src/provenance.ts
// Provenance ledger: line-of-sight from a commit to the
// mission that produced it — which agent persona, which lane, verified by
// what evidence. Distributed in two layers:
//   1. a git note on refs/notes/mugiwara attached to the branch head
//      (local precision archive; survives rebase via notes.rewriteRef)
//   2. provenance.md in the mission dir, ready to paste as a PR comment
//      (the layer every hosting UI can show)
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const NOTES_REF = 'refs/notes/mugiwara';

/** Structural subset any mission state satisfies — keeps this import-free. */
export type NoteSource = {
  mission: string;
  actor: string;
  lane: string;
  mode: string;
  branch: string;
  tasks_done: number;
  tasks_total: number;
  evidence: string[];
  models?: string[];
};

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

export function modelLabel(): string {
  return process.env.MUGIWARA_MODEL?.trim()
    || process.env.ANTHROPIC_MODEL?.trim()
    || 'model-unrecorded (set MUGIWARA_MODEL to attribute)';
}

/** The provenance block — identical wording in the note and the md file. */
export function buildNote(s: {
  mission: string; actor: string; lane: string; mode: string; branch: string;
  tasks_done: number; tasks_total: number; evidence: string[]; model?: string; models?: string[];
}): string {
  const gates = s.evidence.length ? s.evidence.join(' · ') : 'no evidence recorded';
  // Per-stage attribution (A4): when flow history recorded models, render the
  // unique set — a mid-mission switch must not collapse to the last env value.
  // With nothing recorded, keep the env-fallback label wording.
  const uniqModels = [...new Set((s.models ?? []).filter(Boolean))];
  const modelPart = uniqModels.length ? `model(s): ${uniqModels.join(', ')}` : (s.model ?? modelLabel());
  return [
    `mission: ${s.mission}`,
    `agent: ${s.actor || 'unknown'} · ${modelPart} · lane ${s.lane} · mode ${s.mode}`,
    `tasks: ${s.tasks_done}/${s.tasks_total}`,
    `gates/evidence: ${gates}`,
    `branch: ${s.branch}`,
    'human review: pending (PR review is the terminal gate)',
  ].join('\n');
}

/** PR-paste-ready markdown wrapper around the same facts. */
export function renderProvenanceMd(note: string, sha: string | null): string {
  const lines = [
    '# Provenance',
    '',
    '<!-- paste below into the PR description or a PR comment -->',
    '',
    '```',
    note,
    '```',
    '',
    sha ? `Commit: ${sha}` : 'Commit: not recorded (no git head resolved at closure)',
    '',
    'Query locally after pushing notes:',
    '`git fetch origin refs/notes/mugiwara:refs/notes/mugiwara` then `mugiwara blame <path>`.',
  ];
  return lines.join('\n') + '\n';
}

export function attachGitNote(projectDir: string, branch: string, note: string): { sha: string } | null {
  try {
    let sha: string;
    try {
      sha = git(projectDir, ['rev-parse', '--verify', branch]);
    } catch {
      sha = git(projectDir, ['rev-parse', 'HEAD']);
    }
    git(projectDir, ['notes', '--ref=mugiwara', 'add', '-f', '-m', note, sha]);
    return { sha };
  } catch {
    // not a repo, detached oddities, or notes disabled — degrade honestly
    return null;
  }
}

/** `mugiwara blame <path>` — last commit that touched the path + its note. */
export function blamePath(projectDir: string, path: string): string {
  let sha: string;
  try {
    sha = git(projectDir, ['log', '-1', '--format=%H', '--', path]);
  } catch {
    return `blame: not a git repository (${projectDir})`;
  }
  if (!sha) return `blame: no commit touches "${path}"`;
  try {
    const note = git(projectDir, ['notes', '--ref=mugiwara', 'show', sha]);
    return `${path} @ ${sha.slice(0, 7)}\n${note}`;
  } catch {
    return `${path} @ ${sha.slice(0, 7)}\n(no mugiwara provenance note on this commit)`;
  }
}

/** Closure hook: write provenance.md + attach the git note. */
export function writeProvenance(projectDir: string, missionDir: string, state: NoteSource): void {
  const note = buildNote(state);
  const attached = attachGitNote(projectDir, state.branch, note);
  writeFileSync(join(missionDir, 'provenance.md'), renderProvenanceMd(note, attached ? attached.sha : null));
}
