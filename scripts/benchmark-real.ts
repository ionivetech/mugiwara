#!/usr/bin/env bun
// scripts/benchmark-real.ts — real-model before/after benchmark. NOT part of CI gates.
// Runs each task in evals/benchmark/tasks/*.json with a host CLI: plain, and Mugiwara
// installed into the fixture repo and explicitly invoked. Needs a model login or API key;
// the key is inherited, never read, printed or written by this script.
//
//   bun scripts/benchmark-real.ts --dry-run [--runs N] [--calibrate]   plan, call count, local task verification; no model calls
//   bun scripts/benchmark-real.ts --tasks a,b --runs 3 [--out dir] [--config key=value]... [--resume]
//
// Two steps. 1) --calibrate: plain arm only (default 3 runs), writes calibration.json/.md and marks the
// tasks plain fails. 2) compare on those tasks with FRESH runs: --tasks-from <calibration.json> --run-offset N
// (N = calibration runs, so run ids and resume keys never repeat). Other flags: --arm plain|mugiwara|both.
//
// Results are appended to <out>/runs.jsonl as each run finishes. A rate/session limit stops the
// whole benchmark with exit code 3; re-run the same command with --resume to continue.
// Host defaults to Claude; use --host codex or override the CLI with MUGIWARA_EVAL_CMD.
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { applyConfig, armsOf, buildArgs, calibrate, computeEngagement, discriminatingTasks, isInvalidRun, isRateLimited, overlapsCalibration, parseBenchArgs, parseCliOutput, plannedCalls, renderCalibration, renderMarkdown, runIds, runKey, SELECTION_BIAS_NOTE, summaryJson, type Arm, type Host, type RunResult } from './benchmark-lib.ts';

const root = join(import.meta.dirname, '..');
const tasksDir = join(root, 'evals', 'benchmark', 'tasks');
const referenceDir = join(root, 'evals', 'benchmark', 'reference');
const DEFAULT_CMDS: Record<Host, string> = {
  claude: 'claude -p --output-format stream-json --verbose --allowedTools Bash,Edit,Write,Read,Glob,Grep,Skill,Task,Agent',
  // Keep the Codex rollout: its subagent dispatcher needs the parent thread record.
  codex: 'codex exec --json --sandbox workspace-write',
};
// Install files and crew state are not part of the task diff.
const NOISE = ['.claude', '.codex', '.agents', '.mugiwara', '.gitignore'];

export type Task = {
  id: string; title: string; prompt: string;
  trap: string;                       // one sentence for maintainers; never shown to the model
  control?: boolean;                  // no trap: measures pure overhead
  files: Record<string, string>;      // fixture repo, written to a temp dir and committed
  accept: string;                     // shell command; exit 0 = pass
  hidden?: Record<string, string>;    // files added only after the run, then `accept` runs again
};

export function loadTasks(dir = tasksDir): Task[] {
  return readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => {
    const t = JSON.parse(readFileSync(join(dir, f), 'utf8')) as Task;
    for (const k of ['id', 'title', 'prompt', 'accept', 'trap'] as const) if (typeof t[k] !== 'string' || !t[k]) throw new Error(`${f}: missing ${k}`);
    if (!t.files || !Object.keys(t.files).length) throw new Error(`${f}: files empty`);
    return t;
  });
}

function write(dir: string, files: Record<string, string>) {
  for (const [p, c] of Object.entries(files)) { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), c); }
}
function readTree(dir: string, base = dir): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) Object.assign(out, readTree(p, base)); else out[p.slice(base.length + 1)] = readFileSync(p, 'utf8');
  }
  return out;
}
const git = (cwd: string, ...a: string[]) => execFileSync('git', ['-c', 'user.name=bench', '-c', 'user.email=bench@example.invalid', ...a], { cwd, encoding: 'utf8', stdio: 'pipe' });
const accepts = (cwd: string, cmd: string) => spawnSync('sh', ['-c', cmd], { cwd, timeout: 120_000 }).status === 0;

/**
 * Local, model-free check of one task: acceptance fails on the untouched fixture; the reference
 * solution passes acceptance and hidden checks; the naive solution passes the visible tests but
 * fails the hidden ones (control task: passes both). Returns problems, empty when sound.
 * Reference/naive files live under evals/benchmark/reference/<id>/ and are never given to a model.
 */
export function verifyTask(t: Task): string[] {
  const problems: string[] = [];
  const trial = (extra: Record<string, string>, withHidden: boolean) => {
    const dir = mkdtempSync(join(tmpdir(), `mugiwara-verify-${t.id}-`));
    try { write(dir, t.files); write(dir, extra); if (withHidden) write(dir, t.hidden ?? {}); return accepts(dir, t.accept); } finally { rmSync(dir, { recursive: true, force: true }); }
  };
  const ref = readTree(join(referenceDir, t.id, 'reference')), naive = readTree(join(referenceDir, t.id, 'naive'));
  if (!Object.keys(ref).length || !Object.keys(naive).length) return [`${t.id}: missing reference or naive solution`];
  if (trial({}, false)) problems.push(`${t.id}: acceptance passes on the untouched fixture`);
  if (!trial(ref, true)) problems.push(`${t.id}: reference solution fails acceptance/hidden checks`);
  if (!trial(naive, false)) problems.push(`${t.id}: naive solution fails the visible tests`);
  const naiveHidden = trial(naive, true);
  if (t.control ? !naiveHidden : naiveHidden) problems.push(`${t.id}: naive solution ${t.control ? 'fails' : 'passes'} the hidden checks`);
  return problems;
}

