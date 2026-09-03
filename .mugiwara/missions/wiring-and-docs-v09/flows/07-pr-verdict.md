# PR Verdict: feat/wiring-and-docs-v09 — Wiring and Docs v0.9.0 (W1-W17)

## Summary
Closes the "built but never wired" class: 5 modules, 3 config keys, collision detector, team isolation — all now connected. Fixes 17 wiring/docs/report gaps (W1-W17), adds 2 gates (config drift, wiring), rewrites report to single-cost-paragraph with Verdict first.

## What changed
- **savepoint.sh**: mode fallback to config (W1), team_member fallback (W3), solo/team guard + migrate (W4), posture/investigation/team_members in state (W5/W6/W8), plan.md registry (W10), slop wiring (W9)
- **src/mission.ts**: wired posture/investigation/adaptive/cognition/scope/slop/evidence via archive (W7/W9/W10), report shape single Cost paragraph, no raw JSONL, Verdict first (W15), What changed/Gates/Decisions/Not verified/Review order
- **src/config.ts**: grouped template with team_member, team_members, lane_scope_glob (W11)
- **src/cli.ts**: migrate --to-team/--to-solo, lesson command (W4/W14), help updated
- **src/args.ts**: added --to-team/--to-solo
- **content/skills/mugiwara-orchestration**: Solo or team Flow 0 section + reference (W2)
- **content/skills/mugiwara-planning**: Sub-missions team only + reference (W6)
- **content/skills/mugiwara-workflow**: mugiwara off no CLI flag (W13)
- **content/skills/mugiwara-lessons**: writer reference (W14)
- **docs/concepts/config.md**: grouped example, added team_member/team_members/lane_scope_glob, machine-read list updated (W11)
- **docs/concepts/features.md**: §29 evaluated location, §10 lesson command (W6/W14)
- **docs/install/cli.md**: migrate variants + lesson (W4/W14)
- **references/multi-actor.md**: new missions/<mission>/ layout, .mugiwara/lessons.md (W12)
- **docs/concepts/comparison.md**: path fix (W12)
- **README.md**: The problem, What you get back, lane table early, Top 5, fixture report-sample (W16)
- **scripts/validate-content.ts**: --check-config, --check-wiring gates (W11/W7)
- **scripts/gate-selftest.ts**: 7 new mutations (W1/W2/W4/W7/W11/W15/W12)
- **test/fixtures/report-sample.md**: fixture for report shape (W16)
- **test/golden**: updated for new reference files
- **.mugiwara/config**: regenerated grouped template (W11)

## Per-flow-stage evidence
- **Flow 0 (Triage)**: Mode read from config verified (auto vs guided), team_member fallback verified via tmp repo savepoint
- **Flow 0 Solo/Team**: orchestration skill + luffy agent updated, validate-content passes
- **Flow 2 Planning**: sub-mission table added, validate-content passes
- **Flow 3 Execute**: savepoint guard verified (solo->team refused, migrate moves, no ghost)
- **Flow 4-7**: wiring verified via --check-wiring, --check-config, posture team-scoped when team_members>1
- **Flow 8 Healing**: not exercised (no failures)
- **Flow 9 Closure**: report shape verified (no raw JSON, single 73%, verdict first, 4-line header), archive removes JSONL without pasting

## Tests
- `bun run typecheck` → pass
- `bun run build` → pass (40 modules, 170KB)
- `bun test` posture/investigation/scope/cognition/adaptive → 135 pass
- `bun scripts/validate-content.ts --check-manifest --check-docs --check-doc-integrity --check-config --check-wiring` → pass
- `bun scripts/lane-base.ts` → pass
- `bun scripts/check-doc-links.ts` → pass
- `bun scripts/verify-install.ts` → pass (320 pointers, 0 orphans)
- `bun scripts/conformance.ts` → 12/12 pass (goldens updated)
- Manual verifications: W1 mode auto, W3 team_member farid.json, W4 guard, W5 team-scoped, W11 config drift fails when lane_scope_glob removed, W13 grep, W14 lesson, W15 report head

## Checks
- `validate-content` gates: index budget 4741/5500, cost.md 4741, config 21 keys, wiring all imported, content valid 21/14
- `lane-base`: constants match
- `verify-install`: pointers resolve, prose paths valid, no new orphans
- `conformance`: 12 platforms pass
- `gate-selftest`: added 7 mutations, each targets missing file check (manual verified for W7/W11)

## Verdict
**GO** — all wiring connected, docs purged, gates added, report shape fixed, README reordered. No breaking changes. Ready for PR.

Branch: `feat/wiring-and-docs-v09` → https://github.com/ionivetech/mugiwara/pull/new/feat/wiring-and-docs-v09

Secrets scan: no secrets found (grep for ghp_, sk_, etc. — clean)
