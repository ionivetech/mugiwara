// test/slop.test.ts
// Phase 6 Stop-Slop — src/slop.ts unit tests (11 capabilities).
import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  SLOP_TAXONOMY,
  classifySlop,
  detectSlopSignal,
  measureProgress,
  detectAnomaly,
  decideIntervention,
  detectRetrySlop,
  detectHealingSlop,
  detectScopeSlop,
  detectContextSlop,
  detectInvestigationSlop,
  detectCodeSlop,
  recordSlopDecision,
} from '../src/slop.ts';

describe('classifySlop — slop taxonomy (§21)', () => {
  it('repeated file read → context', () => {
    expect(classifySlop('repeated file read')).toBe('context');
  });
  it('same command repeated → retry', () => {
    expect(classifySlop('same command repeated')).toBe('retry');
  });
  it('LOC increases without acceptance → code or scope', () => {
    const k = classifySlop('LOC increases without acceptance');
    expect(['code', 'scope']).toContain(k);
  });
  it('unknown signal → null', () => {
    expect(classifySlop('totally unrelated gibberish xyz')).toBeNull();
  });
  it('SLOP_TAXONOMY has 8 kinds with non-empty descriptions', () => {
    const keys = Object.keys(SLOP_TAXONOMY);
    expect(keys).toHaveLength(8);
    for (const v of Object.values(SLOP_TAXONOMY)) expect(v.length).toBeGreaterThan(10);
  });
  it('repeated read maps to context, healing maps to healing', () => {
    expect(classifySlop('repeated read threshold exceeded')).toBe('context');
    expect(classifySlop('healing cycle with no fixes')).toBe('healing');
  });
});

describe('detectSlopSignal — detection signals (§22)', () => {
  it('count:2 threshold:2 evidence_delta:0 → slop:true', () => {
    const r = detectSlopSignal({ kind: 'context', count: 2, threshold: 2, evidence_delta: 0 });
    expect(r.slop).toBe(true);
    expect(r.reason).toContain('slop: context');
  });
  it('same with evidence_delta:1 → slop:false', () => {
    const r = detectSlopSignal({ kind: 'context', count: 2, threshold: 2, evidence_delta: 1 });
    expect(r.slop).toBe(false);
    expect(r.reason).toContain('no slop');
  });
  it('count:1 threshold:2 → slop:false', () => {
    const r = detectSlopSignal({ kind: 'context', count: 1, threshold: 2 });
    expect(r.slop).toBe(false);
  });
  it('without evidence_delta and over threshold → slop:true', () => {
    const r = detectSlopSignal({ kind: 'retry', count: 3, threshold: 2 });
    expect(r.slop).toBe(true);
  });
});

describe('measureProgress — progress measurement (§23)', () => {
  const before = { tokens_used: 8000, evidence_items: 4, criteria_mapped: 2, files_understood: 3, tests_fixed: 1, code_chars: 1000 };
  it('no evidence/criteria/tests/code gain but +5k tokens → slop_signal:true', () => {
    const after = { tokens_used: 13000, evidence_items: 4, criteria_mapped: 2, files_understood: 3, tests_fixed: 1, code_chars: 1000 };
    const r = measureProgress(before, after);
    expect(r.progress).toBe(0);
    expect(r.cost_delta).toBe(5000);
    expect(r.progress_per_cost).toBe(0);
    expect(r.slop_signal).toBe(true);
    expect(r.reason).toContain('slop');
  });
  it('with +1 evidence → progress:1 slop_signal:false', () => {
    const after = { tokens_used: 13000, evidence_items: 5, criteria_mapped: 2, files_understood: 3, tests_fixed: 1, code_chars: 1000 };
    const r = measureProgress(before, after);
    expect(r.progress).toBe(1);
    expect(r.slop_signal).toBe(false);
    expect(r.cost_delta).toBe(5000);
    expect(r.progress_per_cost).toBe(1 / 5000);
  });
  it('code_chars delta counts as 1 progress even when other deltas 0', () => {
    const after = { tokens_used: 9000, evidence_items: 4, criteria_mapped: 2, files_understood: 3, tests_fixed: 1, code_chars: 1500 };
    const r = measureProgress(before, after);
    expect(r.progress).toBe(1);
    expect(r.slop_signal).toBe(false);
  });
  it('zero cost_delta → progress_per_cost 0, slop false (division safe)', () => {
    const r = measureProgress(before, before);
    expect(r.cost_delta).toBe(0);
    expect(r.progress_per_cost).toBe(0);
    expect(r.slop_signal).toBe(false);
  });
});

