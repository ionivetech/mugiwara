// src/onboard.ts — zero-LLM onboarding wizard (6 questions, writes .mugiwara/config).
// Runs on every platform via the `mugiwara onboard` CLI command. No LLM, no network.
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRl, choose, confirm, type Rl } from './prompt.ts';

// Canonical key order for the written config. Keys the wizard does not ask
// about (auto_commit, delegate_threshold, heal_max_cycles, verbosity) are
// preserved from an existing config, never reset to defaults.
const DEFAULT_ORDER = [
  'mode', 'branch', 'commit', 'auto_commit', 'coverage_new', 'coverage_modified',
  'review_depth', 'quality_depth', 'delegate_threshold', 'heal_max_cycles', 'verbosity',
];

// Defaults for keys the wizard does not ask about — used only when the key is
// absent from an existing config (fresh install). Existing values always win.
const DEFAULTS: Record<string, string> = {
  auto_commit: 'on',
  delegate_threshold: '60',
  heal_max_cycles: '3',
  verbosity: 'normal',
};

const BRANCH_PRESETS: Record<number, string> = {
  1: 'feature/{type}-{issue}-{slug}',
  2: 'feature/{slug}',
  3: 'feat/{slug}',
};

const COMMIT_PRESETS: Record<number, string> = {
  1: 'conventional',
  2: 'gitmoji',
  3: 'plain',
};

export function parseConfig(lines: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!map.has(k)) map.set(k, v);
  }
  return map;
}

export function buildConfig(existing: Map<string, string>, updates: Record<string, string>): string {
  const merged = new Map(existing);
  for (const [k, v] of Object.entries(updates)) merged.set(k, v);
  const lines: string[] = [];
  for (const k of DEFAULT_ORDER) {
    const v = merged.get(k) ?? DEFAULTS[k];
    if (v === undefined) continue;
    lines.push(`${k}=${v}`);
    merged.delete(k);
  }
  for (const [k, v] of merged) lines.push(`${k}=${v}`);
  return lines.join('\n') + '\n';
}

async function askFreeText(rl: Rl, prompt: string): Promise<string> {
  for (;;) {
    const v = (await rl.question(prompt)).trim();
    if (v) return v;
    console.log('  Cannot be empty.');
  }
}

// Same guard the runtime helpers use: a symlinked config must never be
// overwritten through the wizard (the target file is not ours to write).
function assertNotSymlink(file: string): void {
  if (!existsSync(file)) return;
  try {
    if (lstatSync(file).isSymbolicLink()) throw new Error(`refusing to follow symlink: ${file}`);
  } catch (e) {
    if ((e as { code?: string }).code === 'ENOENT') return;
    throw e;
  }
}

