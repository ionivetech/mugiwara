import { describe, it, expect } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyConfig, armsOf, bucket, buildArgs, calibrate, discriminatingTasks, overlapsCalibration, parseBenchArgs, renderCalibration, runIds, SELECTION_BIAS_NOTE, computeEngagement, CREW, isInvalidRun, isRateLimited, median, parseCliOutput, plannedCalls, renderMarkdown, runKey, summarize, summaryJson, totalTokens, verdict, wilson, type RunResult } from '../scripts/benchmark-lib.ts';
import { loadTasks, verifyTask } from '../scripts/benchmark-real.ts';

const result = (usage: object, extra: object = {}) => JSON.stringify({ type: 'result', is_error: false, total_cost_usd: 0.02, result: 'done', usage, ...extra });
const U = { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100, cache_creation_input_tokens: 20 };
const tool = (name: string, input: object = {}) => JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name, input }] } });

describe('parseCliOutput', () => {
  it('reads usage and counts tool_use blocks from stream-json', () => {
    const out = [
      JSON.stringify({ type: 'system', subtype: 'init' }),
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'x' }, { type: 'tool_use', name: 'Read' }, { type: 'tool_use', name: 'Edit' }] } }),
      'not json',
      result(U),
    ].join('\n');
    const p = parseCliOutput(out);
    expect(p.usage).toEqual({ input: 10, output: 5, cacheRead: 100, cacheCreate: 20 });
    expect(p.toolCalls).toBe(2);
    expect(p.costUsd).toBe(0.02);
    expect(p.isError).toBe(false);
    expect(totalTokens(p.usage)).toBe(135);
  });
  it('reads a single JSON result object; tool calls unavailable', () => {
    const p = parseCliOutput(result(U));
    expect(p.usage?.output).toBe(5);
    expect(p.toolCalls).toBeNull();
  });
  it('reads a JSON array of events', () => {
    const p = parseCliOutput(`[${tool('Read')},${result(U)}]`);
    expect(p.toolCalls).toBe(1);
    expect(p.usage?.input).toBe(10);
  });
  it('reads Codex JSONL usage, tools, subagent calls and final text', () => {
    const out = [
      JSON.stringify({ type: 'item.completed', item: { type: 'collab_tool_call', tool: 'spawn_agent', arguments: { agent_type: 'jinbe-security' } } }),
      JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'RBAC checks complete.' } }),
      JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 21195, cached_input_tokens: 11648, cache_write_input_tokens: 0, output_tokens: 5 } }),
    ].join('\n');
    const p = parseCliOutput(out, 'codex');
    expect(p.usage).toEqual({ input: 9547, output: 5, cacheRead: 11648, cacheCreate: 0 });
    expect(p.toolCalls).toBe(1);
    expect(p.subagents).toEqual(['jinbe-security']);
    expect(p.resultText).toBe('RBAC checks complete.');
    expect(p.isError).toBe(false);
    expect(totalTokens(p.usage)).toBe(21200);
  });
  it('flags empty or garbage output as an error with null usage', () => {
    const p = parseCliOutput('boom');
    expect(p.isError).toBe(true);
    expect(p.usage).toBeNull();
    expect(parseCliOutput(result(U, { is_error: true })).isError).toBe(true);
  });
});

