// src/check-writing.ts — writing-rules gate for docs/contributing/CONTRIBUTING-DOCS.md.
// Pure functions so tests can prove red without touching the repo tree.
// Caps mirror docs/_audit.md numeric targets (ceilings, +15% tolerance).
export const WRITING_CAPS: Record<string, number> = {
  'README.md': 1800,
  'docs/concepts/config.md': 700,
  'docs/concepts/cost.md': 680,
  'docs/concepts/crew.md': 800,
  'docs/concepts/mission-flow.md': 1010,
  'docs/concepts/policy.md': 550,
  'docs/concepts/security.md': 580,
  'docs/concepts/trail.md': 700,
  'docs/contributing/CONTRIBUTING-DOCS.md': 500,
  'docs/contributing/anatomy.md': 850,
  'docs/contributing/benchmark.md': 990,
  'docs/contributing/developer-onboarding.md': 300,
  'docs/contributing/evals.md': 350,
  'docs/getting-started.md': 500,
  'docs/index.md': 200,
  'docs/install.md': 900,
  'docs/optional/signing.md': 550,
  'docs/reference/adoption-guide.md': 400,
  'docs/reference/cli.md': 820,
  'docs/reference/compliance-matrix.md': 850,
  'docs/reference/enforcement.md': 1200,
  'docs/reference/glossary.md': 550,
  'docs/reference/harness-matrix.md': 840,
  'docs/runbooks/README.md': 240,
  'docs/runbooks/monorepo.md': 350,
  'docs/runbooks/resume-after-crash.md': 500,
  'docs/runbooks/review-a-mission.md': 890,
  'docs/runbooks/risky-change.md': 1160,
  'docs/runbooks/solo-mission.md': 970,
  'docs/runbooks/team-mission.md': 650,
  'docs/runbooks/troubleshooting.md': 960,
  'docs/runbooks/upgrade-and-uninstall.md': 750,
};

export const BANNED_WORDS = [
  'simply',
  'just',
  'seamlessly',
  'robust',
  'comprehensive',
  'leverage',
  'powerful',
];

// Rule 8 necessarily names the banned words, so the rules file itself is
// exempt from the banned-word scan (all other checks still apply to it).
const BANNED_EXEMPT = new Set(['docs/contributing/CONTRIBUTING-DOCS.md']);

// Fenced blocks hold pasted command output, not prose — prose checks skip them.
export function stripFences(text: string): string {
  const out: string[] = [];
  let inFence = false;
  for (const line of text.split(/\r?\n/)) {
    if (line.trim().startsWith('```')) { inFence = !inFence; continue; }
    if (!inFence) out.push(line);
  }
  return out.join('\n');
}

// PII scan: sample output must not carry personal identifiers. Homedir
// paths (/Users/<name>, /home/<name>) flag unless the segment is a neutral
// placeholder; emails flag unless RFC-2606 example domains or the published
// project identity (ionivetech install/tracker coordinates, not personal
// data). Scans full text: samples live in fenced output blocks.
const PII_PLACEHOLDER_SEG = new Set(['you', 'user', 'your-username', 'example', '<username>', '<user>']);
const PII_EMAIL_EXEMPT = /(^|\.)example\.(com|org|net)$|ionivetech/i;

export function checkPii(text: string): string[] {
  const hits: string[] = [];
  const home = text.match(/(?:\/Users\/|\/home\/)([A-Za-z0-9._-]+)/);
  if (home && !PII_PLACEHOLDER_SEG.has(home[1].toLowerCase())) hits.push(home[0]);
  const emailRe = /[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
  let m: RegExpExecArray | null;
  while ((m = emailRe.exec(text)) !== null) {
    if (!PII_EMAIL_EXEMPT.test(m[1])) { hits.push(m[0]); break; }
  }
  return hits;
}

export function checkWritingFile(rel: string, text: string): string[] {
  const errs: string[] = [];
  const words = text.split(/\s+/).filter(Boolean).length;
  const cap = WRITING_CAPS[rel];
  if (cap !== undefined && words > Math.floor(cap * 1.15)) {
    errs.push(`${rel}: ${words} words exceeds cap ${cap} +15%`);
  }
  // At most one table block over 12 rows: contiguous `|` runs.
  const lines = stripFences(text).split(/\r?\n/);
  let run = 0;
  let bigTables = 0;
  const flush = () => { if (run > 12) bigTables++; run = 0; };
  for (const line of lines) {
    if (/^\s*\|/.test(line)) run++;
    else flush();
  }
  flush();
  if (bigTables > 1) errs.push(`${rel}: ${bigTables} tables over 12 rows (max 1)`);
  const prose = stripFences(text);
  // `just-enough` is a mission-accepted native name, not filler `just`.
  const banProse = prose.replace(/\bjust-enough\b/gi, 'native-name');
  if (!BANNED_EXEMPT.has(rel)) {
    for (const w of BANNED_WORDS) {
      if (new RegExp(`\\b${w}\\b`, 'i').test(banProse)) errs.push(`${rel}: banned word "${w}"`);
    }
  }
  const dashes = (prose.match(/—/g) ?? []).length;
  if (dashes > 2) errs.push(`${rel}: ${dashes} em-dashes (max 2)`);
  for (const hit of checkPii(text)) errs.push(`${rel}: personal identifier "${hit}"`);
  // First prose line must not open with a definition ("X is a/the ...").
  const first = lines
    .map((l) => l.trim())
    .find((l) => l !== '' && !l.startsWith('#') && !l.startsWith('|') && !l.startsWith('>') && !l.startsWith('<'));
  if (first !== undefined && /\bis\s+(a|the)\b/i.test(first)) {
    errs.push(`${rel}: opens with a definition ("${first.slice(0, 60)}")`);
  }
  return errs;
}
