// scripts/benchmark-lib.ts — pure parsing + report logic for benchmark-real.ts.
// No I/O, no model calls: unit-tested with synthetic CLI output.

export type Usage = { input: number; output: number; cacheRead: number; cacheCreate: number };
export type ParsedRun = {
  usage: Usage | null; toolCalls: number | null; costUsd: number | null; isError: boolean; resultText: string;
  skills: string[];                 // Skill tool_use names
  subagents: string[];              // Task/Agent tool_use input.subagent_type, one entry per spawn
  subagentStats: unknown | null;    // `subagent_stats` object on the result event, when present
};
export type Engagement = {
  engaged: boolean; skills: string[]; subagents: string[]; crewSubagents: string[]; subagentStats: unknown | null;
  missionReport: boolean; reviewDispatchLines: number;
};
export type Arm = 'plain' | 'mugiwara';
export type Host = 'claude' | 'codex';
export type RunResult = {
  task: string; arm: Arm; host?: Host; run: number;
  config?: string[];         // extra `.mugiwara/config` lines (Mugiwara arm only); part of the resume key
  control?: boolean;         // the no-trap task that measures pure overhead
  accepted?: boolean;        // visible acceptance passed, before hidden checks
  ok: boolean;               // acceptance AND hidden checks passed
  hiddenOk: boolean | null;  // null when the task has no hidden checks; false = the defect was left behind
  wallMs: number; filesChanged: string[]; error?: string;
  invalid?: boolean;         // the CLI failed before doing any work: not a result, excluded from stats
  engagement?: Engagement | null;  // Mugiwara arm only
} & ParsedRun;

export const CREW = ['brook-healing', 'chopper-checkpoint', 'franky-gates', 'jinbe-security', 'luffy-orchestrator', 'memory-keeper', 'nami-planner', 'resume-coordinator', 'robin-reviewer', 'sanji-quality', 'skeptic-verifier', 'usopp-brainstorm', 'zoro-execution'];

/**
 * CLI argument list for one run. Both arms get identical flags. `--allowedTools` takes
 * several values and would swallow a trailing prompt, so the prompt always follows `--`.
 * The Mugiwara arm is installed in the fixture repo and invoked as `/mugiwara <request>`.
 */
export function buildArgs(pre: string[], arm: Arm, prompt: string, suffix = '', host: Host = 'claude'): string[] {
  const request = suffix ? `${prompt}\n\n${suffix}` : prompt;
  const invoked = arm === 'plain' ? request : host === 'claude' ? `/mugiwara ${request}` : `$mugiwara-orchestration\n\n${request}`;
  return [...pre, '--', invoked];
}

/** Apply `key=value` lines to a `.mugiwara/config` text: replace an existing key, else append. */
export function applyConfig(text: string, lines: string[]): string {
  const out = text.replace(/\n+$/, '').split('\n');
  for (const l of lines) {
    const key = l.split('=')[0].trim();
    const i = out.findIndex((x) => x.trim().startsWith(key + '='));
    if (i === -1) out.push(l); else out[i] = l;
  }
  return out.join('\n').replace(/\n*$/, '\n');
}

export const runKey = (task: string, arm: Arm, run: number, config: string[] = [], host: Host = 'claude') => [host, task, arm, run, [...config].sort().join(',')].join('|');

/** A run that exited with an error and reported no usage never reached the model. */
export const isInvalidRun = (error: string | undefined, usage: Usage | null): boolean => Boolean(error) && usage === null;

/** CLI reported an error that mentions a rate/session limit or HTTP 429: stop, do not record a result. */
export const isRateLimited = (p: ParsedRun, stderr = ''): boolean => p.isError && /limit|429/i.test(`${p.resultText}\n${stderr}`);

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function usageOf(u: any): Usage | null {
  if (!u || typeof u !== 'object') return null;
  return { input: num(u.input_tokens), output: num(u.output_tokens), cacheRead: num(u.cache_read_input_tokens), cacheCreate: num(u.cache_creation_input_tokens) };
}

