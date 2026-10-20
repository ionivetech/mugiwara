# Mugiwara

The Straw Hat crew of AI agents and skills: 11 agents (+2 internal), 14 skills
covering brainstorming, planning, execution, checkpointing, quality, gates,
review, security and self-healing.

Gemini CLI is a community, best-effort platform. The install writes pointer
files under `.gemini/mugiwara/`, and the main thread plays each role from
markdown. See `docs/install.md` for what installs today.

Start any non-trivial mission by loading the `mugiwara-orchestration` skill: it
sizes the work, routes it, checks in and closes. The stage pipeline is in
`content/skills/mugiwara-orchestration/references/pipeline.md`.

For development standards when working on Mugiwara itself, see `AGENTS.md`.
