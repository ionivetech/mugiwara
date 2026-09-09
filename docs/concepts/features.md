# Features

You inherited a change with unclear size and no obvious entry point.
This index maps each need to the page that owns it.
Detail lives on the linked pages, never here.

Example: you ask for role-based access control across an API.
Luffy sizes the diff to a full lane, Usopp sharpens the vague edges, Nami plans waves with acceptance checks, Zoro implements with evidence per task, Chopper re-runs each check, Sanji and Franky gate, Robin and Jinbe review, Brook heals failures, Luffy closes with a report plus a ready PR summary.
The product is the branch plus `.mugiwara/missions/<mission>/report.md`.

Rule: this page answers "what can it do" at index depth.
When a section below matches your need, open its link.
That page owns the mechanism.
Sections follow four reader jobs: run missions, review proof, adopt as a team, extend the crew.

## Run missions

### Lane sizing that fits the diff

Problem: every change pays the same ceremony, so typos queue behind migrations or migrations ship with typo-level care.
What: the lane is computed from git diff and only ever rises, from direct (no stages) through lean and standard to full (nine stages plus security review). The orchestration and workflow skills own the routing, Luffy announces it at triage.
Proof: `mugiwara status` prints the lane with its reason, for example `lane full (floor; computed lean)`, beside blockers and token budget.
For mixed-size teams. Not for solo scripts nobody reviews. Trade-off: borderline diffs land one lane high, and that caution costs minutes.

### Brainstorm before you plan

Problem: the request is a paragraph with three possible meanings, and planning any one of them wastes a wave.
What: the brainstorm skill interrogates the idea, researches with the web where facts matter, and returns options with trade-offs instead of a stamp. Usopp runs it before Nami plans anything.
Proof: the surviving option enters `plan.md` with owners attached, and the rejected options stay recorded in the trail with reasons.
For vague ideas and architecture forks. Not for typed fixes with an obvious shape. Trade-off: interrogation adds a round trip, and thin asks get questioned harder than their author hoped.

### Plans with acceptance checks

Problem: the agent edits before anyone agrees what done means.
What: the planning skill turns the idea into waves with owners and per-task checks, recorded in `plan.md` before Zoro touches code. Nami owns the document.
Proof: `mugiwara continue <mission>` prints the exact resume point, and exits nonzero when you must pick from listed options.
For leads who sign off before code exists. Not for one-line fixes, which skip planning by lane rule. Trade-off: planning adds a round trip, and vague asks bounce back with questions. Detail: [workflow](workflow.md).

### Contracts before code

Problem: the API shape gets negotiated in review comments after the implementation already depends on it.
What: the contract-first skill writes the interface, the error semantics, and the versioning discipline first, with boundary validation named before behavior. Review then checks conformance, not taste.
Proof: breaking-change callers land in the plan as named tasks, and Robin verifies each one against the written contract at review.
For APIs and interfaces other code will depend on. Not for internal refactors with no boundary. Trade-off: the contract round trip slows day one to protect month six.

### Execution with evidence per task

Problem: "tests pass" in chat, with no output attached and no commit per change.
What: the execution skill commits per logical task and records the evidence path for each, so every report claim points at a file. Backend and frontend skills carry repo standards into the change, and the git skill keeps commits atomic with save-points along the way. Zoro runs all of it.
Proof: the closing report lists counts, for example 11 files, +340 / -82, naming sensitive paths such as `src/auth/invitation.ts` outright.
For reviewers who verify instead of trusting. Not for explorations with no branch. Trade-off: commit-per-task slows the middle of the work to speed its review.

### Modes for how closely you watch

Problem: an agent that asks at every step wastes your day, and one that never asks ships surprises.
What: guided asks before each flow stage, semi runs from an approved plan, auto runs triage to closure and pauses only on a genuine blocker. A flip applies from the next stage, never mid-stage.
Proof: the report header records the mode, for example `lane full, mode guided`, and the terminal step never moves: push plus a ready PR summary that you open.
For owners who want the autonomy dialed per mission. Not a cost tier and never an execution posture. Trade-off: auto buys speed with attention debt, and the debt lands in review. Detail: [modes](modes.md).

### Healing capped at three cycles

