# What does this word mean?

Two pages using one word for different things cost a team an afternoon. This page fixes each word once, in plain language, and every other page defers to it.

Example: a plan schedules work in "waves" while the pipeline runs in "stages". They are different things. Wave and Flow stage below stay separate entries so the two never collide.

- **Mission**: one governed unit of work under `.mugiwara/missions/<name>/`, from triage to closure and archive.
- **Flow stage**: one pipeline step, Flow 0 (triage) through Flow 9 (closure). The user-facing word for a stage.
- **Wave**: an ordered group of tasks Zoro runs together. Nami's plan lists tasks in waves. A wave is never a stage and never a directory name.
- **flows/**: the mission directory holding one file per stage. Files are numbered in the order written, not by stage number. Older missions that kept a `waves/` directory stay on it.
- **Lane**: the process size for a change: direct, lean, standard, full or spike. Computed from the diff. Sensitive paths force full.
- **Mode**: how often the crew asks you: guided, semi or auto. Set in `.mugiwara/config`. A mission keeps the mode it started in.
- **Execution posture**: how work runs, for example inline one task after another, or in parallel workers. Chosen at stage boundaries and recorded in the decision trail. Independent of mode and cost.
- **Cost governor**: the part of the crew that watches process spend against the lane budget and records warn or stop decisions. It recommends and records. It never silently skips a safety stage.
- **Slop**: wasted work the governor flags: repeated reads, needless abstraction, a fix loop going nowhere, out-of-scope changes.
- **Savepoint**: the state snapshot written at each stage boundary. Resume and every computed command read it. Normally automatic.
- **Continue**: resume that prints the exact pickup point without running anything.
- **Evidence**: the recorded output behind a claim. A claim without evidence does not pass a stage.
- **Gate**: a pass or fail check with evidence. No negotiation.
- **Blocker ledger**: the list of failures that need help. Shipping needs it empty or every row owned.
- **Heal cycle**: one fix-and-recheck attempt by Brook. The limit is the `heal_max_cycles` config key (3 by default). After that the crew hands the failure to a human.
- **Banner**: the one heading line that marks the start of a stage. Its absence means the stage was skipped, and that is recorded.
- **Check-in**: Luffy's boundary report: what happened, evidence links, next step.
- **Trail**: everything under `.mugiwara/`: plans, stage files, findings, decisions, blockers. It folds into `report.md` at archive.
- **Archive**: folding the trail into `report.md` once the integrity checks pass.
- **Provenance**: a record of which mission, lane and evidence produced a change. See [signing and provenance](../optional/signing.md).
- **Policy**: `mugiwara.policy.yml`, org rules that push lanes and thresholds up only. See [policy](../concepts/policy.md).
- **Index budget**: the 5,500-character ceiling on skill and agent descriptions that load at the start of every session.

Counts everywhere: 14 skills, 11 agents (+2 internal).
