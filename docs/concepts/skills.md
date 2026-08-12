# The Techniques — 26 Skills

Each skill is a portable markdown playbook — the "how to" the crew follows when
it embodies a role.

## Core pipeline

| Skill | Teaches |
|-------|---------|
| `mugiwara-workflow` | Harness entry: inline execution, gateway triage, wave pipeline, workspace, blocker protocol, cleanup |
| `mugiwara-orchestration` | Captain: 5-way classifier, check-ins, work splitting, decision log, closure |
| `mugiwara-brainstorm` | Critical sparring: interrogate, research facts, cut over-engineering, recommend |
| `mugiwara-planning` | Interview-first, full-context scan, wave plans with parallel/sequential markers, team sub-mission planning |
| `mugiwara-execution` | Todo list, sequential inline + parallel worker batches, 6-field delegation, one commit per task |
| `mugiwara-checkpoint` | Verify-everything audit — deduped re-runs scoped to wave diff; failure rows to blocker ledger |
| `mugiwara-quality` | Discover project tooling; formatter, linter, duplication detection, complexity scoring, maintainability rating (A–E), code attribute checks, unit tests |
| `mugiwara-gates` | Coverage ≥90% new / ≥80% modified, build, DoD, granular sonar gate: vulnerabilities, bugs, code smells, duplications — per-condition thresholds |
| `mugiwara-review` | Doubt-driven review: breaking-change map, five-axis, reliability rating (A–E), code attribute deep review, severity-tagged findings |
| `mugiwara-security` | STRIDE-first security review, OWASP Top 10, security hotspots, SCA license, authn/authz, secrets, responsibility attribute |
| `mugiwara-healing` | Reads the ledger, Stop-the-Line + Prove-It root-cause fixes, rollback prep |

## Mission control

| Skill | Teaches |
|-------|---------|
| `mugiwara-git` | Atomic commits, save-points, multi-commit splitting, bisect/blame debugging |
| `mugiwara-testcases` | User-test intake: immutable-gold rule, declarative-AC routing, consent, failure adjudication |
| `mugiwara-pr` | Terminal: push + verdict file with ready PR summary; never creates a PR |
| `mugiwara-ship` | GO/NO-GO ship gate: pre-launch checklist, feature flags, rollback plan |
| `mugiwara-sunset` | Sunset & migration: keep-or-retire gate, cutover playbooks, safe schema changes |
| `mugiwara-resume` | Session resume: rebuild state from `.mugiwara/state.json`; never restart |
| `mugiwara-lessons` | Cross-mission memory: actionable lessons ledger, read at triage, written at closure |

## Engineering practice

| Skill | Teaches |
|-------|---------|
| `using-mugiwara` | Crew overview, pipeline summary, onboarding reference. Documentation reference; `mugiwara-orchestration` is the gatekeeper. |
| `mugiwara-root-cause` | 4-phase: reproduce → localize → reduce → fix + guard; stop-the-line |
| `mugiwara-contract-first` | Contract-first design, error semantics, boundary validation, backward compatibility |
| `mugiwara-claim-audit` | Adversarial verification: CLAIM → EXTRACT → DOUBT → RECONCILE → STOP |
| `mugiwara-context-budget` | Token/context management: feed selectively, trust-sort sources, the window is a budget |

## Domain

| Skill | Teaches |
|-------|---------|
| `mugiwara-frontend` | Anti-slop frontend: audit-first redesigns, design-system extraction, WCAG 2.1 AA |
| `mugiwara-backend` | Backend/server code: repo standards first, source-backed code, data integrity |
| `mugiwara-agent-security` | Agent layer: prompt injection, memory poisoning, excessive agency, MCP trust, sandboxing |

## Anatomy

Every skill is a `SKILL.md` with frontmatter + playbook body. See
[skill-anatomy.md](../reference/skill-anatomy.md).
