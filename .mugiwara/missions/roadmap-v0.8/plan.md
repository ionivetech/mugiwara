# roadmap-v0.8 — campaign plan

Work through the full ROADMAP.md (fresh v0.8) + user-added config bootstrap.
Umbrella plan: mission split into 8 sub-missions, each its own branch + PR
(trunk-based, reviewable diffs). This document holds the split and the
current sub-mission detail (M0). Continuation via continue.json — resume
never restarts.

## Key decisions

- 8 serial sub-missions; no parallel tracks (shared files: config.ts,
  validate-content.ts, floor.json).
- Branch per sub-mission from main; PR per sub-mission; no commits to main.
- M0 lands first: config bootstrap is the foundation for M1 (attestation)
  and M4 (enforcement) — both read `.mugiwara/config`.
- Context7 used for skill grounding in M2/M3 (per user request + roadmap).
- Mode: guided. auto_commit on.

## Architecture overview

- New `src/config.ts`: single shared `readConfig(projectDir)` +
  `ensureConfig(projectDir)` + `DEFAULT_CONFIG` body (extracted verbatim from
  installer). Installer, budget, coverage-gate, cli consume it.
- `savepoint.sh` keeps its shell grep — no cross-language refactor (shell
  cannot import TS; behavior identical, file already read).
- Later missions: M1 extends sign.ts with dual backend; M4 adds
  scripts/check-artifacts.ts as archive gate; M2/M3 harden skills + extend
  validate-content.ts with artifact checks.

## Project structure (touched across campaign)

```
src/config.ts            M0 new
src/installer.ts         M0 use DEFAULT_CONFIG
src/budget.ts            M0 delegate readConfig
src/cli.ts               M0 ensureConfig at run()
src/sign.ts              M1 rewrite (dual backend)
scripts/check-artifacts.ts M4 new
scripts/retrieval-eval.ts M5 per-skill
content/skills/*         M2/M3 hardening
scripts/validate-content.ts M2/M3 artifact gate
evals/cases/retrieval/   M5 new
ROADMAP.md / docs        M6 tracking
```

## Mission split

| Sub | Mission | Branch | Done criteria | Depends |
|-----|---------|--------|---------------|---------|
| M0 | config bootstrap | `feat/roadmap-v0.8` | default config written on first command when missing; shared reader used by installer+budget; tests green | — |
| M1 | dual attestation | `feat/roadmap-v0.8` | sign_backend auto/minisign/pure/off; .mugisig + .minisig; --verify both; tests | M0 |
| M2 | skills batch A | `feat/roadmap-v0.8` | backend/frontend/contract-first/planning/execution 5★; artifact gate in validate-content | — |
| M3 | skills batch B | `feat/roadmap-v0.8` | quality/review/security/gates/checkpoint-healing 5★; artifacts | M2 |
| M4 | enforcement | `feat/roadmap-v0.8` | check-artifacts.ts fails archive on missing plan/flows; state flags computed | M0 |
| M5 | retrieval per-skill | `feat/roadmap-v0.8` | per-skill eval cases; floor re-baselined | M2, M3 |
| M6 | engineering excellence | `feat/roadmap-v0.8` | roadmap tracking doc; no skill labels | — |
| M7 | campaign closure | — | all PRs handed off; mission archived | all |

## Waves

| Wave | Focus | Tasks | Gate |
|------|-------|-------|------|
| 3 | M0 config bootstrap | T1-T4 | `bun test test/config.test.ts` + `bun test test/installer.test.ts test/cli.test.ts` green |

## Task index (M0)

| # | Task | Files | Size | Depends-on | Acceptance |
|---|------|-------|------|------------|------------|
| T1 | shared config module | src/config.ts (new) | M | — | `bun test test/config.test.ts` green; DEFAULT_CONFIG matches installer body |
| T2 | installer uses shared default | src/installer.ts | S | T1 (src/config.ts) | default config written identical bytes; existing config never overwritten |
| T3 | budget delegates reader | src/budget.ts | XS | T1 (src/config.ts) | `bun test` green; readBudgetConfig returns same values |
| T4 | CLI bootstraps config | src/cli.ts | S | T1 (src/config.ts) | first command on fresh project writes .mugiwara/config |

## Detail tasks

**Task 1: shared config module** `[SEQUENTIAL, depends-on: none]`
- Files: create `src/config.ts`
- Interfaces: produces `DEFAULT_CONFIG`, `readConfig(projectDir): Record<string,string>`,
  `ensureConfig(projectDir): boolean` for T2-T4
- Size: M
- Break: none
- Steps:
  - [ ] Write `test/config.test.ts` (failing): ensureConfig writes default on missing; keeps existing; readConfig parses key=value, skips # comments and blanks, trims
  - [ ] Run `bun test test/config.test.ts` — RED
  - [ ] Implement `src/config.ts`: DEFAULT_CONFIG body verbatim from installer.ts:175-189; readConfig scans project then homedir, first-wins; ensureConfig writes DEFAULT_CONFIG only when file missing (lstat symlink guard like installer)
  - [ ] Run `bun test test/config.test.ts` — GREEN; commit `feat(config): shared config reader + bootstrap default`
