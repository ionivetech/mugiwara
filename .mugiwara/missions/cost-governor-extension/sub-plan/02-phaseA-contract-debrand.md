# Sub-plan 02 — Phase A: Contract, Terminology, De-brand

Phase: A
Goal: Establish clean posture vocabulary + remove brand refs, before behaviour
changes. Docs-first — no execution-topology change in this sub-plan.

## Tasks

| # | Task | Files | Size | Depends-on | Acceptance |
|---|------|-------|------|------------|------------|
| T1 | De-brand ponytail/caveman → note | 8 files (see below) | S | — | grep empty |
| T2 | Neutral rewrite cost.md:83-84 comparison | `docs/concepts/cost.md` | S | T1 | no caveman/ponytail names |
| T3 | Posture vocabulary doc (control mode / execution model / cost governor) | `docs/concepts/` | M | T1 | terminology defined |
| T4 | Plan template: posture + dependency/ownership + cost assumptions sections | `content/skills/mugiwara-planning/references/plan-template.md` | S | T3 | template exposes adaptive contract |

## Detail

### T1 — De-brand (comments/docs)
Replace `ponytail:` → `note:` in:
- `src/context.ts:22`, `src/reporting.ts:5,95`, `src/adaptive-budget.ts:130`
- `scripts/benchmark-governor.ts:4,5,135,487`
- `content/skills/mugiwara-quality/SKILL.md:29`
- `content/skills/mugiwara-workflow/references/adaptive-budget-governor.md:3`
- `content/skills/mugiwara-workflow/references/benchmark-governor.md:36,49`
- `docs/concepts/cost.md:170,323,343,362,365`
Keep the rationale text; only the brand label changes.

### T2 — cost.md:83-84 comparison
Rewrite neutrally: mugiwara's static overhead (~1170 tokens) vs a fully-injected
terse-mode skill pack (~1300 tokens). Drop caveman/ponytail names. Keep
honest-limits + on-demand-loading framing.

### T3 — posture vocabulary
New `docs/concepts/execution-model.md` (or extend `cost.md`/`mode` doc): define
control mode, execution model/posture, Cost Governor as three independent
decisions; the posture set; that posture must not imply mode/cost; the honest
"governor recommends/records, not forces" boundary.

### T4 — plan-template
Add the §5.2 compact sections: `## Execution posture`,
`## Dependency and ownership map`, `## Cost-aware operating assumptions`.

## Acceptance
- `grep -ril "caveman\|ponytail" src/ scripts/ content/ docs/` → empty.
- `bun run typecheck` green.
- `bun run test` green.
- docs drift / content validation pass (`--check-docs`).