describe('detectAnomaly — work-to-cost anomaly (§24)', () => {
  it('progress_per_cost 0.0001 baseline 0.001 drop 0.5 → anomaly:true', () => {
    const r = detectAnomaly({ progress_per_cost: 0.0001, baseline_per_cost: 0.001, drop_threshold: 0.5 });
    expect(r.anomaly).toBe(true);
    expect(r.reason).toMatch(/anomaly/i);
  });
  it('0.0006 vs 0.001 → anomaly:false', () => {
    const r = detectAnomaly({ progress_per_cost: 0.0006, baseline_per_cost: 0.001, drop_threshold: 0.5 });
    expect(r.anomaly).toBe(false);
  });
  it('baseline 0 → anomaly:false (division-by-zero safe)', () => {
    const r = detectAnomaly({ progress_per_cost: 0.0001, baseline_per_cost: 0 });
    expect(r.anomaly).toBe(false);
    expect(r.reason).toContain('no anomaly');
  });
  it('default drop_threshold 0.5', () => {
    const r = detectAnomaly({ progress_per_cost: 0.4, baseline_per_cost: 1 });
    expect(r.anomaly).toBe(true);
  });
});

describe('decideIntervention — intervention rules (§20)', () => {
  it('slop:false → tolerate', () => {
    expect(decideIntervention({ kind: 'retry', slop: false, severity: 'harmful', progress_stalled: false }).intervention).toBe('tolerate');
  });
  it('slop:true harmful → escalate', () => {
    expect(decideIntervention({ kind: 'code', slop: true, severity: 'harmful', progress_stalled: false }).intervention).toBe('escalate');
  });
  it('slop:true wasteful → stop', () => {
    expect(decideIntervention({ kind: 'context', slop: true, severity: 'wasteful', progress_stalled: false }).intervention).toBe('stop');
  });
  it('harmless without stall → tolerate', () => {
    expect(decideIntervention({ kind: 'output', slop: true, severity: 'harmless', progress_stalled: false }).intervention).toBe('tolerate');
  });
  it('harmless with stall → compress', () => {
    expect(decideIntervention({ kind: 'output', slop: true, severity: 'harmless', progress_stalled: true }).intervention).toBe('compress');
  });
});

describe('detectRetrySlop — retry slop (§21.6/§31)', () => {
  it('same action/fingerprint/fail in history → slop:true', () => {
    const r = detectRetrySlop({
      action: 'test',
      evidence_fingerprint: 'abc',
      outcome: 'fail',
      history: [{ action: 'test', evidence_fingerprint: 'abc', outcome: 'fail' }],
    });
    expect(r.slop).toBe(true);
    expect(r.kind).toBe('retry');
    expect(r.reason).toContain('same action');
  });
  it('different fingerprint → slop:false', () => {
    const r = detectRetrySlop({
      action: 'test',
      evidence_fingerprint: 'def',
      outcome: 'fail',
      history: [{ action: 'test', evidence_fingerprint: 'abc', outcome: 'fail' }],
    });
    expect(r.slop).toBe(false);
  });
  it('history empty → slop:false', () => {
    const r = detectRetrySlop({ action: 'test', evidence_fingerprint: 'abc', outcome: 'fail', history: [] });
    expect(r.slop).toBe(false);
  });
  it('outcome pass → slop:false even with history', () => {
    const r = detectRetrySlop({
      action: 'test',
      evidence_fingerprint: 'abc',
      outcome: 'pass',
      history: [{ action: 'test', evidence_fingerprint: 'abc', outcome: 'fail' }],
    });
    expect(r.slop).toBe(false);
  });
});