describe('engagement and subagents', () => {
  const none = { missionReport: false, reviewDispatchLines: 0 };
  it('collects Skill names, subagent types and subagent_stats', () => {
    const p = parseCliOutput([tool('Skill', { skill: 'mugiwara' }), tool('Task', { subagent_type: 'robin-reviewer' }), tool('Agent', { subagent_type: 'general-purpose' }), tool('Agent', {}), result(U, { subagent_stats: { count: 3 } })].join('\n'));
    expect(p.skills).toEqual(['mugiwara']);
    expect(p.subagents).toEqual(['robin-reviewer', 'general-purpose', 'unspecified']);
    expect(p.subagentStats).toEqual({ count: 3 });
    const e = computeEngagement(p, none);
    expect(e.engaged).toBe(true);
    expect(e.crewSubagents).toEqual(['robin-reviewer']);
  });
  it('engages on a mugiwara-prefixed skill alone, or a crew subagent alone', () => {
    expect(computeEngagement(parseCliOutput([tool('Skill', { skill: 'mugiwara:mugiwara-review' }), result(U)].join('\n')), none).engaged).toBe(true);
    expect(computeEngagement(parseCliOutput([tool('Task', { subagent_type: 'mugiwara:zoro-execution' }), result(U)].join('\n')), none).engaged).toBe(true);
  });
  it('a plain run, an unrelated skill and a non-crew subagent are not engagement', () => {
    const p = parseCliOutput([tool('Skill', { skill: 'ponytail' }), tool('Task', { subagent_type: 'Explore' }), result(U)].join('\n'));
    expect(computeEngagement(p, none).engaged).toBe(false);
    expect(computeEngagement(p, { missionReport: true, reviewDispatchLines: 2 }).engaged).toBe(true);
  });
  it('CREW names match content/agents', () => {
    const dir = join(import.meta.dirname, '..', 'content', 'agents');
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) expect(CREW).toContain(f.replace(/\.md$/, ''));
  });
});

describe('rate limits and resume keys', () => {
  it('detects limit / 429 errors only when the CLI reports an error', () => {
    const lim = (text: string, isErr = true) => isRateLimited(parseCliOutput(result(U, { is_error: isErr, result: text })));
    expect(lim('5-hour session limit reached')).toBe(true);
    expect(lim('API Error: 429 rate_limit_error')).toBe(true);
    expect(lim('Claude AI usage limit reached', false)).toBe(false);
    expect(lim('some other failure')).toBe(false);
    expect(isRateLimited(parseCliOutput('boom'), '429 Too Many Requests')).toBe(true);
  });
  it('the resume key separates task, arm, run and config', () => {
    const k = runKey('t', 'mugiwara', 1, ['a=1', 'b=2']);
    expect(runKey('t', 'mugiwara', 1, ['b=2', 'a=1'])).toBe(k);
    expect(runKey('t', 'mugiwara', 1, ['a=1'])).not.toBe(k);
    expect(runKey('t', 'plain', 1)).not.toBe(runKey('t', 'mugiwara', 1));
    expect(runKey('t', 'plain', 2)).not.toBe(runKey('t', 'plain', 1));
    expect(runKey('t', 'plain', 1, [], 'codex')).not.toBe(runKey('t', 'plain', 1));
  });
  it('applyConfig replaces existing keys and appends new ones', () => {
    const out = applyConfig('mode=guided\nverbosity=normal\n', ['mode=auto', 'independent_review=off']);
    expect(out).toBe('mode=auto\nverbosity=normal\nindependent_review=off\n');
  });
});

describe('wilson intervals', () => {
  it('matches known values and handles the edges', () => {
    const w = wilson(5, 10)!;
    expect(w.lo).toBeCloseTo(0.237, 2);
    expect(w.hi).toBeCloseTo(0.763, 2);
    expect(wilson(0, 15)!.hi).toBeCloseTo(0.204, 2);
    expect(wilson(15, 15)!.lo).toBeCloseTo(0.796, 2);
    expect(wilson(0, 0)).toBeNull();
  });
});

const mk = (task: string, arm: 'plain' | 'mugiwara', run: number, ok: boolean, out: number, extra: Partial<RunResult> = {}): RunResult => ({
  task, arm, run, accepted: true, ok, hiddenOk: ok, wallMs: 2000, filesChanged: ['a'], usage: { input: 100, output: out, cacheRead: 0, cacheCreate: 0 }, toolCalls: 4, costUsd: 0.1, isError: false, resultText: '', skills: [], subagents: [], subagentStats: null,
  engagement: arm === 'mugiwara' ? { engaged: true, skills: ['mugiwara'], subagents: ['robin-reviewer'], crewSubagents: ['robin-reviewer'], subagentStats: null, missionReport: true, reviewDispatchLines: 1 } : undefined,
  ...extra,
});
const suite = (plainOk: (t: number, r: number) => boolean, mugOk: (t: number, r: number) => boolean, tasks = 5, runs = 3) => {
  const rs: RunResult[] = [];
  for (let t = 0; t < tasks; t++) for (let r = 1; r <= runs; r++) { rs.push(mk('t' + t, 'plain', r, plainOk(t, r), 100)); rs.push(mk('t' + t, 'mugiwara', r, mugOk(t, r), 100)); }
  return rs;
};

