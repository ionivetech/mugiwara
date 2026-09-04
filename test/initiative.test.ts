import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseSubMissions,
  findConflicts,
  splitTouchedFiles,
  runInitiative,
  SUB_MISSIONS_HEADER,
} from '../src/initiative.ts';

const plan = (header: string, rows: string[]): string =>
  `# Plan\n\n## Sub-missions\n\n${header}\n|----|------|----------|--------|--------|-----------|---------------|\n${rows.join('\n')}\n`;

const ROWS = [
  '| S1 | cart api | farid | feat/cart | [ ] | - | src/cart.ts, src/api/shared.ts |',
  '| S2 | payment ui | rina | feat/pay | [ ] | - | src/pay.tsx |',
  '| S3 | docs | rina | feat/docs | [x] | - | docs/guide.md |',
];

function planFile(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-init-'));
  const f = join(dir, 'plan.md');
  writeFileSync(f, body);
  return f;
}

describe('initiative sub-mission parsing (N1)', () => {
  it('1. lowercase header parses 3 sub-missions', () => {
    const { hasSection, rows } = parseSubMissions(
      plan('| id | name | assignee | branch | status | depends on | touched files |', ROWS),
    );
    expect(hasSection).toBe(true);
    expect(rows).toHaveLength(3);
    expect(rows[0].id).toBe('S1');
  });

  it('2. mixed-case header parses 3 sub-missions', () => {
    const { rows } = parseSubMissions(
      plan('| Id | NAME | Assignee | Branch | Status | Depends On | Touched Files |', ROWS),
    );
    expect(rows).toHaveLength(3);
  });

  it('3. comma-separated files leave no trailing commas', () => {
    const { rows } = parseSubMissions(plan(SUB_MISSIONS_HEADER, ROWS));
    expect(rows[0].touchedFiles).toEqual(['src/cart.ts', 'src/api/shared.ts']);
    expect(rows[0].touchedFiles.every((f) => !f.endsWith(','))).toBe(true);
  });

  it('4. two sub-missions sharing a file conflict, naming both IDs', () => {
    const f = planFile(
      plan(SUB_MISSIONS_HEADER, [
        '| S1 | cart api | farid | feat/cart | [ ] | - | src/api/shared.ts |',
        '| S2 | payment ui | rina | feat/pay | [ ] | - | src/api/shared.ts src/pay.tsx |',
      ]),
    );
    try {
      const r = runInitiative('conflict-check', f);
      expect(r.code).toBe(1);
      expect(r.output).toContain('src/api/shared.ts');
      expect(r.output).toContain('S1');
      expect(r.output).toContain('S2');
    } finally {
      rmSync(f, { force: true });
    }
  });

  it('5. no shared files exits 0', () => {
    const { rows } = parseSubMissions(plan(SUB_MISSIONS_HEADER, ROWS));
    expect(findConflicts(rows)).toHaveLength(0);
    const f = planFile(plan(SUB_MISSIONS_HEADER, ROWS));
    try {
      expect(runInitiative('conflict-check', f).code).toBe(0);
    } finally {
      rmSync(f, { force: true });
    }
  });

  it('6. section present but rows malformed exits 1 with the header hint', () => {
    const f = planFile('# Plan\n\n## Sub-missions\n\nno table here, just prose\n');
    try {
      const r = runInitiative('conflict-check', f);
      expect(r.code).toBe(1);
      expect(r.output).toContain(SUB_MISSIONS_HEADER);
      expect(r.output).not.toContain('solo mission');
    } finally {
      rmSync(f, { force: true });
    }
  });

  it('7. no section exits 0 as a solo mission', () => {
    const f = planFile('# Plan\n\n## Tasks\n\n- [ ] something\n');
    try {
      const r = runInitiative('conflict-check', f);
      expect(r.code).toBe(0);
      expect(r.output).toContain('solo mission');
    } finally {
      rmSync(f, { force: true });
    }
  });

  it('status renders the dashboard with blocked-by edges', () => {
    const f = planFile(
      plan(SUB_MISSIONS_HEADER, [
        '| S1 | cart api | farid | feat/cart | [ ] | - | src/cart.ts |',
        '| S2 | payment ui | rina | feat/pay | [ ] | S1 | src/pay.tsx |',
      ]),
    );
    try {
      const r = runInitiative('status', f);
      expect(r.code).toBe(0);
      expect(r.output).toContain('S2');
      expect(r.output).toContain('S1');
    } finally {
      rmSync(f, { force: true });
    }
  });

  it('splitTouchedFiles handles commas and whitespace', () => {
    expect(splitTouchedFiles('a.ts, b.ts  c.ts,')).toEqual(['a.ts', 'b.ts', 'c.ts']);
  });
});