Problem: a failed stage loops forever or dies silently with the context.
What: the healing skill takes ledger failures through root-cause fixes, reproduce, localize, reduce, then guard, for at most three cycles. Then it hands the failure to a human with the trail intact. Brook owns the loop.
Proof: `mugiwara status` shows the counter, for example `heal cycle 1/3`, so the cap is visible state, not folklore.
For flaky middle stages worth another attempt. Not for design misses, which return to planning. Trade-off: the cap can abandon recoverable work at cycle four to protect the budget.

### Resume from the exact stage

Problem: a dead session means starting over, re-reading the code, re-paying the tokens.
What: the resume skill rebuilds from `.mugiwara/missions/<mission>/` on disk and continues at the recorded stage, with savepoints marking known-good points. The Resume coordinator owns the rebuild.
Proof: `mugiwara continue <mission> [member]` prints the exact resume point; `mugiwara savepoint <mission>` records one.
For long missions on flaky connections. Not for direct-lane work, which finishes first. Trade-off: disk state rules, so hand-editing mission files can confuse the next resume.

### Ship with a binary verdict

Problem: launch day brings a thread of maybe, and maybe ships.
What: the ship skill runs the pre-launch checklist, staged rollout, and the mandatory rollback plan, then returns GO or NO-GO with no third option. Luffy records the verdict in the closing report.
Proof: a NO-GO names the blocking finding, its owner, and the re-entry stage, so the next session starts at the gate, not at zero.
For anything with users on the other side. Not for spikes nobody will run twice. Trade-off: the checklist blocks hopeful ships, and hope was doing real work for morale.

## Review proof

### Audits that re-run the checks

Problem: the last stage finished, and nobody independent confirmed it.
What: the checkpoint skill audits each finished stage against the plan and files findings without fixing them. The checkpoint skill carries an adversarial depth that double-checks done claims with an extract, doubt, and reconcile pass. Chopper runs the audit, and high-stakes missions add the Skeptic for adversarial re-verification.
Proof: the report carries a gates ledger, for example checkpoint PASS, quality PASS, coverage PASS with new-code and modified-code percentages.
For teams where the author never grades their own work. Trade-off: findings can send finished work back, and that sting is the feature. Detail: [audit-trail](audit-trail.md).

### Quality and coverage gates

Problem: format, lint, and coverage drift per author mood and per deadline.
What: the quality skill runs the repo's real tooling for format, lint, duplication, and complexity. The gates skill applies coverage, build, and Definition of Done verdicts as binary PASS or FAIL. Sanji finds the tooling, Franky calls the verdict.
Proof: a failing gate blocks the GO verdict until Brook heals it or a human defers it with an owner named.
For repos with tooling configured. Not for prototypes with no test runner. Trade-off: the gate never negotiates, so weak-coverage legacy code pays debt before shipping.

### Review plus security before merge

Problem: breaking changes hide in large diffs and auth paths ship without a threat pass.
What: the review skill maps every breaking change with caller lists across five axes. The security skill runs STRIDE plus OWASP Top 10 plus secrets plus license checks. Robin and Jinbe run them, and neither implements, so findings go to Brook.
Proof: the security line reads 0 high or the mission does not close GO; deferred findings carry an owner in the loose ends.
For auth, payments, and migrations. Not for docs-only lanes, which skip security by rule. Trade-off: review adds latency exactly where rushing hurts most.

### User test cases as immutable gold

Problem: acceptance lives in a chat message, and the message scrolls away before review.
What: the testcases skill takes declared user cases in any intake format and freezes them as immutable gold. Runs then pass against the frozen cases, and a failure goes to adjudication, never to silent editing of the expectation.
Proof: the report cites each case by id with its verdict, and a changed expectation appears in the trail as a human decision with a name.
For missions where the requester names the acceptance outright. Not for exploratory work with no oracle. Trade-off: frozen cases can encode a misunderstanding, and thawing one costs a recorded decision.

### Outcome honesty, including what is missing

Problem: every tool page claims superiority, and none shows the study.
What: the Eval Runner scores skill behavior in the harness so regressions surface in CI. The comparison this page absorbs names the structural difference instead of inventing a winner: one report plus per-task evidence versus a chat log.
Proof: the defensible comparison is structural, because outcome studies against other approaches are not measured yet, and the measured rollup below keeps that row empty.
For teams bottlenecked on review confidence, not typing speed. Not for generating volume. Trade-off: ceremony costs tokens on small work, and the direct lane keeps that cost near zero.

## Adopt as a team

### Team split without merge pain

