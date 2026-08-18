# Wave Banners — formats + crew colors

The single source for wave-banner rendering and crew colors. The opencode
plugin and the opencode-target generator derive agent UI colors from the table
below — change a color HERE, never in code. This file is machine-parsed:
keep the table format exact (one row per agent, pipes, no extra columns).

## Banner format (one form)

Every wave opens with the banner line in the owning agent's color, and closes
with a handoff line:

```
===== ⚔️ WAVE 3 — ZORO (EXECUTION) =====
→ Wave 4 — Chopper (Checkpoint)
```

- Terminal: wrap the whole line in ANSI truecolor `\x1b[38;2;R;G;Bm` ... `\x1b[0m`.
- Markdown UI: emit the plain equals line, no ANSI (UIs strip or garble escapes).
- The crew emoji leads the line, before the `WAVE N` text.
- RGB values come from the `hex` column below; R/G/B are the hex channels in
  decimal (truecolor `38;2;R;G;B`). If the terminal lacks truecolor, use the
  `ansi-256` index: `\x1b[38;5;Nm`.
- Wave 9's handoff: `→ closure`.
- The literal `WAVE N —` text must stay exact: `mugiwara savepoint` counts
  heal cycles by grepping `wave 8` (case-insensitive) in the trace. A banner
  that drops the literal silently resets the heal loop.
- Never convey the wave by color alone — the crew name always accompanies
  the color.

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

1. Banner before EVERY wave; handoff after it. No wave starts without its
   banner (orchestration red flag).
2. The color comes from this table only — never invent a hex mid-mission.
3. One form everywhere: equals line `===== <emoji> WAVE N — <CREW> (ROLE) =====` — five `=` per side, the crew emoji from the table leading the line, ANSI-wrapped in terminals, plain in markdown-rendering UIs. When unsure, the plain form is safe everywhere.
4. Only the crew table's colors and the two SGR forms above (truecolor,
   256-index) may appear in a banner — never other escape families (OSC,
   title, cursor, other SGR codes). The banner is a fixed template, not a
   formatting playground.
5. Adding a crew member? Add the row here first; the plugin and target
   generator pick it up automatically.
