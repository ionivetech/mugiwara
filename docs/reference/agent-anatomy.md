# Agent Anatomy

Every mugiwara agent is a portable markdown file that names a crew member's
persona, rules, and output contract. Agents are harness-native where supported
(Claude Code, opencode) and markdown rule files elsewhere.

## File structure

```
agents/<name>.md
```

```markdown
---
name: chopper-checkpoint
description: Dispatch after each execution flow stage to audit results against the plan - re-runs every acceptance criterion, verifies commit hygiene and parallel-file safety, classifies failures honestly, appends ledger rows, and issues a Definition-of-Done verdict. Auditor only; never fixes code.
skills: mugiwara-checkpoint
---

# Chopper — Checkpoint (Auditor)

## Role
...
```

## Frontmatter

| Field | Required | Notes |
|-------|----------|-------|
| `name` | yes | lowercase, hyphen-separated; matches the file name |
| `description` | yes | ≥20 chars; what this agent does and when to summon it |
| `skills` | no | the crew skills this member holds, comma-separated |

Harness-specific agents (opencode) may add `mode`, `permission`, `model`, etc.
in their own installation copy — the content stays portable.

## The body — house style

Agents follow a fixed skeleton so every member reads the same way:

1. **Role** — one paragraph: what the member does and the boundary it never
   crosses ("Auditor, not fixer", "never implements code").
2. **Experience** — a one-line persona so the model adopts the right instincts
   ("QA lead who has caught 'works on my machine' for 20 years").
3. **When dispatched** — which flow stage of `mugiwara-workflow` and with what inputs.
4. **Rules** — numbered, each an action bound to its reason, deferring to the
   held skill for the full protocol.
5. **Output** — where the artifact lands (`.mugiwara/missions/<mission>/waves/...`) and how it
   routes.
6. **Red flags** — behaviors that mean the member stopped doing its job.

## Agent vs skill

- A **skill** is the reusable playbook ("how to audit a flow stage").
- An **agent** is the persona that applies it ("Chopper is the auditor; Chopper
  never fixes code").

One agent holds many skills (Zoro holds `mugiwara-execution`, `mugiwara-git`,
`mugiwara-mode`, `mugiwara-testcases`, `mugiwara-backend`). When the crew runs
inline, the main thread loads the member's skills and embodies the persona.

## Validation

Agents are validated alongside skills on check-in (name, description length,
sync between `content/` and the repo-root plugin copies). Run:

```bash
bun run validate
bun run validate --check-sync
```

See [developer-onboarding.md](developer-onboarding.md).
