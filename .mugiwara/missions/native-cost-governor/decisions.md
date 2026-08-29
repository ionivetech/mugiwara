# native-cost-governor — decision log

Every row records its actor: `user: <name> <<git email>>` or `AI: <model>`.
Optimization decisions (cost governor) and route decisions (orchestrator)
live here; the plan doc stays clean.

## Flow 0 — Triage (Luffy)

- **Actor:** AI: deepseek-v4-flash
- **Request:** Build the Native Cost Governor per `context.md` (58-section
  plan, 9 implementation phases).
- **Class:** explicit — detailed spec exists; only open choice is sequencing,
  resolved by the plan's own phase structure (§51).
- **Lane:** 3 (Full) — spans `src/budget.ts`, `src/mission.ts`, new cost
  governor domain, state schema, CLI, tests, docs.
- **Mode:** auto (from `.mugiwara/config`) — check-in verdicts logged without
  pausing.
- **Route:** Flow 0 → Flow 2 (Nami). Flow 1 (brainstorm) skipped — reason:
  spec is exhaustive (objectives, architecture, dimensions, phases, DoD,
  success criteria); options and trade-offs already explored in the doc; no
  unknown requirements to interrogate. Evidence: `spec.md` §1–§58.
- **Scope decision:** this mission = Phase 1 (Cost Governor Foundation) only.
  Reason: §51 defines sequential phases; Phase 1 ("normalize existing cost
  state, centralize budget/threshold handling, introduce cost events +
  optimization decision records, preserve existing behavior") is the base
  every later phase builds on. Folding 9 phases into one mission would be
  scope slop (plan §21.8). Later phases become follow-up missions.
- **Foundation verified:** `src/budget.ts`, `src/mission.ts`, `src/routing.ts`,
  `src/config.ts`, `src/policy.ts`, `scripts/lane-base.ts` present — matches
  plan §3 claims. Evidence: repo listing.
- **Branch:** `feat/native-cost-governor` (from `main`; no commits to `main`).
- **Plan impact:** Phase 1 lands on this branch + PR; phases 2–9 are
  follow-up missions split in plan.md.

## Flow 1 — Brainstorm (Usopp)

- **Decision:** skipped.
- **Reason:** requirements explicit and implementation localized to existing
  primitives; plan already documents options/trade-offs.
- **Plan impact:** none — route direct to Flow 2.

## Flow 2 → 3 — Check-in (Luffy)

- **Actor:** AI: deepseek-v4-flash
- **Verdict:** GO — plan approved as written (ca7da80).
- **Reason:** plan satisfies zero-question standard; scope = Phase 1 only per
  triage; every task command-verifiable; sequential chain (shared files
  mission.ts/cost.ts — no false [PARALLEL]); runtime behavior preserved
  (savepoint.sh/lane-base.sh/DEFAULT_CONFIG untouched).
- **Plan impact:** hand off to Flow 3 (Zoro, execution). No revision requested.

## Flow 3 — Execution start (Zoro)

- **Actor:** AI: deepseek-v4-flash
- **Mode:** auto — branch auto-created (feat/native-cost-governor), auto-commit per task (conventional). auto_commit=on.
- **Plan:** T1–T5 sequential, no [PARALLEL]. Executing inline.

## Flow 5 — Scope override (user)

- **Actor:** user: ionive <ionivetech@gmail.com>
- **Decision:** campaign runs to completion — execute ALL 9 Cost Governor
  phases (plan §51) until the Cost Governor is genuinely done; do not stop
  after Phase 1.
- **Reason:** explicit user instruction ("sampai phase akhir, cost governor
  benar-benar selesai").
- **Plan impact:** supersedes the Phase-1-only triage scope. Sequencing model
  unchanged (per plan Mission split): each phase = own branch + PR from main,
  trunk-based, reviewable diffs (roadmap-v0.8 precedent). Phase N branches
  after Phase N-1's PR is handed to the user for merge. Campaign spans
  multiple sessions via continue.json; auto mode → no stopping for approval
  between phases. Current phase (1) completes first, then Phase 2 onward.

## Flow 0 — Phase 2 triage (Luffy)

- **Actor:** AI: deepseek-v4-flash
- **Phase 2 (Context Governor) — plan §51:** explicit class, Lane 3, auto mode.
- **Branch:** continues on feat/native-cost-governor (stacked — Phase 1 foundation reused).
- **Flow 1 skipped:** §51 + §10–13 exhaustive.
- **Architecture decision:** context accounting via TS module mirroring the Phase-1
  pattern (shell savepoint.sh stays the runtime source; TS measures + machine-checks
  parity). Chosen for consistency with Phase 1 + preserving savepoint.sh.
- **Plan impact:** Nami plans Phase 2 on this basis.

## Resume — session continuation (Luffy)

- **Actor:** AI: deepseek-v4-flash
- **Resumed:** native-cost-governor, Flow 3→ (Phase 2), via `mugiwara continue`.
  Phase 1 5/5 tasks done, GO, branch feat/native-cost-governor pushed
  (up to date with origin, 17 commits over main).
- **next_action verified against plan + todos:** consistent. Phase 2 is the
  scope-override campaign's next phase (Flow 0 — Phase 2 triage logged above).
  No contradiction.
- **Plan impact:** proceed to Flow 2 — Nami plans Phase 2 (Context Governor,
  spec §10–13), extending plan.md. Branch continues stacked on
  feat/native-cost-governor.

## Flow 2 → 3 — Phase 2 plan check-in (Luffy)

- **Actor:** AI: deepseek-v4-flash
- **Verdict:** GO — Phase 2 plan approved as written (Nami, appended to plan.md).
- **Reason:** 7 tasks (T1–T7) in 3 waves; honest `[PARALLEL]` sets (T1–T4
  file+interface disjoint; T5–T6 disjoint, all Wave-1 interfaces shipped).
  Architecture matches the logged Phase 2 triage (TS module, savepoint.sh
  untouched). Review items absorbed: P1 (delegateAt clamp), S2 (recordOptDecision
  \r\n strip), Q1 (costEnvelope live), C2 (token status on lane budget, chars on
  context_budget_chars), Q2 (status once); laneBaseForLane/delegateAt consumption
  explicitly deferred to Phase 3. Config call accepted: three commented
  `investigation_*` keys in DEFAULT_CONFIG (mirrors `context_budget_chars`,
  §52 policy boundaries, no behavior change, T3 updates pinned-string test
  in-scope). Honest Phase-2 = measurement-not-enforcement boundary logged.
- **Plan impact:** hand off to Flow 3 (Zoro, execution). Auto mode → no user GO
  pause; proceed to Zoro.

## Flow 4–6 — Phase 2 checkpoint, quality, gates (Luffy)

- **Actor:** AI: deepseek-v4-flash
- **Flow 4 (Chopper):** PASS — every acceptance criterion re-run independently,
  7/7 tasks, no blockers. Note: `bun test <file>` shim fails closure family
  (`vi.setConfig is not a function`) predates Phase 2; real gate runner is
  `vitest run` and passes.
- **Flow 5 (Sanji):** PASS — dup 0%, maint A, typecheck clean, no must-fix.
  Two LOW nits deferred to Phase 3: (a) `CostEvent.context_metrics` shape
  duplicated inline vs importing `ContextMetrics`; (b) archive metrics row can
  show `duplicate_chars:0` when a registry exists (misread risk).
- **Flow 6 (Franky):** GO — `bun run gate` exit 0 (483/483 tests), coverage
  PASS (mission.ts 94.28% ≥80), DoD 8/8, savepoint.sh/lane-base.sh untouched.
- **Plan impact:** continue to Flow 7 review + security.

## Flow 7 — Phase 2 review (Robin) + security (Jinbe)

- **Actor:** AI: deepseek-v4-flash
- **Review (Robin):** FAIL with must-fix. H1 High — `context-registry.jsonl`
  not folded into report nor removed → survives loose, parity broken with
  cost-events.jsonl. M1 Med — efficiency row shows `duplicate_chars:0`/
  `read_avoidance_chars:0` (hardcoded 0) beside real `reuse_rate>0`
  (contradictory). M2 Med — `context_status:'over'` unreachable (archive throws
  first → every persisted closure event is 'ok'). Reliability 6.5/10.
- **Security (Jinbe):** PASS — no Crit/High, Hotspots A, SCA A. S1 (.jsonl in
  TRAIL_EXTS) and S2 (recordOptDecision sanitize) confirmed fixed; zero new
  deps. F4 (context-registry.jsonl missing from archive fold) corroborates
  Robin's H1 — not a blocker now (no production writer) but must close.
- **Heal routing:** H1, M1, M2 → Brook (Flow 8, cycle 1). Security F1
  (loadRegistry shape validation) deferred to Phase 3 wiring. F2/F3 (Low)
  accepted.
- **Plan impact:** enter Flow 8 healing. heal_cycle → 1.

## Flow 8 — heal cycle 1 (Brook) + re-verification (Luffy)

- **Actor:** AI: deepseek-v4-flash
- **Brook healed all 3 must-fix, root-cause, proven by test:**
  - H1 `17b4c7c` — context-registry.jsonl now folded into report.md + removed at archive (survival parity with cost-events.jsonl).
  - M1 `115785a` — registry entries carry `chars`; real duplicate_chars/read_avoidance_chars accounting; `n/a (char data not tracked)` fallback so reuse_rate>0 never coexists with fabricated 0.
  - M2 `5ca71bb` — over-budget closure now records `context_status:'over'` event BEFORE the gate throws (ledger captures the condition, doesn't erase it).
- **Re-verification (Luffy):** heal commits verified in git log; `bun run gate` re-run — **exit 0** (coverage PASS, mission.ts 94.41%). The only intermittent red (enforcement.test.ts "escape #2") is the documented pre-existing flake: reproduced on clean `main` (2/3 fail) in this session — proven NOT a Phase-2 regression, tracked as separate fix mission (blockers row 3), Phase-1 shipped with same caveat. Not burning Phase-2 heal cycles on it.
- **Plan impact:** Phase 2 code clean, gates green. Proceed to Flow 9 closure + ship.

## Flow 9 — Phase 2 closure + ship (Luffy)

- **Actor:** AI: deepseek-v4-flash
- **Ship gate:** GO — PR-ready internal change (no deploy/flag/rollout; N/A).
  Ship checklist: build exit 0, 486 tests + coverage PASS, docs updated,
  secrets scan clean (PR verdict + closure grep negative), rollback = revert
  Phase-2 commits. Evidence: flows/06-closure.md, flows/07-pr-verdict.md.
- **Pushed:** `feat/native-cost-governor` → origin @ dfc7982. Tree clean.
- **savepoint:** state.json written (flow=1, next phase start). continue.json
  next_action rewritten for Phase 3 (machine savepoint had reset to generic).
- **Plan impact:** Phase 2 complete. Campaign continues at Phase 3 (Work
  Governor). Next session resumes via `mugiwara continue`.
- **Deferred (tracked):** enforcement.test.ts escape#2 flake (separate fix
  mission); security F1/F2/F3 harden at Phase-3 wiring; quality nits
  (context_metrics inline shape).

## Flow 0 — Phase 3 triage (Luffy)

- **Actor:** AI: deepseek-v4-flash
- **Request (resumed via `mugiwara continue`):** Phase 3 (Work Governor), plan
  §51: required/conditional/optional stage classification, evidence-backed
  stage skipping, agent invocation control, skill loading control, delegation
  optimization, completion detection. Wire the Phase-2 signals into the agent
  flow (Phase 2 was measurement-only).
- **Class:** explicit — spec §51 Phase 3 enumerates the six deliverable
  capabilities; consumed signals are Phase-2 verdicts.
- **Lane:** Full — spans cost governor domain, agent-flow wiring, state
  schema, tests, docs.
- **Mode:** auto (from `.mugiwara/config`) — campaign runs to completion.
- **Route:** Flow 0 → Flow 2 (Nami, extend plan.md with Phase 3 detail +
  waves) → Flow 3 (Zoro, execute). Flow 1 (brainstorm) skipped — same reason
  as Phase 1/2: spec §51 is explicit, options already in spec + plan.
- **Branch:** continue on `feat/native-cost-governor` (stacked, Phase 1+2
  unmerged).
- **Deferred security hardening:** F1 (loadRegistry shape validation) + F4
  (context-registry fold — actually closed by H1 `17b4c7c`) resolved during
  Phase-3 wiring; F2/F3 (Low) accepted.
- **Plan impact:** plan.md gains a Phase 3 section (Nami); tasks wired from
  §51 + Phase-2 signals.

## Flow 0 — Phase 4 triage (Luffy)

- **Actor:** AI: deepseek-v4-flash
- **Request (resumed via `mugiwara continue`):** Phase 4 (Scope & Code
  Governor), spec §51 Phase 4: scope drift detection, existing-code reuse
  checks, abstraction justification, dependency justification, minimum
  sufficient implementation policy, code waste detection, change-surface
  measurement. Consumes Phase-1 cost + Phase-2 context + Phase-3 work governor
  primitives.
- **Class:** explicit — spec §51 Phase 4 enumerates the seven deliverable
  capabilities; consumed signals are the shipped Phase 1/2/3 primitives
  (`src/cost.ts`, `src/context.ts`, `src/work.ts`, `src/investigation.ts`).
- **Lane:** Full — spans scope-governor domain, code-governor analysis,
  wiring, tests, docs.
- **Mode:** auto (from `.mugiwara/config`) — campaign runs to completion.
- **Route:** Flow 0 → Flow 2 (Nami, extend plan.md with Phase 4 detail +
  waves) → Flow 3 (Zoro, execute). Flow 1 (brainstorm) skipped — same reason
  as Phases 1–3: spec §51 is explicit, options already in spec + plan.
- **Branch:** continue on `feat/native-cost-governor` (stacked, Phase 1+2+3
  unmerged).
- **Heal debt carried forward:** enforcement.test.ts escape#2 flake (separate
  mission); security F2/F3 (Low) accepted, harden at Phase 8.
- **Plan impact:** plan.md gains a Phase 4 section (Nami); tasks wired from
  §51 + the shipped primitives.

## Flow 8 — Phase 4 heal cycle 1 (Brook + Luffy)

- **Actor:** AI: deepseek-v4-flash
- **Blocker (Chopper checkpoint):** T2 (eb8229d) removed two governance lines
  from `content/skills/mugiwara-workflow/SKILL.md` — `Precedence: class decides
  whether there is work; lane decides how much process — class first, lane
  second.` and `Brook reads this at Flow 8. Never silently work around a
  blocker.` — not declared in plan. Zoro claimed "120-line validator cap"
  forced it; Chopper read the cap as chars/line.
- **Root cause (Brook verified):** the real validator (`validate-content.ts:19`)
  caps body at **120 LINES**, not chars. Base + HEAD both sit at exactly 120
  body lines. Zoro's deletion WAS necessary to fit Phase-4's `## Scope & Code
  Governor` section. Chopper's char-per-line premise was false. Restoring the 2
  lines + keeping the section = 123 lines → gate red (proven, then reverted).
- **Luffy scope call — Option A:** move the `## Scope & Code Governor` body to
  `content/skills/mugiwara-workflow/references/scope-code-governor.md` with a
  one-line pointer in SKILL.md (the repo's sanctioned pattern for sections >
  budget; zero content loss; needs `verify-install` green). Restores the 2
  governance lines, keeps all Phase-4 content, stays ≤120 lines.
- **Plan impact:** T2 deliverable shape changes from inline section to
  references pointer. `bun run gate` + `verify-install` must stay green.
- **Heal counter:** heal_cycle=1 (one `## Flow 8 — healing` section logged).

## Flow 8 — Phase 4 heal cycle 2 (Franky gate + Brook)

- **Actor:** AI: deepseek-v4-flash
- **Blocker (Franky gates, Flow 6):** `bun run gate` exit 1. Two failures over
  two attempts: (1) the known pre-existing enforcement escape#2 flake
  (reproduced on clean base, NOT a Phase-4 regression — waivable, attempt 2
  cleared it), and (2) a **genuine Phase-4 regression** — conformance:
  `test/conformance.ts` `.file_count.skills: 62 ≠ 61` for claude + opencode.
  Phase 4 added `content/skills/mugiwara-workflow/references/scope-code-governor.md`
  (af8a204), bumping installed tier-1 skill files 61→62, but
  `test/golden/*.json` were not regenerated. Verified base 3490284 conformance
  passes (61/61); HEAD regression is Phase-4-caused. Not waivable.
- **Root cause:** the heal fix (Option A, af8a204) added a new reference file
  without running the conformance golden update. Missing regression gate: any
  file-count/install-surface change must regenerate goldens.
- **Fix (Brook):** run `bun scripts/conformance.ts --update-golden`, review the
  diff (must be only the file-count delta 61→62 for the new reference file, no
  unrelated golden changes), commit the goldens, re-run `bun run gate` to
  confirm green.
- **Plan impact:** T3 gate requires conformance goldens regenerated; verify
  `bun run gate` exit 0.
- **Heal counter:** heal_cycle=2 (two `## Flow 8 — healing` sections logged).
