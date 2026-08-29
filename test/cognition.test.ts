// test/cognition.test.ts
// Phase 5 Cognitive & Output Governor — src/cognition.ts unit tests.
// Six verdict capabilities (§51 Phase 5): focused reasoning, investigation
// termination, alternative limitation, output compression, duplicate detection,
// mission-focused output structure — plus recordCognitiveDecision (→ recordOptDecision §41)
import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  isFocusedReasoning,
  shouldTerminateInvestigation,
  limitAlternatives,
  compressOutput,
  detectDuplicateExplanation,
  structureOutput,
  recordCognitiveDecision,
} from '../src/cognition.ts';

describe('isFocusedReasoning — focused reasoning policy (§17)', () => {
  const base = {
    question: 'implement governor',
    evidence_available: true,
    speculative_paths: 0,
    reconsiderations: 0,
    hypothetical_requirements: false,
    unrelated_implementations: 0,
  };

  it('speculative_paths:1 → focused:false, slop_types contains speculative_architecture, reason names it', () => {
    const r = isFocusedReasoning({ ...base, speculative_paths: 1 });
    expect(r.focused).toBe(false);
    expect(r.slop_types).toContain('speculative_architecture');
    expect(r.reason).toContain('speculative_architecture');
  });

  it('reconsiderations:2 → focused:false with repeated_reconsideration', () => {
    const r = isFocusedReasoning({ ...base, reconsiderations: 2 });
    expect(r.focused).toBe(false);
    expect(r.slop_types).toContain('repeated_reconsideration');
    expect(r.reason).toContain('repeated_reconsideration');
  });

  it('reconsiderations:1 → focused:true (below threshold)', () => {
    const r = isFocusedReasoning({ ...base, reconsiderations: 1 });
    expect(r.focused).toBe(true);
    expect(r.slop_types).toEqual([]);
  });

  it('hypothetical_requirements:true → focused:false', () => {
    const r = isFocusedReasoning({ ...base, hypothetical_requirements: true });
    expect(r.focused).toBe(false);
    expect(r.slop_types).toContain('hypothetical_requirements');
    expect(r.reason).toContain('hypothetical_requirements');
  });

  it('unrelated_implementations:1 → focused:false', () => {
    const r = isFocusedReasoning({ ...base, unrelated_implementations: 1 });
    expect(r.focused).toBe(false);
    expect(r.slop_types).toContain('unrelated_implementations');
    expect(r.reason).toContain('unrelated_implementations');
  });

  it('all zero/false + evidence_available:true → focused:true, slop_types:[]', () => {
    const r = isFocusedReasoning(base);
    expect(r.focused).toBe(true);
    expect(r.slop_types).toEqual([]);
    expect(r.reason).toBe('Question→Evidence→Decision→Action — reasoning is focused');
  });

  it('multiple slops → all listed, focused:false', () => {
    const r = isFocusedReasoning({
      ...base,
      speculative_paths: 2,
      reconsiderations: 3,
      hypothetical_requirements: true,
      unrelated_implementations: 1,
    });
    expect(r.focused).toBe(false);
    expect(r.slop_types).toEqual(
      expect.arrayContaining([
        'speculative_architecture',
        'repeated_reconsideration',
        'hypothetical_requirements',
        'unrelated_implementations',
      ]),
    );
    expect(r.slop_types.length).toBe(4);
  });
});

describe('shouldTerminateInvestigation — cognitive investigation termination (§13 re-consumed, §17)', () => {
  const base = {
    acceptance_mapped: false,
    surface_understood: false,
    path_established: false,
    passes: 0,
    max_passes: 2,
    unrelated_files_opened: 0,
    repeated_reads: 0,
    has_concrete_reason: false,
  };

  it('triad all true → terminate:true with triad complete', () => {
    const r = shouldTerminateInvestigation({
      ...base,
      acceptance_mapped: true,
      surface_understood: true,
      path_established: true,
    });
    expect(r.terminate).toBe(true);
    expect(r.reason).toContain('triad complete');
  });

  it('passes:2/max_passes:2 without concrete reason → terminate:true (max passes)', () => {
    const r = shouldTerminateInvestigation({ ...base, passes: 2, max_passes: 2 });
    expect(r.terminate).toBe(true);
    expect(r.reason).toContain('max passes');
  });

  it('same with has_concrete_reason:true → terminate:false', () => {
    const r = shouldTerminateInvestigation({ ...base, passes: 2, max_passes: 2, has_concrete_reason: true });
    expect(r.terminate).toBe(false);
    expect(r.reason).toContain('concrete reason');
  });

  it('unrelated_files_opened:6 → terminate:true', () => {
    const r = shouldTerminateInvestigation({ ...base, unrelated_files_opened: 6 });
    expect(r.terminate).toBe(true);
    expect(r.reason).toMatch(/unrelated/i);
  });

  it('unrelated_files_opened:5 → continue (at boundary)', () => {
    const r = shouldTerminateInvestigation({ ...base, unrelated_files_opened: 5 });
    expect(r.terminate).toBe(false);
  });

  it('repeated_reads:2 → terminate:true', () => {
    const r = shouldTerminateInvestigation({ ...base, repeated_reads: 2 });
    expect(r.terminate).toBe(true);
    expect(r.reason).toMatch(/repeated/i);
  });

  it('repeated_reads:1 → continue', () => {
    const r = shouldTerminateInvestigation({ ...base, repeated_reads: 1 });
    expect(r.terminate).toBe(false);
  });

  it('triad incomplete + under limits + no concrete reason → terminate:false', () => {
    const r = shouldTerminateInvestigation({ ...base, passes: 1, unrelated_files_opened: 2, repeated_reads: 1 });
    expect(r.terminate).toBe(false);
    expect(r.reason).toContain('continue');
  });

  it('triad complete wins even when concrete reason present', () => {
    const r = shouldTerminateInvestigation({
      ...base,
      acceptance_mapped: true,
      surface_understood: true,
      path_established: true,
      has_concrete_reason: true,
      passes: 5,
    });
    expect(r.terminate).toBe(true);
    expect(r.reason).toContain('triad complete');
  });
});

