# Enforcement

A markdown harness cannot force a model to comply with prose — that is the
ceiling of every skills pack, mugiwara included. Mugiwara is a skills pack, not
a plugin with hooks: it ships markdown the agent reads and follows. What keeps
the pipeline honest is the skills themselves, not a CLI.

## Skip gates

Every skill carries a `## Skip when` block: ≤4 bullets, numeric thresholds,
telling the agent when the skill does not apply. The content validator
(`bun run validate`) fails the build when a skill lacks the block, so the gate
cannot rot. A skipped skill is recorded in the decision log, never silent.

## Evidence over claims

Every skill enforces the iron law: a wave passes only on command output or a
file the agent can point at. "Subagents lie. No evidence = not complete." This
is prose the agent follows, checked by no tool — the honest limit.

## Capability tiers

How skills load differs per harness:

| Tier | Harnesses | Skill loading |
|------|-----------|---------------|
| 1 | Claude Code, opencode | progressive — read by trigger, not all at once |
| 2 | Copilot, Gemini, Codex | bootstrap pointer → the model chooses what to read |
| 3 | Windsurf, Cline, Kilo, Antigravity | rules dirs glob-load — skills ship as stubs, full bodies in `.mugiwara/refs/` |

On tier 3, skills ship as small stubs (routing + pointer) so glob-loading
harnesses stop eating ~40k tokens; the full body lives in `.mugiwara/refs/`,
read on demand. Tier 3 also uses **wave-boundary state flush**: the full
mission state is written to `.mugiwara/` at each wave so the next wave resumes
without the previous context — the portable substitute for subagent isolation.

**Honest limit.** Mugiwara cannot force an agent to follow a skill. That is
true on every tier and every harness. It is a skills pack, not a supervisor.