class RateLimit extends Error {}

function runOne(t: Task, arm: Arm, run: number, cmd: string[], config: string[], promptSuffix = '', host: Host = 'claude'): RunResult {
  const dir = mkdtempSync(join(tmpdir(), `mugiwara-bench-${t.id}-`));
  try {
    write(dir, t.files);
    git(dir, 'init', '-q', '-b', 'main'); git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'fixture');
    const base = git(dir, 'rev-parse', 'HEAD').trim();
    if (arm === 'mugiwara') {
      // How a real user runs it: the repo's own CLI installs into the project; mode=auto so headless never waits for answers.
      execFileSync('bun', [join(root, 'src', 'cli.ts'), 'install', '--target', host, '--yes', '--project', dir], { cwd: dir, stdio: 'pipe' });
      const cfg = join(dir, '.mugiwara', 'config');
      writeFileSync(cfg, applyConfig(existsSync(cfg) ? readFileSync(cfg, 'utf8') : '', ['mode=auto', ...config]));
    }
    const [bin, ...pre] = cmd;
    const args = buildArgs(pre, arm, t.prompt, promptSuffix, host);
    const t0 = Date.now();
    const p = spawnSync(bin, args, { cwd: dir, encoding: 'utf8', timeout: 20 * 60_000, maxBuffer: 256 * 1024 * 1024 });
    const wallMs = Date.now() - t0;
    const parsed = parseCliOutput(p.stdout ?? '', host);
    if (isRateLimited(parsed, (p.stderr ?? '').slice(-2000))) throw new RateLimit();
    git(dir, 'add', '-A');
    const filesChanged = git(dir, 'diff', '--cached', '--name-only', base, '--', '.', ...NOISE.map((n) => `:(exclude)${n}`)).split('\n').filter(Boolean);
    const accepted = accepts(dir, t.accept);
    let ok = accepted, hiddenOk: boolean | null = null;
    if (t.hidden) { write(dir, t.hidden); hiddenOk = accepts(dir, t.accept); ok = accepted && hiddenOk; }
    let engagement = null;
    if (arm === 'mugiwara') {
      const missions = join(dir, '.mugiwara', 'missions');
      const missionReport = existsSync(missions) && readdirSync(missions).some((m) => existsSync(join(missions, m, 'report.md')));
      const dispatch = join(dir, '.mugiwara', 'review-dispatch.jsonl');
      const reviewDispatchLines = existsSync(dispatch) ? readFileSync(dispatch, 'utf8').split('\n').filter((l) => l.trim()).length : 0;
      engagement = computeEngagement(parsed, { missionReport, reviewDispatchLines });
    }
    const error = p.error ? String(p.error.message) : p.status ? `exit ${p.status}` : undefined;
    return { task: t.id, arm, host, run, config: arm === 'mugiwara' ? config : [], control: t.control, accepted, ok, hiddenOk, wallMs, filesChanged, error, invalid: isInvalidRun(error, parsed.usage), engagement, ...parsed };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

if (import.meta.main) {
  const a = parseBenchArgs(process.argv.slice(2));
  if ('error' in a) { console.error(a.error); process.exit(1); }
  const { dry, resume, runs, runOffset, config, promptSuffix, host } = a;
  const arms = armsOf(a.arm);
  const all = loadTasks();
  let want = a.tasks;
  let cal: { runOffset?: number; runs?: number; tasks?: any[] } | undefined;
  if (a.tasksFrom) {
    try { cal = JSON.parse(readFileSync(a.tasksFrom, 'utf8')); } catch (e) { console.error(`cannot read ${a.tasksFrom}: ${(e as Error).message}`); process.exit(1); }
    want = discriminatingTasks(cal!);
    if (!want.length) { console.error(`${a.tasksFrom} has no discriminating tasks: nothing to compare. Add harder tasks and calibrate again.`); process.exit(1); }
    if (overlapsCalibration(cal!, runOffset, runs)) { console.error(`run ids ${runOffset + 1}..${runOffset + runs} reuse calibration run ids. Pass --run-offset ${(cal!.runOffset ?? 0) + (cal!.runs ?? 0)} or higher: the comparison needs fresh runs.`); process.exit(1); }
  }
  const tasks = want ? all.filter((t) => want!.includes(t.id)) : all;
  if (want && tasks.length !== want.length) { console.error(`unknown task(s); have: ${all.map((t) => t.id).join(', ')}`); process.exit(1); }
  const cmdStr = process.env.MUGIWARA_EVAL_CMD ?? DEFAULT_CMDS[host];
  const calls = plannedCalls(tasks.length, runs, arms.length);
  const ids = runIds(runOffset, runs);
  console.log(`host: ${host}\ntasks: ${tasks.map((t) => t.id).join(', ')}\nmode: ${a.calibrate ? 'calibration (plain arm only)' : 'comparison'}\narms: ${arms.join(', ')}\nruns per arm: ${runs} (run ids ${ids[0]}..${ids[ids.length - 1]})\ncommand: ${cmdStr}${promptSuffix ? `\nprompt suffix: ${promptSuffix}` : ''}`);
  if (arms.includes('mugiwara')) console.log(`mugiwara arm: project install + mode=auto${config.length ? ' + ' + config.join(' ') : ''}, ${host === 'claude' ? 'prompt sent as "/mugiwara <request>"' : 'prompt invokes $mugiwara-orchestration'}`);
  console.log(`estimated model calls: ${calls} (${tasks.length} tasks x ${runs} runs x ${arms.length} arm${arms.length > 1 ? 's' : ''})`);
  if (a.calibrate) console.log(SELECTION_BIAS_NOTE);
  // Local, model-free verification: always on a dry run, and before any calibration spend.
  const problems = dry || a.calibrate ? tasks.flatMap(verifyTask) : [];
  if (dry) {
    console.log(problems.length ? `task verification FAILED:\n${problems.map((p) => '  ' + p).join('\n')}` : `task verification ok: ${tasks.length} tasks (fixture fails, reference passes, naive fails hidden checks)`);
    console.log('dry run: no model calls made');
    process.exit(problems.length ? 1 : 0);
  }
  if (problems.length) { console.error(`task verification FAILED, no model calls made:\n${problems.map((p) => '  ' + p).join('\n')}`); process.exit(1); }
  const out = a.out ?? join(root, a.calibrate ? 'benchmark-results-calibration' : 'benchmark-results');
  const log = join(out, 'runs.jsonl');
  mkdirSync(out, { recursive: true });
  if (existsSync(log) && !resume) { console.error(`${log} exists. Pass --resume to continue it, or choose a new --out.`); process.exit(1); }
  const load = (): RunResult[] => (existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
  const done = new Set(load().map((r) => runKey(r.task, r.arm, r.run, r.config ?? [], r.host ?? 'claude')));
  const report = () => {
    const mine = new Set(tasks.map((t) => t.id));
    const results = load().filter((r) => mine.has(r.task) && ids.includes(r.run) && arms.includes(r.arm) && (r.host ?? 'claude') === host && (r.arm === 'plain' || runKey('', 'mugiwara', 0, r.config ?? [], host) === runKey('', 'mugiwara', 0, config, host)));
    const date = new Date().toISOString().slice(0, 10);
    if (a.calibrate) {
      // problems is empty here, so every task's local verification is clean.
      const rows = calibrate(results, Object.fromEntries(tasks.map((t) => [t.id, true])));
      writeFileSync(join(out, 'calibration.json'), JSON.stringify({ date, host, cmd: cmdStr, runs, runOffset, selectionBiasNote: SELECTION_BIAS_NOTE, tasks: rows, discriminating: rows.filter((r) => r.discriminating).map((r) => r.task) }, null, 2) + '\n');
      writeFileSync(join(out, 'calibration.md'), renderCalibration(rows, { cmd: cmdStr, runs, runOffset, date }));
      return;
    }
    writeFileSync(join(out, 'benchmark.json'), JSON.stringify({ date, host, cmd: cmdStr, runs, runOffset, arms, config, summary: summaryJson(results), results }, null, 2) + '\n');
    writeFileSync(join(out, 'benchmark.md'), renderMarkdown(results, { cmd: cmdStr, runs, date, config }));
  };
  try {
    for (const t of tasks) for (const r of ids) for (const arm of arms) {
      if (done.has(runKey(t.id, arm, r, arm === 'mugiwara' ? config : [], host))) { console.log(`skip (already recorded) ${t.id} ${arm} #${r}`); continue; }
      const res = runOne(t, arm, r, cmdStr.split(' '), config, promptSuffix, host);
      appendFileSync(log, JSON.stringify(res) + '\n');
      const eng = res.engagement ? (res.engagement.engaged ? ' engaged' : ' NOT ENGAGED') : '';
      console.log(`${res.ok ? 'pass' : 'fail'} ${t.id} ${arm} #${r} hidden=${res.hiddenOk} ${(res.wallMs / 1000).toFixed(1)}s${eng}`);
    }
  } catch (e) {
    if (!(e instanceof RateLimit)) throw e;
    report();
    console.error(`rate/session limit reached: stopped, the interrupted run was not recorded. Wait for the limit to reset, then re-run the same command with --resume (results so far: ${log}).`);
    process.exit(3);
  }
  report();
  console.log(a.calibrate ? `wrote ${join(out, 'calibration.json')} and calibration.md` : `wrote ${join(out, 'benchmark.json')} and benchmark.md`);
}
