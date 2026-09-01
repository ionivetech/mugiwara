// src/integrity.ts
// Closure integrity gate: the audit trail validates itself
// at archive time. Deterministic checks only — a violation fails the archive
// with an actionable message instead of shipping a broken or leaking artifact.
//
// Three checks:
//   1. Paths — every relative markdown link in the trail resolves to a file
//      (mission-relative or repo-root).
//   2. Secrets — no trail file matches known secret shapes.
//   3. Evidence — cited wave/evidence paths exist.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { loadPolicy } from './policy.ts';

export type IntegrityIssue = {
  kind: 'dangling-path' | 'secret' | 'secret-warn' | 'evidence' | 'evidence-thin';
  detail: string;
  severity?: 'block' | 'warn';
};

export type SecretSeverity = 'block' | 'warn';
export type SecretPattern = [RegExp, string, SecretSeverity];

export const SECRET_PATTERNS: Array<SecretPattern> = [
  [/AKIA[0-9A-Z]{16}/, 'AWS access key id', 'block'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key block', 'block'],
  [/gh[pousr]_[A-Za-z0-9]{20,}/, 'GitHub token', 'block'],
  [/xox[baprs]-[A-Za-z0-9-]{10,}/, 'Slack token', 'block'],
  [/sk-[A-Za-z0-9]{32,}/, 'API key (sk-…)', 'block'],
  [/eyJhbGciOi[A-Za-z0-9_.-]{20,}/, 'JWT pasted verbatim', 'block'],
  [/(api[_-]?key|secret|passwd|password)\s*[=:]\s*["'][^"'\s]{8,}["']/i, 'credential assignment', 'block'],
  [/AIza[0-9A-Za-z_-]{35}/, 'Google API key', 'block'],
  [/ya29\.[0-9A-Za-z_-]{20,}/, 'Google OAuth token', 'block'],
  [/\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@/]{4,}@[^\s/]+/i, 'connection string with inline credential', 'block'],
  [/\bAC[a-f0-9]{32}\b/, 'Twilio account SID', 'block'],
  [/\bSK[a-f0-9]{32}\b/, 'Twilio API key', 'block'],
  [/\bglpat-[A-Za-z0-9_-]{20,}/, 'GitLab token', 'block'],
  [/\bnpm_[A-Za-z0-9]{36}\b/, 'npm token', 'block'],
  [/\bdop_v1_[a-f0-9]{64}\b/, 'DigitalOcean token', 'block'],
  [/\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/, 'card-number shape (verify before committing)', 'warn'],
];

const ALLOW_SECRET = 'mugiwara:allow-secret';

