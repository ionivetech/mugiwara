---
name: mugiwara-writing-skills
description: Use when authoring a new mugiwara skill or revising an existing one. Enforces the skill anatomy (name/description 20-500 chars, when-to-use, process, rationalizations, red flags, verification), the 120-line body ceiling, and progressive disclosure of detail into a references/ file. Meta-skill: governs the other skills.
---

# Writing Mugiwara Skills

## Skip when

- Not authoring or revising a mugiwara skill — plain application code change.
- Skill change is a one-line description fix with no anatomy impact.

A skill is a process workflow the agent runs on cue, not a reference guide. If it reads like a wiki page, it fails. The description decides when the skill loads; the body decides what happens next. Both must justify their size.

## Skill anatomy

Every skill is a single `SKILL.md` at `content/skills/<name>/`, plus an optional `references/` folder for pulled-out detail. The name is the directory name; the validator checks that exact match.

| Part | Requirement |
|------|-------------|
| name | equals the directory name, `mugiwara-<domain>` |
| description | one "Use when..." sentence, 20-500 chars, loads the right skill and rejects the wrong ones |
| body | `# title` + sections below, 120 lines max |
| references/ | overflow detail, linked from the body |

## When to use

Use this skill the moment you start authoring a new skill file or restructuring an existing one. Skip it only for edits so small they cannot touch anatomy, limits, or wording.

## Process

1. **Confirm the niche.** Grep `content/skills/` for overlap; a new skill must not duplicate an existing one. Name it `mugiwara-<domain>`.
2. **Write the description first.** One "Use when..." sentence naming the trigger, the behavior, and the boundary of what the skill is not for. Target 60-120 chars; the 500-char cap is a ceiling, not a goal.
3. **Draft the body as a workflow.** Concrete numbered steps the agent executes, in order, with decisions and branches embedded. Name the skills it reads or dispatches. Use tables for excusable patterns and quick comparisons.
4. **Cut to the ceiling.** Body must end at 120 lines or fewer. Section-by-section trim: merge subsections, kill throat-clearing, convert prose to tables. `ponytail` and `caveman` instincts apply — the body is command output, not a report.
5. **Disclose progressively.** If a section exceeds roughly 15-20 lines, move it to `references/<topic>.md`, drop a one-line pointer in the body, and keep the pointer actionable (what to read and why).
6. **Check the anatomy list.** Each required section present, in order: title, When to use, Process, Rationalizations, Red flags, Verification.
7. **Validate.** Run `bun scripts/validate-content.ts --check content/skills/<name>/SKILL.md` and leave it exiting 0.

## Rationalizations

| Excuse | Rebuttal |
|--------|----------|
| "It's a guide, not a checklist" | A skill the agent cannot execute is decoration. Rewrite every paragraph as a step or a criterion. |
| "The detail is essential" | Then move it to `references/` and keep the body a decision tree, not a dump. |
| "More lines mean more coverage" | 120 lines enforce focus. Cover the decision, not the encyclopedia. |
| "Long description catches more triggers" | A description that matches everything loads on nothing specific and trains the agent to ignore the skill. |
| "Patterns are the same everywhere, I'll mirror another skill's text" | Wording must be original. Mirror the shape, never the sentences. |
| "It's fine for now, I'll validate later" | Validation is the last step of the write, not a follow-up task. |

## Red flags

- Body over 120 lines or a description outside 20-500 chars.
- No "Use when..." trigger sentence, or a description that names no boundary.
- A section that reads as a lecture instead of steps the agent can run.
- Required sections missing or out of order.
- Text copied from another skill, superpowers, or agent-skills.
- A `references/` file that is unreferenced, or a body so crammed it needed none.
- An unvalidated file reported as done.

Any of these: revise the skill, re-run validation, and confirm both before reporting.

## Verification

Evidence of a complete skill: the file passes `--check` with exit 0; `wc -l` on the body is at or under 120; the description triggers only its intended cases; every required section is present and original; and any overflow sits in a linked `references/` file.
