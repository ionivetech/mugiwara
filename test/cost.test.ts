// test/cost.test.ts
// Phase 1 Cost Governor Foundation — src/cost.ts unit tests.
// Every expectation is a literal value asserted against scripts/lib/lane-base.sh
// and scripts/savepoint.sh math (D5 single source of truth), never a truthy
// typeof check.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, mkdtempSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  budgetForLane,
  laneBaseForLane,
  warnAt,
  stopAt,
  budgetStatus,
  delegateAt,
  costEnvelope,
  appendCostEvent,
  recordOptDecision,
} from '../src/cost.ts';

describe('budgetForLane', () => {
  it('returns the lane-base.sh BUDGET constants per lane', () => {
    expect(budgetForLane('lean')).toBe(12000);
    expect(budgetForLane('standard')).toBe(25000);
    expect(budgetForLane('full')).toBe(50000);
    expect(budgetForLane('spike')).toBe(3000);
  });
  it('returns 0 for unknown lanes and direct', () => {
    expect(budgetForLane('direct')).toBe(0);
    expect(budgetForLane('mystery')).toBe(0);
  });
});

describe('laneBaseForLane', () => {
  it('returns the lane-base.sh LANE_BASE constants per lane', () => {
    expect(laneBaseForLane('lean')).toBe(8421);
    expect(laneBaseForLane('standard')).toBe(13325);
    expect(laneBaseForLane('full')).toBe(22016);
    expect(laneBaseForLane('spike')).toBe(5411);
  });
  it('returns 0 for unknown lanes', () => {
    expect(laneBaseForLane('direct')).toBe(0);
    expect(laneBaseForLane('mystery')).toBe(0);
  });
});

describe('thresholds — savepoint.sh math (BUDGET*3/2, BUDGET*3)', () => {
  it('warnAt is integer-division BUDGET*3/2 for every lane budget', () => {
    expect(warnAt(12000)).toBe(18000);
    expect(warnAt(25000)).toBe(37500);
    expect(warnAt(50000)).toBe(75000);
    expect(warnAt(3000)).toBe(4500);
  });
  it('stopAt is BUDGET*3 for every lane budget', () => {
    expect(stopAt(12000)).toBe(36000);
    expect(stopAt(25000)).toBe(75000);
    expect(stopAt(50000)).toBe(150000);
    expect(stopAt(3000)).toBe(9000);
  });
});

describe('budgetStatus — savepoint.sh gate', () => {
  it('is ok below warn', () => {
    expect(budgetStatus(12000, 0)).toBe('ok');
    expect(budgetStatus(12000, 17999)).toBe('ok');
  });
  it('is warn from warnAt to just under stopAt', () => {
    expect(budgetStatus(12000, 18000)).toBe('warn');
    expect(budgetStatus(12000, 35999)).toBe('warn');
  });
  it('is stop at and above stopAt', () => {
    expect(budgetStatus(12000, 36000)).toBe('stop');
    expect(budgetStatus(12000, 999999)).toBe('stop');
  });
  it('is ok when budget is 0 (unknown lane) regardless of tokens', () => {
    expect(budgetStatus(0, 999999)).toBe('ok');
  });
});

describe('delegateAt — savepoint.sh DELEGATE_AT math', () => {
  it('is integer-division BUDGET*threshold/100', () => {
    expect(delegateAt(12000, 60)).toBe(7200);
    expect(delegateAt(25000, 60)).toBe(15000);
    expect(delegateAt(50000, 80)).toBe(40000);
    expect(delegateAt(3000, 60)).toBe(1800);
  });

  it('clamps thresholdPct to [1,100] before division (P1 — matches savepoint.sh clamp)', () => {
    // 0 → clamped to 1: BUDGET*1/100
    expect(delegateAt(12000, 0)).toBe(delegateAt(12000, 1));
    expect(delegateAt(12000, 0)).toBe(120);
    // >100 → clamped to 100: BUDGET*100/100
    expect(delegateAt(12000, 150)).toBe(delegateAt(12000, 100));
    expect(delegateAt(12000, 150)).toBe(12000);
    // mid-range unchanged
    expect(delegateAt(12000, 60)).toBe(7200);
  });
});

describe('costEnvelope', () => {
  it('computes the normalized envelope from stored primitives', () => {
    const env = costEnvelope({ lane: 'standard', budget: 25000, tokens_est: 14200 });
    expect(env).toEqual({
      planned: 25000,
      used: 14200,
      remaining: 10800,
      pct: 57,
      warn_at: 37500,
      stop_at: 75000,
      status: 'ok',
    });
  });
  it('floors remaining at 0', () => {
    expect(costEnvelope({ lane: 'lean', budget: 12000, tokens_est: 50000 }).remaining).toBe(0);
  });
  it('rounds pct to the nearest integer', () => {
    expect(costEnvelope({ lane: 'lean', budget: 12000, tokens_est: 3000 }).pct).toBe(25);
  });
  it('degrades cleanly when budget is 0', () => {
    const env = costEnvelope({ lane: 'direct', budget: 0, tokens_est: 5000 });
    expect(env).toEqual({
      planned: 0,
      used: 5000,
      remaining: 0,
      pct: 0,
      warn_at: 0,
      stop_at: 0,
      status: 'ok',
    });
  });
});

