// src/doctor.ts
// `mugiwara doctor` — read-only health check of the current repo. Every check
// is a plain-language line; a failed one carries one line saying how to fix it.
// Never writes a file (the CLI skips the config bootstrap for this command).
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { readConfig } from './config.ts';
import { readManifest, manifestPath } from './manifest.ts';
import { targets } from './targets/index.ts';
import { VERSION } from './installer.ts';
import { readState } from './continue.ts';
import { inspectMissions } from './state-health.ts';
import { findBash, SCRIPTS_DIR } from './run.ts';
import { REVIEW_LEDGER } from './active-mission.ts';

export type Check = { name: string; status: 'ok' | 'warn' | 'fail'; detail: string; fix?: string };

/** Hook files the Claude target wires into settings.json (see src/targets/claude.ts). */
export const CLAUDE_HOOKS = ['session-start.js', 'mugiwara-mode-tracker.js', 'pretool-guard.js', 'auto-savepoint.js', 'pipeline-guard.js', 'engagement-marker.js'];

const PIN_RE = /@ionivetech\/mugiwara@(\d+\.\d+\.\d+[0-9A-Za-z.+-]*)/g;
const COMMAND_FILE = join('.claude', 'commands', 'mugiwara.md');

/** Distinct npx pins found in an installed command file; null when the file is absent. */
export function commandPins(projectDir: string): string[] | null {
  const file = join(projectDir, COMMAND_FILE);
  if (!existsSync(file)) return null;
  try {
    return [...new Set([...readFileSync(file, 'utf8').matchAll(PIN_RE)].map((m) => m[1]))];
  } catch { return []; }
}

/** One-line warning when the installed pin differs from the running CLI; null when fine or unpinned. */
export function pinMismatch(projectDir: string, cli = VERSION): string | null {
  const pins = commandPins(projectDir)?.filter((p) => p !== cli) ?? [];
  if (!pins.length) return null;
  const rel = pins.every((p) => p < cli) ? 'older' : 'different';
  return `installed command pins ${rel} version ${pins.join(', ')} but this CLI is ${cli} — delete ${COMMAND_FILE} and run \`mugiwara update\``;
}

function installChecks(projectDir: string, home: string, out: Check[]): string[] {
  let m;
  try { m = readManifest(manifestPath({ scope: 'project', projectDir, home })); } catch {
    out.push({ name: 'install', status: 'fail', detail: '.mugiwara/manifest.json is not valid JSON', fix: 'delete .mugiwara/manifest.json and run `mugiwara update`' });
    return [];
  }
  if (!m) {
    out.push({ name: 'install', status: 'fail', detail: 'no project install found', fix: 'run `mugiwara install --yes`' });
    return [];
  }
  out.push({ name: 'install', status: 'ok', detail: `v${m.version}, targets ${m.targets.join(', ')}` });
  const missing = m.files.filter((f) => !existsSync(f));
  for (const id of m.targets) {
    const t = targets[id];
    if (!t) { out.push({ name: `host files (${id})`, status: 'fail', detail: 'unknown target in manifest', fix: 'run `mugiwara update`' }); continue; }
    const dir = t.paths({ scope: 'project', projectDir, home }).skillsDir;
    out.push(existsSync(dir)
      ? { name: `host files (${id})`, status: 'ok', detail: dir }
      : { name: `host files (${id})`, status: 'fail', detail: `${dir} is missing`, fix: `run \`mugiwara update --target ${id}\`` });
  }
  if (missing.length) {
    out.push({ name: 'manifest files', status: 'fail', detail: `${missing.length} installed file(s) missing, first: ${missing[0]}`, fix: 'run `mugiwara update`' });
  }
  return m.targets;
}

function hookCheck(projectDir: string): Check {
  const settings = join(projectDir, '.claude', 'settings.json');
  const hooksDir = join(projectDir, '.claude', 'hooks');
  const name = 'hooks wired (claude)';
  if (!existsSync(settings)) {
    return existsSync(hooksDir)
      ? { name, status: 'fail', detail: '.claude/hooks exists but .claude/settings.json does not wire it', fix: 'run `mugiwara update --target claude`' }
      : { name, status: 'warn', detail: 'no project hooks; fine only if the plugin install supplies them (ASSUMPTION: plugin hooks are not detectable here)' };
  }
  let text: string;
  try { JSON.parse(readFileSync(settings, 'utf8')); text = readFileSync(settings, 'utf8'); } catch {
    return { name, status: 'fail', detail: '.claude/settings.json is not valid JSON', fix: 'repair the JSON by hand, then run `mugiwara update --target claude`' };
  }
  const missing = CLAUDE_HOOKS.filter((h) => !text.includes(h));
  return missing.length
    ? { name, status: 'fail', detail: `settings.json does not wire: ${missing.join(', ')}`, fix: 'run `mugiwara update --target claude`' }
    : { name, status: 'ok', detail: `${CLAUDE_HOOKS.length} hooks wired in .claude/settings.json` };
}

