// test/reporting.test.ts
// Phase 8 Reporting & CLI — src/reporting.ts unit tests.
// Every expectation is a literal value per plan T1 acceptance, not typeof checks.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildCostLedger,
  parseDecisionTrail,
  computeAvoidedMetrics,
  computeEfficiencyMetrics,
  renderCostSection,
  toCostJSON,
  loadCostEvents,
  summarizeAdaptation,
  renderAdaptationSection,
} from '../src/reporting.ts';
import { costEnvelope } from '../src/cost.ts';
import { loadRegistry, persistRegistry } from '../src/evidence.ts';
import { appendCostEvent, recordOptDecision } from '../src/cost.ts';
import { archiveMission } from '../src/mission.ts';

function tmpMission(): string {
  const base = mkdtempSync(join(tmpdir(), 'mugiwara-reporting-'));
  const dir = join(base, '.mugiwara', 'missions', 'test-ledger');
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('buildCostLedger — empty missionDir', () => {
  it('returns empty ledger when no files present', () => {
    const dir = tmpMission();
    const env = costEnvelope({ lane: 'full', tokens_est: 1000 });
    const ledger = buildCostLedger({ missionDir: dir, envelope: env });
    expect(ledger.ledger.events).toEqual([]);
    expect(ledger.ledger.registrySize).toBe(0);
    expect(ledger.trail).toEqual([]);
    expect(ledger.avoided).toEqual({ stages_avoided: 0, contexts_avoided: 0, slop_interventions: 0, tokens_avoided_est: 0 });
    expect(ledger.efficiency.reuse_rate).toBe(0);
    expect(ledger.efficiency.duplicate_avoidance_chars).toBe(0);
  });
});

describe('buildCostLedger — populated', () => {
  it('loads one event + one registry entry + one decision bullet', () => {
    const dir = tmpMission();
    const env = costEnvelope({ lane: 'full', tokens_est: 500 });
    // one cost event
    appendCostEvent(dir, { kind: 'closure', mission: 'test-ledger', tokens_est: 500, budget: 50000, status: 'ok' });
    // one registry entry
    persistRegistry(dir, [{ fingerprint: 'f1', kind: 'file', file: 'a', id: 'E001', reads: 1, ref: 'E001 a', chars: 10 }]);
    // one decision bullet
    recordOptDecision(dir, { actor: 'test', decision: 'did thing', reason: 'because' });
    const ledger = buildCostLedger({ missionDir: dir, envelope: env });
    expect(ledger.ledger.events).toHaveLength(1);
    expect(ledger.ledger.registrySize).toBe(1);
    expect(ledger.trail).toHaveLength(1);
  });
});

describe('parseDecisionTrail', () => {
  it('parses 2 bullets under ## Cost governor decisions', () => {
    const dir = tmpMission();
    writeFileSync(join(dir, 'decisions.md'), '## Cost governor decisions\n\n- 2026-01-01T00:00:00.000Z — alice: decision one — reason: r1\n- 2026-01-01T00:01:00.000Z — bob: decision two — reason: r2 — evidence: ev\n');
    const trail = parseDecisionTrail(dir);
    expect(trail).toHaveLength(2);
    expect(trail[0].actor).toBe('alice');
    expect(trail[1].evidence).toBe('ev');
  });
  it('returns [] when file missing', () => {
    const dir = tmpMission();
    expect(parseDecisionTrail(dir)).toEqual([]);
  });
});

describe('computeAvoidedMetrics', () => {
  it('5 contexts (3 dup +2 repeated), 1 stage, 4 interventions → 750 tokens', () => {
    const a = computeAvoidedMetrics({
      registryMetrics: { duplicateCount: 3, repeatedReads: 2 },
      workMetrics: { stagesAvoided: 1 },
      slopMetrics: { interventions: 4 },
    });
    expect(a).toEqual({ contexts_avoided: 5, stages_avoided: 1, slop_interventions: 4, tokens_avoided_est: 750 });
  });
});

describe('computeEfficiencyMetrics', () => {
  it('10 reads 3 reuse 400 dup 50000 budget 12500 used → reuse 0.3, dup 400, budget 25', () => {
    const e = computeEfficiencyMetrics({ totalReads: 10, reuseHits: 3, duplicateChars: 400, budget: 50000, used: 12500 });
    expect(e).toEqual({ reuse_rate: 0.3, duplicate_avoidance_chars: 400, budget_efficiency_pct: 25 });
  });
  it('zero reads → reuse 0, zero budget → pct 0', () => {
    expect(computeEfficiencyMetrics({ totalReads: 0, reuseHits: 0, duplicateChars: 0, budget: 0, used: 1000 }).reuse_rate).toBe(0);
    expect(computeEfficiencyMetrics({ totalReads: 0, reuseHits: 0, duplicateChars: 0, budget: 0, used: 1000 }).budget_efficiency_pct).toBe(0);
  });
});

describe('renderCostSection', () => {
  it('contains ## Cost and required rows, truncates trail >5', () => {
    const dir = tmpMission();
    const env = costEnvelope({ lane: 'full', tokens_est: 1000 });
    // 6 decisions to trigger truncation
    for (let i = 0; i < 6; i++) recordOptDecision(dir, { actor: `a${i}`, decision: `d${i}`, reason: `r${i}` });
    const ledger = buildCostLedger({ missionDir: dir, envelope: env });
    const s = renderCostSection(ledger);
    expect(s).toContain('## Cost');
    expect(s).toContain('| Budget |');
    expect(s).toContain('| Context |');
    expect(s).toContain('| Avoided |');
    expect(s).toContain('| Efficiency |');
    expect(s).toContain('| Trail |');
    expect(s).toContain('… 1 more');
  });
});

describe('toCostJSON', () => {
  it('round-trips and has required keys', () => {
    const dir = tmpMission();
    const env = costEnvelope({ lane: 'full', tokens_est: 1000 });
    const ledger = buildCostLedger({ missionDir: dir, envelope: env });
    const j = toCostJSON(ledger);
    const p = JSON.parse(j);
    expect(p).toHaveProperty('envelope');
    expect(p).toHaveProperty('ledger');
    expect(p).toHaveProperty('avoided');
    expect(p).toHaveProperty('efficiency');
    expect(p).toHaveProperty('trail');
  });
});

describe('loadCostEvents selective-drop', () => {
  it('file with one valid + one corrupt line → loads 1', () => {
    const dir = tmpMission();
    writeFileSync(join(dir, 'cost-events.jsonl'), JSON.stringify({ mission: 'test-ledger', tokens_est: 1, budget: 100, status: 'ok', kind: 'closure' }) + '\nnot-json\n');
    expect(loadCostEvents(dir)).toHaveLength(1);
  });
});

describe('F2 registry selective-drop', () => {
  it('one corrupt line + two valid entries → loads 2', () => {
    const dir = tmpMission();
    writeFileSync(join(dir, 'context-registry.jsonl'), 'not-json\n' + JSON.stringify({ fingerprint: 'f1', kind: 'file', file: 'a', id: 'E001', reads: 1, ref: 'E001 a' }) + '\n' + JSON.stringify({ fingerprint: 'f2', kind: 'file', file: 'b', id: 'E002', reads: 1, ref: 'E002 b' }) + '\n');
    expect(loadRegistry(dir)).toHaveLength(2);
  });
});

describe('F3 allowlist', () => {
  it('/tmp/evil throws, allowlisted mission does not', () => {
    const env = costEnvelope({ lane: 'full', tokens_est: 1 });
    expect(() => buildCostLedger({ missionDir: '/tmp/evil', envelope: env })).toThrow('Invalid missionDir');
    const dir = tmpMission();
    expect(() => buildCostLedger({ missionDir: dir, envelope: env })).not.toThrow();
  });
});

describe('archive integration — reporting enriches report.md', () => {
  it('temp mission with event+registry+decisions → report contains Avoided/Efficiency/Trail and folds jsonls', () => {
    const base = mkdtempSync(join(tmpdir(), 'mugiwara-reporting-'));
    const projectDir = base;
    const mission = 'test-archive-reporting';
    const dir = join(projectDir, '.mugiwara', 'missions', mission);
    mkdirSync(join(dir, 'flows'), { recursive: true });
    // minimal state.json for archive
    writeFileSync(join(dir, 'state.json'), JSON.stringify({ mission, lane: 'full', tokens_est: 1000, budget: 50000, base_sha: 'unknown', branch: 'feat/test', actor: 'test', updated_at: new Date().toISOString(), tasks_done: 1, tasks_total: 1, evidence: [], sensitive_paths: [] }));
    // required plan.md (artifact gate) and flows evidence
    writeFileSync(join(dir, 'plan.md'), '# plan');
    writeFileSync(join(dir, 'flows', '01-execution.md'), 'evidence');
    // ledger files
    appendCostEvent(dir, { kind: 'closure', mission, tokens_est: 1000, budget: 50000, status: 'ok' });
    persistRegistry(dir, [{ fingerprint: 'f1', kind: 'file', file: 'a', id: 'E001', reads: 2, ref: 'E001 a', chars: 20 }]);
    recordOptDecision(dir, { actor: 'test', decision: 'foo', reason: 'bar' });
    // also add a .mugiwara/config to satisfy lane check? not needed
    const result = archiveMission(projectDir, mission, { dryRun: false });
    const report = readFileSync(join(dir, 'report.md'), 'utf8');
    expect(report).toContain('## Cost');
    expect(report).toContain('Avoided');
    expect(report).toContain('Efficiency');
    expect(report).toContain('Trail');
    expect(report).toContain('## Archived: cost-events.jsonl');
    expect(report).toContain('## Archived: context-registry.jsonl');
    expect(existsSync(join(dir, 'cost-events.jsonl'))).toBe(false);
    expect(existsSync(join(dir, 'context-registry.jsonl'))).toBe(false);
  });
});

describe('summarizeAdaptation / renderAdaptationSection (Phase E)', () => {
  it('returns zero rows when no posture decisions recorded', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-adapt-empty-'));
    const { count, rows } = summarizeAdaptation(dir);
    expect(count).toBe(0);
    expect(rows).toHaveLength(0);
    expect(renderAdaptationSection(dir)).toBe('');
  });

  it('summarizes posture switch rows from the decisions trail', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugi-adapt-'));
    writeFileSync(
      join(dir, 'decisions.md'),
      '## Cost governor decisions\n' +
        '- 2026-08-29T00:00:00Z — AI: luffy: posture switch inline-sequential → parallel-workers — reason: 2 independent tasks per Nami dependency map — evidence: plan.md\n',
    );
    const { count, rows } = summarizeAdaptation(dir);
    expect(count).toBe(1);
    expect(rows[0].decision).toContain('posture switch');
    expect(rows[0].decision).toContain('parallel-workers');
    const section = renderAdaptationSection(dir);
    expect(section).toContain('## Adaptation');
    expect(section).toContain('parallel-workers');
  });
});
