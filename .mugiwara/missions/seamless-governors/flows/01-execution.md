# Flow 3 — Execution (Zoro) — Wave 1 T1-T2

**Mission:** seamless-governors · **Branch:** feat/seamless-governors · **Mode:** auto · **Lane:** full
**Actor:** AI: muse-spark-1.2-contributor-free · **Commit style:** conventional · **auto_commit:** on (auto mode always)

## Task table

| # | Task | Status | Evidence link |
|---|------|--------|---------------|
| T1 | Merge 5 governors → 1 references/cost-governor.md | ✅ | [references/cost-governor.md](../../../references/cost-governor.md) · [content/skills/mugiwara-workflow/SKILL.md](../../../content/skills/mugiwara-workflow/SKILL.md) |
| T2 | Wire cost-governor reduce — Zoro pre-check | ✅ | [content/skills/mugiwara-execution/SKILL.md](../../../content/skills/mugiwara-execution/SKILL.md) · [content/skills/mugiwara-orchestration/SKILL.md](../../../content/skills/mugiwara-orchestration/SKILL.md) |

## Evidence detail

### T1 — Merge 5 governors → 1 references/cost-governor.md

- Created `references/cost-governor.md` — single source merging cognitive-output, scope-code, stop-slop, adaptive-budget, benchmark. Ladder: Does this need to exist? → Already in codebase? → Stdlib? → Native platform? → Installed dep? → One line? → Only then code. Also covers terse output Decision/Action/Result/Evidence, dedup fingerprint, slop taxonomy (§21 8 kinds, signals §22, measurement §23, anomaly §24, intervene tolerate/stop/compress/escalate §20, six detectors), budget reserve/projection (§26), thresholds (§28 60/75/90/100/150/300), breaker (§29 2×), benchmark 4 workloads + 12 slop scenarios + 3 stress + ratchet.
- Must NOT contain strings "caveman" or "ponytail": `grep -i` clean — `grep -R -i "caveman|ponytail" references/cost-governor.md` → 0 hits.
- Updated `content/skills/mugiwara-workflow/SKILL.md`: Rules §2 now points to `_shared/references/cost-governor.md` (was 2a-2g 5-file list), Governors section replaced with `## Cost governor` single pointer. Body 113/120.
- Updated `content/skills/mugiwara-orchestration/SKILL.md`: Lane routing paragraph now includes `Cost: ladder + terse output + slop + budget — Full checklist: _shared/references/cost-governor.md`. Body 119/120.
- Deleted 5 old governor files:
  - `content/skills/mugiwara-workflow/references/cognitive-output-governor.md`
  - `content/skills/mugiwara-workflow/references/scope-code-governor.md`
  - `content/skills/mugiwara-workflow/references/stop-slop-governor.md`
  - `content/skills/mugiwara-workflow/references/adaptive-budget-governor.md`
  - `content/skills/mugiwara-workflow/references/benchmark-governor.md`
- Validation:
  - `bun run build` → Bundled 34 modules, hooks built — exit 0
  - `bun scripts/validate-content.ts --check-manifest --check-docs --check-doc-integrity` → manifest sync, index budget 4741/5500, docs sync, content valid 21 skills 14 agents — exit 0
  - `bun run typecheck` → exit 0
  - `bun scripts/verify-install.ts` → 290 pointers, 0 broken, 0 orphans — exit 0
  - `grep -R -i "caveman|ponytail" content/ references/` → clean

### T2 — Wire cost-governor reduce — Zoro pre-check

- Updated `content/skills/mugiwara-execution/SKILL.md`: appended to Code quality floor paragraph `Before adding code: ladder reuse helper?→stdlib?→native?→installed dep?→one line?→code — Full checklist: _shared/references/cost-governor.md`. Minimal diff (1 line extended), body 119/120.
- Execution skill now references governor via `_shared/references/cost-governor.md`; verify-install proves pointer resolves (290 pointers checked).
- Validation same as T1: build, validate-content, verify-install, typecheck all green.

## Deviations

None. Deleted 5 files instead of stubbing — stubs would have become orphans (no inbound pointer after workflow update), deletion keeps orphan baseline 0. Kept body ≤120 via single-line extension, not new section.

## Next

→ Wave 2 T3-T4 lane-aware gates & cost auto-compress per plan.md.

→ Flow 4 — Chopper (Checkpoint)