describe('report logic', () => {
  it('median handles even/odd/empty', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });
  it('summarize computes pass, hidden, token and USD medians and totals', () => {
    const s = summarize([mk('t', 'plain', 1, true, 10), mk('t', 'plain', 2, false, 30)]);
    expect(s.passed).toBe(1);
    expect(s.hiddenPassed).toBe(1);
    expect(s.medianTokens).toBe(120);
    expect(s.totalTokens).toBe(240);
    expect(s.totalUsd).toBeCloseTo(0.2);
    expect(s.hiddenCi!.hi).toBeGreaterThan(0.5);
  });
  it('verdict says too small for a tiny sample', () => {
    expect(verdict([mk('t', 'plain', 1, true, 10), mk('t', 'mugiwara', 1, true, 20)])).toContain('too small to conclude');
  });
  it('a disjoint-looking but tiny sample never says better', () => {
    const v = verdict(suite(() => false, () => true, 2, 2));
    expect(v).toContain('too small');
    expect(v).not.toMatch(/better|saves/);
  });
  it('overlapping intervals say no clear difference, never better/saves', () => {
    const v = verdict(suite((t) => t < 3, (t) => t < 4));
    expect(v).toContain('no clear difference at this sample size');
    expect(v).not.toMatch(/better|saves/);
  });
  it('disjoint intervals with 5 tasks x 3 runs per arm may say better', () => {
    const v = verdict(suite(() => false, () => true));
    expect(v).not.toContain('too small');
    expect(v).toContain('Mugiwara was better');
    expect(v).toContain('not a proof');
  });
  it('not-engaged Mugiwara runs are counted separately, never as Mugiwara', () => {
    const ne = mk('t', 'mugiwara', 2, true, 10, { engagement: { engaged: false, skills: [], subagents: [], crewSubagents: [], subagentStats: null, missionReport: false, reviewDispatchLines: 0 } });
    expect(bucket(ne)).toBe('not-engaged');
    expect(bucket(mk('t', 'mugiwara', 2, true, 10, { engagement: undefined }))).toBe('not-engaged');
    const rs = [mk('t', 'plain', 1, true, 10), mk('t', 'mugiwara', 1, true, 20), ne];
    expect(verdict(rs)).toContain('1 Mugiwara run(s) did NOT engage');
    const md = renderMarkdown(rs, { cmd: 'x', runs: 1, date: '2026-01-01' });
    expect(md).toContain('| mugiwara (engaged) | 1 |');
    expect(md).toContain('| mugiwara NOT ENGAGED (not a Mugiwara result) | 1 |');
    expect(verdict([mk('t', 'plain', 1, true, 10), ne])).toContain('No verdict');
  });
  it('markdown carries the label, intervals, engagement and control overhead', () => {
    const rs = [mk('c', 'plain', 1, true, 100, { control: true }), mk('c', 'mugiwara', 1, true, 200, { control: true })];
    const md = renderMarkdown(rs, { cmd: 'x', runs: 1, date: '2026-01-01', config: ['independent_review=off'] });
    expect(md.startsWith('INTERNAL')).toBe(true);
    expect(md).toContain('95% CI');
    expect(md).toContain('## Engagement (Mugiwara arm)');
    expect(md).toContain('independent_review=off');
    expect(md).toContain('Median tokens +50%');
    expect(summaryJson(rs).controlOverhead.tokens).toBeCloseTo(0.5);
  });
  it('plans tasks x runs x arms calls', () => { expect(plannedCalls(6, 3)).toBe(36); expect(plannedCalls(22, 3, 1)).toBe(66); });
});

