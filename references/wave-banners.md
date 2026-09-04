# Flow Banners — formats + crew colors

The single source for flow-banner rendering and crew colors. The opencode
plugin and the opencode-target generator derive agent UI colors from the table
below — change a color HERE, never in code. This file is machine-parsed:
keep the table format exact (one row per agent, pipes, no extra columns).

## The banner

Every flow stage opens with this line and closes with a handoff:

    ## ⚔️ Flow 3 — Zoro (Execution)
    → Flow 4 — Chopper

Rules, all unconditional:

- A markdown heading (`## `), the crew emoji, then `Flow N — Crew (Role)`.
- **Never emit ANSI escapes.** The model cannot tell a terminal from a markdown
  UI, so it must not try. Colour is applied by the harness plugin, which knows
  the surface — see "Colour" below.
- Keep `Flow N —` literal: the check-in protocol reads it.
- Handoff is the LAST line of the stage's final response. Flow 9 closes with
  `→ closure`.

## Colour (harness, not model)

The crew colour table below is consumed by the opencode plugin
(`readBannerColors()`) and by any harness that can style output. The model never
renders colour and never needs the hex values.

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
| eval-runner | EvalRunner | #14b8a6 | 37 | 🧪 |
| resume-coordinator | Resume | #d97706 | 172 | 🔄 |
| memory-keeper | MemoryKeeper | #d946ef | 200 | 🧠 |

Skeptic, EvalRunner, Resume and MemoryKeeper are internal/dispatch agents —
their banners appear only when a wave or worker names them.

## Rules

1. Banner before EVERY flow stage; handoff after it. Main thread emits `## <emoji> Flow N — Crew (Role)` FIRST line and `→ Flow N+1 — Crew` LAST line even when subagent does work — covers Flow 0 Luffy, 1 Usopp, 2 Nami, 3 Zoro, 4 Chopper, 5 Sanji, 6 Franky, 7 Robin/Jinbe, 8 Brook, 9 Luffy. No flow stage starts without its banner (orchestration red flag).
2. The color comes from this table only — never invent a hex mid-mission. The model never emits color itself; the harness styles the heading.
3. One form everywhere: heading `## <emoji> Flow N — Crew (Role)` — renders as a visual break in every markdown UI and stays readable as plain text in a terminal.
5. Adding a crew member? Add the row here first; the plugin and target
   generator pick it up automatically.
