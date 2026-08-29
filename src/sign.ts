// src/sign.ts
// Signed attestation: evidence that cannot be fabricated
// after the fact — optional, user-keyed, never a hard dependency.
//
// Dual backend (roadmap v0.8 item 1):
//  - minisign: external binary when installed + user supplies keys (legacy)
//  - pure:     internal node:crypto ed25519, zero binary, zero deps
// Backend chosen via sign_backend in .mugiwara/config (auto|minisign|pure|off).
// Detached signature lives beside the report (report.md.minisig | .mugisig).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readConfig } from './config.ts';

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

// --- pure ed25519 backend ------------------------------------------------

export interface PureSig {
  algo: 'ed25519-pure';
  sig: string;        // 64B base64
  pub: string;        // 32B base64
  mission: string;
  commit: string;
  ts: string;
}

/** Generate a 32-byte ed25519 seed + public key, both base64. */
export function generatePureKey(): { key: string; pub: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    key: privateKey.export({ format: 'raw-private' }).toString('base64'),
    pub: publicKey.export({ format: 'raw-public' }).toString('base64'),
  };
}

/**
 * Ensure ~/.mugiwara/mugiwara.key + .pub exist (idempotent — never
 * overwrite, never follow a symlink). Returns the .mugiwara dir.
 */
export function ensurePureKey(homeDir: string): string {
  const dir = join(homeDir, '.mugiwara');
  const keyPath = join(dir, 'mugiwara.key');
  const pubPath = join(dir, 'mugiwara.pub');
  if (!existsSync(keyPath) || !existsSync(pubPath)) {
    mkdirSync(dir, { recursive: true });
    const { key, pub } = generatePureKey();
    // atomic-ish: write key first, then pub; a partial pair re-keys on next run
    if (!existsSync(keyPath)) writeFileSync(keyPath, key + '\n');
    if (!existsSync(pubPath)) writeFileSync(pubPath, pub + '\n');
  }
  return dir;
}

/**
 * Sign content with the pure backend. Returns either the parsed signature
 * object or an error result. When outputPath is given, writes the .mugisig
 * JSON file beside the report.
 */
export function pureSign(
  content: string,
  seedBase64: string,
  opts: { mission: string; commit: string; ts: string; pub: string; outputPath?: string },
): PureSig | { ok: false; message: string } {
  const seed = Buffer.from(seedBase64.trim(), 'base64');
  if (seed.length !== 32) return { ok: false, message: 'invalid seed (want 32B base64)' };
  const privateKey = createPrivateKey({ key: seed, format: 'raw-private', asymmetricKeyType: 'ed25519' });
  const sig = sign(null, Buffer.from(content, 'utf8'), privateKey).toString('base64');
  const out: PureSig = { algo: 'ed25519-pure', sig, pub: opts.pub, mission: opts.mission, commit: opts.commit, ts: opts.ts };
  if (opts.outputPath) writeFileSync(opts.outputPath, JSON.stringify(out, null, 2) + '\n');
  return out;
}

/** Verify a pure signature against content. */
export function pureVerify(content: string, sig: PureSig): boolean {
  try {
    const pub = Buffer.from(sig.pub, 'base64');
    if (pub.length !== 32) return false;
    const publicKey = createPublicKey({ key: pub, format: 'raw-public', asymmetricKeyType: 'ed25519' });
    return verify(null, Buffer.from(content, 'utf8'), publicKey, Buffer.from(sig.sig, 'base64'));
  } catch {
    return false;
  }
}

// --- backend resolution ---------------------------------------------------

export type BackendChoice = 'off' | 'minisign' | 'minisign-fail' | 'pure';

/**
 * Resolve the effective signing backend from config sign_backend + runtime
 * facts. Unknown values fall back to pure — never a silent off.
 */
export function resolveBackend(
  configured: string | undefined,
  env: { hasMinisign: boolean; hasKey: boolean },
): BackendChoice {
  switch (configured) {
    case 'off': return 'off';
    case 'minisign': return env.hasMinisign ? 'minisign' : 'minisign-fail';
    case 'pure': return 'pure';
    case 'auto':
    default:
      return env.hasMinisign && env.hasKey ? 'minisign' : 'pure';
  }
}

/** Read sign_backend from config (project then home). */
export function configuredBackend(projectDir: string): string | undefined {
  return readConfig(projectDir).sign_backend;
}