describe('task suite', () => {
  const tasks = loadTasks();
  it('ships 22 well-formed tasks with a trap note, hidden checks and exactly one control', () => {
    expect(tasks.map((t) => t.id).sort()).toEqual(['add-months', 'api-token', 'control-unique', 'csv-rows', 'download-path', 'login-lockout', 'login-redirect', 'merge-blocks', 'merge-config', 'order-total', 'pay-order', 'rate-limit', 'refund-payment', 'reset-token', 'role-assign', 'role-check', 'search-query', 'signup-email', 'slug-migration', 'split-bill', 'stock-reserve', 'tenant-notes']);
    for (const t of tasks) { expect(Object.keys(t.hidden ?? {}).length).toBeGreaterThan(0); expect(t.trap.length).toBeGreaterThan(20); }
    expect(tasks.filter((t) => t.control).map((t) => t.id)).toEqual(['control-unique']);
  });
  it('prompts do not hint at the trap', () => {
    for (const t of tasks) expect(t.prompt).not.toMatch(/secur|traversal|inject|expire|expiry|single.use|sanitiz|malicious|attack|prototype/i);
  });
  it('the trap note is for maintainers: it never appears in the prompt or the fixture files', () => {
    for (const t of tasks) {
      const shown = t.prompt + '\n' + Object.values(t.files).join('\n');
      expect(shown).not.toContain(t.trap);
      expect(shown).not.toMatch(/\btrap\b/i);
      expect(Object.keys(t.files).join('\n')).not.toMatch(/trap/i);
    }
  });
  it('the model never sees reference solutions: they live outside tasks/ and out of the fixtures', () => {
    const ref = join(import.meta.dirname, '..', 'evals', 'benchmark', 'reference');
    for (const t of tasks) {
      for (const kind of ['reference', 'naive']) for (const f of readdirSync(join(ref, t.id, kind), { recursive: true, withFileTypes: true }).filter((e) => e.isFile())) {
        const fixture = Object.values(t.files).join('\n');
        for (const l of readFileSync(join(f.parentPath, f.name), 'utf8').split('\n').map((x) => x.trim()).filter((x) => x.length > 25 && !fixture.includes(x))) expect(JSON.stringify(t.prompt + fixture)).not.toContain(l);
      }
    }
  });
  for (const t of loadTasks()) {
    it(`${t.id}: fixture fails, reference passes everything, naive passes visible but fails hidden`, () => {
      expect(verifyTask(t)).toEqual([]);
    }, 120_000);
  }
});

describe('argument order and invalid runs', () => {
  it('puts the prompt after `--` so a variadic --allowedTools cannot swallow it', () => {
    const pre = ['-p', '--allowedTools', 'Bash,Edit'];
    for (const arm of ['plain', 'mugiwara'] as const) expect(buildArgs(pre, arm, 'fix the bug').slice(-2)[0]).toBe('--');
    expect(buildArgs(pre, 'plain', 'fix the bug').slice(-1)).toEqual(['fix the bug']);
  });
  it('both arms use identical flags; only the Mugiwara prompt is a /mugiwara command', () => {
    const pre = ['-p', '--allowedTools', 'Bash,Skill'];
    expect(buildArgs(pre, 'mugiwara', 'do x').slice(0, -1)).toEqual(buildArgs(pre, 'plain', 'do x').slice(0, -1));
    expect(buildArgs(pre, 'mugiwara', 'do x').slice(-1)).toEqual(['/mugiwara do x']);
    expect(buildArgs(pre, 'mugiwara', 'x')).not.toContain('--plugin-dir');
  });
  it('Codex requests name the installed skill explicitly', () => {
    expect(buildArgs([], 'mugiwara', 'do x', '', 'codex').at(-1)).toBe('$mugiwara-orchestration\n\ndo x');
    expect(buildArgs([], 'plain', 'do x', '', 'codex').at(-1)).toBe('do x');
  });
  it('appends the same optional prompt suffix to either arm', () => {
    const suffix = 'Treat each implied edge case as part of the request.';
    expect(buildArgs([], 'plain', 'do x', suffix).at(-1)).toBe(`do x\n\n${suffix}`);
    expect(buildArgs([], 'mugiwara', 'do x', suffix).at(-1)).toBe(`/mugiwara do x\n\n${suffix}`);
  });
  it('a run that errored without usage is invalid and excluded from the verdict', () => {
    expect(isInvalidRun('exit 1', null)).toBe(true);
    expect(isInvalidRun('exit 1', { input: 1, output: 1, cacheRead: 0, cacheCreate: 0 })).toBe(false);
    expect(isInvalidRun(undefined, null)).toBe(false);
    const bad: RunResult = { ...mk('t', 'plain', 1, false, 0), error: 'exit 1', usage: null, invalid: true };
    const text = verdict([bad, mk('t', 'mugiwara', 1, true, 10)]);
    expect(text).toContain('1 run(s) failed before doing any work');
    expect(text).toContain('No verdict');
  });
});

