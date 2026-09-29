// src/memory-template.ts — the `.mugiwara/MEMORY.md` template gate.
//
// Extracted from scripts/validate-content.ts for a mechanical reason: the
// validator's test suite imported this one function, and importing a script
// executes its whole top-level body. That pulled all ~950 of the validator's
// lines into lcov at ~30% line coverage, and the coverage gate measures
// whole-file line% against a 90% modified threshold — so ANY edit to the
// project's main validator failed the project's own gate. Two real fixes were
// blocked by it before the cause was found.
//
// Pure functions live in src/ and get tested; scripts/ stays a thin runner
// nothing imports. Same split as src/enforcement-check.ts.
export const MEMORY_TEMPLATE_SECTIONS = ['Facts', 'Conventions', 'Preferences', 'Never'];
export const MEMORY_TEMPLATE_MAX_LINES = 40;

const MEMORY_SECRET_PATTERNS: RegExp[] = [
  /sk-/,
  /AKIA/,
  /ghp_/,
  /xox[bpas]-/,
  /-----BEGIN .*PRIVATE KEY-----/,
  /password\s*[:=]/i,
];

/** Required sections present, line budget respected, no secret shapes. */
export function memoryTemplateErrors(text: string, label = 'references/memory-template.md'): string[] {
  const errs: string[] = [];
  for (const s of MEMORY_TEMPLATE_SECTIONS) {
    if (!text.includes(`## ${s}`)) errs.push(`${label}: missing "## ${s}" section`);
  }
  const nonEmpty = text.split(/\r?\n/).filter((l) => l.trim() !== '').length;
  if (nonEmpty > MEMORY_TEMPLATE_MAX_LINES) {
    errs.push(`${label}: memory-template exceeds ${MEMORY_TEMPLATE_MAX_LINES} lines (${nonEmpty} non-empty)`);
  }
  for (const re of MEMORY_SECRET_PATTERNS) {
    if (re.test(text)) errs.push(`${label}: possible secret pattern ${re} — never store secrets in MEMORY.md`);
  }
  return errs;
}
