// src/routing.ts
// Review routing: tell the reviewer where to look. A ranked
// reading order computed from what the mission touched — not a flat diff.
// Heuristic and labeled as such: the ranking decides reading ORDER, never
// whether a line is correct.

export type RankedFile = { path: string; score: number; reasons: string[] };

const DOC_PAT = /\.(md|txt|rst)$|^docs\/|^(CHANGELOG|LICENSE|README)/;
const TEST_PAT = /\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)(tests?|__tests__|specs?)\//;

export type RoutingSource = { evidence: string[]; sensitive_paths?: string[] };

/**
 * Score one path. Sensitive paths dominate; production code next; tests and
 * docs sink. Files the evidence trail never mentions get a bump — absence of
 * evidence is exactly where review attention pays.
 */
export function scorePath(path: string, sensitivePaths: string[], evidenceJoined: string): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const sensitiveHit = sensitivePaths.some((s) => s && (path === s || path.startsWith(s.replace(/\/?$/, '/')) || new RegExp(s.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*')).test(path)));
  if (sensitiveHit) {
    score += 100;
    reasons.push('sensitive path');
  }
  if (!DOC_PAT.test(path) && !TEST_PAT.test(path)) {
    score += 50;
    reasons.push('production code');
  } else if (TEST_PAT.test(path)) {
    score += 10;
    reasons.push('test scaffolding — skim unless behavior changed');
  } else {
    score += 5;
    reasons.push('docs/config');
  }
  if (!evidenceJoined.includes(path)) {
    score += 20;
    reasons.push('not covered by recorded evidence');
  }
  return { score, reasons };
}

export function rankFiles(paths: string[], state: RoutingSource): RankedFile[] {
  const sensitive = state.sensitive_paths ?? [];
  const ev = state.evidence.join(' ');
  return paths
    .map((path) => {
      const { score, reasons } = scorePath(path, sensitive, ev);
      return { path, score, reasons };
    })
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
}

export function renderRouting(ranked: RankedFile[], mission: string): string {
  if (!ranked.length) return '';
  const lines = [
    '',
    '## Review routing',
    '',
    `Ranked reading order for \`${mission}\` (heuristic ordering — it decides where to look first, never correctness):`,
    '',
  ];
  ranked.forEach((r, i) => {
    lines.push(`${i + 1}. \`${r.path}\` — ${r.reasons.join('; ')}`);
  });
  lines.push('');
  return lines.join('\n');
}
