# Control Commands (pre-flow)

`mugiwara continue` / `mugiwara status` are read-only control commands, not flow
work. They:

- Dispatch before Flow 0 and crew dispatch — the CLI is the deterministic half
  of resume (directory scan + solo-vs-team rule), no reasoning turn needed.
- Never create `.mugiwara/config` and never print setup chatter — a fresh
  project stays clean.
- Never start a flow stage.

Exit codes: 0 = a single resume point printed; 2 = ambiguous/absent — stop and
let the user select. Only after the CLI resolves the resume point does Flow 0
re-entry (or plan verification) begin.

Without CLI or npx, resolve the resume point by reading
`.mugiwara/missions/<mission>/state.json | <member>.json` +
`continue.json | continue-<member>.json` directly (solo-vs-team split per
`mugiwara-resume` → State contract) — same exit-code protocol, same STOP on
ambiguity. The deterministic half survives without the binary.