function missionMeta(projectDir: string, mission: string): { commit: string; ts: string } {
  let commit = 'unknown';
  try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: projectDir, encoding: 'utf8' }).trim(); } catch { /* best-effort */ }
  return { commit, ts: new Date().toISOString() };
}

export function signReport(projectDir: string, missionDir: string): { ok: boolean; message: string } {
  const report = join(missionDir, 'report.md');
  if (!existsSync(report)) return { ok: false, message: 'no report.md to sign — archive first' };
  const mission = missionDir.split(join('.mugiwara', 'missions', '')).pop() ?? 'unknown';
  const backend = resolveBackend(configuredBackend(projectDir), { hasMinisign: hasMinisign(), hasKey: existsSync(defaultKey('secret')) });

  if (backend === 'off') return { ok: false, message: 'signing disabled (sign_backend=off)' };
  if (backend === 'minisign-fail') return { ok: false, message: 'sign_backend=minisign but minisign not installed — install it or set sign_backend=pure' };
  if (backend === 'minisign') {
    const secretKey = process.env.MUGIWARA_SIGN_KEY?.trim() || defaultKey('secret');
    try {
      execFileSync('minisign', signArgs(report, secretKey), { cwd: projectDir, stdio: 'pipe', input: process.env.MUGIWARA_SIGN_PASSWORD ?? '' });
      return { ok: true, message: `signed ${report}.minisig (minisign, key: ${secretKey})` };
    } catch (e) {
      return { ok: false, message: `signing failed: ${(e as Error).message}` };
    }
  }

  // pure backend
  const dir = ensurePureKey(homedir());
  const seed = process.env.MUGIWARA_SIGN_KEY?.trim() || readFileSyncSafe(join(dir, 'mugiwara.key'));
  const pub = process.env.MUGIWARA_SIGN_PUB?.trim() || readFileSyncSafe(join(dir, 'mugiwara.pub'));
  if (!seed || !pub) return { ok: false, message: 'pure keys missing — run `mugiwara sign --gen-key --backend pure`' };
  const content = readFileSafe(report);
  if (content === null) return { ok: false, message: `cannot read ${report}` };
  const { commit, ts } = missionMeta(projectDir, mission);
  const sig = pureSign(content, seed, { mission, commit, ts, pub, outputPath: `${report}.mugisig` });
  if ('ok' in sig) return { ok: false, message: `signing failed: ${sig.message}` };
  return { ok: true, message: `signed ${report}.mugisig (pure ed25519, key: ${join(dir, 'mugiwara.key')})` };
}

export function verifyReport(projectDir: string, missionDir: string): { ok: boolean; message: string } {
  const report = join(missionDir, 'report.md');
  const minisig = `${report}.minisig`;
  const mugisig = `${report}.mugisig`;

  // pure first? No — verify what exists; try both, minisig then mugisig.
  if (!existsSync(minisig) && !existsSync(mugisig)) {
    return { ok: false, message: 'not signed (no .minisig or .mugisig beside report.md)' };
  }

  if (existsSync(minisig)) {
    if (!hasMinisign()) return { ok: false, message: 'minisig present but minisign not installed — cannot verify that signature' };
    const pubKey = existsSync(defaultKey('public')) ? defaultKey('public') : null;
    try {
      execFileSync('minisign', verifyArgs(report, pubKey), { cwd: projectDir, stdio: 'pipe' });
      return { ok: true, message: 'signature verifies against report.md (minisig)' };
    } catch {
      return { ok: false, message: 'SIGNATURE INVALID — report.md changed after signing (minisig)' };
    }
  }

  // mugisig — pure verify
  try {
    const parsed = JSON.parse(readFileSafe(mugisig) ?? '{}') as PureSig;
    const content = readFileSafe(report);
    if (content === null || parsed.algo !== 'ed25519-pure') return { ok: false, message: 'invalid .mugisig file' };
    return pureVerify(content, parsed)
      ? { ok: true, message: 'signature verifies against report.md (mugisig, ed25519-pure)' }
      : { ok: false, message: 'SIGNATURE INVALID — report.md changed after signing (mugisig)' };
  } catch {
    return { ok: false, message: 'invalid .mugisig file' };
  }
}

function readFileSafe(p: string): string | null {
  try { return readFileSync(p, 'utf8'); } catch { return null; }
}
function readFileSyncSafe(p: string): string {
  try { return readFileSync(p, 'utf8').trim(); } catch { return ''; }
}