Problem: two agents on one mission overwrite each other and merge the wreckage.
What: one shared plan, per-person state files, conflicts flagged before merge, solo state migrating via `mugiwara migrate --to-team <member>`.
Proof: `mugiwara status --all` reports every actor's wave, tasks, and blockers on one screen.
For pairs and small crews on one mission. Not for solo work. Trade-off: teammates wait on planning before parallel execution starts.

### Cost ledger per mission

Problem: token spend stays invisible until the invoice.
What: every mission carries a budget by lane, warns then stops at the limit, and reports spend in the closing report plus `mugiwara cost --ledger` in human and JSON form. The governor phases behind it record decisions to the trail without ever forcing the model.
Proof: the sample report shows `8,781 of 12,000 tokens (73 percent)` beside the verdict, with avoided work and efficiency beside raw spend.
For leads who budget AI spend. Not for flat-rate seats with no metering. Trade-off: the stop is hard, so a mission can halt mid-stage until a human raises the cap. Detail: [cost](cost.md).

### One crew on every harness

Problem: switching editors strands your process behind a half-ported workflow.
What: the same 20 skills and 14 agents ship to Claude Code, opencode, Copilot, Gemini, Codex, Cursor, Kimi, Pi, Windsurf, Cline, Kilo, and Antigravity; only the loading path changes per tier.
Proof: 322 pointers resolve with 0 broken across 9 targets; 216 retrieval probes rank 1 at 95.9 percent, all enforced in CI.
For developers in more than one editor. Not for single-harness shops. Trade-off: tier 3 targets run inline from stub pointers, so large crews run slower there. Detail: [harness matrix](../reference/harness-matrix.md).

### Lessons that survive the mission

Problem: every mission re-learns the migrator flag, then forgets it.
What: the lessons skill has the Memory Keeper read `.mugiwara/lessons.md` at triage and append at closure; `mugiwara lesson "<text>"` adds a dated row by hand.
Proof: `mugiwara reset --keep-logs` wipes mission state while the lessons ledger survives, which is the point in one flag.
For teams running repeated missions in one repo. Not for one-off visits elsewhere. Trade-off: lessons are repo-local prose, so each codebase earns its own.

### Provenance and signed reports

Problem: months later nobody proves who ran what or whether the report changed since.
What: `mugiwara handoff <mission>` writes the report the next engineer acts on (with `--path`, plus the provenance note for that path), `mugiwara sign <mission>` attests the report.
Proof: `mugiwara sign <mission> --verify` checks the attestation; blame documents the notes ref it reads.
For regulated paths and owner handoffs. Not for internal spikes. Trade-off: signing adds key management, ed25519 by default, that small teams skip until they need it.

## Extend the crew

### Every skill, no gaps

Problem: a catalog that names ten favorites hides the eleventh you needed.
What: all 20 skills, each owned by the sections above. Run missions: orchestration, workflow, brainstorm, planning, contract-first, execution, backend, frontend, git, healing, root-cause, resume, ship. Review proof: checkpoint (with adversarial depth), quality, gates, review, security, testcases. Adopt and extend: lessons.
Proof: the skill index holds 20 entries in CI, and every name in this list resolves to `content/skills/<name>/SKILL.md` in the repo.
For anyone checking cover before adopting. Trade-off: the roster looks large on first read, and the lane system exists so small work never loads all of it. Detail: [skills](skills.md).

### Every agent, no gaps

Problem: a role with no name never gets called.
What: all 14 agents. Captain Luffy triages, runs check-ins, records decisions, closes. Usopp interrogates vague ideas. Nami plans. Zoro executes. Chopper audits. Skeptic re-verifies. Sanji runs quality tooling. Franky calls gate verdicts. Robin reviews diffs. Jinbe runs security. Brook heals. Resume rebuilds dead sessions. Memory Keeper carries lessons. Eval Runner scores behavior.
Proof: every install ships the whole crew, 11 specialists plus 3 internal helpers, with the call moment per member in [agents](agents.md).
For leads assigning ownership per stage. Trade-off: fourteen names take one reading to learn, and after that the call is one sentence.

Measured rollup: 20 skills indexed, 322 pointers with 0 broken, 216 probes at 95.9 percent rank 1 over 170 positives and 82 negatives across 284 terms. Every number comes from `.metrics/latest.json`.

Open [Getting started](../getting-started.md) and hand the crew one real task.
