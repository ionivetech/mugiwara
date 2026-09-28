// src/enforcement-check.ts — two gate checks that outgrew validate-content.ts.
//
// They live here, pure and unit-tested, because scripts/validate-content.ts is
// imported by its own test suite: that pulls all 800 of its top-level lines
// into lcov at ~30% line coverage, so the coverage gate fails on ANY edit to
// it. Rather than lower a threshold the gate explicitly forbids lowering, new
// checks go into a tested module and a thin unscoped runner calls them.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export type CheckError = string;

/**
 * Every `INV-*` row in docs/concepts/enforcement.md must name a mechanism that
 * exists (a hooks/scripts/src file) or admit it is prose.
 *
 * Why: the page's own header promised "the machine behind it", and 27 of 29
 * cells named the concept's own id. INV-banner's mechanism was "INV-banner".
 * The registry's anchor check cannot catch that — the anchor IS the id in the
 * same row's first column, so the check passes while the claim is empty.
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

/**
 * Every key in WRITING_CAPS must name a file that exists.
 *
 * Why: a cap for a missing file is skipped in silence, so the table rots with
 * no symptom. Five entries had gone stale before anyone looked.
 */
export function checkWritingCapTargets(caps: Record<string, number>, repoRoot: string): CheckError[] {
  return Object.keys(caps)
    .filter((rel) => !existsSync(join(repoRoot, rel)))
    .map((rel) => `writing caps: "${rel}" has a cap but no file — delete the entry or restore the doc`);
}

/**
 * Crew prose must name only artifact paths the workspace layout defines.
 *
 * Why this and not the docs writing rules: applying those to `content/`
 * produced 100 findings that were ~95% false — most "banned word" hits are
 * QUOTED user pressure ("just skip the pipeline") inside the rationalization
 * tables, and prose-style.md trips every rule it documents. What actually
 * rotted was different and unchecked: prose naming `results/`, `logs/`, or a
 * `flows/NN-name.md` the layout never defined. Those are text, not links, so
 * check-doc-links could never see them, and they survived every gate until a
 * human read two files side by side.
 *
 * `canonical` is the set of flow filenames the layout defines.
 */
export function checkArtifactPaths(
  files: Array<{ path: string; text: string }>,
  canonical: readonly string[],
): CheckError[] {
  const errors: CheckError[] = [];
  const known = new Set(canonical);
  for (const { path, text } of files) {
    // Directories the layout replaced. `results/` and `logs/` were the mission
    // workspace before missions/<mission>/ existed.
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
 * Any doc citing a measured retrieval/pointer figure must cite the measured one.
 *
 * Why: these numbers rot silently. `--check-readme-metrics` covers README.md
 * and nothing else, so the same three figures went stale in
 * docs/reference/enforcement.md (95.4 / 221 / 342) and twice in
 * docs/concepts/features.md while every gate stayed green — on the very page
 * whose stated job is that no line "promises what the repo cannot keep".
 *
 * Deliberately narrow: it only fires on the exact phrasings the docs use, so a
 * sentence mentioning a percentage for some other reason is left alone.
 */
export function checkMetricCitations(
  files: Array<{ path: string; text: string }>,
  metrics: { retrieval_rank1: number; retrieval_probes: number; pointers_total: number },
): CheckError[] {
  const errors: CheckError[] = [];
  const probes = [
    // Forward phrasing only ("95.6% rank-1"). A backward form would also read
    // "the v0.5.0 trim dropped rank-1 to 33%" — a story about the past, not a
    // claim about now — and flagging it pushes writers to delete the lesson
    // instead of keeping the number honest.
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