- Acceptance: `bun test test/config.test.ts` passes; `readConfig` returns known keys from `.mugiwara/config` in repo
- Risk: none

**Task 2: installer uses shared default** `[SEQUENTIAL, depends-on: Task 1 (file: src/config.ts)]`
- Files: modify `src/installer.ts` (lines ~168-190)
- Interfaces: consumes `DEFAULT_CONFIG` from src/config.ts
- Size: S
- Break: none
- Steps:
  - [ ] Replace inline body array with `DEFAULT_CONFIG` import; keep lstat guard + dry-run path
  - [ ] Run `bun test test/installer.test.ts` — GREEN
  - [ ] Verify bytes identical: `bun -e "import('./src/installer.ts')"` compare against committed default
  - [ ] Commit `refactor(installer): use shared DEFAULT_CONFIG from config.ts`
- Acceptance: `bun test test/installer.test.ts` green; installer writes same default body
- Risk: none

**Task 3: budget delegates reader** `[SEQUENTIAL, depends-on: Task 1 (file: src/config.ts)]`
- Files: modify `src/budget.ts`
- Interfaces: consumes `readConfig` from src/config.ts
- Size: XS
- Break: none
- Steps:
  - [ ] Replace readBudgetConfig scan loop with `readConfig(base)['context_budget_chars']`
  - [ ] Run `bun test` (closure tests) — GREEN
  - [ ] Commit `refactor(budget): read config via shared reader`
- Acceptance: `bun test test/closure-runtime.test.ts test/mission.test.ts` green
- Risk: none

**Task 4: CLI bootstraps config** `[SEQUENTIAL, depends-on: Task 1 (file: src/config.ts)]`
- Files: modify `src/cli.ts` (run() entry, ~line 22)
- Interfaces: consumes `ensureConfig` from src/config.ts
- Size: S
- Break: none
- Steps:
  - [ ] Test: fresh tmp project dir (no .mugiwara), invoke `mugiwara status --project <tmp>` → expect .mugiwara/config created with DEFAULT body
  - [ ] Implement: in `run()`, before command dispatch, `ensureConfig(projectDir)` (project scope only)
  - [ ] Run `bun test test/cli.test.ts` — GREEN; manual: `bun run build && node dist/mugiwara.js status` in clean dir
  - [ ] Commit `feat(cli): bootstrap .mugiwara/config on first command when missing`
- Acceptance: fresh project gets config on any command; existing config untouched; `bun test test/cli.test.ts` green
- Risk: none

## Risk & rollback

- **Config drift:** if ensureConfig writes while installer also writes — both guarded by exists/lstat check; idempotent. Rollback: revert M0 branch, delete config.ts.
- **savepoint.sh divergence:** shell grep stays — no refactor, no risk.
- **Byte-identical default:** T2 verifies; rollback trivial (single commit revert).

## Definition of Done (M0)

- [ ] All 4 tasks committed, conventional messages
- [ ] `bun test` full suite green
- [ ] `bun run typecheck` + `bun run build` green
- [ ] Manual smoke: fresh project bootstrap
- [ ] PR verdict written, branch pushed, user opens PR

## Mission split note

M0 done → continue.json points to M1 (dual attestation). M1 plan written
after M0 PR handed off. Sub-missions after M0 documented in spec.md;
detailed plans written per sub-mission at its turn.

## M1 — Dual attestation (sub-mission detail)

Branch: feat/roadmap-v0.8 (single general campaign branch — amendment: no per-mission branches). Roadmap item 1.

### Task index

| # | Task | Files | Size | Depends-on | Acceptance |
|---|------|-------|------|------------|------------|
| T1 | pure ed25519 backend | src/sign.ts | M | M0 config.ts | `npx vitest run test/sign.test.ts` green; .mugisig JSON written+verified round-trip |
| T2 | backend resolution + config key | src/sign.ts, src/cli.ts | M | T1 | sign_backend=auto|minisign|pure|off honored; tests green |
| T3 | --gen-key | src/cli.ts, src/sign.ts | S | T2 | `mugiwara sign --gen-key --backend pure` writes ~/.mugiwara/mugiwara.key+.pub; tests |
| T4 | verify both backends + docs | src/sign.ts, help text | S | T3 | `--verify` tries minisig then mugisig; help updated; tests |

### Detail

**T1 pure backend** — node:crypto ed25519: `generateKeyPairSync('ed25519')`,
detached sig via `sign(null, data, key)`; `.mugisig` JSON
`{algo:"ed25519-pure",sig,pub,mission,commit,ts}` base64 fields. Guard: key
missing → honest skip. Context7 already verified API (Flow 1 evidence).

**T2 resolution** — read `sign_backend` via `readConfig` (M0). auto: hasMinisign
+ key → minisign path; else pure path (gen key on demand). minisign: force
binary, fail loud. pure: force node:crypto. off: skip signing. Never fake a
signature.

