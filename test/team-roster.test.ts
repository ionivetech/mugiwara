// test/team-roster.test.ts — 18 cases covering roster, closure, state integrity (Parts 1-3)
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync, execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { rosterSize, rosterAssignees, closureBlockers, readMemberStates } from '../src/mission.ts';
import { knownMembers } from '../src/continue.ts';

function mkTmp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mugiwara-team-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'a@b.c'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: dir });
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(join(dir, 'src', 'a.ts'), 'x');
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-qm', 'i'], { cwd: dir });
  return dir;
}

function writePlan(dir: string, mission: string, rows: string): void {
  mkdirSync(join(dir, '.mugiwara', 'missions', mission), { recursive: true });
  writeFileSync(join(dir, '.mugiwara', 'missions', mission, 'plan.md'), rows);
}

function savepoint(dir: string, mission: string, member: string, flow: number) {
  const script = join(process.cwd(), 'scripts', 'savepoint.sh');
  execFileSync('bash', [script, mission, member, String(flow), 'guided'], { cwd: dir, encoding: 'utf8' });
}

describe('team-roster', () => {
  let dir: string;
  beforeEach(() => { dir = mkTmp(); });
  afterEach(() => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });

  it('1: plan with 3 assignees -> rosterSize 3', () => {
    writePlan(dir, 'm', `## Sub-missions\n| ID | Name | Assignee | Branch | Status | Depends On | Touched Files |\n|----|------|----------|--------|--------|-----------|---------------|\n| S1 | api | jane-doe | feat/a | [ ] | - | src/a.ts |\n| S2 | web | john-smith | feat/b | [ ] | - | src/b.ts |\n| S3 | ops | eleanor-vance | feat/c | [ ] | - | src/c.ts |\n`);
    expect(rosterSize(join(dir, '.mugiwara', 'missions', 'm'))).toBe(3);
    expect(rosterAssignees(join(dir, '.mugiwara', 'missions', 'm')).sort()).toEqual(['eleanor-vance', 'jane-doe', 'john-smith'].sort());
  });

  it('2: no plan.md -> rosterSize 1', () => {
    mkdirSync(join(dir, '.mugiwara', 'missions', 'solo'), { recursive: true });
    expect(rosterSize(join(dir, '.mugiwara', 'missions', 'solo'))).toBe(1);
    expect(rosterAssignees(join(dir, '.mugiwara', 'missions', 'solo'))).toEqual([]);
  });

  it('3: lowercase header parsed same as uppercase', () => {
    writePlan(dir, 'm', `## sub-missions\n| id | name | assignee | branch | status | depends on | touched files |\n|---|---|---|---|---|---|---|\n| S1 | api | jane-doe | feat/a | [ ] | - | src/a.ts |\n| S2 | web | john-smith | feat/b | [ ] | - | src/b.ts |\n`);
    expect(rosterSize(join(dir, '.mugiwara', 'missions', 'm'))).toBe(2);
  });

  it('4: active-member cache set -> savepoint writes <member>.json', { timeout: 120000 }, () => {
    mkdirSync(join(dir, '.mugiwara'), { recursive: true });
    writeFileSync(join(dir, '.mugiwara', 'active-member'), 'jane-doe\n');
    const script = join(process.cwd(), 'scripts', 'savepoint.sh');
    execFileSync('bash', [script, 'm', '', '1'], { cwd: dir });
    expect(existsSync(join(dir, '.mugiwara', 'missions', 'm', 'jane-doe.json'))).toBe(true);
    expect(existsSync(join(dir, '.mugiwara', 'missions', 'm', 'continue-jane-doe.json'))).toBe(true);
  });

  it('5: no cache, no positional -> savepoint writes state.json', { timeout: 120000 }, () => {
    const script = join(process.cwd(), 'scripts', 'savepoint.sh');
    execFileSync('bash', [script, 'm2', '', '1'], { cwd: dir });
    expect(existsSync(join(dir, '.mugiwara', 'missions', 'm2', 'state.json'))).toBe(true);
    expect(existsSync(join(dir, '.mugiwara', 'missions', 'm2', 'continue.json'))).toBe(true);
  });

  it('6: roster 3 -> posture team-scoped', { timeout: 120000 }, () => {
    writePlan(dir, 'm', `## Sub-missions\n| ID | Name | Assignee | Branch | Status | Depends On | Touched Files |\n|----|------|----------|--------|--------|-----------|---------------|\n| S1 | api | jane-doe | feat/a | [ ] | - | src/a.ts |\n| S2 | web | john-smith | feat/b | [ ] | - | src/b.ts |\n| S3 | ops | eleanor-vance | feat/c | [ ] | - | src/c.ts |\n`);
    writeFileSync(join(dir, '.mugiwara', 'active-member'), 'jane-doe\n');
    savepoint(dir, 'm', 'jane-doe', 3);
    const j = JSON.parse(readFileSync(join(dir, '.mugiwara', 'missions', 'm', 'jane-doe.json'), 'utf8'));
    expect(j.posture).toBe('team-scoped');
  });

  it('7: assignee never started -> closure blocked names them', { timeout: 120000 }, () => {
    writePlan(dir, 'proj', `## Sub-missions\n| ID | Name | Assignee | Branch | Status | Depends On | Touched Files |\n|----|------|----------|--------|--------|-----------|---------------|\n| S1 | api | jane-doe | feat/a | [ ] | - | src/a.ts |\n| S2 | web | john-smith | feat/b | [ ] | - | src/b.ts |\n`);
    savepoint(dir, 'proj', 'jane-doe', 9);
    // john-smith never started
    const blockers = closureBlockers(join(dir, '.mugiwara', 'missions', 'proj'), 'proj');
    expect(blockers.join('\n')).toMatch(/john-smith/);
    expect(blockers.join('\n')).toMatch(/never started/);
  });

  it('8: assignee at Flow 3 -> closure blocked names flow', { timeout: 120000 }, () => {
    writePlan(dir, 'proj', `## Sub-missions\n| ID | Name | Assignee | Branch | Status | Depends On | Touched Files |\n|----|------|----------|--------|--------|-----------|---------------|\n| S1 | api | jane-doe | feat/a | [ ] | - | src/a.ts |\n| S2 | web | john-smith | feat/b | [ ] | - | src/b.ts |\n`);
    savepoint(dir, 'proj', 'jane-doe', 9);
    savepoint(dir, 'proj', 'john-smith', 3);
    const blockers = closureBlockers(join(dir, '.mugiwara', 'missions', 'proj'), 'proj');
    expect(blockers.join('\n')).toMatch(/john-smith/);
    expect(blockers.join('\n')).toMatch(/Flow 3/);
  });

  it('9: all assignees at Flow 9 -> closure proceeds', { timeout: 120000 }, () => {
    writePlan(dir, 'proj', `## Sub-missions\n| ID | Name | Assignee | Branch | Status | Depends On | Touched Files |\n|----|------|----------|--------|--------|-----------|---------------|\n| S1 | api | jane-doe | feat/a | [ ] | - | src/a.ts |\n| S2 | web | john-smith | feat/b | [ ] | - | src/b.ts |\n`);
    savepoint(dir, 'proj', 'jane-doe', 9);
    savepoint(dir, 'proj', 'john-smith', 9);
    const blockers = closureBlockers(join(dir, '.mugiwara', 'missions', 'proj'), 'proj');
    expect(blockers).toEqual([]);
  });

  it('10: state but no sub-mission -> closure warns names them', { timeout: 120000 }, () => {
    writePlan(dir, 'proj', `## Sub-missions\n| ID | Name | Assignee | Branch | Status | Depends On | Touched Files |\n|----|------|----------|--------|--------|-----------|---------------|\n| S1 | api | jane-doe | feat/a | [ ] | - | src/a.ts |\n`);
    savepoint(dir, 'proj', 'jane-doe', 9);
    savepoint(dir, 'proj', 'sophia-martinez', 5);
    const blockers = closureBlockers(join(dir, '.mugiwara', 'missions', 'proj'), 'proj');
    expect(blockers.join('\n')).toMatch(/sophia-martinez/);
    expect(blockers.join('\n')).toMatch(/has state but no sub-mission/);
  });

  it('11: --force with blockers -> closure proceeds (archive with force)', { timeout: 120000 }, async () => {
    writePlan(dir, 'proj', `## Sub-missions\n| ID | Name | Assignee | Branch | Status | Depends On | Touched Files |\n|----|------|----------|--------|--------|-----------|---------------|\n| S1 | api | jane-doe | feat/a | [ ] | - | src/a.ts |\n| S2 | web | john-smith | feat/b | [ ] | - | src/b.ts |\n`);
    savepoint(dir, 'proj', 'jane-doe', 9);
    savepoint(dir, 'proj', 'john-smith', 3);
    // write minimal report and flows to pass artifact gate
    writeFileSync(join(dir, '.mugiwara', 'missions', 'proj', 'report.md'), '# Mission: proj\nok\n');
    mkdirSync(join(dir, '.mugiwara', 'missions', 'proj', 'flows'), { recursive: true });
    writeFileSync(join(dir, '.mugiwara', 'missions', 'proj', 'flows', '04-audit.md'), 'x');
    writeFileSync(join(dir, '.mugiwara', 'missions', 'proj', 'flows', '05-quality.md'), 'x');
    const { archiveMission } = await import('../src/mission.ts');
    // without force should throw
    expect(() => archiveMission(dir, 'proj', { dryRun: false })).toThrow(/closure blocked/);
    // with force should not throw
    expect(() => archiveMission(dir, 'proj', { dryRun: false, force: true })).not.toThrow();
  });

  it('12: continue file deleted, state intact -> member still listed (union)', { timeout: 120000 }, () => {
    savepoint(dir, 'm', 'jane-doe', 3);
    savepoint(dir, 'm', 'john-smith', 5);
    // delete continue for john-smith
    rmSync(join(dir, '.mugiwara', 'missions', 'm', 'continue-john-smith.json'), { force: true });
    const members = knownMembers(dir, 'm');
    expect(members).toContain('jane-doe');
    expect(members).toContain('john-smith');
    // also via CLI continue table: members list exits 2 (pick one), still prints both
    let out = '';
    try {
      out = execFileSync('npx', ['tsx', join(process.cwd(), 'src', 'cli.ts'), 'continue', 'm', '--all'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e: unknown) {
      const err = e as { status?: number; stdout?: string | Buffer; stderr?: string | Buffer };
      expect([2]).toContain(err.status);
      out = String(err.stdout ?? '') + String(err.stderr ?? '');
    }
    expect(out).toMatch(/jane-doe/);
    expect(out).toMatch(/john-smith/);
  });

  it('13: state deleted, continue intact -> resume refused exit 1', { timeout: 120000 }, () => {
    savepoint(dir, 'm', 'eleanor-vance', 1);
    rmSync(join(dir, '.mugiwara', 'missions', 'm', 'eleanor-vance.json'), { force: true });
    try {
      execFileSync('npx', ['tsx', join(process.cwd(), 'src', 'cli.ts'), 'continue', 'm', 'eleanor-vance'], { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
      expect.fail('should have exited 1');
    } catch (e: unknown) {
      const err = e as { status?: number; stderr?: Buffer; stdout?: Buffer };
      expect(err.status).toBe(1);
      const combined = String((err.stderr as unknown) ?? '') + String((err.stdout as unknown) ?? '');
      // In execFileSync error, stdout may be in e.stdout? Check status and that at least process failed
      expect(err.status).toBe(1);
    }
    // also check message — execSync throws on exit 1, merged output lands on the error
    let out = '';
    try { out = execSync(`npx tsx ${join(process.cwd(), 'src', 'cli.ts')} continue m eleanor-vance 2>&1`, { cwd: dir, encoding: 'utf8' }); } catch (e: unknown) {
      const err = e as { stdout?: string | Buffer; message?: string; status?: number };
      out = String(err.stdout ?? err.message ?? e);
    }
    expect(out).toMatch(/has a resume point but no state file/);
  });

  it('14: corrupt state -> resume refused (existing)', { timeout: 120000 }, () => {
    savepoint(dir, 'm', 'jane-doe', 2);
    writeFileSync(join(dir, '.mugiwara', 'missions', 'm', 'jane-doe.json'), '{ not json');
    try {
      execFileSync('npx', ['tsx', join(process.cwd(), 'src', 'cli.ts'), 'continue', 'm', 'jane-doe'], { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
      expect.fail('should have exited 1 due to corrupt');
    } catch (e: unknown) {
      const err = e as { status?: number };
      expect(err.status).toBe(1);
    }
  });

  it('15: join adds roster row -> plan and decision log both updated', { timeout: 120000 }, () => {
    writePlan(dir, 'm', `## Sub-missions\n| ID | Name | Assignee | Branch | Status | Depends On | Touched Files |\n|----|------|----------|--------|--------|-----------|---------------|\n| S1 | api | jane-doe | feat/a | [ ] | - | src/a.ts |\n`);
    writeFileSync(join(dir, '.mugiwara', 'missions', 'm', 'decisions.md'), '# Decisions\n');
    execFileSync('npx', ['tsx', join(process.cwd(), 'src', 'cli.ts'), 'join', 'm', 'sophia-martinez', '--area', 'testing'], { cwd: dir });
    const plan = readFileSync(join(dir, '.mugiwara', 'missions', 'm', 'plan.md'), 'utf8');
    expect(plan).toMatch(/sophia-martinez/);
    const dec = readFileSync(join(dir, '.mugiwara', 'missions', 'm', 'decisions.md'), 'utf8');
    expect(dec).toMatch(/sophia-martinez/);
    expect(existsSync(join(dir, '.mugiwara', 'active-member'))).toBe(true);
    expect(readFileSync(join(dir, '.mugiwara', 'active-member'), 'utf8').trim()).toBe('sophia-martinez');
  });

  it('16: join with existing name -> refused', { timeout: 120000 }, () => {
    writePlan(dir, 'm', `## Sub-missions\n| ID | Name | Assignee | Branch | Status | Depends On | Touched Files |\n|----|------|----------|--------|--------|-----------|---------------|\n| S1 | api | jane-doe | feat/a | [ ] | - | src/a.ts |\n`);
    try {
      execFileSync('npx', ['tsx', join(process.cwd(), 'src', 'cli.ts'), 'join', 'm', 'jane-doe', '--area', 'testing'], { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
      expect.fail('should refuse');
    } catch (e: unknown) {
      const err = e as { status?: number };
      expect(err.status).toBe(1);
    }
  });

  it('17: savepoint --flow 3 short form -> flow recorded as 3', { timeout: 120000 }, () => {
    writePlan(dir, 'm', `## Sub-missions\n| ID | Name | Assignee | Branch | Status | Depends On | Touched Files |\n|----|------|----------|--------|--------|-----------|---------------|\n| S1 | api | jane-doe | feat/a | [ ] | - | src/a.ts |\n`);
    savepoint(dir, 'm', 'jane-doe', 2);
    writeFileSync(join(dir, '.mugiwara', 'active-member'), 'jane-doe\n');
    execFileSync('npx', ['tsx', join(process.cwd(), 'src', 'cli.ts'), 'savepoint', '--flow', '3'], { cwd: dir });
    const j = JSON.parse(readFileSync(join(dir, '.mugiwara', 'missions', 'm', 'jane-doe.json'), 'utf8'));
    expect(j.flow).toBe(3);
  });

  it('18: team_member in config is ignored — key is gone', { timeout: 120000 }, () => {
    mkdirSync(join(dir, '.mugiwara'), { recursive: true });
    writeFileSync(join(dir, '.mugiwara', 'config'), 'team_member=jane-doe\nteam_members=5\nmode=guided\n');
    // savepoint without positional member and without cache should still be solo, not jane-doe
    const script = join(process.cwd(), 'scripts', 'savepoint.sh');
    // ensure no active-member
    try { rmSync(join(dir, '.mugiwara', 'active-member'), { force: true }); } catch {}
    execFileSync('bash', [script, 'solo2', '', '1'], { cwd: dir });
    expect(existsSync(join(dir, '.mugiwara', 'missions', 'solo2', 'state.json'))).toBe(true);
    expect(existsSync(join(dir, '.mugiwara', 'missions', 'solo2', 'jane-doe.json'))).toBe(false);
  });
});
