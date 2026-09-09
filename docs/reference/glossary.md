# What does this word mean?

Two pages calling different things a "wave" cost a team an afternoon. This page fixes each word once, names the preferred term where two overlap, and every other page defers to it.

Example: a plan document schedules work in "waves" while the pipeline runs "flow stages". Same team, same week, unrelated meanings. Below, Wave (planning) and Flow stage stay separate entries so the collision never repeats.

- **Mission**: one governed unit of work under `.mugiwara/missions/<name>/`, from triage to closure plus archive.
- **Flow stage**: one pipeline step, Flow 0 triage through Flow 9 closure. Older texts say "wave"; prefer flow stage.
- **Wave (planning)**: an execution batch inside a plan document. Unrelated to flow stages, never a directory name.
- **flows/**: the mission flow-artifact directory. Legacy missions keeping `waves/` stay on it so live trails never split.
- **Lane**: process size for a change: direct, lean, standard, full, or spike. Computed from the diff; sensitive paths force full.
- **Mode**: autonomy level: guided, semi, or auto. Set in `.mugiwara/config`.
- **Control mode**: the participation decision. Independent from execution posture and Cost Governor.
- **Execution posture**: how work runs: inline-sequential by default, batched, parallel workers, context relief, phase isolated, or team scoped. Chosen at flow boundaries, recorded in the decision trail.
- **Cost Governor**: the spend-safety decision: reserve, project, avoid, or stop verdicts with a recorded optimization trail. Recommends and records, never silently skips a safety stage.
- **Slop**: wasted cost the governor flags: repeated reads, useless abstraction, healing spin, out-of-scope work.
- **Savepoint**: state written at each flow-stage boundary. Powers resume and every computed command.
- **Continue**: deterministic resume printing the exact pickup point.
- **Evidence**: recorded artifact behind a claim. Claims without evidence never pass a flow stage.
- **Gate**: binary pass or fail with evidence. No negotiation.
- **Blocker ledger**: rows for failures needing help. Ship-readiness needs it empty or owned.
- **Heal cycle**: one Brook pass over accumulated failures, bounded at three; a fourth halts and escalates.
- **Banner**: the flow-stage heading marking stage start; its absence means the stage was skipped, recorded.
- **Check-in**: Luffy's boundary report: what happened, evidence links, next route.
- **Trail**: everything under `.mugiwara/`: plans, flow artifacts, findings, decisions, blockers. Folds into `report.md` at archive.
- **Archive**: folding the trail into `report.md` after the integrity gate passes.
- **Provenance**: per-commit attribution as git note plus `provenance.md`. See [provenance](../concepts/provenance.md).
- **Policy**: `mugiwara.policy.yml`, org rules pushing lanes and thresholds up only. See [policy as code](../concepts/policy-as-code.md).
- **Index budget**: the 5,500-char ceiling on skill plus agent descriptions loaded cold each session.

Counts govern everywhere: 21 skills, 11 user-facing agents plus 3 internal.
