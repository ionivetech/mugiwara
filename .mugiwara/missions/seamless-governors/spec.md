# Spec — seamless-governors

**Goal:** Solo & enterprise sama-sama useful, semua fitur berguna, cost kecil, seamless. Cost Governor reduce (terse+lazy inspired by caveman/ponytail but no branding), Stop Slop all-lines, Lane-aware, Crew strengthened.

**Acceptance (from user 2026-08-31):**
- Caveman/ponytail as *inspiration* for cost reduce — reimplement as Mugiwara-native, no branding, no copy
- Stop slop active on all lines (Luffy, Nami, Zoro, Brook, etc.)
- Lane aware meaning: `direct` (1 file <20 LOC) → minimal gate, `full` (9+ files/sensitive) → full gate, lane never drops, budget adapts
- Crew capabilities strengthened — which crew weak?
- Overall seamless & useful

**Constraints:**
- No new runtime deps
- No "caveman"/"ponytail" strings in final content
- Keep `DEFAULT_CONFIG` values, only change *usage*
- Body lines ≤120 per skill, move to `references/` if needed
- 21 skill ceiling — merge, don't add

**Out of scope:**
- `claude-mem` worker integration (optional companion, not core)
- New `lessons.md` format — keep append-only