// Cross-source parity (D5): cost.ts constants MUST equal lane-base.sh — the
// shell side is the runtime source of truth (savepoint.sh reads it) and the
// TS side is the reader (mission.ts archive). A drift between the two would
// silently split budget verdicts between savepoint and archive.
const LANE_BASE_SRC = readFileSync(join(import.meta.dirname, '..', 'scripts', 'lib', 'lane-base.sh'), 'utf8');
const LANES = ['lean', 'standard', 'full', 'spike'] as const;

function shellConstant(pat: string, lane: string): number {
  const m = LANE_BASE_SRC.match(new RegExp(`${pat}_${lane}=(\\d+)`));
  return m ? parseInt(m[1], 10) : -1;
}

describe('parity with scripts/lib/lane-base.sh (D5)', () => {
  for (const lane of LANES) {
    it(`BUDGET_${lane} matches lane-base.sh`, () => {
      expect(budgetForLane(lane)).toBe(shellConstant('BUDGET', lane));
    });
    it(`LANE_BASE_${lane} matches lane-base.sh`, () => {
      expect(laneBaseForLane(lane)).toBe(shellConstant('LANE_BASE', lane));
    });
  }
});

// Gate-math parity with scripts/savepoint.sh (Robin review, Flow 7 — High):
// the constants test above only locks VALUES from lane-base.sh; it does not
// lock the warn/stop/delegate FORMULAS. If savepoint.sh's gate math changes,
// cost.ts must follow or archive and savepoint split their verdicts. Evaluate
// the formulas read from savepoint.sh through bash (the exact arithmetic the
// shell runtime uses) and assert cost.ts reproduces it per lane budget.
import { execFileSync } from 'node:child_process';
const SAVEPOINT_SRC = readFileSync(join(import.meta.dirname, '..', 'scripts', 'savepoint.sh'), 'utf8');

function savepointFormula(name: string): string {
  // parse `WARN_AT=$(( BUDGET * 3 / 2 ))` by line prefix — no regex escaping,
  // immune to paren-counting. Content = everything between `$((` and `))`.
  const line = SAVEPOINT_SRC.split(/\r?\n/).find((l) => l.trim().startsWith(`${name}=$((`));
  if (!line) throw new Error(`savepoint.sh formula ${name} not found`);
  const start = line.indexOf('$') + 3; // past `$((`
  const end = line.indexOf('))'); // before both closing parens
  return line.slice(start, end).trim();
}

function bashEval(expr: string): number {
  return parseInt(execFileSync('bash', ['-c', `echo $(( ${expr} ))`], { encoding: 'utf8' }).trim(), 10);
}

describe('gate-math parity with scripts/savepoint.sh (D5, Flow 7 fix)', () => {
  it('warnAt matches savepoint.sh WARN_AT formula evaluated per lane budget', () => {
    const f = savepointFormula('WARN_AT');
    expect(f).toContain('BUDGET'); // guard: we are testing the real formula, not a stub
    for (const lane of LANES) {
      const b = budgetForLane(lane);
      expect(warnAt(b)).toBe(bashEval(f.replace('BUDGET', String(b))));
    }
  });
  it('stopAt matches savepoint.sh STOP_AT formula evaluated per lane budget', () => {
    const f = savepointFormula('STOP_AT');
    for (const lane of LANES) {
      const b = budgetForLane(lane);
      expect(stopAt(b)).toBe(bashEval(f.replace('BUDGET', String(b))));
    }
  });
  it('delegateAt matches savepoint.sh DELEGATE_AT formula evaluated per lane budget + threshold', () => {
    const f = savepointFormula('DELEGATE_AT');
    expect(f).toContain('DELEGATE_THRESHOLD');
    for (const lane of LANES) {
      const b = budgetForLane(lane);
      expect(delegateAt(b, 60)).toBe(bashEval(f.replace('BUDGET', String(b)).replace('DELEGATE_THRESHOLD', '60')));
    }
  });
  it('budgetStatus matches savepoint.sh branch order (stop wins over warn)', () => {
    // savepoint: tokens >= STOP_AT → stop (checked first); then >= WARN_AT → warn; else ok
    expect(budgetStatus(12000, 36000)).toBe('stop');
    expect(budgetStatus(12000, 35999)).toBe('warn');
    expect(budgetStatus(12000, 18000)).toBe('warn');
    expect(budgetStatus(12000, 17999)).toBe('ok');
  });
});