export async function runOnboard(projectDir: string): Promise<void> {
  if (!process.stdin.isTTY) {
    throw new Error('Not a terminal. Run `mugiwara onboard` in a terminal, or edit .mugiwara/config directly.');
  }
  const mugiwaraDir = join(projectDir, '.mugiwara');
  const configPath = join(mugiwaraDir, 'config');
  assertNotSymlink(configPath);
  const existing = parseConfig(existsSync(configPath) ? readFileSync(configPath, 'utf8').split(/\r?\n/) : []);

  const rl = createRl();
  try {
    console.log('');
    console.log('╔══════════════════════════════════════╗');
    console.log('║   Mugiwara Onboarding Wizard         ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('');

    if (existing.size > 0) {
      const redo = await confirm(rl, 'Existing .mugiwara/config found. Re-onboard?');
      if (!redo) {
        console.log('Onboarding cancelled. Config preserved.');
        return;
      }
      console.log('');
    }

    // Q1 — branch pattern
    const branchChoice = await choose(rl, 'Q1 — Branch naming pattern:', [
      'Trunk-based — feature/{type}-{issue}-{slug}',
      'GitFlow — feature/{slug}',
      'GitHub Flow — feat/{slug}',
      'Custom — enter your own pattern',
    ]);
    let branch: string;
    if (branchChoice === 3) {
      branch = await askFreeText(rl, '  Branch pattern (placeholders: {type} {issue} {slug}, e.g. {issue}-{slug}): ');
    } else {
      branch = BRANCH_PRESETS[branchChoice + 1];
    }

    // Q2 — autonomy mode
    const modeIdx = await choose(rl, 'Q2 — Autonomy mode:', [
      'guided — ask before every wave transition',
      'semi — auto-advance through waves, pause on failures',
      'auto — full auto-pilot',
    ]);
    const mode = ['guided', 'semi', 'auto'][modeIdx];

    // Q3 — review depth
    const reviewIdx = await choose(rl, 'Q3 — Code review depth:', [
      'full — breaking-change map, five-axis review, <=3 cycles',
      'standard — five-axis review, 1 cycle',
      'quick — diff-only, no caller-map',
    ]);
    const reviewDepth = ['full', 'standard', 'quick'][reviewIdx];

    // Q4 — quality depth
    const qualityIdx = await choose(rl, 'Q4 — Quality check depth:', [
      'full — format, lint, typecheck, test, build',
      'standard — lint, typecheck, test',
      'quick — test only',
    ]);
    const qualityDepth = ['full', 'standard', 'quick'][qualityIdx];

    // Q5 — coverage
    const covIdx = await choose(rl, 'Q5 — Test coverage threshold:', [
      '90/80 — new code 90%, modified 80%',
      '80/70 — new code 80%, modified 70%',
      'custom — enter your own values',
      'none — 0/0, no coverage enforcement',
    ]);
    let coverageNew = 90;
    let coverageModified = 80;
    if (covIdx === 1) { coverageNew = 80; coverageModified = 70; }
    else if (covIdx === 2) {
      coverageNew = Number.parseInt(await askFreeText(rl, '  Coverage for new code (%): '), 10) || 0;
      coverageModified = Number.parseInt(await askFreeText(rl, '  Coverage for modified code (%): '), 10) || 0;
    } else if (covIdx === 3) { coverageNew = 0; coverageModified = 0; }

    // Q6 — commit style
    const commitChoice = await choose(rl, 'Q6 — Commit style:', [
      'Conventional Commits — feat:, fix:, chore:, docs:',
      'Gitmoji — emoji-prefixed conventional',
      'Plain — no prefix, imperative sentence',
      'Custom template — enter your own (placeholders: {type} {issue} {title})',
    ]);
    let commit: string;
    if (commitChoice === 3) {
      commit = await askFreeText(rl, '  Commit template (e.g. {issue}: {title}): ');
    } else {
      commit = COMMIT_PRESETS[commitChoice + 1];
    }

    // ---- Write config ----
    if (!existsSync(mugiwaraDir)) mkdirSync(mugiwaraDir, { recursive: true });
    const body = buildConfig(existing, {
      mode,
      branch,
      commit,
      coverage_new: String(coverageNew),
      coverage_modified: String(coverageModified),
      review_depth: reviewDepth,
      quality_depth: qualityDepth,
    });
    writeFileSync(configPath, `# .mugiwara/config — written by mugiwara onboard on ${new Date().toISOString().slice(0, 10)}\n${body}`);

    // ---- Summary ----
    console.log('╔══════════════════════════════════════╗');
    console.log('║   Onboarding Complete                ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('');
    console.log(`  Branch pattern:   ${branch}`);
    console.log(`  Autonomy mode:    ${mode}`);
    console.log(`  Review depth:     ${reviewDepth}`);
    console.log(`  Quality depth:    ${qualityDepth}`);
    console.log(`  Coverage:         ${coverageNew}/${coverageModified}`);
    console.log(`  Commit style:     ${commit}`);
    console.log('');
    console.log(`  Config written:   ${configPath}`);
    console.log('');
  } finally {
    rl.close();
  }
}