describe('command line flags', () => {
  const ok = (...a: string[]) => parseBenchArgs(a) as Exclude<ReturnType<typeof parseBenchArgs>, { error: string }>;
  const err = (...a: string[]) => (parseBenchArgs(a) as { error: string }).error;
  it('defaults: both arms, 1 run, no offset', () => {
    const a = ok();
    expect([a.arm, a.runs, a.runOffset, a.calibrate]).toEqual(['both', 1, 0, false]);
    expect(armsOf(a.arm)).toEqual(['plain', 'mugiwara']);
    expect(armsOf('plain')).toEqual(['plain']);
  });
  it('--arm picks one arm and rejects anything else', () => {
    expect(ok('--arm', 'plain').arm).toBe('plain');
    expect(ok('--arm', 'mugiwara', '--config', 'a=b').config).toEqual(['a=b']);
    expect(err('--arm', 'both2')).toContain('--arm');
    expect(err('--arm')).toContain('needs a value');
    expect(err('--arm', 'plain', '--config', 'a=b')).toContain('mugiwara arm');
  });
  it('--host selects Claude or Codex and rejects unknown hosts', () => {
    expect(ok('--host', 'codex').host).toBe('codex');
    expect(ok().host).toBe('claude');
    expect(err('--host', 'cursor')).toContain('--host');
  });
  it('--calibrate means plain only with 3 runs unless --runs says otherwise', () => {
    const a = ok('--calibrate');
    expect([a.arm, a.runs]).toEqual(['plain', 3]);
    expect(ok('--calibrate', '--runs', '5').runs).toBe(5);
    expect(err('--calibrate', '--arm', 'both')).toContain('plain arm only');
    expect(err('--calibrate', '--tasks-from', 'c.json')).toContain('--tasks-from');
  });
  it('--run-offset starts run ids at N+1 and validates', () => {
    expect(runIds(0, 3)).toEqual([1, 2, 3]);
    expect(runIds(3, 3)).toEqual([4, 5, 6]);
    expect(ok('--run-offset', '3').runOffset).toBe(3);
    expect(err('--run-offset', '-1')).toContain('non-negative');
    expect(err('--run-offset', '1.5')).toContain('non-negative');
    expect(err('--runs', '0')).toContain('positive');
  });
  it('offset run ids keep resume keys distinct from calibration run ids', () => {
    const cal = new Set(runIds(0, 3).map((r) => runKey('t', 'plain', r)));
    for (const r of runIds(3, 3)) expect(cal.has(runKey('t', 'plain', r))).toBe(false);
  });
  it('--tasks and --tasks-from are exclusive', () => {
    expect(ok('--tasks', 'a,b').tasks).toEqual(['a', 'b']);
    expect(ok('--tasks-from', 'cal.json').tasksFrom).toBe('cal.json');
    expect(err('--tasks', 'a', '--tasks-from', 'c.json')).toContain('not both');
  });
  it('accepts a prompt suffix for matched prompt experiments', () => {
    expect(ok('--prompt-suffix', 'same wording').promptSuffix).toBe('same wording');
    expect(err('--prompt-suffix')).toContain('needs a value');
  });
});