function configChecks(projectDir: string, out: Check[]): void {
  let cfg: Record<string, string>;
  try { cfg = readConfig(projectDir); } catch {
    out.push({ name: 'config', status: 'fail', detail: '.mugiwara/config cannot be read', fix: 'chmod u+r .mugiwara/config' });
    return;
  }
  if (!existsSync(join(projectDir, '.mugiwara', 'config'))) {
    out.push({ name: 'config', status: 'warn', detail: 'no .mugiwara/config, defaults apply', fix: 'any mugiwara command except doctor writes the default file' });
  }
  const rows: Array<[string, string, string[]]> = [
    ['mode', 'guided', ['guided', 'semi', 'auto']],
    ['enforce', 'warn', ['off', 'warn', 'block']],
    ['independent_review', 'on', ['on', 'off']],
  ];
  for (const [key, def, allowed] of rows) {
    const v = cfg[key] ?? def;
    out.push(allowed.includes(v)
      ? { name: `config ${key}`, status: 'ok', detail: `${v}${cfg[key] === undefined ? ' (default)' : ''}` }
      : { name: `config ${key}`, status: 'fail', detail: `"${v}" is not one of ${allowed.join('|')}`, fix: `set ${key}=${def} in .mugiwara/config` });
  }
}

function laneCheck(projectDir: string): Check {
  const bash = findBash();
  if (!bash) return { name: 'lane', status: 'warn', detail: 'no bash found, lane not computed', fix: 'set MUGIWARA_BASH or install bash' };
  const r = spawnSync(bash, [join(SCRIPTS_DIR, 'lane.sh'), 'main', '--json'], { cwd: projectDir, encoding: 'utf8' });
  try {
    const j = JSON.parse(r.stdout) as { lane: string; reason: string; files_touched: number };
    return { name: 'lane', status: 'ok', detail: `${j.lane} (${j.files_touched} file(s) changed; ${j.reason})` };
  } catch {
    return { name: 'lane', status: 'warn', detail: (r.stderr || 'lane.sh gave no JSON').trim().split('\n')[0], fix: 'run inside a git repository with a valid mugiwara.policy.yml' };
  }
}

/** `opts.lane: false` skips the lane.sh spawn (about 0.5 s) for callers that only need the other checks. */
export function doctor(projectDir: string, home: string, opts: { lane?: boolean } = {}): Check[] {
  const out: Check[] = [];
  const installed = installChecks(projectDir, home, out);
  if (installed.includes('claude')) out.push(hookCheck(projectDir));
  configChecks(projectDir, out);
  if (opts.lane !== false) out.push(laneCheck(projectDir));

  const bad = inspectMissions(projectDir);
  for (const p of bad) out.push({ name: `state ${p.file}`, status: 'fail', detail: p.problem, fix: p.fix });
  if (!bad.length) {
    const live = readState(projectDir);
    out.push({ name: 'missions', status: 'ok', detail: live.length ? `${live.length} in flight: ${live.map((s) => s.mission + (s.member ? `/${s.member}` : '')).join(', ')}` : 'none in flight' });
  }

  const root = join(projectDir, '.mugiwara');
  const engaged = existsSync(join(root, '.engaged'));
  out.push(engaged
    ? { name: 'engaged marker', status: 'ok', detail: '.mugiwara/.engaged present' }
    : { name: 'engaged marker', status: 'warn', detail: 'no .mugiwara/.engaged yet, the crew has not run here', fix: 'start a mission with /mugiwara in the host' });
  const ledger = existsSync(join(root, REVIEW_LEDGER));
  out.push(ledger
    ? { name: 'review ledger', status: 'ok', detail: `.mugiwara/${REVIEW_LEDGER} present` }
    : { name: 'review ledger', status: 'warn', detail: `no .mugiwara/${REVIEW_LEDGER}, no independent review dispatched yet`, fix: 'expected until the first review stage runs' });

  const pins = commandPins(projectDir);
  const mismatch = pinMismatch(projectDir);
  if (pins === null) out.push({ name: 'version', status: 'ok', detail: `CLI ${VERSION}, no installed command file to compare` });
  else if (mismatch) out.push({ name: 'version', status: 'fail', detail: mismatch.split(' — ')[0], fix: mismatch.split(' — ')[1] });
  else if (!pins.length) out.push({ name: 'version', status: 'warn', detail: `CLI ${VERSION}, ${COMMAND_FILE} has no npx pin` });
  else out.push({ name: 'version', status: 'ok', detail: `CLI ${VERSION} matches pin ${pins[0]}` });
  return out;
}

export function renderDoctor(checks: Check[]): string {
  const tag = { ok: 'ok  ', warn: 'warn', fail: 'FAIL' };
  return checks.map((c) => `[${tag[c.status]}] ${c.name}: ${c.detail}${c.status !== 'ok' && c.fix ? `\n       fix: ${c.fix}` : ''}`).join('\n');
}
