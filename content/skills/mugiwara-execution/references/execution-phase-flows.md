# Large Campaign — Phase-Isolated Flows (Execution)

Rule: For large campaigns (>3 phases or >1500 lines), Zoro writes per-phase.

## Layout

- `flows/phase-01/` … `flows/phase-09/` each holds `02-execution.md`, `02-audit.md`, `03-quality.md`, `04-gates.md`
- Master `flows/` holds only pointer or empty until merge
- `flows/todos.md` has `## Phase NN` sections

## Why

Prevents flat `flows/02-execution.md` overwrite across 9 phases.

## Acceptance

- `grep -c "flows/phase" content/skills/mugiwara-execution/SKILL.md` ≥1
- `validate-content` green, body ≤120
