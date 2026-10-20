# Banners — format and crew colors

The single source for banner rendering and crew colors. The opencode plugin and the opencode-target generator derive agent UI colors from the table below — change a color HERE, never in code. This file is machine-parsed: keep the table format exact (one row per agent, pipes, no extra columns). The file name is historical.

Stage names, chat actions, and handoff phrases live in the stage table (`mugiwara-orchestration` → `references/stages.md`).

## The opening line

Every stage opens with one line:

    ## ⚔️ Zoro · building (2/4)

Form: `## <emoji> <Name> · <plain action> (n/N)`.

- `<plain action>` is the stage's "Chat action" from the stage table.
- `(n/N)` is this stage's position among the stages the lane runs, counting the closing step. A lean mission with triage, build, quality, closing is 4 stages.
- One emoji, from the colour table. Colour is applied by the harness plugin; never emit ANSI escapes, since the model cannot tell a terminal from a markdown UI.
- The opening line is the first line of the stage's first response, even when a subagent does the work.

## The body

- Quiet pass: the opening line plus one result line, for example `✓ 84 tests pass, lint clean → flows/03-quality.md`. A finding, decision, or question gets detail under the opening line.
- A name appears once per stage, on the opening line. The body is plain, factual sentences: no persona narration ("Nice work!", "Honestly..."), no crew banter, no repeating the role.
- Chat never contains a bare "Flow N", and never the words lane, posture, governor, slop, savepoint, heal, or dispatch. Use the plain wording from the stage table.

## The handoff

The last line of the stage's final response: `→ <Name> <plain verb phrase>`, for example `→ Chopper checks the result`. Use the "Handoff line" column of the stage table. Never point backward: when a stage hands back to Luffy for a decision, Luffy opens its own line (`## 🏴‍☠️ Luffy · deciding the next step (3/4)`); when the route is unconditional, the stage hands straight to the next stage and Luffy's reason goes to `decisions.md`. Closing ends with `→ 🏁 done`.

## First use and `/mugiwara crew`

The first reply of a session that starts a mission carries one plain line: "Crew: Nami plans, Zoro builds, Chopper checks, Robin reviews, Jinbe guards security." Intended behavior of `/mugiwara crew`: print who does what in plain words (name, role, one line each), read-only, no mission started.

## Crew colors

| agent-id | role | hex | ansi-256 | emoji |
|----------|------|-----|----------|-------|
| luffy-orchestrator | Luffy | #ef4444 | 196 | 🏴‍☠️ |
| usopp-brainstorm | Usopp | #b45309 | 130 | 🎯 |
| nami-planner | Nami | #f97316 | 208 | 🧭 |
| zoro-execution | Zoro | #22c55e | 34 | ⚔️ |
| chopper-checkpoint | Chopper | #60a5fa | 75 | 🩺 |
| sanji-quality | Sanji | #facc15 | 220 | 🍳 |
| franky-gates | Franky | #06b6d4 | 45 | 🔧 |
| robin-reviewer | Robin | #8b5cf6 | 99 | 📚 |
| jinbe-security | Jinbe | #6366f1 | 63 | 🌊 |
| brook-healing | Brook | #2dd4bf | 43 | 🎻 |
| skeptic-verifier | Skeptic | #64748b | 245 | 🔍 |
| resume-coordinator | Resume | #d97706 | 172 | 🔄 |
| memory-keeper | MemoryKeeper | #d946ef | 200 | 🧠 |

Skeptic, Resume and MemoryKeeper are internal agents; their banners appear only when a task names them.

## Rules

1. Opening line before every stage, handoff after it, even when a subagent does the work.
2. The color comes from the table only. Never invent a hex mid-mission.
3. Adding a crew member: add the row here first; the plugin and target generator pick it up automatically.