describe('limitAlternatives — alternative limitation (§17)', () => {
  it('5 alternatives, max 3, 2 backed among first 3 → dropped is 2 beyond bound + non-backed within, limited:true', () => {
    const r = limitAlternatives({
      alternatives: ['a', 'b', 'c', 'd', 'e'],
      evidence_backed: [true, true, false, false, false],
      max_alternatives: 3,
    });
    expect(r.limited).toBe(true);
    expect(r.dropped).toContain('c');
    expect(r.dropped).toContain('d');
    expect(r.dropped).toContain('e');
    expect(r.dropped.length).toBe(3);
    expect(r.alternatives).toEqual(['a', 'b']);
    expect(r.reason).toContain('bounded');
  });

  it('2 alternatives within bound all backed → limited:false, dropped:[]', () => {
    const r = limitAlternatives({
      alternatives: ['a', 'b'],
      evidence_backed: [true, true],
      max_alternatives: 3,
    });
    expect(r.limited).toBe(false);
    expect(r.dropped).toEqual([]);
    expect(r.alternatives).toEqual(['a', 'b']);
    expect(r.reason).toContain('within bound');
  });

  it('no backed alternatives → only beyond-bound dropped', () => {
    const r = limitAlternatives({
      alternatives: ['a', 'b', 'c', 'd'],
      evidence_backed: [false, false, false, false],
      max_alternatives: 3,
    });
    expect(r.dropped).toEqual(['d']);
    expect(r.alternatives).toEqual(['a', 'b', 'c']);
  });

  it('all backed within bound → limited:false', () => {
    const r = limitAlternatives({
      alternatives: ['a', 'b', 'c'],
      evidence_backed: [true, true, true],
      max_alternatives: 3,
    });
    expect(r.limited).toBe(false);
    expect(r.dropped).toEqual([]);
  });

  it('defaults max_alternatives to 3 when not provided', () => {
    const r = limitAlternatives({
      alternatives: ['a', 'b', 'c', 'd'],
      evidence_backed: [true, true, true, true],
      max_alternatives: 3,
    });
    expect(r.alternatives.length).toBe(3);
  });
});

describe('compressOutput — output compression (§18)', () => {
  it('output with Decision/Evidence headings + verbose filler 10 lines away → compressed drops filler, saved_chars>0, well_structured:true', () => {
    const output = [
      'Decision: use TS module',
      'line near 1',
      'line near 2',
      'filler 1 far away',
      'filler 2 far away',
      'filler 3 far away',
      'filler 4 far away',
      'filler 5 far away',
      'filler 6 far away',
      'filler 7 far away',
      'filler 8 far away',
      'filler 9 far away',
      'filler 10 far away',
      'Evidence: budget.ts reuse',
      'line near evidence 1',
    ].join('\n');
    const r = compressOutput({ output, essential_sections: ['Decision', 'Evidence'] });
    expect(r.well_structured).toBe(true);
    expect(r.saved_chars).toBeGreaterThan(0);
    expect(r.compressed.length).toBeLessThan(output.length);
    expect(r.compressed).toContain('Decision');
    expect(r.compressed).toContain('Evidence');
    // filler far from headings should be dropped
    expect(r.compressed).not.toContain('filler 5');
  });

  it('output with only one heading → well_structured:false', () => {
    const r = compressOutput({ output: 'Decision: do X\nsome detail', essential_sections: ['Decision'] });
    expect(r.well_structured).toBe(false);
  });

  it('saved_chars = output.length - compressed.length', () => {
    const output = 'Decision: X\nEvidence: Y\nfar filler that is distant\nmore distant\nmore distant\nmore distant\nmore distant\nmore distant\nmore distant\n';
    const r = compressOutput({ output, essential_sections: ['Decision', 'Evidence'] });
    expect(r.saved_chars).toBe(output.length - r.compressed.length);
  });

  it('reason names compression', () => {
    const output = 'Decision: X\nEvidence: Y\nfiller far\nfiller far\nfiller far\nfiller far\nfiller far\nfiller far\nfiller far\nfiller far\n';
    const r = compressOutput({ output, essential_sections: ['Decision', 'Evidence'] });
    expect(r.reason.toLowerCase()).toMatch(/compress/);
  });
});

