# Who does what?

Eleven specialists plus three internal helpers look like an answer. They form a roster: 11 agents (+3 internal). The question at mission start is which member to call for the work in front of you. Each agent below names its role and the moment to summon it.

Example: the last flow stage finished and you want it checked. Say "Chopper, audit the last flow stage against the plan". Luffy records the route, Chopper audits, findings land in the ledger. Direct calls never skip check-ins.

## The crew

Captain: Luffy triages, runs check-ins, records decisions, closes missions. Luffy never implements code.

Planning: Usopp interrogates vague ideas and researches before recommending. Nami turns the surviving idea into an execution plan.

Execution: Zoro runs approved plans with evidence per task and commits per logical change.

Audit: Chopper verifies flow-stage results and reports failures without fixing them. Skeptic re-verifies adversarially on high-stakes missions.

Quality and gates: Sanji finds the repo's real tooling and runs format, lint, tests, duplication, complexity. Franky applies coverage, build, and Definition of Done verdicts.

Review and security: Robin maps breaking changes and rates the diff. Jinbe runs STRIDE, OWASP Top 10, secrets, and license checks. Neither implements; findings go to Brook.

Recovery and memory: Brook fixes ledger failures in at most three cycles. Resume rebuilds state after context loss and continues without restarting. Memory Keeper reads lessons at triage and writes them at closure. Eval Runner scores skill behavior in the harness.

## Shape of the install

Every install ships the whole crew: 11 agents plus 3 internal, alongside 20 skills. No selection step, the router picks the specialist per task. Agent file layout lives in [agent anatomy](../reference/agent-anatomy.md); technique catalog in [skills](skills.md).

## Roster

Eleven user-facing, three internal (file slug in `content/agents/` beside each summon moment):

- Captain `luffy-orchestrator`, triage to closure
- Sparring partner `usopp-brainstorm`, vague ideas
- Planner `nami-planner`, spec to task plan
- Executor `zoro-execution`, approved plans only
- Auditor `chopper-checkpoint`, flow-stage verdicts
- Adversarial check `skeptic-verifier`, high-stakes second look
- Quality `sanji-quality`, format, lint, tests
- Gates `franky-gates`, coverage, build, Definition of Done
- Reviewer `robin-reviewer`, breaking-change map
- Security `jinbe-security`, STRIDE and secrets
- Healer `brook-healing`, bounded fix cycles
- Resumer `resume-coordinator`, dead sessions continue
- Memory `memory-keeper`, lessons across missions
- Eval runner `eval-runner`, behavior scores
