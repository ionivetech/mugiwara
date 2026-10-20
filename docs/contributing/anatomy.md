# Anatomy of a skill and an agent

A new skill or agent written freehand drifts: no summon line, no boundary, output landing nowhere. The fixed shapes below keep every file readable the same way, so authors fill slots instead of inventing structure.

A skill is the reusable playbook. An agent is the persona that applies it. One agent may hold several skills, and the main thread plays the persona by loading them. Every skill ships as one `SKILL.md` file: no code, no runtime, only frontmatter plus a playbook the agent follows.

## The three layers

| Layer | Loaded | Budget | Contains |
|---|---|---|---|
| `description` | **always** (index) | ≤220 chars, 5500 total | trigger vocabulary + disambiguators only |
| body | on trigger | ≤120 lines, sections ≤20 | what changes behavior every run |
| `references/` | on demand | unlimited | what you open after deciding to do the work |

Content moves **downward only**. The description never receives anything; it
only shrinks.

**The split test:** body = what changes behavior on every run. References = what
you open after deciding to do the work. *If the agent must open a file to know
whether a rule applies, that rule effectively does not exist.*

**Measured:** the index and pointer numbers are published from `.metrics/latest.json` and summarized in the [README](../../README.md#what-is-measured-and-what-is-not). Most of the pack costs nothing until it is needed.

**The eight mechanisms that make it hold:**

1. Three layers, one-way movement.
2. Description carries trigger vocabulary, never procedure.
3. Index budget gate in CI, without a hard number it grows back.
4. Section-length gate (warn 15, fail 20), forces offload, not compression.
5. `Skip when` in every skill, negative space lets descriptions stay short.
6. Tables for adversarial handling, denser than prose.
7. One-line Iron Law instead of paragraphs of rules.
8. **Retrieval eval as the feedback loop**, you can cut aggressively only
   because rank-1 tells you when you cut too far.

Mechanism 8 is what makes the rest safe. Without it, trimming is guessing —
which is exactly how the v0.5.0 trim dropped rank-1 to 33% with nobody noticing.

**Pointers must be actionable:**

    ❌ Full checklist: references/checklist.md
    ✅ Before calling a view done, run references/checklist.md, 37 WCAG 2.1 AA
       items; unchecked boxes are not done.

## File structure

```
skills/<skill-name>/SKILL.md
skills/<skill-name>/references/<topic>.md   # optional: overflow detail
```

```markdown
---
name: mugiwara-checkpoint
description: Use after an execution flow stage to audit results against the plan.
---
# Checkpoint (Chopper)

<playbook body>
```

## Frontmatter

| Field | Required | Notes |
|-------|----------|-------|
| `name` | yes | lowercase, hyphen-separated, matches folder name, ≤64 chars |
| `description` | yes | 20–220 chars; trigger conditions + disambiguators only. Front-load trigger keywords. |
| `license`/`compatibility`/`metadata` | no | optional |

## Playbook body

1. **Title + one-line identity**, role name and what it does/doesn't do.
2. **Skip when**, required. ≤4 bullets, numeric threshold. Validator fails
   build without it.
3. **Protocol**, numbered steps, exact commands, exact file paths.
4. **Decision tables**, signal → action.
5. **Iron law**, one memorable non-negotiable line.
6. **Common rationalizations**, excuses + correct reply.
7. **Red flags**, stop conditions + what to do.

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

Checks: name matches folder, description 20–220 chars, body ≤120 lines, no
duplicate names, `## Skip when` block with 1–4 bullets.

## Agent files

Every agent is `content/agents/<name>.md`. The frontmatter has a required `name` (lowercase, hyphenated, matching the file name), a required `description` that says what the agent does and when to summon it, and an optional `skills` list of held skills, comma-separated. Internal helpers add `internal: true`.

```markdown
---
name: chopper-checkpoint
description: Persona for mugiwara-checkpoint. Auditor only; never fixes code.
skills: mugiwara-checkpoint
---
```

The body follows a fixed skeleton. Role states the work and the boundary never crossed. Experience gives a one-line persona. Dispatch states the stage and inputs. Rules stay numbered, each an action bound to its reason, deferring to the held skill for protocol. Output names the artifact path and the route. Red flags name the behaviors that prove the member stopped doing its job. Every agent carries a "Before you start" entry check, and every agent except Luffy a "Return to Luffy" rule.
