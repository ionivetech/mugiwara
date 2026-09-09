// src/check-writing.ts — writing-rules gate for docs/CONTRIBUTING-DOCS.md.
// Pure functions so tests can prove red without touching the repo tree.
// Caps mirror docs/_audit.md numeric targets (ceilings, +15% tolerance).
export const WRITING_CAPS: Record<string, number> = {
  'README.md': 1800,
  'docs/concepts/features.md': 2400,
  'docs/concepts/cost.md': 800,
  'docs/concepts/config.md': 600,
  'docs/getting-started.md': 800,
  'docs/reference/harness-matrix.md': 700,
  'docs/concepts/audit-trail.md': 700,
  'docs/concepts/workflow.md': 700,
  'docs/concepts/modes.md': 600,
  'docs/concepts/lanes.md': 600,
  'docs/reference/enforcement.md': 700,
  'docs/concepts/policy-as-code.md': 600,
  'docs/reference/glossary.md': 450,
  'docs/concepts/closure-tools.md': 450,
  'docs/install/cli.md': 500,
  'docs/evals.md': 500,
  'docs/concepts/security.md': 500,
  'docs/install/opencode.md': 400,
  'docs/reference/developer-onboarding.md': 400,
  'docs/cost-governor.md': 400,
  'docs/reference/adoption-guide.md': 400,
  'docs/concepts/agents.md': 400,
  'docs/concepts/git-strategy.md': 400,
  'docs/adoption.md': 300,
  'docs/runbooks/team-mission.md': 450,
  'docs/concepts/skills.md': 350,
  'docs/reference/agent-anatomy.md': 300,
  'docs/runbooks/troubleshooting.md': 600,
  'docs/runbooks/resume-after-crash.md': 400,
  'docs/concepts/permissions.md': 300,
  'docs/concepts/provenance.md': 300,
  'docs/runbooks/solo-mission.md': 350,
  'docs/runbooks/signing-and-attestation.md': 300,
  'docs/runbooks/policy-for-a-team.md': 300,
  'docs/runbooks/joining-a-mission.md': 300,
  'docs/install/claude.md': 200,
  'docs/runbooks/monorepo.md': 300,
  'docs/install/index.md': 500,
  'docs/install/codex.md': 300,
  'docs/install/gemini.md': 300,
  'docs/install/copilot.md': 300,
  'docs/install/antigravity.md': 300,
  'docs/install/pi.md': 300,
  'docs/install/cursor.md': 300,
  'docs/install/kimi.md': 300,
  'docs/concepts/execution-model.md': 50,
  'docs/concepts/enforcement.md': 50,
  'docs/concepts/comparison.md': 50,
  'docs/troubleshooting.md': 50,
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
const BANNED_EXEMPT = new Set(['docs/CONTRIBUTING-DOCS.md']);

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
  if (!BANNED_EXEMPT.has(rel)) {
    for (const w of BANNED_WORDS) {
      if (new RegExp(`\\b${w}\\b`, 'i').test(prose)) errs.push(`${rel}: banned word "${w}"`);
    }
  }
  const dashes = (prose.match(/—/g) ?? []).length;
  if (dashes > 2) errs.push(`${rel}: ${dashes} em-dashes (max 2)`);
  // First prose line must not open with a definition ("X is a/the ...").
  const first = lines
    .map((l) => l.trim())
    .find((l) => l !== '' && !l.startsWith('#') && !l.startsWith('|') && !l.startsWith('>') && !l.startsWith('<'));
  if (first !== undefined && /\bis\s+(a|the)\b/i.test(first)) {
    errs.push(`${rel}: opens with a definition ("${first.slice(0, 60)}")`);
  }
  return errs;
}
