// src/guards.ts — shared irreversible-command predicates (E4, E5).
//
// Single source of truth for the FORBIDDEN table. hooks/pretool-guard.ts
// imports it (bundled into the .js by build-hooks). The opencode plugin
// (.opencode/plugins/mugiwara.mjs) embeds a copy of the table delimited by
// the same GUARDS-TABLE markers — test/plugin.test.ts asserts the two blocks
// are byte-identical, so a drift fails CI instead of silently forking
// enforcement across harnesses.

export const FORBIDDEN: Array<[RegExp, string]> = [
// GUARDS-TABLE-START
  [/\bgh\s+pr\s+(create|merge|ready)\b/, 'opening or merging a PR'],
  [/\bgh\s+release\s+create\b/, 'creating a release'],
  [/\bgit\s+merge\b/, 'merging a branch'],
  [/\bgit\s+push\b[^|;&]*\b(main|master|production|release)\b/, 'pushing to a protected branch'],
  [/\bgit\s+push\b[^|;&]*--force/, 'force-pushing'],
  [/\bnpm\s+publish\b|\byarn\s+publish\b|\bpnpm\s+publish\b/, 'publishing a package'],
  [/\bkubectl\s+(apply|delete|rollout)\b/, 'changing a cluster'],
  [/\bterraform\s+(apply|destroy)\b/, 'changing infrastructure'],
  [/\bdocker\s+push\b/, 'pushing an image'],
  [/\baws\s+\w+\s+(create|delete|update|put)\b/, 'changing cloud resources'],
// GUARDS-TABLE-END
];

/** The refused action for a shell command, or null when it may run. */
export function checkCommand(command: string): string | null {
  for (const [re, action] of FORBIDDEN) {
    if (re.test(command)) return action;
  }
  return null;
}

/** Deny message: names the action, the human terminal step, the escape hatch. */
export function refusalMessage(action: string): string {
  return (
    `Mugiwara: refusing to ${action}. The crew never creates a PR, merges, or ` +
    `deploys — the human does, from the branch and the verdict the crew hands over. ` +
    `Run it yourself, or set enforce=off in .mugiwara/config.`
  );
}
