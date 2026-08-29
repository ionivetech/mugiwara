# Large Campaign — Sub-Plan Governance (Planning)

Trigger: `phase count >3` or `plan.md >1500 lines` (`wc -l`). When triggered, Nami auto-splits.

## Naming

- `sub-plan/NN-phaseNN-<slug>.md` (zero-padded, slug from `Phase N: Title` lowercased, `[^a-z0-9]+` → `-`)
- Master `plan.md` holds Mission split table (index) + DoD + how-to-start; detail lives in `sub-plan/`
- Example: `sub-plan/01-phase01-cost-governor-foundation.md`

## Master index

Master `plan.md` never exceeds 1500 lines — detail lives in sub-plan slices.

## Skill body rule

If body would exceed 120 lines, move checklist here; SKILL.md keeps one-line pointer.

## Acceptance

- `grep -c "sub-plan" content/skills/mugiwara-planning/SKILL.md` ≥1
- `validate-content --check-manifest --check-docs` 0
