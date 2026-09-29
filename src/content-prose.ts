// src/content-prose.ts — prose rules for the crew prompts.
// Not the docs writing rules: run over content/ those produce ~95% false
// findings, because most banned-word hits are QUOTED user pressure in the
// rationalization tables. Each rule below is a defect this repo shipped.
export type ProseError = string;

/** Flow number to crew, from mugiwara-workflow's pipeline table. */
export const PIPELINE: Record<string, string> = {
  '0': 'Luffy', '1': 'Usopp', '2': 'Nami', '3': 'Zoro', '4': 'Chopper',
  '5': 'Sanji', '6': 'Franky', '7': 'Robin', '8': 'Brook', '9': 'Luffy',
};
/** Flow 7 runs Robin and Jinbe in parallel. */
const ALSO_VALID: Record<string, string[]> = { '7': ['Jinbe', 'Robin/Jinbe', 'Robin∥Jinbe'] };

/** Host capabilities — crew rules must not depend on them. */
const HOST_CAPABILITIES = ['have-adhd', 'anti-stuff', 'anti-fluff', 'just-enough', 'anti-slop'];

export function checkContentProse(
  files: Array<{ path: string; text: string }>,
  opts: { hostNameAllowlist?: readonly string[] } = {},
): ProseError[] {
  const errors: ProseError[] = [];
  const allow = new Set(opts.hostNameAllowlist ?? []);

  for (const { path, text } of files) {
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();

      // Banner: emoji + crew + (Role).
      const banner = /^#{2,3}\s+(.*?)Flow\s+([\d.]+)\s+—\s+([A-Za-z∥/]+)\s*(\(([^)]*)\))?/.exec(line);
      if (banner) {
        const [, lead, flow, crew, , role] = banner;
        if (!isBanner(crew)) continue;
        if (!/\p{Extended_Pictographic}/u.test(lead)) {
          errors.push(`content-prose: ${path} banner "Flow ${flow} — ${crew}" has no crew emoji`);
        }
        if (!role) {
          errors.push(`content-prose: ${path} banner "Flow ${flow} — ${crew}" has no "(Role)" suffix`);
        }
        errors.push(...crewMismatch(path, flow, crew, role));
      }

      // Handoff: emoji + crew, never a role.
      const handoff = /^→\s*(.*?)Flow\s+([\d.]+)\s+—\s+([A-Za-z∥/]+)\s*(\(([^)]*)\))?/.exec(line);
      if (handoff) {
        const [, lead, flow, crew, , role] = handoff;
        if (!isBanner(crew)) continue;
        if (!/\p{Extended_Pictographic}/u.test(lead)) {
          errors.push(`content-prose: ${path} handoff "→ Flow ${flow} — ${crew}" has no crew emoji`);
        }
        if (role && role.toLowerCase() !== 'routing') {
          errors.push(`content-prose: ${path} handoff "→ Flow ${flow} — ${crew} (${role})" carries a role — the role belongs to the banner`);
        }
        errors.push(...crewMismatch(path, flow, crew, role));
      }

      // A crew rule must not be named after a host capability.
      if (!allow.has(path)) {
        for (const cap of HOST_CAPABILITIES) {
          if (line.includes(cap)) {
            errors.push(`content-prose: ${path} names the host capability "${cap}" — the crew owns its own output shape; host names live in docs/concepts/host-skills.md`);
          }
        }
      }
    }
  }
  return errors;
}

/** Every name the pipeline can legitimately put after `Flow N — `. */
const CREW = new Set([...Object.values(PIPELINE), 'Jinbe', 'Robin/Jinbe', 'Robin∥Jinbe', 'Skeptic']);

/** `## Flow 0 — Triage` is a section heading: "Triage" is not a crew name. */
function isBanner(crew: string): boolean {
  return CREW.has(crew);
}

function crewMismatch(path: string, flow: string, crew: string, role?: string): ProseError[] {
  const want = PIPELINE[flow];
  if (!want) return [];
  if (crew === want) return [];
  if ((ALSO_VALID[flow] ?? []).includes(crew)) return [];
  // The documented return hop: `→ Flow N — Luffy (routing)`.
  if (crew === 'Luffy' && role?.toLowerCase() === 'routing') return [];
  return [`content-prose: ${path} pairs Flow ${flow} with ${crew} — the pipeline runs ${want} there`];
}
