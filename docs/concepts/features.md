# Features

You inherited a change with unclear size and no obvious entry point. You want one example of the crew handling real work, then a map to the page that owns each detail. This index is that map. Detail lives on the linked pages, never here.

Example: you ask for role-based access control across an API. Luffy sizes the diff to a full lane, Nami writes a plan with waves and acceptance checks, Zoro implements with evidence per task, Chopper re-runs each check, Sanji and Franky gate, Robin and Jinbe review, Brook heals failures, Luffy closes with a report plus a ready PR summary. The product is the branch plus `.mugiwara/missions/<mission>/report.md`.

Rule: this page answers "what can it do" at index depth. When a row below matches your need, open its link. That page owns the mechanism.

| Need | Open | What you find |
|---|---|---|
| Run a mission | [workflow](workflow.md) | Flow 0 to 9 owners, evidence rule, posture summary |
| Size the work | [lanes](lanes.md) | Lane sizing from the diff, rise-only rule |
| Set behavior | [config](config.md) | Keys table, defaults, machine-read split |
| Choose interruptions | [modes](modes.md) | Guided, semi, auto, switch phrase |
| Trust the trail | [audit-trail](audit-trail.md) | Artifacts, reviewer order, archive shape |
| Price the run | [cost](cost.md) | Lane budgets, warn and stop, reported path |
| Match your harness | [harness matrix](../reference/harness-matrix.md) | Tier behavior, conformance cover |
| Enforce the rules | [enforcement](../reference/enforcement.md) | Machine checks versus prose-only rules |

Measured: the skill index covers 21 skills. Pointer checks cover 318 pointers with 0 broken. Retrieval probes count 216 with 95.9% rank 1 over 170 positives and 82 negatives across 293 terms.

## What it is

Mugiwara is the governance layer for AI-assisted engineering work. Every change carries a human-reviewable trail: which flow stage ran, what evidence it produced, who approved it. Lane sizing scales the process from zero flow stages for a typo to nine for an auth migration. Resume rebuilds from disk instead of restarting. Comparison detail folded here from the old positioning page, which now redirects.

## What it refuses

A runtime or daemon. Orchestration stays in the harness. Auto-merge or auto-deploy. Human review at the PR is the terminal gate. Unattended marathon mode. The crew runs inline where you watch each flow stage. Skill-count growth. A new skill replaces an old one.

## When to use something else

Deep autonomous marathon runs with minimal visibility fit a subagent-driven harness better. Reference-encyclopedia depth fits a library of engineering essays better. A deployable agent crew fits a framework with an API runtime better. One instruction with no ceremony needs no pipeline at all.