describe('calibration', () => {
  const rows = (...rs: RunResult[]) => calibrate(rs, { a: true, b: true, c: true, d: false });
  const plain = (task: string, run: number, accepted: boolean, hiddenOk: boolean | null, extra: Partial<RunResult> = {}) => mk(task, 'plain', run, accepted && hiddenOk === true, 10, { accepted, hiddenOk, ...extra });
  const rs = [
    plain('a', 1, true, true), plain('a', 2, true, false), plain('a', 3, true, true),      // defect once: discriminating
    plain('b', 1, true, true), plain('b', 2, true, true), plain('b', 3, true, true),       // never: too easy
    plain('c', 1, false, false), plain('c', 2, false, false),                              // broke the visible tests: not "defect left behind"
    plain('d', 1, true, false),                                                            // defect, but the reference is unsound
    plain('a', 4, true, false, { invalid: true }),                                         // invalid runs are ignored
    mk('a', 'mugiwara', 1, false, 10),                                                     // other arms are ignored
  ];
  it('counts hidden passes per task and flags discriminating ones, sorted first', () => {
    const out = rows(...rs);
    expect(out.map((r) => r.task)).toEqual(['a', 'c', 'd', 'b']);
    expect(out[0]).toEqual({ task: 'a', runs: 3, hiddenPassed: 2, defectLeft: 1, visibleFailed: 0, referenceOk: true, discriminating: true });
    expect(out.find((r) => r.task === 'b')).toMatchObject({ hiddenPassed: 3, defectLeft: 0, discriminating: false });
    expect(out.find((r) => r.task === 'c')).toMatchObject({ visibleFailed: 2, defectLeft: 0, discriminating: false });
    expect(out.find((r) => r.task === 'd')).toMatchObject({ defectLeft: 1, referenceOk: false, discriminating: false });
  });
  it('a task with no runs is listed but never discriminating', () => {
    expect(calibrate([], { a: true })[0]).toMatchObject({ runs: 0, hiddenPassed: 0, discriminating: false });
  });
  it('--tasks-from takes only the discriminating tasks', () => {
    expect(discriminatingTasks({ tasks: rows(...rs) })).toEqual(['a']);
    expect(discriminatingTasks({})).toEqual([]);
  });
  it('refuses a comparison that reuses calibration run ids', () => {
    const cal = { runOffset: 0, runs: 3 };
    expect(overlapsCalibration(cal, 0, 3)).toBe(true);
    expect(overlapsCalibration(cal, 2, 3)).toBe(true);
    expect(overlapsCalibration(cal, 3, 3)).toBe(false);
  });
  it('the markdown puts discriminating tasks first and carries the selection-bias note and next step', () => {
    const md = renderCalibration(rows(...rs), { cmd: 'x', runs: 3, runOffset: 0, date: '2026-01-01' });
    expect(md.startsWith('INTERNAL')).toBe(true);
    expect(md).toContain('1 of 4 tasks discriminate');
    expect(md.indexOf('| a |')).toBeLessThan(md.indexOf('| b |'));
    expect(md).toContain('| a | 2/3 | 1 | 0 | yes | yes |');
    expect(md).toContain(SELECTION_BIAS_NOTE);
    expect(md).toContain('--run-offset 3');
  });
  it('the selection-bias note says the calibration runs must not be reused and the comparison needs fresh runs', () => {
    expect(SELECTION_BIAS_NOTE).toMatch(/picked because the plain agent failed/);
    expect(SELECTION_BIAS_NOTE).toMatch(/must never be reused as the plain arm/);
    expect(SELECTION_BIAS_NOTE).toMatch(/fresh runs/);
  });
  it('a plain-only result set renders without crashing and reaches no verdict', () => {
    const md = renderMarkdown([plain('a', 1, true, true)], { cmd: 'x', runs: 1, date: '2026-01-01' });
    expect(md).toContain('No verdict');
  });
});

// ---- in-process CLI, driven by a fake host command (no model, no network) ----
import { afterAll, beforeAll, spyOn } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { main } from '../scripts/benchmark-real.ts';