**T3 --gen-key** — `--backend pure|minisign` flag; pure writes
`~/.mugiwara/mugiwara.key/.pub` (32B base64), minisign shells out
`minisign -G`. Refuse overwrite without --force.

**T4 verify both** — verifyReport tries `.minisig` via binary, then `.mugisig`
via crypto.verify. Update help text. Existing closure-runtime tests keep
passing (minisign stub path unchanged).

## M2 — Skills batch A (sub-mission detail, roadmap item 2 batch 1/2)

Branch: feat/roadmap-v0.8 (single campaign branch). Files: 5 skill dirs +
validate-content.ts + docs. Lane 3.

### Task index

| # | Task | Files | Size | Depends-on | Acceptance |
|---|------|-------|------|------------|------------|
| T1 | backend 5★ | content/skills/mugiwara-backend/ | M | — | gate_artifact field; clean-arch/Prisma/Express/OTel specifics; context7 cites |
| T2 | frontend+design system 5★ | content/skills/mugiwara-frontend/ | M | — | tokens/primitives/useActionState/CWV specifics; gate_artifact |
| T3 | contract-first 5★ | content/skills/mugiwara-contract-first/ | M | — | Zod/OpenAPI/envelope/versioning; gate_artifact |
| T4 | planning 5★ | content/skills/mugiwara-planning/ | M | — | context scan/waves/CODEOWNERS; gate_artifact |
| T5 | execution 5★ | content/skills/mugiwara-execution/ | M | — | boy-scout/knip/strict/TDD; gate_artifact |
| T6 | artifact gate in validate-content.ts | scripts/validate-content.ts + test | M | T1-T5 (reads frontmatter) | gate_artifact field required+valid; validator test; missing = FAIL |

### Detail

**Contract (diputuskan Nami):** setiap skill 5★ menambah frontmatter
`gate_artifact: <path-pattern> — <apa yang diverifikasi>` (mis.
`flows/01-execution.md cited doc link` untuk backend). validate-content.ts
(baru) memvalidasi: field ada, pattern non-empty, menyebut flows/ atau
reference yang bisa diverifikasi. Chopper di Flow 4 memverifikasi artifact
benar-benar ada di flows/. Ini mengubah "prose sound" → "measured".

**[PARALLEL] proof:** T1-T5 = 5 file dirs independen, tidak ada file
bersama (tiap skill punya dir sendiri). validate-content.ts (T6) hanya
dibaca, bukan diedit, selama T1-T5. Parallel aman.

**Context7 (instruksi user):** tiap worker memakai context7 untuk
grounding — backend: Prisma $transaction/select/include/@@index;
frontend: React useActionState, CLS/LCP/INP; contract: Zod safeParse;
planning/execution: patterns dari source-grounding. Skill body menyebut
`Context7`/doc links, bukan brand names (roadmap: behavior, no labels).

## M4 — Enforcement (sub-mission detail, roadmap item 4)

Branch: feat/roadmap-v0.8. Files: scripts/check-artifacts.ts (new),
src/mission.ts (archive gate), src/integrity.ts, test. Lane 2.

### Tasks

| # | Task | Files | Acceptance |
|---|------|-------|------------|
| T1 | check-artifacts.ts (new script) | scripts/check-artifacts.ts | Lane 2+ mission (state.json lane) must have plan.md + flows/01-execution.md; exit 1 with list when missing; 0 when ok |
| T2 | archive gate wiring | src/mission.ts archiveMission | check-artifacts runs before fold; missing artifacts fail archive (like secret gate) |
| T3 | state flags computed | scripts/savepoint.sh + state fields | review_depth/quality_depth/verify_merged computed into state.json (heal_halt pattern) |
| T4 | tests | test/check-artifacts.test.ts + mission tests | unit tests for T1-T3 |

## M5 — Retrieval per-skill (sub-mission detail, roadmap item 5)

Branch: feat/roadmap-v0.8. Files: evals/cases/retrieval/<skill>.json (new),
scripts/retrieval-eval.ts (load retrieval/*.json), floor re-baseline. Lane 2.

### Tasks

| # | Task | Files | Acceptance |
|---|------|-------|------------|
| T1 | per-skill retrieval cases for 11 hardened skills | evals/cases/retrieval/*.json | prompts berbasis context7-grounded knowledge (Prisma/Express/React/Zod/ESLint/OWASP/Sonar); positive + negative per skill |
| T2 | retrieval-eval.ts loads retrieval/ subdir | scripts/retrieval-eval.ts | cases dibaca tanpa collision dengan existing cases |
| T3 | run + re-baseline floor | evals/floor.json | rank-1 ≥ 94% retained; --update-floor deliberate |

### Detail

Retrieval cases = prompt ke skill description (TF-IDF). Positive: prompt
konkret dari capability skill (mis. "Prisma transaction dengan rollback" →
mugiwara-backend). Negative: prompt dari skill LAIN (harus TIDAK match).
Context7 ground truth = prompt dirancang dari knowledge yang sudah di-cite
di skill body (M2/M3). T2: loader scan evals/cases/retrieval/*.json sebagai
bagian dari covered set (skill key wajib).
