# PR verdict — roadmap v0.8 complete (M0-M6)

## Title

feat: roadmap v0.8 — config bootstrap, dual attestation, 5★ skills, enforcement, retrieval evals

## Summary

Full ROADMAP.md v0.8 implemented on a single branch (user decision), 5
roadmap items + 1 user-added item:

1. **Config auto-bootstrap** (user): `.mugiwara/config` written on first
   command, shared `src/config.ts` reader.
2. **Dual attestation** (item 1): `sign_backend=auto|minisign|pure|off` —
   pure node:crypto ed25519 fallback (zero deps) + minisign selectable,
   `--gen-key`, `--verify` both backends, seed key 0600.
3. **Skills 3★→5★** (item 2): 11 practical skills hardened — source-grounded
   via Context7 (Prisma, Express, React, Tailwind, Zod, ESLint, OWASP,
   Sonar docs), measured with concrete numbers, `gate_artifact` validator in
   validate-content.ts.
4. **Engineering excellence** (item 3): constraint verified — no brand
   labels, roadmap tracks the bar.
5. **Enforcement advisory→measured** (item 4): `check-artifacts.ts` archive
   gate (Lane 2+ needs plan.md + flows/), depth flags computed in state.json.
6. **Retrieval per-skill** (item 5): 11 per-skill eval cases (Context7-
   grounded prompts), floor re-baselined to rank-1 95.6%.

## What changed

- `src/config.ts` (new), `src/sign.ts` (dual backend), `src/cli.ts`,
  `src/args.ts`, `src/installer.ts`, `src/budget.ts`, `src/mission.ts`
  (archive gate), `src/check-artifacts.ts` (new)
- `scripts/validate-content.ts` (gate_artifact + lane sync),
  `scripts/lib/lane-base.sh` (constants), `scripts/savepoint.sh` (depth
  flags), `scripts/retrieval-eval.ts` (retrieval/ subdir loader)
- `content/skills/*` 11 skill dirs (5★ hardening, no brand labels)
- `evals/cases/retrieval/*.json` (11 new), `evals/floor.json` (95.6)
- Tests: config 8, sign 16, cli 27, closure-runtime 14, check-artifacts 5,
  validate-content 6, lane-integrity 32 — all green

## Per-flow-stage evidence

| Misi | Roadmap item | Verdict | Evidence |
|------|--------------|---------|----------|
| M0 config bootstrap | (user) | GO | flows/02-audit.md (M0) |
| M1 dual attestation | 1 | GO | smoke: gen-key→sign→verify mugisig |
| M2 skills batch A | 2 (1/2) | GO | gate_artifact ×5, context7 cites |
| M3 skills batch B | 2 (2/2) | GO | lane sync, doc-integrity |
| M4 enforcement | 4 | GO | archive gate smoke-verified |
| M5 retrieval per-skill | 5 | GO | 201/201, floor 95.6% |
| M6 engineering excellence | 3 | GO | brand-label grep clean |

## Tests

- `npx vitest run`: 405/407 — 2 pre-existing (targets.test.ts 5s timeout,
  enforcement.test.ts flake), both proven on base main, tracked in
  blockers.md, NOT this diff.
- Retrieval eval: 201/201, rank-1 95.6% (floor 93.5 → 95.6).
- Coverage: unmeasurable only due to the same pre-existing targets timeout;
  all mission files covered by direct unit tests.

## Checks

typecheck ✅ · build ✅ · validate-content ✅ (4741/5500) · lane-base ✅ ·
run-evals ✅ · retrieval 95.6% ✅ · verify-install ✅ (0 problems) ·
`npm audit` 0 vulns ✅ · secrets scan clean ✅

## Verdict

**GO** — full roadmap v0.8 complete. 25 commits, linear, revertable, no
blockers, no criticals. PR size exceeds 400 LOC guideline (user decision:
single-branch campaign) — recorded, not waived.

## Branch

`feat/roadmap-v0.8` — pushed, 25 commits. **User opens the PR.** Crew never
merges, never deploys.