describe('detectDuplicateExplanation — duplicate explanation detection (§17/§18)', () => {
  it('["fix X","fix X","fix Y"] → duplicate:true, duplicate_groups contains ["fix X","fix X"]', () => {
    const r = detectDuplicateExplanation({ explanations: ['fix X', 'fix X', 'fix Y'] });
    expect(r.duplicate).toBe(true);
    expect(r.duplicate_groups.length).toBe(1);
    expect(r.duplicate_groups[0]).toEqual(['fix X', 'fix X']);
    expect(r.reason).toMatch(/duplicate/i);
  });

  it('all unique → duplicate:false, duplicate_groups:[]', () => {
    const r = detectDuplicateExplanation({ explanations: ['fix X', 'fix Y', 'fix Z'] });
    expect(r.duplicate).toBe(false);
    expect(r.duplicate_groups).toEqual([]);
    expect(r.reason).toContain('no duplicate');
  });

  it('multiple duplicate groups', () => {
    const r = detectDuplicateExplanation({ explanations: ['a', 'a', 'b', 'b', 'c'] });
    expect(r.duplicate).toBe(true);
    expect(r.duplicate_groups.length).toBe(2);
  });

  it('empty explanations → duplicate:false', () => {
    const r = detectDuplicateExplanation({ explanations: [] });
    expect(r.duplicate).toBe(false);
    expect(r.duplicate_groups).toEqual([]);
  });
});

describe('structureOutput — mission-focused output structure (§18)', () => {
  it('has_decision:true, has_evidence:true → well_structured:true', () => {
    const r = structureOutput({
      output: 'Decision done Evidence present',
      has_decision: true,
      has_action: false,
      has_result: false,
      has_evidence: true,
      has_blocker: false,
    });
    expect(r.well_structured).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.reason).toContain('mission-focused');
  });

  it('missing Decision → well_structured:false, missing contains Decision', () => {
    const r = structureOutput({
      output: 'no decision',
      has_decision: false,
      has_action: false,
      has_result: false,
      has_evidence: true,
      has_blocker: false,
    });
    expect(r.well_structured).toBe(false);
    expect(r.missing).toContain('Decision');
    expect(r.reason).toContain('Decision');
  });

  it('missing Evidence → well_structured:false, missing contains Evidence', () => {
    const r = structureOutput({
      output: 'Decision present',
      has_decision: true,
      has_action: false,
      has_result: false,
      has_evidence: false,
      has_blocker: false,
    });
    expect(r.well_structured).toBe(false);
    expect(r.missing).toContain('Evidence');
  });

  it('both Decision and Evidence missing → both listed', () => {
    const r = structureOutput({
      output: 'empty',
      has_decision: false,
      has_action: false,
      has_result: false,
      has_evidence: false,
      has_blocker: false,
    });
    expect(r.missing).toEqual(expect.arrayContaining(['Decision', 'Evidence']));
    expect(r.well_structured).toBe(false);
  });
});

describe('recordCognitiveDecision — decision trail (§41)', () => {
  it('writes a single ## Cost governor decisions bullet with cognitive-governor actor, sanitized', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugiwara-cognition-'));
    recordCognitiveDecision(dir, { decision: 'limit alternatives', reason: 'bounded to 3', evidence: 'E001' });
    const body = readFileSync(join(dir, 'decisions.md'), 'utf8');
    expect(body.split(/\r?\n/).filter((l) => l.trim() === '## Cost governor decisions')).toHaveLength(1);
    const bullets = body.split(/\r?\n/).filter((l) => l.startsWith('- '));
    expect(bullets).toHaveLength(1);
    expect(bullets[0]).toContain('cognitive-governor');
    expect(bullets[0]).toContain('limit alternatives');
    expect(bullets[0]).toContain('reason: bounded to 3');
    expect(bullets[0]).toContain('E001');
  });

  it('sanitizes newline-injected reason (S2 reuse)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugiwara-cognition-'));
    recordCognitiveDecision(dir, { decision: 'compress\n## fake', reason: 'a\r\nb' });
    const body = readFileSync(join(dir, 'decisions.md'), 'utf8');
    const bullets = body.split(/\r?\n/).filter((l) => l.startsWith('- '));
    expect(bullets).toHaveLength(1);
    expect(bullets[0]).not.toContain('\n');
    expect(bullets[0]).not.toContain('\r');
    expect(body.split(/\r?\n/).some((l) => l.trim().startsWith('## fake'))).toBe(false);
  });

  it('creates the mission dir when missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugiwara-cognition-'));
    const nested = join(dir, 'missions', 'demo');
    recordCognitiveDecision(nested, { decision: 'terminate', reason: 'triad complete' });
    expect(existsSync(join(nested, 'decisions.md'))).toBe(true);
  });
});
