# Plan — seamless-pipeline: Seamless Pipeline & Output Discipline

Fixes N1–N9 (instructions the model cannot follow; references to deleted/never-built things) plus gates so the next batch must be a new defect shape. Branch `fix/seamless-pipeline`.

## Tasks

- [ ] 1.1 N1 Option A — restore `mugiwara initiative` (`src/initiative.ts`: `status` + `conflict-check`; case-insensitive header; split Touched Files on commas+whitespace; malformed-table → exit 1 with header hint; no section → exit 0 solo). Register `case 'initiative'` in `src/cli.ts`. Restore `test/initiative.test.ts` (7 cases). VERIFY: conflict-check exit 1 on shared file; 7 tests pass.
- [ ] 1.2 N4 — extend `--check-doc-integrity` in `scripts/validate-content.ts`: every `` `mugiwara <cmd>` `` in content/docs/references must exist as `case '<cmd>'` in `src/cli.ts` (skip in-session `mode`/`off`, skip `--flags`). VERIFY: passes; removing `case 'archive'` fails it.
- [ ] 4.1 N3 — `scripts/savepoint.sh`: accept `quick` for both depth keys, alias undocumented `lean` → `quick`, fallback `full`. VERIFY: quick→quick, standard→standard, full→full, lean→quick, bogus→full.
- [ ] 4.2 N6 — extend `--check-config`: compare documented enum values vs code allowlists both directions for `mode, verbosity, review_depth, quality_depth, verify_merged, auto_commit, sign, enforce`. VERIFY: passes; docs `turbo` value fails it.
- [ ] 2.1 N2 — rewrite `references/wave-banners.md` rendering rules to one unconditional markdown-heading form, no ANSI; keep colour table for plugin; update `mugiwara-workflow:40` + `mugiwara-orchestration:84` examples. VERIFY: zero `38;2;` in all three; `Flow N —` present; plugin test passes.
- [ ] 3.1 N5 — flow-summary-line contract in `mugiwara-orchestration`; red-flag line in 7 skills (execution, quality, gates, checkpoint, review, security, healing). VERIFY: section present; validate-content clean.
- [ ] 3.2 — short-command rule in `mugiwara-execution` step budget.
- [ ] 2.2 — banner recording in `hooks/engagement-marker.ts` + warning (never block) in `hooks/pipeline-guard.ts`. VERIFY: hooks banner test.
- [ ] 1.3 N7 — resolve `mugiwara lessons import` promise (default Option B: remove promise, hand-append instruction; Option A only if shareable-lessons story matters — decision logged before implementing). VERIFY per chosen option.
- [ ] 1.4 N8 — mark `mugiwara mode` in-session in `mugiwara-workflow:46` + check `docs/concepts/modes.md:97`, `docs/concepts/features.md:153`. VERIFY: zero `` `/mugiwara mode` `` in content/; ≥2 `no CLI flag` in workflow skill.
- [ ] 1.5 N9 — README 9+3 platform split + marketplace error path in `src/cli.ts`. VERIFY: cursor error names marketplace manifest; README has `9 via install`.
- [ ] 5.1 Mutations — one per fix in `scripts/gate-selftest.ts`; each must turn selftest red.
- [ ] 5.2 Banner-format check in `validate-content.ts`: no raw ANSI escapes in model-facing instructions under content//references (colour table in wave-banners.md exempt as plugin data).

## Acceptance
`bun run gate && bun scripts/gate-selftest.ts && bun scripts/conformance.ts`; `validate-content --check-config --check-wiring --check-doc-integrity`; `bun test`; all 11 spec acceptance boxes ticked.
