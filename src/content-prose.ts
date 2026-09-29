// src/content-prose.ts — prose rules for the crew prompts.
//
// The docs writing rules do NOT belong here. Running them over content/
// produced 100 findings that were ~95% false: most "banned word" hits are
// QUOTED user pressure inside the rationalization tables ("just skip the
// pipeline"), prose-style.md trips every rule it documents, and the em-dash
// cap fights a prompt style that uses the dash as a compact separator.
//
// These three rules are different. Each one is the machine form of a defect
// this repo actually shipped, found by reading two files side by side:
//
//   1. Every non-captain agent opened with `Announce → Flow N`, the handoff
//      arrow used as a greeting, while the banner spec says arrival is
//      `## <emoji> Flow N — Crew (Role)`. Nine stages ran with no banner.
//   2. Crew rules were named after `have-adhd`, a host capability the docs
//      admit "varies by host". A mandatory output shape cannot depend on
//      something that may not be installed.
//   3. src/features.ts advertised ship at Flow 8. Flow 8 is Brook. The same
//      off-by-one is just as easy to write in prose.
export type ProseError = string;

/** Flow number to crew, from mugiwara-workflow's pipeline table. */
export const PIPELINE: Record<string, string> = {
  '0': 'Luffy', '1': 'Usopp', '2': 'Nami', '3': 'Zoro', '4': 'Chopper',
  '5': 'Sanji', '6': 'Franky', '7': 'Robin', '8': 'Brook', '9': 'Luffy',
};
/** Flow 7 runs Robin and Jinbe in parallel; 4.5 is the optional Skeptic pass. */
const ALSO_VALID: Record<string, string[]> = { '7': ['Jinbe', 'Robin/Jinbe', 'Robin∥Jinbe'] };

/** Host capabilities. Crew rules describe their own shape instead. */
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

      // 1a. A banner heading names its crew and role, and carries the emoji.
      const banner = /^#{2,3}\s+(.*?)Flow\s+([\d.]+)\s+—\s+([A-Za-z∥/]+)\s*(\(([^)]*)\))?/.exec(line);
      if (banner) {
        const [, lead, flow, crew, , role] = banner;
        if (!isBanner(crew)) continue; // a section heading, not a banner
        if (!/\p{Extended_Pictographic}/u.test(lead)) {
          errors.push(`content-prose: ${path} banner "Flow ${flow} — ${crew}" has no crew emoji`);
        }
        if (!role) {
          errors.push(`content-prose: ${path} banner "Flow ${flow} — ${crew}" has no "(Role)" suffix`);
        }
        errors.push(...crewMismatch(path, flow, crew, role));
      }

      // 1b. A handoff carries the emoji and NEVER the role suffix.
      const handoff = /^→\s*(.*?)Flow\s+([\d.]+)\s+—\s+([A-Za-z∥/]+)\s*(\(([^)]*)\))?/.exec(line);
      if (handoff) {
        const [, lead, flow, crew, , role] = handoff;
        if (!isBanner(crew)) continue; // not a crew name — not a handoff
        if (!/\p{Extended_Pictographic}/u.test(lead)) {
          errors.push(`content-prose: ${path} handoff "→ Flow ${flow} — ${crew}" has no crew emoji`);
        }
        if (role && role.toLowerCase() !== 'routing') {
          errors.push(`content-prose: ${path} handoff "→ Flow ${flow} — ${crew} (${role})" carries a role — the role belongs to the banner`);
        }
        errors.push(...crewMismatch(path, flow, crew, role));
      }

      // 2. A crew rule must not be named after a host capability.
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

/**
 * A heading like `## Flow 0 — Triage (always first)` is a document section,
 * not a banner: "Triage" is a stage name, not a crew member. Only a known crew
 * name makes the line a banner, so section headings are left alone.
 */
function isBanner(crew: string): boolean {
  return CREW.has(crew);
}

function crewMismatch(path: string, flow: string, crew: string, role?: string): ProseError[] {
  const want = PIPELINE[flow];
  if (!want) return [];
  if (crew === want) return [];
  if ((ALSO_VALID[flow] ?? []).includes(crew)) return [];
  // The return hop keeps the RETURNING stage's number and names Luffy:
  // `→ 🏴‍☠️ Flow 2 — Luffy (routing)`. Documented in wave-banners.md.
  if (crew === 'Luffy' && role?.toLowerCase() === 'routing') return [];
  return [`content-prose: ${path} pairs Flow ${flow} with ${crew} — the pipeline runs ${want} there`];
}