function loadExtraPatterns(projectRoot: string): Array<SecretPattern> {
  try {
    const policy = loadPolicy(projectRoot);
    const extras = (policy as unknown as { integrity?: { extra_secret_patterns?: Array<{ pattern: string; label: string; severity?: SecretSeverity }> } })?.integrity?.extra_secret_patterns;
    if (!extras || !Array.isArray(extras)) return [];
    const out: Array<SecretPattern> = [];
    for (const e of extras) {
      if (!e || typeof (e as Record<string, unknown>).pattern !== 'string' || typeof (e as Record<string, unknown>).label !== 'string') continue;
      const rec = e as { pattern: string; label: string; severity?: SecretSeverity };
      const sev: SecretSeverity = rec.severity === 'warn' ? 'warn' : 'block';
      try {
        const re = new RegExp(rec.pattern);
        out.push([re, rec.label, sev]);
      } catch {
        // invalid regex — skip
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Secret shapes per line; a line carrying the allow marker is skipped — deliberate examples stay possible. */
export function findSecrets(
  body: string,
  extra?: Array<SecretPattern>,
): Array<{ label: string; hit: string; severity: SecretSeverity }> {
  const out: Array<{ label: string; hit: string; severity: SecretSeverity }> = [];
  const patterns: Array<SecretPattern> = extra ? [...SECRET_PATTERNS, ...extra] : SECRET_PATTERNS;
  for (const line of body.split(/\r?\n/)) {
    if (line.includes(ALLOW_SECRET)) continue;
    for (const [re, label, severity] of patterns) {
      const hit = line.match(re);
      if (hit) out.push({ label, hit: hit[0], severity: (severity ?? 'block') as SecretSeverity });
    }
  }
  return out;
}

const TRAIL_EXTS = new Set(['.md', '.json', '.sh', '.jsonl']);

function trailFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (TRAIL_EXTS.has(e.name.slice(e.name.lastIndexOf('.')) || '')) out.push(p);
    }
  };
  walk(dir);
  return out;
}

/** Relative markdown-link targets like `](../src/x.ts)` — skip URLs and anchors. */
function linkedPaths(md: string): string[] {
  const out: string[] = [];
  for (const m of md.matchAll(/\]\(([^)\s]+)\)/g)) {
    const t = m[1];
    if (/^(https?:|mailto:|#|\/\/)/.test(t)) continue;
    out.push(t.split('#')[0]);
  }
  return out.filter(Boolean);
}

function hasCommandOutputShape(body: string): boolean {
  return /`[^`]+`/.test(body) || /\b(exit\s+[01]|✓|✗|\bPASS\b|\bFAIL\b|passed|failed|\d+\s+(passed|failed))\b/i.test(body);
}

function collectPassCitedPaths(missionDir: string): string[] {
  const out: string[] = [];
  for (const f of trailFiles(missionDir)) {
    let body: string;
    try { body = readFileSync(f, 'utf8'); } catch { continue; }
    for (const line of body.split(/\r?\n/)) {
      if (!/\bPASS\b/.test(line)) continue;
      for (const p of linkedPaths(line)) out.push(p);
      // also catch bare repo-path mentions like flows/04-gates.md or evidence/foo.md
      for (const m of line.matchAll(/(?:^|[\s"'(])([a-zA-Z0-9._\/-]+\.(?:md|txt|log|json))\b/g)) {
        const cand = m[1];
        if (cand.includes('/')) out.push(cand);
      }
    }
  }
  return [...new Set(out)];
}

export function checkTrail(missionDir: string, projectRoot: string): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const files = trailFiles(missionDir);
  const extraPatterns = loadExtraPatterns(projectRoot);

  // 1 + 2: per-file link resolution and secret scan
  for (const f of files) {
    let body: string;
    try { body = readFileSync(f, 'utf8'); } catch { continue; }
    for (const target of linkedPaths(body)) {
      if (isAbsolute(target)) continue;
      const fromMission = join(missionDir, target);
      const fromRoot = join(projectRoot, target);
      if (!existsSync(fromMission) && !existsSync(fromRoot)) {
        issues.push({
          kind: 'dangling-path',
          detail: `${relative(projectRoot, f)} links "${target}" — no such file (mission dir or repo root)`,
        });
      }
    }
    for (const { label, hit, severity } of findSecrets(body, extraPatterns.length ? extraPatterns : undefined)) {
      const isWarn = severity === 'warn';
      issues.push({
        kind: isWarn ? 'secret-warn' : 'secret',
        detail: `${relative(projectRoot, f)} matches ${label}: ${hit.slice(0, 12)}…`,
        severity: isWarn ? 'warn' : 'block',
      });
    }
  }

  // 3: evidence entries recorded as repo paths must exist
  const evidencePaths: string[] = [];
  const evidenceFile = join(missionDir, 'state.json');
  if (existsSync(evidenceFile)) {
    try {
      const s = JSON.parse(readFileSync(evidenceFile, 'utf8')) as { evidence?: unknown };
      if (Array.isArray(s.evidence)) {
        for (const e of s.evidence) {
          if (typeof e !== 'string' || !e.trim()) continue;
          evidencePaths.push(e);
          const cand = join(projectRoot, e);
          if (!isAbsolute(e) && !existsSync(cand) && !existsSync(join(missionDir, e))) {
            issues.push({ kind: 'evidence', detail: `state.json evidence "${e}" does not exist` });
          }
        }
      }
    } catch { /* corrupt state — the state reader owns that error */ }
  }

  // 4: evidence-content spot check (T7): a PASS verdict that cites an evidence
  // path must point at a file that exists AND contains command-output shape
  // (backticked command or exit-status token). Fake-but-consistent trails
  // defeat existence-only checks — this raises the bar cheaply.
  const passCited = collectPassCitedPaths(missionDir);
  for (const e of passCited) {
    if (!e.trim() || isAbsolute(e)) continue;
    // state/continue are machine-generated JSON, not evidence with command output — skip thin check
    if (/(?:^|\/)(state|continue)(-[^\/]*)?\.json$/.test(e)) continue;
    const candMission = join(missionDir, e);
    const candRoot = join(projectRoot, e);
    const resolved = existsSync(candMission) ? candMission : existsSync(candRoot) ? candRoot : null;
    if (!resolved) continue; // already reported as evidence/dangling elsewhere
    let body: string;
    try { body = readFileSync(resolved, 'utf8'); } catch { continue; }
    if (!hasCommandOutputShape(body)) {
      issues.push({ kind: 'evidence-thin', detail: `evidence "${e}" exists but lacks command output (no backticked command or exit-status token)` });
    }
  }

  return issues;
}

export function formatIssues(issues: IntegrityIssue[]): string {
  return issues.map((i) => `  ✗ [${i.kind}] ${i.detail}`).join('\n');
}