describe('detectHealingSlop — healing slop (§21.7/§32)', () => {
  it('cycle 3 fixes 0 history [3,1,0] → slop:true', () => {
    const r = detectHealingSlop({ cycle: 3, fixes_in_cycle: 0, history_fixes: [3, 1, 0] });
    expect(r.slop).toBe(true);
    expect(r.kind).toBe('healing');
  });
  it('cycle 1 fixes 3 → slop:false', () => {
    const r = detectHealingSlop({ cycle: 1, fixes_in_cycle: 3, history_fixes: [] });
    expect(r.slop).toBe(false);
  });
  it('cycle 3 fixes 1 → slop:false', () => {
    const r = detectHealingSlop({ cycle: 3, fixes_in_cycle: 1, history_fixes: [3, 1, 0] });
    expect(r.slop).toBe(false);
  });
  it('cycle 3 fixes 0 with no zero history but at max → slop:true (second clause)', () => {
    const r = detectHealingSlop({ cycle: 3, fixes_in_cycle: 0, history_fixes: [1, 1, 1] });
    expect(r.slop).toBe(true);
  });
  it('cycle 2 fixes 0 history no zero and under max → slop:false', () => {
    const r = detectHealingSlop({ cycle: 2, fixes_in_cycle: 0, history_fixes: [1, 2] });
    expect(r.slop).toBe(false);
  });
});

describe('detectScopeSlop — scope slop (§21.8)', () => {
  it('out-of-scope file without acceptance → slop:true', () => {
    const r = detectScopeSlop({
      files_changed: ['src/a.ts', 'src/unrelated.ts'],
      declared_scope: ['src/a.ts'],
      acceptance_expanded: false,
      unrelated_refactors: [],
    });
    expect(r.slop).toBe(true);
    expect(r.kind).toBe('scope');
  });
  it('same with acceptance true → slop:false', () => {
    const r = detectScopeSlop({
      files_changed: ['src/a.ts', 'src/unrelated.ts'],
      declared_scope: ['src/a.ts'],
      acceptance_expanded: true,
      unrelated_refactors: [],
    });
    expect(r.slop).toBe(false);
  });
  it('within scope → slop:false', () => {
    const r = detectScopeSlop({
      files_changed: ['src/a.ts'],
      declared_scope: ['src/a.ts'],
      acceptance_expanded: false,
      unrelated_refactors: [],
    });
    expect(r.slop).toBe(false);
  });
  it('unrelated_refactors triggers slop', () => {
    const r = detectScopeSlop({
      files_changed: ['src/a.ts'],
      declared_scope: ['src/a.ts'],
      acceptance_expanded: false,
      unrelated_refactors: ['src/other.ts'],
    });
    expect(r.slop).toBe(true);
  });
});

describe('detectContextSlop — context slop (§21.2/§12)', () => {
  it('repeated_reads 2 threshold 2 → slop:true', () => {
    const r = detectContextSlop({ repeated_reads: 2, repeated_read_threshold: 2, duplicate_chars: 0, irrelevant_files: [] });
    expect(r.slop).toBe(true);
    expect(r.kind).toBe('context');
  });
  it('duplicate_chars 500 → slop:true', () => {
    const r = detectContextSlop({ repeated_reads: 0, repeated_read_threshold: 2, duplicate_chars: 500, irrelevant_files: [] });
    expect(r.slop).toBe(true);
  });
  it('irrelevant_files triggers', () => {
    const r = detectContextSlop({ repeated_reads: 0, repeated_read_threshold: 2, duplicate_chars: 0, irrelevant_files: ['tmp/foo'] });
    expect(r.slop).toBe(true);
  });
  it('all zero/empty → slop:false', () => {
    const r = detectContextSlop({ repeated_reads: 0, repeated_read_threshold: 2, duplicate_chars: 0, irrelevant_files: [] });
    expect(r.slop).toBe(false);
  });
});

describe('detectInvestigationSlop — investigation slop (§21.1/§13)', () => {
  it('unrelated 6 max 5 without reason → slop:true', () => {
    const r = detectInvestigationSlop({
      unrelated_files_opened: 6,
      max_unrelated_files: 5,
      repeated_reads: 0,
      repeated_read_threshold: 2,
      exploration_passes: 0,
      max_passes: 2,
      acceptance_mapped: true,
      has_concrete_reason: false,
    });
    expect(r.slop).toBe(true);
    expect(r.kind).toBe('investigation');
  });
  it('same with has_concrete_reason true → slop:false', () => {
    const r = detectInvestigationSlop({
      unrelated_files_opened: 6,
      max_unrelated_files: 5,
      repeated_reads: 0,
      repeated_read_threshold: 2,
      exploration_passes: 0,
      max_passes: 2,
      acceptance_mapped: true,
      has_concrete_reason: true,
    });
    expect(r.slop).toBe(false);
  });
  it('exploration_passes 2 max 2 without reason → slop:true', () => {
    const r = detectInvestigationSlop({
      unrelated_files_opened: 0,
      max_unrelated_files: 5,
      repeated_reads: 0,
      repeated_read_threshold: 2,
      exploration_passes: 2,
      max_passes: 2,
      acceptance_mapped: false,
      has_concrete_reason: false,
    });
    expect(r.slop).toBe(true);
  });
  it('repeated_reads triggers', () => {
    const r = detectInvestigationSlop({
      unrelated_files_opened: 0,
      max_unrelated_files: 5,
      repeated_reads: 2,
      repeated_read_threshold: 2,
      exploration_passes: 0,
      max_passes: 2,
      acceptance_mapped: false,
      has_concrete_reason: false,
    });
    expect(r.slop).toBe(true);
  });
});

