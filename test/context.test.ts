// test/context.test.ts
// Phase 2 Context Governor — src/context.ts unit tests.
// Context accounting measures trail chars (not tokens — savepoint.sh measures
// tokens only), estimates chars→tokens, gates on context_budget_chars, and
// computes context-efficiency metrics. measureContextChars must REUSE the
// existing budget.ts implementation — never re-implemented.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { measureContextChars as budgetMeasureContextChars } from '../src/budget.ts';
import {
  measureContextChars,
  estContextTokens,
  contextStatus,
  computeContextMetrics,
} from '../src/context.ts';

describe('measureContextChars — reuse proof', () => {
  it('equals budget.measureContextChars for a temp trail (single implementation)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugiwara-context-'));
    mkdirSync(join(dir, 'flows'), { recursive: true });
    writeFileSync(join(dir, 'plan.md'), 'a'.repeat(100));
    writeFileSync(join(dir, 'flows', '01.md'), 'b'.repeat(50));
    writeFileSync(join(dir, 'report.md'), 'c'.repeat(30));
    expect(measureContextChars(dir)).toBe(budgetMeasureContextChars(dir));
  });
});

describe('estContextTokens', () => {
  it('estimates chars→tokens at 1 token / 4 chars, rounded', () => {
    expect(estContextTokens(120000)).toBe(30000);
    expect(estContextTokens(0)).toBe(0);
    expect(estContextTokens(3)).toBe(1);
    expect(estContextTokens(7)).toBe(2);
  });
});

describe('contextStatus — context budget gate (chars, not tokens)', () => {
  it('is over when chars > budgetChars', () => {
    expect(contextStatus(100, 101)).toBe('over');
    expect(contextStatus(100, 500)).toBe('over');
  });
  it('is ok at or under budgetChars', () => {
    expect(contextStatus(100, 100)).toBe('ok');
    expect(contextStatus(100, 0)).toBe('ok');
  });
  it('is ok when budget is 0 (no budget configured)', () => {
    expect(contextStatus(0, 999999)).toBe('ok');
  });
});

describe('computeContextMetrics', () => {
  it('computes reuse_rate, duplicate_chars, and read_avoidance_chars', () => {
    const m = computeContextMetrics({
      files_loaded: 3,
      reads_total: 4,
      reads_reused: 2,
      unique_chars: 600,
      total_chars: 1000,
      repeated_reads: 2,
    });
    expect(m.files_loaded).toBe(3);
    expect(m.repeated_reads).toBe(2);
    expect(m.reuse_rate).toBe(0.5); // 2/4
    expect(m.duplicate_chars).toBe(400); // total − unique
    expect(m.read_avoidance_chars).toBe(400); // = duplicate_chars
  });
  it('duplicate_chars and read_avoidance are zero when unique equals total', () => {
    const m = computeContextMetrics({
      files_loaded: 1,
      reads_total: 1,
      reads_reused: 0,
      unique_chars: 100,
      total_chars: 100,
      repeated_reads: 0,
    });
    expect(m.duplicate_chars).toBe(0);
    expect(m.read_avoidance_chars).toBe(0);
    expect(m.reuse_rate).toBe(0);
  });
  it('returns reuse_rate 0 (no NaN/Infinity) when reads_total is 0', () => {
    const m = computeContextMetrics({
      files_loaded: 0,
      reads_total: 0,
      reads_reused: 0,
      unique_chars: 0,
      total_chars: 0,
      repeated_reads: 0,
    });
    expect(m.reuse_rate).toBe(0);
    expect(Number.isNaN(m.reuse_rate)).toBe(false);
    expect(Number.isFinite(m.reuse_rate)).toBe(true);
  });
});