describe('appendCostEvent — append-only JSONL', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mugiwara-cost-event-'));
  });

  it('creates the file on first write and appends on the second', () => {
    appendCostEvent(dir, { kind: 'closure', mission: 'demo', tokens_est: 100, budget: 12000, status: 'ok' });
    appendCostEvent(dir, { kind: 'savepoint', mission: 'demo', tokens_est: 200, budget: 12000, status: 'ok' });
    const lines = readFileSync(join(dir, 'cost-events.jsonl'), 'utf8').trim().split(/\r?\n/);
    expect(lines).toHaveLength(2);
    const [a, b] = lines.map((l) => JSON.parse(l) as { kind: string; mission: string; tokens_est: number; budget: number; status: string; ts: string });
    expect(a).toMatchObject({ kind: 'closure', mission: 'demo', tokens_est: 100, budget: 12000, status: 'ok' });
    expect(b).toMatchObject({ kind: 'savepoint', mission: 'demo', tokens_est: 200, budget: 12000, status: 'ok' });
    expect(a.ts).toBeTruthy();
  });

  it('creates the mission dir when missing', () => {
    const nested = join(dir, 'missions', 'demo');
    appendCostEvent(nested, { kind: 'closure', mission: 'demo', tokens_est: 0, budget: 0, status: 'ok' });
    expect(existsSync(join(nested, 'cost-events.jsonl'))).toBe(true);
  });

  it('does not rewrite or reorder earlier lines on append', () => {
    appendCostEvent(dir, { kind: 'closure', mission: 'demo', tokens_est: 10, budget: 12000, status: 'ok' });
    appendCostEvent(dir, { kind: 'closure', mission: 'demo', tokens_est: 20, budget: 12000, status: 'ok' });
    const lines = readFileSync(join(dir, 'cost-events.jsonl'), 'utf8').trim().split(/\r?\n/);
    expect(JSON.parse(lines[0]).tokens_est).toBe(10);
    expect(JSON.parse(lines[1]).tokens_est).toBe(20);
  });
});

describe('recordOptDecision — decisions.md section append', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mugiwara-opt-decision-'));
  });

  it('creates section header + bullet on a fresh file', () => {
    recordOptDecision(dir, { actor: 'AI: test', decision: 'skip brainstorm', reason: 'spec explicit' });
    const body = readFileSync(join(dir, 'decisions.md'), 'utf8');
    const lines = body.split(/\r?\n/);
    expect(lines.filter((l) => l.trim() === '## Cost governor decisions')).toHaveLength(1);
    expect(lines.some((l) => l.includes('- ') && l.includes('skip brainstorm') && l.includes('reason: spec explicit'))).toBe(true);
  });

  it('appends a second bullet without duplicating the header', () => {
    recordOptDecision(dir, { actor: 'AI: test', decision: 'skip brainstorm', reason: 'spec explicit' });
    recordOptDecision(dir, { actor: 'AI: test', decision: 'reuse E014', reason: 'already inspected', evidence: 'E014' });
    const body = readFileSync(join(dir, 'decisions.md'), 'utf8');
    expect(body.split(/\r?\n/).filter((l) => l.trim() === '## Cost governor decisions')).toHaveLength(1);
    expect(body).toContain('reuse E014');
    expect(body).toContain('evidence: E014');
  });

  it('leaves existing sections untouched and appends at the end', () => {
    writeFileSync(join(dir, 'decisions.md'), '# demo — decision log\n\n## Flow 0 — Triage\n\n- row\n');
    recordOptDecision(dir, { actor: 'AI: test', decision: 'stop healing', reason: 'no progress' });
    const body = readFileSync(join(dir, 'decisions.md'), 'utf8');
    expect(body).toContain('# demo — decision log');
    expect(body).toContain('## Flow 0 — Triage');
    expect(body.split(/\r?\n/).filter((l) => l.trim() === '## Cost governor decisions')).toHaveLength(1);
    expect(body.trimEnd().endsWith('reason: no progress')).toBe(true);
  });

  it('creates the mission dir when missing', () => {
    const nested = join(dir, 'missions', 'demo');
    recordOptDecision(nested, { actor: 'AI: test', decision: 'x', reason: 'y' });
    expect(existsSync(join(nested, 'decisions.md'))).toBe(true);
  });

  it('strips newlines from flat fields — no markdown/line injection (S2)', () => {
    recordOptDecision(dir, {
      actor: 'AI: test\n- injected actor',
      decision: 'stop\n## fake section',
      reason: 'x\ry',
      evidence: 'E001\n* injected',
    });
    const body = readFileSync(join(dir, 'decisions.md'), 'utf8');
    // exactly one bullet line — no injected blank/header lines
    const bullets = body.split(/\r?\n/).filter((l) => l.startsWith('- '));
    expect(bullets).toHaveLength(1);
    expect(bullets[0]).not.toContain('\n');
    expect(bullets[0]).not.toContain('\r');
    // no injected header line — `## fake section` is flattened inline, never a standalone heading
    expect(body.split(/\r?\n/).some((l) => l.trim().startsWith('## fake section'))).toBe(false);
    expect(body.split(/\r?\n/).some((l) => l.startsWith('- injected'))).toBe(false);
    expect(body.split(/\r?\n/).some((l) => l.startsWith('* injected'))).toBe(false);
    expect(bullets[0]).toContain('reason: x y');
  });
});
