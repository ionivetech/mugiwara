# Harness Matrix

You switch editors and the crew behaves differently. Skills that auto-fired now sit idle, or agents that dispatched now narrate instead. This page answers "which harness supports what" with one example, then the tier table. Loading differs per tier. Workflow, lane sizing, and evidence discipline stay identical.

Example: on opencode a security audit dispatches Jinbe as an isolated subagent. On a tier 3 target the same request runs inline: the main thread embodies the Jinbe persona from markdown and reads the full body from `.mugiwara/refs/` on demand. Same checklist, different loading path.

Rule: every skill and agent file ships to every harness. The tier decides native trigger versus rules file versus stub pointer. Conformance proves each target in CI against golden files.

| Tier | Harnesses | Loading | Scope | CLI |
|---|---|---|---|---|
| 1 | Claude Code, opencode | Native skills, dispatchable agents | Global plus project | Bundled |
| 2 | Gemini, Codex, Copilot | Full body as rules, agents as markdown | Project only | npx only |
| 3 | Windsurf, Cline, Kilo, Antigravity | Stub pointer, body in `.mugiwara/refs/` | Project only | Shell fallback |
| Marketplace | Cursor, Kimi, Pi | Manifest plus content pointers | Per host | npx only |

Tier 1 auto-triggers on description match and supports progressive disclosure from description to body to references. Tier 2 loads skills as rules files the model selects per task, with references copied under `.mugiwara/refs/`. Tier 3 installs stubs to save glob-load and opens the reference only when the task needs it. Marketplace targets resolve through the host plugin manifest.

Without the CLI there is no machine-readable state. Savepoint, archive, continue, and sign need it. The crew still runs the pipeline and still writes an inline report, but resume, budget tracking, lane memory, and the closure integrity gate stay inactive. The crew announces this at Flow 0.

Write scope is runtime-enforced on opencode for internal agents only. Claude Code blocks edits for artifact agents with partial cover. All other targets carry the constraint as prose plus validator gates. Worker dispatch is native on Claude Code, opencode, and Copilot. Elsewhere the fallback is savepoint plus checkpoint plus a fresh session through resume. The plan doc stays the source of truth on every host.