/** Parse `claude -p` output: stream-json (NDJSON), a single JSON object, or a JSON array of events. */
export function parseCliOutput(stdout: string, host: Host = 'claude'): ParsedRun {
  const events: any[] = [];
  const text = stdout.trim();
  try {
    const whole = JSON.parse(text);
    if (Array.isArray(whole)) events.push(...whole); else events.push(whole);
  } catch {
    for (const line of text.split('\n')) {
      try { events.push(JSON.parse(line)); } catch { /* non-JSON line: ignore */ }
    }
  }
  let usage: Usage | null = null, costUsd: number | null = null, isError = false, resultText = '', subagentStats: unknown | null = null;
  let toolCalls = 0, sawAssistant = false;
  const skills: string[] = [], subagents: string[] = [];
  for (const e of events) {
    if (!e || typeof e !== 'object') continue;
    if (e.type === 'assistant' && Array.isArray(e.message?.content)) {
      sawAssistant = true;
      for (const b of e.message.content) {
        if (b?.type !== 'tool_use') continue;
        toolCalls++;
        if (b.name === 'Skill') { const s = b.input?.skill ?? b.input?.name ?? b.input?.command; if (typeof s === 'string') skills.push(s); }
        if (b.name === 'Task' || b.name === 'Agent') subagents.push(typeof b.input?.subagent_type === 'string' ? b.input.subagent_type : 'unspecified');
      }
    }
    if (e.type === 'result') {
      usage = usageOf(e.usage) ?? usage;
      if (typeof e.total_cost_usd === 'number') costUsd = e.total_cost_usd;
      isError = e.is_error === true;
      if (typeof e.result === 'string') resultText = e.result;
      if (e.subagent_stats && typeof e.subagent_stats === 'object') subagentStats = e.subagent_stats;
    }
  }
  if (!events.length) isError = true;
  if (host === 'codex') {
    const completedTurn = events.find((e) => e?.type === 'turn.completed');
    const u = completedTurn?.usage;
    usage = u && typeof u === 'object' ? {
      input: Math.max(0, num(u.input_tokens) - num(u.cached_input_tokens)),
      output: num(u.output_tokens), cacheRead: num(u.cached_input_tokens), cacheCreate: num(u.cache_write_input_tokens),
    } : null;
    isError = events.some((e) => e?.type === 'turn.failed') || (!completedTurn && events.some((e) => e?.item?.type === 'error'));
    const items = events.filter((e) => e?.type === 'item.completed').map((e) => e.item).filter((item) => item && typeof item === 'object');
    toolCalls = items.filter((item) => ['command_execution', 'file_change', 'mcp_tool_call', 'web_search', 'collab_tool_call'].includes(item.type)).length;
    sawAssistant = true;
    for (const item of items) {
      if (item.type === 'agent_message' && typeof item.text === 'string') resultText = item.text;
      if (item.type === 'skill_invocation') {
        const name = item.name ?? item.skill_name;
        if (typeof name === 'string') skills.push(name);
      }
      if (item.type === 'collab_tool_call' && /spawn_agent|spawn/i.test(String(item.tool ?? item.name ?? ''))) {
        const raw = item.arguments ?? item.input ?? {};
        let args = raw;
        if (typeof raw === 'string') { try { args = JSON.parse(raw); } catch { args = {}; } }
        const name = args.agent_type ?? args.name ?? args.nickname;
        subagents.push(typeof name === 'string' ? name : 'unspecified');
      }
    }
  }
  return { usage, toolCalls: sawAssistant ? toolCalls : null, costUsd, isError, resultText, skills, subagents, subagentStats };
}

const bare = (s: string) => s.slice(s.lastIndexOf(':') + 1);

/**
 * Did the crew engage? Yes when a `mugiwara*` Skill ran, a crew member was spawned as a subagent,
 * or the run wrote a mission report (ASSUMPTION: a slash command may expand without a Skill tool_use,
 * and a report.md is strong evidence the workflow ran). All signals are also reported on their own.
 */
export function computeEngagement(p: ParsedRun, facts: { missionReport: boolean; reviewDispatchLines: number }): Engagement {
  const crewSubagents = p.subagents.filter((s) => CREW.includes(bare(s)));
  const engaged = p.skills.some((s) => s.startsWith('mugiwara')) || crewSubagents.length > 0 || facts.missionReport;
  return { engaged, skills: p.skills, subagents: p.subagents, crewSubagents, subagentStats: p.subagentStats, ...facts };
}

