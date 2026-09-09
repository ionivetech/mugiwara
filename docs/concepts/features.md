# Features

You inherited a change with unclear size and no obvious entry point. This index maps each need to the page that owns it. Detail lives on the linked pages, never here.

Example: you ask for role-based access control across an API. Luffy sizes the diff to a full lane, Nami plans waves with acceptance checks, Zoro implements with evidence per task, Chopper re-runs each check, Sanji and Franky gate, Robin and Jinbe review, Brook heals failures, Luffy closes with a report plus a ready PR summary. The product is the branch plus `.mugiwara/missions/<mission>/report.md`.

Rule: this page answers "what can it do" at index depth. When a section below matches your need, open its link. That page owns the mechanism.

## Lane sizing that fits the diff

Problem: every change pays the same ceremony, so typos queue behind migrations or migrations ship with typo-level care.
What: the lane is computed from git diff and only ever rises, from direct (no stages) through lean and standard to full (nine stages plus security review).
Proof: `mugiwara status` prints the lane with its reason, for example `lane full (floor; computed lean)`, beside blockers and token budget.
For mixed-size teams. Not for solo scripts nobody reviews. Trade-off: borderline diffs land one lane high, and that caution costs minutes.

## Plans with acceptance checks

Problem: the agent edits before anyone agrees what done means.
What: Nami turns the idea into waves with owners and per-task checks, recorded in `plan.md` before Zoro touches code.
Proof: `mugiwara continue <mission>` prints the exact resume point, and exits nonzero when you must pick from listed options.
For leads who sign off before code exists. Not for one-line fixes, which skip planning by lane rule. Trade-off: planning adds a round trip, and vague asks bounce back with questions. Detail: [workflow](workflow.md).

## Execution with evidence per task

Problem: "tests pass" in chat, with no output attached and no commit per change.
What: Zoro commits per logical task and records the evidence path for each, so every report claim points at a file.
Proof: the closing report lists counts, for example 11 files, +340 / -82, naming sensitive paths such as `src/auth/invitation.ts` outright.
For reviewers who verify instead of trusting. Not for explorations with no branch. Trade-off: commit-per-task slows the middle of the work to speed its review.

## Audits that re-run the checks

Problem: the last stage finished, and nobody independent confirmed it.
What: Chopper audits each finished stage against the plan and files findings without fixing them; high-stakes missions add the Skeptic for adversarial re-verification.
Proof: the report carries a gates ledger, for example checkpoint PASS, quality PASS, coverage PASS with new-code and modified-code percentages.
For teams where the author never grades their own work. Trade-off: findings can send finished work back, and that sting is the feature. Detail: [audit-trail](audit-trail.md).

## Quality and coverage gates

Problem: format, lint, and coverage drift per author mood and per deadline.
What: Sanji runs the repo's real tooling; Franky applies coverage, build, and Definition of Done verdicts as binary PASS or FAIL.
Proof: a failing gate blocks the GO verdict until Brook heals it or a human defers it with an owner named.
For repos with tooling configured. Not for prototypes with no test runner. Trade-off: the gate never negotiates, so weak-coverage legacy code pays debt before shipping.

## Review plus security before merge

Problem: breaking changes hide in large diffs and auth paths ship without a threat pass.
What: Robin maps every breaking change with caller lists; Jinbe runs STRIDE plus OWASP Top 10 plus secrets plus license checks. Neither implements, so findings go to Brook.
Proof: the security line reads 0 high or the mission does not close GO; deferred findings carry an owner in the loose ends.
For auth, payments, and migrations. Not for docs-only lanes, which skip security by rule. Trade-off: review adds latency exactly where rushing hurts most.

## Healing capped at three cycles

Problem: a failed stage loops forever or dies silently with the context.
What: Brook takes ledger failures through root-cause fixes for at most three cycles, then hands the failure to a human with the trail intact.
Proof: `mugiwara status` shows the counter, for example `heal cycle 1/3`, so the cap is visible state, not folklore.
For flaky middle stages worth another attempt. Not for design misses, which return to planning. Trade-off: the cap can abandon recoverable work at cycle four to protect the budget.