describe('loadTasks / verifyTask edge cases', () => {
  const dirs: string[] = [];
  const tmp = () => { const d = mkdtempSync(join(tmpdir(), 'mugi-bench-tasks-')); dirs.push(d); return d; };
  afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
  const task = { id: 't', title: 'T', prompt: 'p', accept: 'true', trap: 'x', files: { 'a.txt': 'a' } };
  it('rejects a task missing a required string', () => {
    const d = tmp();
    writeFileSync(join(d, 'bad.json'), JSON.stringify({ ...task, prompt: '' }));
    expect(() => loadTasks(d)).toThrow('bad.json: missing prompt');
  });
  it('rejects a task with no fixture files', () => {
    const d = tmp();
    writeFileSync(join(d, 'bad.json'), JSON.stringify({ ...task, files: {} }));
    expect(() => loadTasks(d)).toThrow('files empty');
  });
  it('loads valid tasks sorted by file name and ignores non-json', () => {
    const d = tmp();
    writeFileSync(join(d, 'b.json'), JSON.stringify({ ...task, id: 'b' }));
    writeFileSync(join(d, 'a.json'), JSON.stringify({ ...task, id: 'a' }));
    writeFileSync(join(d, 'notes.txt'), 'ignored');
    expect(loadTasks(d).map((t) => t.id)).toEqual(['a', 'b']);
  });
  it('verifyTask reports a task with no reference or naive solution', () => {
    expect(verifyTask({ ...task, id: 'no-such-reference' })).toEqual(['no-such-reference: missing reference or naive solution']);
  });
});