export const totalTokens = (u: Usage | null): number | null => (u ? u.input + u.output + u.cacheRead + u.cacheCreate : null);

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Wilson score interval (default 95%) for k successes in n trials. */
export function wilson(k: number, n: number, z = 1.96): { lo: number; hi: number } | null {
  if (n <= 0) return null;
  const p = k / n, z2 = z * z, d = 1 + z2 / n;
  const c = (p + z2 / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / d;
  return { lo: Math.max(0, c - h), hi: Math.min(1, c + h) };
}
const overlap = (a: { lo: number; hi: number }, b: { lo: number; hi: number }) => a.lo <= b.hi && b.lo <= a.hi;

export type ArmSummary = {
  runs: number; accepted: number; passed: number; hiddenRuns: number; hiddenPassed: number;
  acceptedCi: { lo: number; hi: number } | null; hiddenCi: { lo: number; hi: number } | null;
  medianTokens: number | null; totalTokens: number | null; medianUsd: number | null; totalUsd: number | null;
  medianOutput: number | null; medianWallS: number | null; medianTools: number | null; medianFiles: number | null;
};

const sum = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) : null);

export function summarize(rs: RunResult[]): ArmSummary {
  const col = (f: (r: RunResult) => number | null) => rs.map(f).filter((x): x is number => x !== null);
  const hid = rs.filter((r) => r.hiddenOk !== null);
  const accepted = rs.filter((r) => r.accepted ?? r.ok).length, hiddenPassed = hid.filter((r) => r.hiddenOk).length;
  const tok = col((r) => totalTokens(r.usage)), usd = col((r) => r.costUsd);
  return {
    runs: rs.length, accepted, passed: rs.filter((r) => r.ok).length, hiddenRuns: hid.length, hiddenPassed,
    acceptedCi: wilson(accepted, rs.length), hiddenCi: wilson(hiddenPassed, hid.length),
    medianTokens: median(tok), totalTokens: sum(tok), medianUsd: median(usd), totalUsd: sum(usd),
    medianOutput: median(col((r) => r.usage?.output ?? null)), medianWallS: median(col((r) => r.wallMs / 1000)),
    medianTools: median(col((r) => r.toolCalls)), medianFiles: median(col((r) => r.filesChanged.length)),
  };
}

/** Minimum sample before the verdict will say anything beyond "too small". */
export const MIN_TASKS = 5;
export const MIN_RUNS_PER_ARM = 3;

/** Which bucket a run belongs to. A Mugiwara run without proof of engagement is never a Mugiwara result. */
export const bucket = (r: RunResult): 'plain' | 'mugiwara' | 'not-engaged' => (r.arm === 'plain' ? 'plain' : r.engagement?.engaged ? 'mugiwara' : 'not-engaged');

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const ci = (c: { lo: number; hi: number } | null) => (c ? `${pct(c.lo)}-${pct(c.hi)}` : 'n/a');
const rate = (k: number, n: number, c: { lo: number; hi: number } | null) => `${k}/${n} (95% CI ${ci(c)})`;

export function verdict(all: RunResult[]): string {
  const invalid = all.filter((r) => r.invalid);
  const results = all.filter((r) => !r.invalid);
  const notEngaged = results.filter((r) => bucket(r) === 'not-engaged');
  const notes = (invalid.length ? `${invalid.length} run(s) failed before doing any work (CLI error) and are excluded. ` : '')
    + (notEngaged.length ? `${notEngaged.length} Mugiwara run(s) did NOT engage the crew; they are reported separately and not counted as Mugiwara results. ` : '');
  return notes + verdictOf(results);
}

function verdictOf(results: RunResult[]): string {
  const plain = results.filter((r) => bucket(r) === 'plain');
  const mug = results.filter((r) => bucket(r) === 'mugiwara');
  if (!plain.length || !mug.length) return 'No verdict: both arms need at least one run (engaged runs for Mugiwara).';
  const taskIds = [...new Set(results.map((r) => r.task))];
  const perArm = Math.min(...[plain, mug].flatMap((rs) => taskIds.map((t) => rs.filter((r) => r.task === t).length)));
  const p = summarize(plain), m = summarize(mug);
  const facts = `Hidden-check pass (defect not left behind): plain ${rate(p.hiddenPassed, p.hiddenRuns, p.hiddenCi)}, Mugiwara ${rate(m.hiddenPassed, m.hiddenRuns, m.hiddenCi)}. `
    + `Acceptance pass: plain ${rate(p.accepted, p.runs, p.acceptedCi)}, Mugiwara ${rate(m.accepted, m.runs, m.acceptedCi)}.`
    + (p.medianTokens !== null && m.medianTokens !== null ? ` Median total tokens per run: ${Math.round(p.medianTokens)} plain, ${Math.round(m.medianTokens)} Mugiwara (${m.medianTokens >= p.medianTokens ? '+' : '-'}${Math.abs(Math.round(((m.medianTokens - p.medianTokens) / p.medianTokens) * 100))}%, point estimate).` : ' Token usage was not reported for one or both arms.');
  const enough = taskIds.length >= MIN_TASKS && perArm >= MIN_RUNS_PER_ARM;
  if (!enough) {
    return `${facts} The sample is too small to conclude anything: ${taskIds.length} task(s) with ${perArm} run(s) per arm per task (minimum: ${MIN_TASKS} tasks, ${MIN_RUNS_PER_ARM} runs). Treat these numbers as anecdotes.`;
  }
  const hp = p.hiddenCi, hm = m.hiddenCi;
  let line: string;
  if (!hp || !hm || overlap(hp, hm)) line = 'The hidden-check intervals overlap: there is no clear difference at this sample size.';
  else line = m.hiddenPassed / m.hiddenRuns > p.hiddenPassed / p.hiddenRuns ? 'The hidden-check intervals are disjoint: Mugiwara was better at not leaving defects behind.' : 'The hidden-check intervals are disjoint: plain was better at not leaving defects behind.';
  return `${facts} ${line} This is a small fixture suite, not a proof; model variance is not controlled.`;
}