## Resume from the exact stage

Problem: a dead session means starting over, re-reading the code, re-paying the tokens.
What: resume rebuilds from `.mugiwara/missions/<mission>/` on disk and continues at the recorded stage, with savepoints marking known-good points.
Proof: `mugiwara continue <mission> [member]` prints the exact resume point; `mugiwara savepoint <mission>` records one.
For long missions on flaky connections. Not for direct-lane work, which finishes first. Trade-off: disk state rules, so hand-editing mission files can confuse the next resume.

## Team split without merge pain

Problem: two agents on one mission overwrite each other and merge the wreckage.
What: one shared plan, per-person state files, conflicts flagged before merge, solo state migrating via `mugiwara migrate --to-team <member>`.
Proof: `mugiwara status --all` reports every actor's wave, tasks, and blockers on one screen.
For pairs and small crews on one mission. Not for solo work. Trade-off: teammates wait on planning before parallel execution starts.

## Cost ledger per mission

Problem: token spend stays invisible until the invoice.
What: every mission carries a budget by lane, warns then stops at the limit, and reports spend in the closing report plus `mugiwara cost --ledger` in human and JSON form.
Proof: the sample report shows `8,781 of 12,000 tokens (73 percent)` beside the verdict, with avoided work and efficiency beside raw spend.
For leads who budget AI spend. Not for flat-rate seats with no metering. Trade-off: the stop is hard, so a mission can halt mid-stage until a human raises the cap. Detail: [cost](cost.md).

## Provenance and signed reports

Problem: months later nobody proves who ran what or whether the report changed since.
What: `mugiwara blame <path>` notes the last commit touching a path, `mugiwara handoff <mission>` writes the report the next engineer acts on, `mugiwara sign <mission>` attests the report.
Proof: `mugiwara sign <mission> --verify` checks the attestation; blame documents the notes ref it reads.
For regulated paths and owner handoffs. Not for internal spikes. Trade-off: signing adds key management, ed25519 by default, that small teams skip until they need it.

## Lessons that survive the mission

Problem: every mission re-learns the migrator flag, then forgets it.
What: the Memory Keeper reads `.mugiwara/lessons.md` at triage and appends at closure; `mugiwara lesson "<text>"` adds a dated row by hand.
Proof: `mugiwara reset --keep-logs` wipes mission state while the lessons ledger survives, which is the point in one flag.
For teams running repeated missions in one repo. Not for one-off visits elsewhere. Trade-off: lessons are repo-local prose, so each codebase earns its own.

## One crew on twelve platforms

Problem: switching editors strands your process behind a half-ported workflow.
What: the same 21 skills and 14 agents ship to Claude Code, opencode, Copilot, Gemini, Codex, Cursor, Kimi, Pi, Windsurf, Cline, Kilo, and Antigravity; only the loading path changes per tier.
Proof: 318 pointers resolve with 0 broken across 9 targets; 216 retrieval probes rank 1 at 95.9 percent, all enforced in CI.
For developers in more than one editor. Not for single-harness shops. Trade-off: tier 3 targets run inline from stub pointers, so large crews run slower there. Detail: [harness matrix](../reference/harness-matrix.md).

## Why this instead of raw agent chat

Problem: raw chat writes code fast and remembers nothing, so review carries the whole burden.
What: Mugiwara adds lane sizing, evidence gates, and a signed report around the agent you already use, without replacing the harness.
Proof: the defensible comparison is structural, one report plus per-task evidence versus a chat log, because outcome studies against other approaches are not measured yet.
For teams bottlenecked on review confidence, not typing speed. Not for generating volume. Trade-off: ceremony costs tokens on small work, and the direct lane keeps that cost near zero.

Measured rollup: 21 skills indexed, 318 pointers with 0 broken, 216 probes at 95.9 percent rank 1 over 170 positives and 82 negatives across 293 terms. Every number comes from `.metrics/latest.json`.

Open [Getting started](../getting-started.md) and hand the crew one real task.
