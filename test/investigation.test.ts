// test/investigation.test.ts
// Phase 2 Context Governor — src/investigation.ts unit tests.
// Bounded investigation state machine (spec §13): max passes, max unrelated
// files, repeated-read threshold, plus an objective-met stop. Emits stop
// verdicts as optimization decision records (reuses sanitized recordOptDecision).
import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluateInvestigation, recordInvestigationStop } from '../src/investigation.ts';

const base = {
  acceptance_mapped: false,
  surface_understood: false,
  path_established: false,
  unrelated_files_opened: 0,
  repeated_reads: 0,
  max_passes: 2,
  max_unrelated_files: 5,
  repeated_read_threshold: 2,
};

describe('evaluateInvestigation — stop conditions (objective-met wins)', () => {
  it('objective-met stops even before any limit', () => {
    const s = evaluateInvestigation({ ...base, pass: 1, acceptance_mapped: true, surface_understood: true, path_established: true });
    expect(s.stop).toBe(true);
    expect(s.reason).toBe('objective met');
  });

  it('pass at max_passes boundary → stop max passes', () => {
    const s = evaluateInvestigation({ ...base, pass: 2 });
    expect(s.stop).toBe(true);
    expect(s.reason).toBe('max passes');
  });

  it('pass below max_passes → continue', () => {
    const s = evaluateInvestigation({ ...base, pass: 1 });
    expect(s.stop).toBe(false);
    expect(s.reason).toBe('');
  });

  it('unrelated files over the cap → stop max unrelated files; at cap → continue', () => {
    const over = evaluateInvestigation({ ...base, pass: 1, unrelated_files_opened: 6 });
    expect(over.stop).toBe(true);
    expect(over.reason).toBe('max unrelated files');
    const at = evaluateInvestigation({ ...base, pass: 1, unrelated_files_opened: 5 });
    expect(at.stop).toBe(false);
  });

  it('repeated reads at threshold → stop repeated read; below → continue', () => {
    const at = evaluateInvestigation({ ...base, pass: 1, repeated_reads: 2 });
    expect(at.stop).toBe(true);
    expect(at.reason).toBe('repeated read');
    const below = evaluateInvestigation({ ...base, pass: 1, repeated_reads: 1 });
    expect(below.stop).toBe(false);
  });

  it('objective-met wins over concurrent limit conditions', () => {
    const s = evaluateInvestigation({
      ...base,
      pass: 2,
      unrelated_files_opened: 9,
      repeated_reads: 5,
      acceptance_mapped: true,
      surface_understood: true,
      path_established: true,
    });
    expect(s.reason).toBe('objective met');
  });
});

describe('recordInvestigationStop', () => {
  it('writes a single ## Cost governor decisions bullet with the reason', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugiwara-investigation-'));
    recordInvestigationStop(dir, { pass: 2, stop: true, reason: 'max passes' }, 'E004 src/a.ts');
    const body = readFileSync(join(dir, 'decisions.md'), 'utf8');
    expect(body.split(/\r?\n/).filter((l) => l.trim() === '## Cost governor decisions')).toHaveLength(1);
    const bullets = body.split(/\r?\n/).filter((l) => l.startsWith('- '));
    expect(bullets).toHaveLength(1);
    expect(bullets[0]).toContain('cost-governor');
    expect(bullets[0]).toContain('stop investigation');
    expect(bullets[0]).toContain('reason: max passes');
    expect(bullets[0]).toContain('E004 src/a.ts');
  });

  it('records nothing when status.stop is false', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugiwara-investigation-'));
    recordInvestigationStop(dir, { pass: 1, stop: false, reason: '' });
    expect(existsSync(join(dir, 'decisions.md'))).toBe(false);
  });

  it('creates the mission dir when missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mugiwara-investigation-'));
    const nested = join(dir, 'missions', 'demo');
    recordInvestigationStop(nested, { pass: 2, stop: true, reason: 'objective met' });
    expect(existsSync(join(nested, 'decisions.md'))).toBe(true);
  });
});
