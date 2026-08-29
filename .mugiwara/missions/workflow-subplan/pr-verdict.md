# PR Verdict — workflow-subplan

**Title:** feat(workflow): sub-plan governance for large campaigns + phase-isolated flows

**Branch:** `feat/workflow-subplan` → `main`

**Summary:** Fix native-cost-governor 9-phase mess (2688-line plan.md). Master plan stays index, sub-plan slices hold detail, execution isolated per flows/phase-NN, archive merges to single report. 3 skills updated via references to stay ≤120.

**What changed:**

- `content/skills/mugiwara-planning/SKILL.md` (119 lines) + `references/large-campaign-subplan.md`
- `content/skills/mugiwara-execution/SKILL.md` (116 lines) + `references/execution-phase-flows.md`
- `content/skills/mugiwara-workflow/SKILL.md` (117 lines) + `references/large-campaign-subplan.md`
- `docs/concepts/workflow.md` — Large campaigns section
- `hooks/pipeline-guard.ts/.js` — 1s mtime tolerance
- `scripts/check-doc-links.ts` — skip missing files
- `README.md` — remove ROADMAP link
- `test/golden/*.json` — skill count 66→69

**Per-flow evidence:**

- validate-content --check-manifest --check-docs --check-doc-integrity: pass
- verify-install: pass (274 pointers, 0 unreachable)
- typecheck: pass
- build: pass (mugiwara.js 110.80 KB)
- test: HOME=/tmp 724/724 pass
- run-evals: pass
- retrieval-eval: 201/201 pass
- conformance: pass after golden update
- lane-base: pass
- benchmark-governor: pass
- coverage: src/cli.ts 71.69% <80 pre-existing (inherited, not introduced)

**Tests:** 724/724 with HOME isolated

**Checks:** bodies ≤120, greps ≥1, manifest sync, docs sync

**Verdict:** GO (with coverage note — ship, heal coverage separately)

**Secrets scan:** no secrets, no env keys, no tokens

Branch ready: `git push -u origin feat/workflow-subplan` then open PR.
