// src/risk.ts — risk-area detection for the /mugiwara prompt hook. Pure: no I/O.
// A miss only means the model sizes the work by itself; a false hit only adds a
// reminder line, so the lists favour recall.

const RISK_WORDS = new RegExp(
  '\\b(' + [
    // English
    'auth\\w*', 'log[- ]?in', 'sign[- ]?in', 'password\\w*', 'credential\\w*', 'secrets?', 'tokens?', 'rbac', 'roles?',
    'permissions?', 'tenant\\w*', 'multi-tenant', 'payments?', 'billing', 'refund\\w*', 'invoices?', 'migrat\\w+', 'schema',
    'ci/cd', 'github actions',
    // Indonesian
    'izin', 'hak akses', 'otorisasi', 'autentikasi', 'masuk akun', 'pembayaran', 'penagihan', 'pengembalian dana',
    'kata sandi', 'sandi', 'rahasia', 'kunci api', 'penyewa', 'migrasi', 'skema',
  ].join('|') + ')\\b',
  'i',
);

// A path-like token (has a slash) whose name parts hit one of these is a risky path.
const RISK_PATH_PARTS = new Set(['auth', 'payment', 'payments', 'billing', 'migration', 'migrations', 'rbac', 'permission', 'permissions', 'secret', 'secrets']);

function riskPath(text: string): string | null {
  for (const tok of text.split(/[\s"'`()<>,;]+/)) {
    if (!tok.includes('/')) continue;
    for (const part of tok.toLowerCase().split(/[/\\_.\-]+/)) if (RISK_PATH_PARTS.has(part)) return tok;
  }
  return null;
}

/** The first risk word or risky path named in `text`, lowercased, or null. */
export function riskTerm(text: string): string | null {
  if (typeof text !== 'string') return null;
  const m = RISK_WORDS.exec(text);
  if (m) return m[1].toLowerCase();
  return riskPath(text)?.toLowerCase() ?? null;
}

/** Reminder for a request that names a risk area, else null. */
export function riskReminder(text: string): string | null {
  const term = riskTerm(text.replace(/^\s*\/(?:mugiwara:)?mugiwara\b/i, ''));
  return term
    ? `Mugiwara: this request mentions "${term}", a risk area. Take the full process, not the direct path: load the mugiwara-orchestration skill and record the mission before you edit code. ` +
      'Before closing, dispatch Robin (robin-reviewer) and Jinbe (jinbe-security) as separate agents; a review written by the conversation that made the change does not count.'
    : null;
}

/** Exact next step for a risky mission whose independent review has not been dispatched. */
export function reviewNextStep(mission: string, ran: ReadonlySet<string> = new Set()): string {
  const todo = [['robin-reviewer', 'Robin'], ['jinbe-security', 'Jinbe']].filter(([a]) => !ran.has(a)).map(([a, n]) => `${n} (${a})`);
  return `Next step: start ${todo.length ? todo.join(' and ') : 'the reviewers'} as separate agents for mission "${mission}", then run \`mugiwara archive ${mission}\`.`;
}