const f = (n: number | null, d = 0) => (n === null ? 'n/a' : n.toFixed(d));
const usd = (n: number | null) => (n === null ? 'n/a' : '$' + n.toFixed(2));
const BUCKETS = ['plain', 'mugiwara', 'not-engaged'] as const;

export function summaryJson(all: RunResult[]) {
  const results = all.filter((r) => !r.invalid);
  const arms = Object.fromEntries(BUCKETS.map((b) => [b, summarize(results.filter((r) => bucket(r) === b))]));
  const ctl = (b: 'plain' | 'mugiwara') => summarize(results.filter((r) => r.control && bucket(r) === b));
  const cp = ctl('plain'), cm = ctl('mugiwara');
  const over = (a: number | null, b: number | null) => (a && b !== null ? (b - a) / a : null);
  return { arms, controlOverhead: { tokens: over(cp.medianTokens, cm.medianTokens), usd: over(cp.medianUsd, cm.medianUsd) } };
}

export function renderMarkdown(all: RunResult[], meta: { cmd: string; runs: number; date: string; config?: string[] }): string {
  const results = all.filter((r) => !r.invalid);
  const tasks = [...new Set(all.map((r) => r.task))];
  const row = (label: string, rs: RunResult[]) => {
    const s = summarize(rs);
    return `| ${label} | ${s.runs} | ${s.accepted}/${s.runs} | ${s.hiddenPassed}/${s.hiddenRuns} (${ci(s.hiddenCi)}) | ${f(s.medianTokens)} | ${f(s.totalTokens)} | ${usd(s.medianUsd)} | ${usd(s.totalUsd)} | ${f(s.medianWallS, 1)} | ${f(s.medianFiles, 1)} |`;
  };
  const head = '| Run set | Runs | Acceptance | Hidden checks (95% CI) | Median tokens | Total tokens | Median USD | Total USD | Median wall (s) | Median files |\n|---|---|---|---|---|---|---|---|---|---|';
  const of = (b: string) => results.filter((r) => bucket(r) === b);
  const lines = [
    'INTERNAL', '', '# Real-model benchmark report', '',
    `Date ${meta.date}. Runs per arm per task: ${meta.runs}. Command: \`${meta.cmd}\`.${meta.config?.length ? ` Mugiwara config overrides: \`${meta.config.join(' ')}\`.` : ''}`, '',
    '## Verdict', '', verdict(all), '',
    '## Before / after (plain vs Mugiwara)', '', head,
    row('plain', of('plain')), row('mugiwara (engaged)', of('mugiwara')),
  ];
  if (of('not-engaged').length) lines.push(row('mugiwara NOT ENGAGED (not a Mugiwara result)', of('not-engaged')));
  const mrs = all.filter((r) => r.arm === 'mugiwara');
  if (mrs.length) {
    const e = (r: RunResult) => r.engagement;
    const types = [...new Set(mrs.flatMap((r) => e(r)?.subagents ?? []))].sort().join(', ') || 'none';
    lines.push('', '## Engagement (Mugiwara arm)', '',
      `- Crew engaged in ${of('mugiwara').length} of ${mrs.length} runs; ${of('not-engaged').length} did not engage.`,
      `- Median subagents spawned per run: ${f(median(mrs.map((r) => e(r)?.subagents.length ?? 0)), 1)}. Types seen: ${types}.`,
      `- Mission report.md written in ${mrs.filter((r) => e(r)?.missionReport).length} runs; review-dispatch.jsonl non-empty in ${mrs.filter((r) => (e(r)?.reviewDispatchLines ?? 0) > 0).length} runs.`);
  }
  const s = summaryJson(all).controlOverhead;
  const pc = (x: number | null) => (x === null ? 'n/a' : `${x >= 0 ? '+' : ''}${(x * 100).toFixed(0)}%`);
  if (results.some((r) => r.control)) lines.push('', '## Overhead on the control task (no trap)', '', `Median tokens ${pc(s.tokens)}, median USD ${pc(s.usd)}, Mugiwara (engaged) vs plain. This is the pure cost of running the crew when there is nothing to catch.`);
  lines.push('', '## Per task', '', head.replace('Run set', 'Task / arm'));
  for (const t of tasks) for (const b of BUCKETS) { const rs = results.filter((r) => r.task === t && bucket(r) === b); if (rs.length) lines.push(row(`${t} / ${b}`, rs)); }
  const errs = all.filter((r) => r.error || r.isError);
  if (errs.length) lines.push('', '## Runs with errors', '', ...errs.map((r) => `- ${r.task} / ${r.arm} / run ${r.run}: ${r.error ?? 'CLI reported an error'}${r.invalid ? ' (invalid: excluded from the tables)' : ''}`));
  lines.push('', 'Tokens and USD are provider-reported by the CLI; "n/a" means the CLI did not report the field. Hidden checks failing means the defect was left behind.', '');
  return lines.join('\n');
}

/** Number of model calls a plan implies: tasks x runs x 2 arms. */
export const plannedCalls = (tasks: number, runs: number, arms = 2) => tasks * runs * arms;

// ---- command line, calibration -------------------------------------------------------------

export type ArmChoice = Arm | 'both';
export type BenchArgs = {
  dry: boolean; resume: boolean; calibrate: boolean; arm: ArmChoice; host: Host;
  runs: number; runOffset: number;   // run ids are runOffset+1 .. runOffset+runs
  tasks?: string[]; tasksFrom?: string; out?: string; promptSuffix?: string; config: string[];
};

/** Parse the benchmark command line. Pure: returns `{ error }` instead of exiting. */
export function parseBenchArgs(argv: string[]): BenchArgs | { error: string } {
  const bad = (m: string) => ({ error: m });
  const val = (n: string): string | undefined | Error => {
    const i = argv.indexOf(n);
    if (i === -1) return undefined;
    const v = argv[i + 1];
    return v === undefined || v.startsWith('--') ? new Error(`${n} needs a value`) : v;
  };
  const get: Record<string, string | undefined> = {};
  for (const n of ['--host', '--arm', '--runs', '--run-offset', '--tasks', '--tasks-from', '--out', '--prompt-suffix']) {
    const v = val(n);
    if (v instanceof Error) return bad(v.message);
    get[n] = v;
  }
  const calibrate = argv.includes('--calibrate');
  const host = (get['--host'] ?? 'claude') as Host;
  if (!['claude', 'codex'].includes(host)) return bad('--host must be claude or codex');
  const arm = (get['--arm'] ?? (calibrate ? 'plain' : 'both')) as ArmChoice;
  if (!['plain', 'mugiwara', 'both'].includes(arm)) return bad('--arm must be plain, mugiwara or both');
  if (calibrate && arm !== 'plain') return bad('--calibrate runs the plain arm only; drop --arm or use --arm plain');
  const runs = Number(get['--runs'] ?? (calibrate ? 3 : 1));
  if (!Number.isInteger(runs) || runs < 1) return bad('--runs must be a positive integer');
  const runOffset = Number(get['--run-offset'] ?? 0);
  if (!Number.isInteger(runOffset) || runOffset < 0) return bad('--run-offset must be a non-negative integer');
  if (get['--tasks'] && get['--tasks-from']) return bad('use --tasks or --tasks-from, not both');
  if (calibrate && get['--tasks-from']) return bad('--calibrate measures tasks; --tasks-from selects tasks from a finished calibration');
  const config: string[] = [];
  argv.forEach((a, i) => { if (a === '--config' && argv[i + 1]) config.push(argv[i + 1]); });
  const badCfg = config.find((c) => !/^[a-z_]+=\S+$/.test(c));
  if (badCfg) return bad(`--config expects key=value (no spaces), got "${badCfg}"`);
  if (config.length && arm === 'plain') return bad('--config only applies to the mugiwara arm');
  return { dry: argv.includes('--dry-run'), resume: argv.includes('--resume'), calibrate, arm, host, runs, runOffset, tasks: get['--tasks']?.split(','), tasksFrom: get['--tasks-from'], out: get['--out'], promptSuffix: get['--prompt-suffix'], config };
}

export const armsOf = (arm: ArmChoice): Arm[] => (arm === 'both' ? ['plain', 'mugiwara'] : [arm]);
export const runIds = (runOffset: number, runs: number): number[] => Array.from({ length: runs }, (_, i) => runOffset + i + 1);

export type CalibrationRow = {
  task: string; runs: number;
  hiddenPassed: number;    // plain runs whose hidden checks passed
  defectLeft: number;      // plain runs that passed the visible tests but failed the hidden checks
  visibleFailed: number;   // plain runs that did not even pass the visible tests (not counted as "defect left behind")
  referenceOk: boolean;    // the local verification (fixture fails, reference passes, naive fails hidden) is clean
  discriminating: boolean; // defectLeft >= 1 and referenceOk
};

/** Per-task calibration from plain-arm runs. Invalid runs are ignored; tasks come from `referenceOk` keys. */
export function calibrate(all: RunResult[], referenceOk: Record<string, boolean>): CalibrationRow[] {
  const plain = all.filter((r) => r.arm === 'plain' && !r.invalid);
  const rows = Object.keys(referenceOk).map((task): CalibrationRow => {
    const rs = plain.filter((r) => r.task === task);
    const defectLeft = rs.filter((r) => r.accepted !== false && r.hiddenOk === false).length;
    return {
      task, runs: rs.length, hiddenPassed: rs.filter((r) => r.hiddenOk === true).length, defectLeft,
      visibleFailed: rs.filter((r) => r.accepted === false).length,
      referenceOk: referenceOk[task], discriminating: defectLeft >= 1 && referenceOk[task],
    };
  });
  return rows.sort((a, b) => Number(b.discriminating) - Number(a.discriminating) || a.hiddenPassed - b.hiddenPassed || a.task.localeCompare(b.task));
}

export const SELECTION_BIAS_NOTE = 'Selection bias: these tasks are picked because the plain agent failed them. Plain will look worse on them than it really is, by construction, so the plain calibration runs must never be reused as the plain arm. Run the two-arm comparison with fresh runs (use --run-offset so run ids do not repeat), and read its plain pass rate as the rate on tasks chosen to be hard for plain, not as plain\'s general rate.';

export const discriminatingTasks = (cal: { tasks?: CalibrationRow[] }): string[] => (cal.tasks ?? []).filter((r) => r.discriminating).map((r) => r.task);

/** True when a comparison's run ids reuse any run id the calibration used. */
export const overlapsCalibration = (cal: { runOffset?: number; runs?: number }, runOffset: number, runs: number): boolean => {
  const used = new Set(runIds(cal.runOffset ?? 0, cal.runs ?? 0));
  return runIds(runOffset, runs).some((r) => used.has(r));
};

export function renderCalibration(rows: CalibrationRow[], meta: { cmd: string; runs: number; runOffset: number; date: string }): string {
  const hit = rows.filter((r) => r.discriminating).length;
  const lines = [
    'INTERNAL', '', '# Benchmark calibration (plain arm only)', '',
    `Date ${meta.date}. Plain runs per task: ${meta.runs} (run ids ${meta.runOffset + 1} to ${meta.runOffset + meta.runs}). Command: \`${meta.cmd}\`.`, '',
    `${hit} of ${rows.length} tasks discriminate: plain left the defect behind in at least one run and the reference solution passes.`, '',
    '| Task | Plain hidden passes | Defect left | Visible failed | Reference ok | Discriminating |', '|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.task} | ${r.hiddenPassed}/${r.runs} | ${r.defectLeft} | ${r.visibleFailed} | ${r.referenceOk ? 'yes' : 'NO'} | ${r.discriminating ? 'yes' : 'no'} |`),
    '', SELECTION_BIAS_NOTE, '',
    'Next: `bun scripts/benchmark-real.ts --tasks-from <this dir>/calibration.json --run-offset ' + (meta.runOffset + meta.runs) + ' --runs 3 --out <new dir>`.', '',
  ];
  return lines.join('\n');
}
