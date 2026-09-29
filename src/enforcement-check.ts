// src/enforcement-check.ts — gate checks that must stay unit-testable.
// They live here, not in scripts/validate-content.ts: that file is imported by
// its own test, which drags all ~950 of its lines into lcov and fails the
// coverage gate on any edit.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export type CheckError = string;

/**
 * Every `INV-*` row in docs/concepts/enforcement.md names a mechanism that
 * exists, or admits it is prose. A cell repeating the concept's own id claims
 * a guarantee nobody implemented.
 */
export function checkMechanismCells(enforcementMd: string, repoRoot: string): CheckError[] {
  const errors: CheckError[] = [];
  for (const line of enforcementMd.split(/\r?\n/)) {
    const row = /^\|\s*(INV-[a-z0-9-]+)[^|]*\|[^|]*\|\s*([^|]+?)\s*\|\s*$/.exec(line);
    if (!row) continue;
    const [, cid, mech] = row;
    if (/^prose \(aspirational\)/.test(mech)) continue;
    const path = mech.split(/\s/)[0];
    if (!/^(hooks|scripts|src)\//.test(path) || !existsSync(join(repoRoot, path))) {
      errors.push(
        `enforcement: ${cid} mechanism "${mech.slice(0, 48)}" is neither an existing hooks/scripts/src file nor "prose (aspirational)"`,
      );
    }
  }
  return errors;
}

/** Every WRITING_CAPS key names a file that exists. A cap for a missing file is skipped in silence. */
export function checkWritingCapTargets(caps: Record<string, number>, repoRoot: string): CheckError[] {
  return Object.keys(caps)
    .filter((rel) => !existsSync(join(repoRoot, rel)))
    .map((rel) => `writing caps: "${rel}" has a cap but no file — delete the entry or restore the doc`);
}

/**
 * Prose names only artifact paths the workspace layout defines. These are text,
 * not links, so check-doc-links cannot see them.
 */
export function checkArtifactPaths(
  files: Array<{ path: string; text: string }>,
  canonical: readonly string[],
): CheckError[] {
  const errors: CheckError[] = [];
  const known = new Set(canonical);
  for (const { path, text } of files) {
    for (const dead of ['results/', '`logs/`']) {
      if (text.includes(dead)) {
        errors.push(`artifact-path: ${path} names "${dead}" — the layout defines missions/<mission>/flows/ and decisions.md`);
      }
    }
    for (const m of text.matchAll(/flows\/(\d{2}-[a-z-]+\.md)/g)) {
      if (!known.has(m[1])) {
        errors.push(`artifact-path: ${path} names "flows/${m[1]}" — not in the workspace layout (${canonical.join(', ')})`);
      }
    }
  }
  return errors;
}

/**
 * Any doc citing a measured figure cites the measured one.
 * `--check-readme-metrics` covers README.md alone, so four other pages drifted.
 */
export function checkMetricCitations(
  files: Array<{ path: string; text: string }>,
  metrics: { retrieval_rank1: number; retrieval_probes: number; pointers_total: number },
): CheckError[] {
  const errors: CheckError[] = [];
  const probes = [
    // Forward phrasing only: a backward form would also read "dropped rank-1
    // to 33%", which is history, not a claim.
    { re: /(\d+(?:\.\d+)?)\s*(?:%|percent)\s*rank[ -]?1/gi, want: metrics.retrieval_rank1, what: 'rank-1' },
    { re: /(\d[\d,]*)\s+(?:retrieval\s+)?probes/gi, want: metrics.retrieval_probes, what: 'probes' },
    { re: /(\d[\d,]*)\s+pointers/gi, want: metrics.pointers_total, what: 'pointers' },
  ];
  for (const { path, text } of files) {
    for (const { re, want, what } of probes) {
      for (const m of text.matchAll(re)) {
        const got = Number(m[1].replace(/,/g, ''));
        if (Number.isFinite(got) && got !== want) {
          errors.push(`metrics: ${path} cites ${what} ${m[1]} — .metrics/latest.json measures ${want}`);
        }
      }
    }
  }
  return errors;
}

/**
 * No workflow runs a check `gate` already runs. ci.yml states this in prose and
 * it has failed three times; the last one hid two checks behind an early exit.
 */
export function checkWorkflowGateDrift(
  workflows: Array<{ path: string; text: string }>,
  gateScripts: readonly string[],
  exempt: readonly string[] = [],
): CheckError[] {
  const errors: CheckError[] = [];
  const skip = new Set(exempt);
  for (const { path, text } of workflows) {
    for (const script of gateScripts) {
      if (skip.has(script)) continue;
      if (text.includes(script)) {
        errors.push(`workflow-drift: ${path} runs "${script}" directly — it is already in \`bun run gate\`. One gate, one definition.`);
      }
    }
  }
  return errors;
}

/** Script paths the `gate` npm script invokes. */
export function gateScriptPaths(gateCommand: string): string[] {
  return [...new Set(Array.from(gateCommand.matchAll(/scripts\/[A-Za-z0-9._-]+\.ts/g), (m) => m[0]))];
}
