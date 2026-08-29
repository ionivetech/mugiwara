import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkMissionArtifacts } from '../src/check-artifacts.ts';

function mission(dir: string, name: string, lane: string): string {
  const mdir = join(dir, '.mugiwara', 'missions', name);
  mkdirSync(join(mdir, 'flows'), { recursive: true });
  writeFileSync(join(mdir, 'state.json'), JSON.stringify({ mission: name, lane }));
  return mdir;
}

describe('checkMissionArtifacts', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'mugi-art-')) + '/proj'; mkdirSync(dir, { recursive: true }); });
  afterEach(() => { rmSync(join(dir, '..'), { recursive: true, force: true }); });

  it('lane 0/1 missions pass without plan.md (audit-lite)', () => {
    const mdir = mission(dir, 'm0', 'direct');
    const r = checkMissionArtifacts(mdir);
    expect(r.ok).toBe(true);
  });

  it('lane 2+ mission with plan.md + flows evidence passes', () => {
    const mdir = mission(dir, 'm2', 'standard');
    writeFileSync(join(mdir, 'plan.md'), '# plan\n');
    writeFileSync(join(mdir, 'flows', '01-execution.md'), '# executed\n');
    const r = checkMissionArtifacts(mdir);
    expect(r.ok).toBe(true);
  });

  it('lane 2+ mission missing plan.md fails', () => {
    const mdir = mission(dir, 'm2', 'standard');
    writeFileSync(join(mdir, 'flows', '01-execution.md'), '# executed\n');
    const r = checkMissionArtifacts(mdir);
    expect(r.ok).toBe(false);
    expect(r.missing).toContain('plan.md');
  });

  it('lane 2+ mission missing flows evidence fails', () => {
    const mdir = mission(dir, 'm3', 'full');
    writeFileSync(join(mdir, 'plan.md'), '# plan\n');
    const r = checkMissionArtifacts(mdir);
    expect(r.ok).toBe(false);
    expect(r.missing.some(m => m.includes('flows'))).toBe(true);
  });

  it('archived mission (report.md, no state.json) passes — nothing to check', () => {
    const mdir = mission(dir, 'done', 'standard');
    writeFileSync(join(mdir, 'report.md'), '# report\n');
    // archive removes state.json + flows
    rmSync(join(mdir, 'state.json'));
    rmSync(join(mdir, 'flows'), { recursive: true });
    const r = checkMissionArtifacts(mdir);
    expect(r.ok).toBe(true);
  });
});