describe('benchmark-real main with a fake host', () => {
  const work = mkdtempSync(join(tmpdir(), 'mugi-bench-main-'));
  const fake = join(work, 'fake-host.sh');
  const naive = join(process.cwd(), 'evals', 'benchmark', 'reference', 'add-months', 'naive');
  const saved = { cmd: process.env.MUGIWARA_EVAL_CMD };
  let logs: string[] = [], errs: string[] = [];
  let logSpy: ReturnType<typeof spyOn>, errSpy: ReturnType<typeof spyOn>;
  const sandbox = () => join(work, `out-${Math.random().toString(36).slice(2)}`);
  const run = async (mode: string, ...argv: string[]) => {
    process.env.MUGIWARA_EVAL_CMD = `sh ${fake} ${mode} ${naive}`;
    logs = []; errs = [];
    const code = await main(argv);
    return { code, out: logs.join('\n'), err: errs.join('\n') };
  };
  beforeAll(() => {
    // Prints stream-json like the real CLI; argv[1] picks the behaviour, argv[2] is the files to copy in.
    writeFileSync(fake, `#!/bin/sh
case "$1" in
  limit) echo '{"type":"result","is_error":true,"result":"usage limit reached","usage":{"input_tokens":1,"output_tokens":1}}'; exit 1 ;;
  crash) exit 2 ;;
  edit) echo x > note.txt ;;
  solve) cp -R "$2"/. . ;;
esac
echo '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Skill","input":{"skill":"mugiwara"}},{"type":"tool_use","name":"Edit"}]}}'
echo '{"type":"result","is_error":false,"total_cost_usd":0.01,"result":"done","usage":{"input_tokens":10,"output_tokens":5,"cache_read_input_tokens":0,"cache_creation_input_tokens":0}}'
`);
    logSpy = spyOn(console, 'log').mockImplementation((...a: unknown[]) => { logs.push(a.join(' ')); });
    errSpy = spyOn(console, 'error').mockImplementation((...a: unknown[]) => { errs.push(a.join(' ')); });
  });
  afterAll(() => {
    logSpy.mockRestore(); errSpy.mockRestore();
    if (saved.cmd === undefined) delete process.env.MUGIWARA_EVAL_CMD; else process.env.MUGIWARA_EVAL_CMD = saved.cmd;
    rmSync(work, { recursive: true, force: true });
  });

  it('rejects bad arguments', async () => {
    const r = await run('ok', '--arm', 'nope');
    expect(r.code).toBe(1);
    expect(r.err).toContain('--arm must be');
  });
  it('--dry-run verifies tasks and makes no run', async () => {
    const r = await run('ok', '--dry-run', '--tasks', 'add-months');
    expect(r.code).toBe(0);
    expect(r.out).toContain('task verification ok: 1 tasks');
    expect(r.out).toContain('dry run: no model calls made');
  });
  it('rejects an unknown task id', async () => {
    const r = await run('ok', '--tasks', 'nope', '--out', sandbox());
    expect(r.code).toBe(1);
    expect(r.err).toContain('unknown task(s)');
  });
  it('plain arm records a run, writes the report, and refuses to overwrite without --resume', async () => {
    const out = sandbox();
    const r = await run('edit', '--tasks', 'add-months', '--arm', 'plain', '--out', out);
    expect(r.code).toBe(0);
    expect(r.out).toContain('fail add-months plain #1');
    const row = JSON.parse(readFileSync(join(out, 'runs.jsonl'), 'utf8').trim());
    expect(row).toMatchObject({ task: 'add-months', arm: 'plain', accepted: false, filesChanged: ['note.txt'], toolCalls: 2 });
    expect(existsSync(join(out, 'benchmark.json'))).toBe(true);
    expect(existsSync(join(out, 'benchmark.md'))).toBe(true);
    const again = await run('edit', '--tasks', 'add-months', '--arm', 'plain', '--out', out);
    expect(again.code).toBe(1);
    expect(again.err).toContain('Pass --resume');
    const resumed = await run('edit', '--tasks', 'add-months', '--arm', 'plain', '--out', out, '--resume');
    expect(resumed.code).toBe(0);
    expect(resumed.out).toContain('skip (already recorded) add-months plain #1');
  }, 30_000);
  it('a non-zero host exit is recorded as an error', async () => {
    const out = sandbox();
    await run('crash', '--tasks', 'add-months', '--arm', 'plain', '--out', out);
    expect(JSON.parse(readFileSync(join(out, 'runs.jsonl'), 'utf8').trim()).error).toBe('exit 2');
  }, 30_000);
  it('mugiwara arm installs into the fixture and records engagement', async () => {
    const out = sandbox();
    const r = await run('ok', '--tasks', 'add-months', '--arm', 'mugiwara', '--config', 'coverage=85', '--prompt-suffix', 'be brief', '--out', out);
    expect(r.code).toBe(0);
    expect(r.out).toContain('mugiwara arm: project install + mode=auto + coverage=85');
    const row = JSON.parse(readFileSync(join(out, 'runs.jsonl'), 'utf8').trim());
    expect(row.arm).toBe('mugiwara');
    expect(row.config).toEqual(['coverage=85']);
    expect(row.engagement).toBeTruthy();
  }, 60_000);
  it('rate limit stops with exit 3, records nothing, and still writes the report', async () => {
    const out = sandbox();
    const r = await run('limit', '--tasks', 'add-months', '--arm', 'plain', '--out', out);
    expect(r.code).toBe(3);
    expect(r.err).toContain('rate/session limit reached');
    expect(existsSync(join(out, 'runs.jsonl'))).toBe(false);
    expect(existsSync(join(out, 'benchmark.json'))).toBe(true);
  }, 30_000);
  it('--calibrate then --tasks-from flows through, and guards its error paths', async () => {
    const cal = sandbox();
    const c = await run('solve', '--calibrate', '--tasks', 'add-months', '--runs', '1', '--out', cal);
    expect(c.code).toBe(0);
    expect(c.out).toContain('calibration (plain arm only)');
    const calFile = join(cal, 'calibration.json');
    expect(JSON.parse(readFileSync(calFile, 'utf8')).discriminating).toEqual(['add-months']);
    expect(existsSync(join(cal, 'calibration.md'))).toBe(true);

    const reuse = await run('solve', '--tasks-from', calFile, '--runs', '1', '--out', sandbox());
    expect(reuse.code).toBe(1);
    expect(reuse.err).toContain('reuse calibration run ids');

    const cmp = sandbox();
    const ok = await run('solve', '--tasks-from', calFile, '--run-offset', '1', '--runs', '1', '--arm', 'plain', '--out', cmp);
    expect(ok.code).toBe(0);
    expect(ok.out).toContain('run ids 2..2');
    expect(ok.out).toContain('wrote');

    const missing = await run('ok', '--tasks-from', join(work, 'nope.json'), '--out', sandbox());
    expect(missing.code).toBe(1);
    expect(missing.err).toContain('cannot read');

    const none = join(work, 'none.json');
    writeFileSync(none, JSON.stringify({ tasks: [] }));
    const empty = await run('ok', '--tasks-from', none, '--out', sandbox());
    expect(empty.code).toBe(1);
    expect(empty.err).toContain('no discriminating tasks');
  }, 60_000);
});
