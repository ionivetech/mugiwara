# What skills exist?

A role without a playbook improvises. Each skill below carries the portable markdown playbook the crew follows when it embodies a role: 21 skills, loaded on demand, measured at 95.4% rank-1 over 221 retrieval probes with 342 pointers resolving and 0 broken.

Example: a vague request arrives and Luffy must decide the route. Luffy loads `mugiwara-orchestration`, runs the 5-way triage, and records the decision. The playbook decided the shape before any work started.

## Core pipeline

Start and run the mission: enter through gateway triage (`mugiwara-workflow`), command the crew (`mugiwara-orchestration`), argue with a vague idea until it holds (`mugiwara-brainstorm`), turn the survivor into a plan (`mugiwara-planning`), run the plan with evidence per task (`mugiwara-execution`), audit each finished stage (`mugiwara-checkpoint`), check formatting and tests (`mugiwara-quality`), judge coverage, build, and Definition of Done (`mugiwara-gates`), review the diff (`mugiwara-review`), probe it for attacks (`mugiwara-security`), and fix failures in bounded cycles (`mugiwara-healing`).

## Mission control and practice

Control the mission: commit atomically with [save-points](../../content/skills/mugiwara-git/SKILL.md#save-point-pattern) (`mugiwara-git`), take in user tests (`mugiwara-testcases`), call the ship verdict (`mugiwara-ship`), resume dead sessions (`mugiwara-resume`), and remember across missions (`mugiwara-lessons`). Practice the engineering: hunt root causes (`mugiwara-root-cause`) and design contract-first (`mugiwara-contract-first`).

## Domain

Change the product: redesign the interface (`mugiwara-frontend`), guard data on the server (`mugiwara-backend`), and move schemas and frameworks (`mugiwara-migration`).

Skill file layout and the one-line pointer rule live in the [skill anatomy](../reference/skill-anatomy.md).
