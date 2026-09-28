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
