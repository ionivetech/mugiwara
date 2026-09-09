# How do I adopt it?

A crew that fights your workflow loses to your workflow. Adoption works when the harness, the mode, and the pipeline size fit how your team already builds. This guide fits all three before your first mission.

Example: a Claude Code team wanting the full pipeline installs natively, sets `mode=guided` in `.mugiwara/config`, and runs trivial fixes at Lane 0 with zero flow stages. Same crew, same week: small fixes stay light while payment work gets all nine stages.

## Pick your harness

Native installs (Claude Code, opencode, Copilot) register agents plus skills directly. Skills-only installs serve every other tool through the agentskills.io layout. Single-tool users follow their per-harness page from the [install index](../install/index.md).

## Pick your mode

Guided asks everything: plan, branch, commits, ambiguities, check-ins. Semi asks the written plan only, then runs automatically from Flow 3 while still asking real questions. Auto asks nothing, resolving ambiguities internally. Missing config reads as guided; a flip applies from the next flow stage, never mid-stage. State-mutating tests against shared state always need explicit consent, in every mode, with no knob to disable it.

## Fit the pipeline

Trivial one-liners route to Lane 0 and run with zero flow stages. Medium features run triage, plan, execute, checkpoint, quality, gates, review, closure. High-stakes work involving money, security, data, or public API always runs the full pipeline with the adversarial pass and the heal loop. Repos with history read the lessons ledger at triage, so each mission stands on previous ones.

## What the crew never does

It never merges, deploys, or reacts to review comments or CI on its own. It pushes the branch and hands over the verdict file, since PR review is the terminal gate. No flow stage passes on a spoken claim, and no blocker is worked around silently; everything lands in the ledger. Contributors continue at [developer onboarding](developer-onboarding.md).
