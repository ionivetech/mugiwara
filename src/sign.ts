// src/sign.ts
// Signed attestation: evidence that cannot be fabricated
// after the fact — optional, user-keyed, never a hard dependency.
//
// Uses minisign when it is installed and the user supplies keys. No minisign,
// no keys → today's behavior, stated plainly in the output. Detached
// signature lives beside the report (`report.md.minisig`).
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function signArgs(reportPath: string, secretKey: string): string[] {
  return ['-Sm', reportPath, '-s', secretKey];
}

export function verifyArgs(reportPath: string, pubKey: string | null): string[] {
  return pubKey ? ['-Vm', reportPath, '-p', pubKey] : ['-Vm', reportPath];
}

export function hasMinisign(): boolean {
  try {
    execFileSync('minisign', ['-v'], { stdio: ['ignore', 'pipe', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}

function defaultKey(flag: 'secret' | 'public'): string {
  return join(homedir(), '.mugiwara', flag === 'secret' ? 'minisign.key' : 'minisign.pub');
}

export function signReport(projectDir: string, missionDir: string): { ok: boolean; message: string } {
  const report = join(missionDir, 'report.md');
  if (!existsSync(report)) return { ok: false, message: 'no report.md to sign — archive first' };
  if (!hasMinisign()) {
    return { ok: false, message: 'minisign not installed — signing skipped (install minisign to enable attestation)' };
  }
  const secretKey = process.env.MUGIWARA_SIGN_KEY?.trim() || defaultKey('secret');
  try {
    execFileSync('minisign', signArgs(report, secretKey), { cwd: projectDir, stdio: 'pipe', input: process.env.MUGIWARA_SIGN_PASSWORD ?? '' });
    return { ok: true, message: `signed ${report}.minisig (key: ${secretKey})` };
  } catch (e) {
    return { ok: false, message: `signing failed: ${(e as Error).message}` };
  }
}

export function verifyReport(projectDir: string, missionDir: string): { ok: boolean; message: string } {
  const report = join(missionDir, 'report.md');
  const sig = `${report}.minisig`;
  if (!existsSync(sig)) return { ok: false, message: 'not signed (no .minisig beside report.md)' };
  if (!hasMinisign()) return { ok: false, message: 'minisign not installed — cannot verify' };
  const pubKey = existsSync(defaultKey('public')) ? defaultKey('public') : null;
  try {
    execFileSync('minisign', verifyArgs(report, pubKey), { cwd: projectDir, stdio: 'pipe' });
    return { ok: true, message: 'signature verifies against report.md' };
  } catch {
    return { ok: false, message: 'SIGNATURE INVALID — report.md changed after signing' };
  }
}
