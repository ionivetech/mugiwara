# Workflow

You asked for a change and now ten strangers seem to own pieces of it. You cannot tell who runs first, what each hands over, or where parallel work is safe. This page answers "how does a mission run" with one example, then the stage table. Each flow stage is owned by one crew member and runs inline in the main conversation.

Example: you ask for role-based access control. Luffy triages to a full lane and logs the route. Nami writes a plan with waves, tasks, and acceptance checks. Zoro executes test-first with evidence per task. Chopper re-runs each check. Sanji and Franky gate. Robin and Jinbe review in parallel. Brook heals failures. Luffy closes with a report, a push, and a ready PR summary.

Rule: evidence over claims, and the plan is the source of truth. No flow stage passes on assertion. The owning agent runs the checks and shows output. A skipped flow stage is logged, never silent.

| Flow stages | Owner | Output |
|---|---|---|
| 0 Triage | Luffy | Route decision plus reason |
| 1 Brainstorm, 2 Planning | Usopp, Nami | Options, then plan with criteria |
| 3 Execution | Zoro | Tasks done with evidence |
| 4 Checkpoint, 4.5 Adversarial | Chopper, Skeptic | Audit plus ledger, findings when called |
| 5 Quality, 6 Gates | Sanji, Franky | Lint and test results, coverage and DoD |
| 7 Review | Robin plus Jinbe | Severity-tagged findings |
| 8 Healing | Brook | Fixes, back to Flow 4, at most 3 cycles |
| 9 Closure | Luffy | Report, push, PR verdict for you to open |

Execution posture is absorbed here from the old execution-model page, which now redirects. Control mode, execution posture, and Cost Governor are three independent decisions. Mode decides approvals. Posture decides how work runs: inline-sequential by default, parallel-workers for proven-independent batches, context-relief under pressure, phase-isolated for large campaigns, team-scoped for shared missions. The governor decides what spend is safe. Luffy records posture at Flow 0, Nami resolves it at Flow 2, and it re-evaluates only at stage or batch boundaries.

Subagents parallelize, never hide. Independent batches run one worker per task, Brook fans out independent fixes, checkers re-run diff passes in workers, and context pressure dispatches remaining tasks one at a time in plan order. Every worker returns a banner, a one-line verdict, and an evidence path. Sequential work stays inline. Each flow stage opens with one heading banner and mirrors progress into the host todo tool in the same response the evidence lands.
