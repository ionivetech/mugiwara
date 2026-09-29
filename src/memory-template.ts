// src/memory-template.ts — the `.mugiwara/MEMORY.md` template gate.
// Split out of scripts/validate-content.ts so no test imports that script:
// importing it runs its whole body and drags ~950 lines into lcov.
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
