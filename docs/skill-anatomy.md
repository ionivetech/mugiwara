# Skill Anatomy

Every mugiwara skill is a single `SKILL.md` file. No code, no runtime — just
frontmatter plus a playbook the agent follows.

## File structure

```
skills/<skill-name>/SKILL.md
skills/<skill-name>/references/<topic>.md   # optional: overflow detail
```

```markdown
---
name: mugiwara-checkpoint
description: Use after an execution wave to audit results against the plan.
---
# Checkpoint (Chopper)

<playbook body>
```

## Frontmatter

| Field | Required | Notes |
|-------|----------|-------|
| `name` | yes | lowercase, hyphen-separated, matches folder name, ≤64 chars |
| `description` | yes | 20–500 chars; trigger conditions + disambiguators only. Front-load trigger keywords. |
| `license`/`compatibility`/`metadata` | no | optional |

## Playbook body

1. **Title + one-line identity** — role name and what it does/doesn't do.
2. **Skip when** — required. ≤4 bullets, numeric threshold. Validator fails
   build without it.
3. **Protocol** — numbered steps, exact commands, exact file paths.
4. **Decision tables** — signal → action.
5. **Iron law** — one memorable non-negotiable line.
6. **Common rationalizations** — excuses + correct reply.
7. **Red flags** — stop conditions + what to do.

## Style rules

- **Evidence over claims.** Say what to run, never what to assume.
- **Concrete, never aspirational.** Exact paths, exact commands.
- **≤120 lines.** Grow beyond → split or move to `references/`.
- **Progressive disclosure.** Sections >15–20 lines move to
  `references/<topic>.md`; body gets a one-line pointer saying what to read
  and why.
- **220-char description ceiling.** Descriptions carry trigger vocabulary, not
  procedure. Procedure belongs in the body.

## Three-layer discipline

| Stays in body | Moves to references |
|---------------|---------------------|
| Skip when, red flags, rationalizations | Worked examples |
| "Never do X" rules | Long checklists |
| Step order, decision trees | Reference tables, edge cases, templates |

Test: body = what changes behavior on every run. References = what you open
after deciding to do the work.

## Validation

```bash
bun run validate
```

Checks: name matches folder, description 20–500 chars, body ≤120 lines, no
duplicate names, `## Skip when` block with 1–4 bullets.
