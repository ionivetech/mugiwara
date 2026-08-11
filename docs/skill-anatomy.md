# Skill Anatomy

Every mugiwara skill is a single portable `SKILL.md` file. No code, no runtime —
just frontmatter plus a playbook the agent follows. This is the format skills
ship in for Claude Code, opencode, Copilot, Cursor, Gemini, and 70+ other tools
via the agentskills.io layout.

## File structure

```
skills/<skill-name>/SKILL.md
skills/<skill-name>/references/<topic>.md   # optional: overflow detail, linked from the body
```

```markdown
---
name: mugiwara-checkpoint
description: Use after an execution wave to audit results against the plan. Runs every acceptance criterion as a command or file inspect, verifies commit hygiene and parallel-file safety, classifies failures honestly, appends ledger rows, and issues a Definition-of-Done verdict. Auditor only - never fixes code.
---

# Checkpoint (Chopper)

<playbook body>
```

## Frontmatter

| Field | Required | Notes |
|-------|----------|-------|
| `name` | yes | lowercase, hyphen-separated, matches the folder name, ≤64 chars |
| `description` | yes | 20–500 chars; what it does AND when to trigger. Front-load the trigger keywords. Skills without a description are filtered out. |
| `license`, `compatibility`, `metadata` | no | optional extras |

## The playbook body

The body is the actual behavior. Well-formed mugiwara skills follow a house
style:

1. **Title + one-line identity** — `# Checkpoint (Chopper)`, then what the role
   is and is not.
2. **Skip when** — required. ≤4 bullets, numeric threshold, telling the agent
   when this skill does not apply (e.g. "no UI code touched", "<3 files").
   Without it the content validator fails the build. A skipped skill is
   recorded in the decision log, never silent.
3. **The protocol** — numbered steps, exact commands, exact file paths.
4. **Decision tables** — where a judgment is needed, a table of signal → action.
5. **The iron law** — one memorable line that states the non-negotiable
   ("TRUST NOTHING; VERIFY EVERYTHING").
6. **Common rationalizations** — the excuses to reject, and the correct reply.
7. **Red flags** — conditions that mean "stop, this isn't done," each ending
   with what to do.

### Style rules that keep skills effective

- **Evidence over claims.** A skill says what to run, never what to assume.
- **Concrete, never aspirational.** Exact paths, exact commands; "works
  correctly" is banned as an acceptance criterion.
- **Boundaries are explicit.** Auditor skills say "never edit code"; executor
  skills say "never report done without command output."
- **≤120 lines.** Skills that grow past that get split, not stretched.
- **Progressive disclosure.** Keep the trigger-scannable description and the
  decision tree in the body; when a section exceeds roughly 15–20 lines, move
  the detail to a `references/<topic>.md` file and drop a one-line pointer in
  the body saying what to read and why.

## How skills reference each other

Skills cross-reference by name: an agent's frontmatter lists its held skills
(`skills: mugiwara-checkpoint`), and skills defer to each other (e.g.
`mugiwara-quality` defers to `mugiwara-mode` for the consent contract). Content
is the single source of truth; harnesses copy it verbatim.

## Validation

Every skill is validated on check-in: name matches folder, description 20–500
chars, body ≤120 lines, no duplicate names, and a `## Skip when` block with
1–4 bullets. Run:

```bash
bun run validate
```

See [developer-onboarding.md](developer-onboarding.md).
