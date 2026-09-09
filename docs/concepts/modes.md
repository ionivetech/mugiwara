# Modes

An agent that asks at every step wastes your day. One that never asks ships surprises. This page answers "guided, semi, or auto" with one example, then the level table. Set the interruption level once per mission instead of negotiating it at every flow stage.

Example: you steer a sensitive auth change in guided mode and approve each flow stage. Friday night you hand a typed fix to auto mode and review the branch Monday. Same pipeline, different pause points. The terminal step never moves: push plus ready PR summary, and you open the PR.

Rule: mode owns autonomy, config owns writing standards. Mode is read once per flow stage. A flip applies from the next flow stage, never mid-stage. Mode never implies an execution posture or a cost tier.

| Level | Plan | Execution | Questions |
|---|---|---|---|
| guided | You approve every step | Ask before each flow stage | Ask you |
| semi | You approve the written plan | Auto from execution to ship | Ask you when real |
| auto | Auto | Auto to ship, your member scope in teams | Crew resolves internally |

Guided is the default and fits unfamiliar or risky work. Semi fits a trusted plan you still want to bless: manual up to the written GO, then the crew self-manages branch, commits, quality, gates, review, heal, and closure. Auto fits typed batches: triage through closure without asking, brainstorm plus Luffy call for ambiguities, pause only on a genuine blocker or heal halt.

One config lever bends the terminal step. With `auto_commit=off`, guided and semi hand you an uncommitted tree with the exact commands. Auto always commits. Consent for state-mutating tests against shared state is never a mode knob. Verbosity controls echo depth, never what review needs. Switch in session by saying `mugiwara mode auto`. The tracker hook writes config and logs the change.
