# Harness Matrix

You switch editors and the crew behaves differently. Skills that auto-fired now sit idle, or agents that dispatched now narrate instead. This page answers "which harness supports what" with one example, then the tier table. Loading differs per tier. Workflow, lane sizing, and evidence discipline stay identical.

Example: on Claude Code a security audit on a sensitive path dispatches Jinbe as an isolated subagent. On a tier 3 target the same request runs inline: the main thread embodies the Jinbe persona from markdown and reads the full body from `.mugiwara/refs/` on demand. Same checklist, different loading path.

Rule: every skill and agent file ships to every harness. The tier decides native trigger versus rules file versus stub pointer. A conformance script (`scripts/conformance.ts`) checks every installable target against golden files in CI.

| Tier | Harnesses | Loading | Scope | CLI |
|---|---|---|---|---|
| 1 | Claude Code, opencode, Codex, Cursor (first-class) | Native skills, native agent files | Global plus project | Bundled |
| 2 | Copilot (community, best effort) | Stub pointer, body in `.mugiwara/refs/` | Global plus project | npx only |
| 3 | Windsurf, Cline, Kilo, Antigravity, Gemini (community, best effort) | Stub pointer, body in `.mugiwara/refs/` | Project only | Shell fallback |
| Marketplace | Kimi, Pi (community, best effort) | Manifest plus content pointers | Per host | npx only |

First-class means native files and a conformance golden (`test/golden/<id>.json`). A 2026-10-19 Codex run created a full-lane mission and ran focused tests, but review dispatch failed under ephemeral mode and no archived report was produced. The benchmark default is fixed; a fresh run is pending. Cursor remains untested. Community targets are best effort.

**Codex and Cursor enforcement.** Both ship skills and agents natively and nothing else: no hooks, runtime write-scope or irreversible-command guard. Codex custom agents cannot override `sandbox_mode`; Cursor's `readonly` would block `.mugiwara/**` writes so it is unused. Codex entered the workflow, but reviewer dispatch failed under ephemeral mode; independent review remains unverified. Cursor agent dispatch is also unverified. Keep the four-dispatch-worthy rule below and use inline review when dispatch is unavailable. The Codex plugin and Cursor plugin manifests ship skills only (agent bundling undocumented).

Tier 1 auto-triggers on description match and supports progressive disclosure from description to body to references. Tier 2 installs stubs and opens the reference only when the task needs it, with native worker dispatch. Tier 3 installs stubs to save glob-load and opens the reference only when the task needs it. Marketplace targets resolve through the host plugin manifest.

**"Dispatchable agents" is not one behavior.** opencode's agent switch is a
foreground, context-preserving mode change: the same session keeps
narrating, wearing a different persona. Claude Code's (and, natively,
Copilot's) agent dispatch is a background, zero-context subagent: a fresh
instance with no memory of the conversation that called it, its result
surfacing only after it finishes. Treating the two as interchangeable breaks
any persona whose job is continuous cross-flow-stage routing.

Only four personas are dispatch-worthy under the isolated model: bounded,
evidence-in/verdict-out roles that can reconstruct everything they need from
`.mugiwara/missions/<mission>/**`: `zoro-execution` (parallel workers),
`brook-healing` (heal workers), `robin-reviewer`, `jinbe-security` (parallel
review). The other ten personas, `luffy-orchestrator` above all since it
alone owns live routing and the decision log across the whole mission, must
run inline: embodied by the main thread via `/mugiwara` or the equivalent
natural-language trigger, never invoked directly through an isolated-dispatch
tool. `luffy-orchestrator.md` carries a self-check guard for this; see its
"Dispatch guard" section.

Copilot ships the identical crew files and is documented as having "native
worker dispatch" for auditor/reviewer roles (see [install](../install.md)), but
whether its dispatch mechanism isolates context the same way Claude Code's
does, and therefore whether `luffy-orchestrator` is exposed to the same
misuse there, is **unverified**. Treat Copilot as same-risk-until-tested,
not as confirmed-safe.

**Independent review.** With `independent_review=on`, Luffy dispatches `robin-reviewer` and `jinbe-security` as separate subagents on the full lane or a sensitive path. Claude Code supports this. Not verified: opencode (its agent switch keeps the conversation, so it may not give a fresh context), Copilot, Codex and Cursor (dispatch behavior untested). Those hosts, and every inline-only tier, have no ledger and no closure gate, and run the review inline and the report says `Checked inline`. The ledger that backs the label is written by a Claude Code hook, so no other host produces an independent label today (ASSUMPTION: no hook equivalent was run elsewhere).

Without the CLI there is no machine-readable state. Savepoint, archive, continue, and sign need it. The crew still runs the pipeline and still writes an inline report, but resume, budget tracking, lane memory, and the closure integrity gate stay inactive. The crew announces this at Flow 0.

Write scope is runtime-enforced on opencode for internal agents only. Claude Code blocks edits for artifact agents with partial cover. All other targets carry the constraint as prose plus validator gates. Worker dispatch is native on Claude Code, opencode, and Copilot; Codex and Cursor have native agent files but dispatch behavior is unverified. Elsewhere the fallback is savepoint plus checkpoint plus a fresh session through resume. The plan doc stays the source of truth on every host.

## Enforcement per target

Hooks are the only mechanism that produces a mission artifact without a model choosing to, and they are not portable.

- **Turn-end enforcement.** Claude Code: enforced, because `Stop` and `SubagentStop` run `hooks/auto-savepoint.ts`. opencode: a warning at session end, because the `session.idle` event surfaces work without triage. Every other target, including Codex and Cursor: advisory only, with no hook mechanism at all.
- **Irreversible-command guard.** Claude Code: enforced, because `PreToolUse` on Bash runs `hooks/pretool-guard.js`. opencode: enforced, because `tool.execute.before` on bash throws (same table as `src/guards.ts`, parity-tested). Every other target, including Codex and Cursor: prose only.
