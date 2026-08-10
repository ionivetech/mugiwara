# Comparison

How mugiwara fits against the alternatives.

## Mugiwara vs. plain skills (agent-skills / skills.sh)

The [agent-skills](https://github.com/addyosmani/agent-skills) ecosystem ships
standalone skills that an agent picks up on demand. Mugiwara ships the same
portable `SKILL.md` format — and also ships:

- **A named crew** — personas (Luffy, Nami, Zoro, …) on top of the skills, so
  the pipeline has a defined owner per wave instead of "whichever skill fires."
- **A pipeline, not a pile** — ordered waves (triage → plan → execute →
  checkpoint → quality → gates → review → heal → closure) with gates between.
- **Evidence discipline** — no wave passes on a claim; the owning role runs the
  checks and shows output.
- **A workspace contract** — `.mugiwara/` holds plan, results, ledger, and
  logs, so a mission survives context loss.

You can still install just the skills (`npx skills add ionivetech/mugiwara`).

## Mugiwara vs. agent frameworks (LangGraph, CrewAI, …)

Framework crews are code: graphs, nodes, runtimes to host. Mugiwara is:

- **Zero runtime** — pure markdown; your existing agent's own subagent
  machinery does the work. Nothing to deploy, nothing to keep updated.
- **Harness-native** — installs into Claude Code, opencode, Copilot, Gemini,
  Codex, Cursor, and 70+ tools rather than forcing one runtime.
- **Inline** — the pipeline runs in your main conversation (see
  [execution-model.md](execution-model.md)); frameworks hide the work behind
  their own execution graph.

## Mugiwara vs. a single mega-prompt

A mega-prompt gives you one big instruction. Mugiwara:

- **Splits by specialization** — 25 focused skills + 15 personas instead of one
  document that tries to be everything, so each phase has a tight contract.
- **Is gated** — every wave has a verifiable gate and a recorded reason, so
  drift is caught early.
- **Heals** — a bounded 3-cycle heal loop reads the failure ledger and fixes
  root causes, instead of re-running the same mega-prompt.

## When NOT to use mugiwara

- **One-line fixes** — Luffy routes trivia straight to execution; you don't
  need the crew for a typo.
- **You want a framework runtime** — if you need orchestration in code,
  deployable graphs, or API-driven crews, a framework is the right tool.
- **You want the crew to merge/deploy** — mugiwara deliberately stops at push +
  PR. Human review is the terminal gate.

## Summary

| | Mugiwara | Plain skills | Framework crews | Mega-prompt |
|---|----------|--------------|-----------------|-------------|
| Runtime | none | none | yes | none |
| Pipeline | ordered waves + gates | on-demand | graph | linear |
| Visibility | inline in your chat | inline | behind the graph | inline |
| Evidence gates | yes | no | configurable | no |
| Self-healing | yes (3-cycle loop) | no | configurable | no |
| Harnesses | 12+ | 70+ | one per framework | any |