describe('detectCodeSlop — code slop (§21.5/§15)', () => {
  it('new_abstractions 1 without acceptance/justification → slop:true', () => {
    const r = detectCodeSlop({
      new_abstractions: 1,
      new_dependencies: 0,
      loc_added: 10,
      acceptance_expanded: false,
      justification_provided: false,
      boilerplate_chars: 0,
    });
    expect(r.slop).toBe(true);
    expect(r.kind).toBe('code');
  });
  it('same with justification true → slop:false', () => {
    const r = detectCodeSlop({
      new_abstractions: 1,
      new_dependencies: 0,
      loc_added: 10,
      acceptance_expanded: false,
      justification_provided: true,
      boilerplate_chars: 0,
    });
    expect(r.slop).toBe(false);
  });
  it('acceptance true → slop:false', () => {
    const r = detectCodeSlop({
      new_abstractions: 1,
      new_dependencies: 0,
      loc_added: 10,
      acceptance_expanded: true,
      justification_provided: false,
      boilerplate_chars: 0,
    });
    expect(r.slop).toBe(false);
  });
  it('boilerplate chars triggers', () => {
    const r = detectCodeSlop({
      new_abstractions: 0,
      new_dependencies: 0,
      loc_added: 10,
      acceptance_expanded: false,
      justification_provided: false,
      boilerplate_chars: 500,
    });
    expect(r.slop).toBe(true);
  });
  it('loc_added >100 triggers, ≤100 does not', () => {
    const r1 = detectCodeSlop({ new_abstractions: 0, new_dependencies: 0, loc_added: 101, acceptance_expanded: false, justification_provided: false, boilerplate_chars: 0 });
    const r2 = detectCodeSlop({ new_abstractions: 0, new_dependencies: 0, loc_added: 50, acceptance_expanded: false, justification_provided: false, boilerplate_chars: 0 });
    expect(r1.slop).toBe(true);
    expect(r2.slop).toBe(false);
  });
});

describe('recordSlopDecision — decision trail (§41)', () => {
  it('writes a single ## Cost governor decisions bullet with slop-governor actor, sanitized', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugiwara-slop-'));
    recordSlopDecision(dir, { decision: 'stop retry', reason: 'same action repeatedly failing', kind: 'retry' });
    const body = readFileSync(join(dir, 'decisions.md'), 'utf8');
    expect(body.split(/\r?\n/).filter((l) => l.trim() === '## Cost governor decisions')).toHaveLength(1);
    const bullets = body.split(/\r?\n/).filter((l) => l.startsWith('- '));
    expect(bullets).toHaveLength(1);
    expect(bullets[0]).toContain('slop-governor');
    expect(bullets[0]).toContain('stop retry');
    expect(bullets[0]).toContain('retry');
  });
  it('sanitizes newline-injected reason', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugiwara-slop-'));
    recordSlopDecision(dir, { decision: 'stop\n## fake', reason: 'a\r\nb' });
    const body = readFileSync(join(dir, 'decisions.md'), 'utf8');
    const bullets = body.split(/\r?\n/).filter((l) => l.startsWith('- '));
    expect(bullets).toHaveLength(1);
    expect(bullets[0]).not.toContain('\n');
    expect(bullets[0]).not.toContain('\r');
    expect(body.split(/\r?\n/).some((l) => l.trim().startsWith('## fake'))).toBe(false);
  });
  it('creates missing dir', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugiwara-slop-'));
    const nested = join(dir, 'missions', 'demo');
    recordSlopDecision(nested, { decision: 'compress', reason: 'verbose output' });
    expect(existsSync(join(nested, 'decisions.md'))).toBe(true);
  });
});
