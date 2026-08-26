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

export type IntegrityIssue = { kind: 'dangling-path' | 'secret' | 'evidence'; detail: string };

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/AKIA[0-9A-Z]{16}/, 'AWS access key id'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key block'],
  [/gh[pousr]_[A-Za-z0-9]{20,}/, 'GitHub token'],
  [/xox[baprs]-[A-Za-z0-9-]{10,}/, 'Slack token'],
  [/sk-[A-Za-z0-9]{32,}/, 'API key (sk-…)'],
  [/eyJhbGciOi[A-Za-z0-9_.-]{20,}/, 'JWT pasted verbatim'],
  [/(api[_-]?key|secret|passwd|password)\s*[=:]\s*["'][^"'\s]{8,}["']/i, 'credential assignment'],
];

const TRAIL_EXTS = new Set(['.md', '.json', '.sh']);

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

export function checkTrail(missionDir: string, projectRoot: string): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const files = trailFiles(missionDir);

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
    for (const [re, label] of SECRET_PATTERNS) {
      const hit = body.match(re);
      if (hit) {
        issues.push({
          kind: 'secret',
          detail: `${relative(projectRoot, f)} matches ${label}: ${hit[0].slice(0, 12)}…`,
        });
      }
    }
  }

  // 3: evidence entries recorded as repo paths must exist
  const evidenceFile = join(missionDir, 'state.json');
  if (existsSync(evidenceFile)) {
    try {
      const s = JSON.parse(readFileSync(evidenceFile, 'utf8')) as { evidence?: unknown };
      if (Array.isArray(s.evidence)) {
        for (const e of s.evidence) {
          if (typeof e !== 'string' || !e.trim()) continue;
          const cand = join(projectRoot, e);
          if (!isAbsolute(e) && !existsSync(cand) && !existsSync(join(missionDir, e))) {
            issues.push({ kind: 'evidence', detail: `state.json evidence "${e}" does not exist` });
          }
        }
      }
    } catch { /* corrupt state — the state reader owns that error */ }
  }

  return issues;
}

export function formatIssues(issues: IntegrityIssue[]): string {
  return issues.map((i) => `  ✗ [${i.kind}] ${i.detail}`).join('\n');
}
