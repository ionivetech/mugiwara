# The Techniques — 25 Skills

Each skill is a portable markdown playbook — the "how to" the crew follows when
it embodies a role. Skills are the actual content; agents are the personas.

## Core pipeline

| Skill | Enforces |
|-------|----------|
| `mugiwara-workflow` | The harness entry point: inline execution model, gateway triage, wave pipeline, workspace layout, blocker protocol, cleanup |
| `mugiwara-orchestration` | Luffy's captain behavior: 5-way classifier, check-ins, work splitting, decision log, closure |
| `mugiwara-brainstorm` | Usopp's critical sparring: interrogate, research facts, cut over-engineering, recommend |
| `mugiwara-planning` | Interview-first, full-context scan, wave plans with parallel/sequential markers + anti-patterns |
| `mugiwara-execution` | Todo list, sequential tasks inline + parallel worker batches, 6-field delegation for parallel work, one commit per logical task |
| `mugiwara-checkpoint` | Verify-everything audit — deduped and scoped to the wave's diff; failure rows to the blocker ledger |
| `mugiwara-quality` | Discover the project's real tooling; formatter, linter, unit tests under the consent matrix |
| `mugiwara-gates` | Coverage ≥90% new / ≥80% modified, build validation, Definition of Done |
| `mugiwara-review` | Doubt-driven review: breaking-change analysis, five-axis, severity-tagged findings |
| `mugiwara-security` | OWASP-driven security review, untrusted-data doctrine, severity by exploitability × impact |
| `mugiwara-healing` | Reads the ledger, Stop-the-Line + Prove-It root-cause fixes, rollback prep |

## Mission control

| Skill | Enforces |
|-------|----------|
| `mugiwara-mode` | Runtime levels guided / semi / auto, consent invariants, gated auto-GO, push + ready-PR terminal |
| `mugiwara-git` | Atomic commits, save-points, multi-commit splitting, bisect/blame debugging |
| `mugiwara-testcases` | User-test intake (ATDD): immutable-gold rule, declarative-AC routing, consent, failure adjudication |
| `mugiwara-pr` | CI/CD loop terminal: one verdict file + push via plain git; stop-at-PR invariant |
| `mugiwara-ship` | GO/NO-GO ship gate: pre-launch checklist, feature flags, rollback plan |
| `mugiwara-deprecation` | Sunset & migration discipline: keep-or-retire gate, cutover playbooks, safe schema changes |
| `mugiwara-resume` | Session resume: rebuild state from `.mugiwara/` after compaction/loss; never restart |
| `mugiwara-lessons` | Cross-mission memory: actionable lessons ledger, read at triage, written at closure |
| `mugiwara-observability` | Trace the crew: structured logs, OTel-compatible spans, session correlation |

## Domain & advanced

| Skill | Enforces |
|-------|----------|
| `mugiwara-frontend` | Anti-slop frontend: audit-first redesigns, design-system extraction, slop list |
| `mugiwara-backend` | Backend/server code: repo standards first, API design, data integrity, error handling, security |
| `mugiwara-agent-security` | Secure the agent layer: prompt injection, memory poisoning, excessive agency, secrets, sandboxing |
| `mugiwara-dynamic-workflow` | Runtime workflow patterns: fan-out-and-synthesize, tournament, loop-until-done, classify-and-act |
| `mugiwara-eval` | Test the harness itself: task suites, judge-agent rubric comparison, pass/fail per case |

## Anatomy of a skill

Every skill is a single `SKILL.md` with frontmatter + a playbook body:

```markdown
---
name: mugiwara-checkpoint
description: Use after an execution wave to audit results against the plan. ...
---

# Checkpoint (Chopper)

<playbook: protocol, rules, red flags, iron law>
```

See [skill-anatomy.md](skill-anatomy.md) for the details.
