# Wave Banners — formats + crew colors

The single source for wave-banner rendering and crew colors. The opencode
plugin and the opencode-target generator derive agent UI colors from the table
below — change a color HERE, never in code. This file is machine-parsed:
keep the table format exact (one row per agent, pipes, no extra columns).

## Terminal format (ANSI truecolor)

Every wave opens with the banner line in the owning agent's color, and closes
with a handoff line. Wrap the whole line in the ANSI truecolor of the agent:

```
\x1b[38;2;R;G;Bm==================== WAVE 3 — ZORO (EXECUTION) ====================\x1b[0m
→ Wave 4 — Chopper (Checkpoint)
```

- RGB values come from the `hex` column below; R/G/B are the hex channels in
  decimal (truecolor `38;2;R;G;B`). If the terminal lacks truecolor, use the
  `ansi-256` index: `\x1b[38;5;Nm`.
- Wave 9's handoff: `→ closure`.
- The literal `WAVE N —` text must stay exact: `scripts/savepoint.sh` counts
  heal cycles by grepping `wave 8` (case-insensitive) in the trace. A banner
  that drops the literal silently resets the heal loop.
- Never convey the wave by color alone — the crew name and emoji always
  accompany the color.

## UI format (markdown UIs)

Rich UIs (Claude Code UI, VSCode, Codex) strip or garble ANSI escapes. Emit
the emoji-heading form instead — no ANSI, no equals line:

```
## ⚔️ WAVE 3 — ZORO (EXECUTION)
→ Wave 4 — Chopper (Checkpoint)
```

Same literal `WAVE N —` rule applies.

## Crew colors

| agent-id | role | hex | ansi-256 | emoji |
|----------|------|-----|----------|-------|
| luffy-orchestrator | Luffy | #ef4444 | 196 | 🏴‍☠️ |
| usopp-brainstorm | Usopp | #f59e0b | 214 | 🎯 |
| nami-planner | Nami | #f97316 | 208 | 🧭 |
| zoro-execution | Zoro | #22c55e | 34 | ⚔️ |
| chopper-checkpoint | Chopper | #3b82f6 | 33 | 🩺 |
| sanji-quality | Sanji | #a855f7 | 141 | 🍳 |
| franky-gates | Franky | #06b6d4 | 45 | 🔧 |
| robin-reviewer | Robin | #8b5cf6 | 99 | 📚 |
| jinbe-security | Jinbe | #6366f1 | 63 | 🌊 |
| brook-healing | Brook | #ec4899 | 205 | 🎻 |
| skeptic-verifier | Skeptic | #64748b | 245 | 🔍 |
| eval-runner | EvalRunner | #14b8a6 | 37 | 🧪 |
| resume-coordinator | Resume | #d97706 | 172 | 🔄 |
| memory-keeper | MemoryKeeper | #d946ef | 200 | 🧠 |
| onboarding-guide | Guide | #0ea5e9 | 75 | 🚀 |

Skeptic, EvalRunner, Resume, MemoryKeeper and Guide are internal/dispatch or
wizard agents — their banners appear only when a wave or worker names them.

## Rules

1. Banner before EVERY wave; handoff after it. No wave starts without its
   banner (orchestration red flag).
2. The color comes from this table only — never invent a hex mid-mission.
3. Terminal variant when the session looks like a terminal; UI variant for
   markdown-rendering UIs. When unsure, the UI variant is safe everywhere.
4. Adding a crew member? Add the row here first; the plugin and target
   generator pick it up automatically.
