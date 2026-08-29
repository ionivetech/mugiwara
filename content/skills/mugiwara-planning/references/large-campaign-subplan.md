# Large Campaign — Sub-Plan Governance (Planning)

Trigger: `phase count >3` or `plan.md >1500 lines` (`wc -l`). When triggered, Nami auto-splits.

## Naming

- `sub-plan/NN-phaseNN-<slug>.md` (zero-padded, slug from `Phase N: Title` lowercased, `[^a-z0-9]+` → `-`)
- Master `plan.md` holds Mission split table (index) + DoD + how-to-start; detail lives in `sub-plan/`
- Example: `sub-plan/01-phase01-cost-governor-foundation.md`

## Master index

Master `plan.md` never exceeds 1500 lines — detail lives in sub-plan slices.

## Phase isolation vs true sub-mission

Two distinct decisions — do not conflate:

- **Phase isolation** (sub-plan) = ONE mission, one plan. `sub-plan/NN-phaseNN-*.md`
  slices detail; `flows/phase-NN/` owns evidence; archive folds the
  trail. Phase-local posture lives in the slice.
- **True sub-mission** = a SEPARATE, independently mergeable unit: own branch,
  done-criteria, continuation pointer, and mergeable end state. Only Nami
  creates it explicitly.

## Dependency / write conflicts

Each slice's task index makes write-conflict groups explicit: tasks that write
the same file/area are never parallel. `[PARALLEL]` requires file- AND
interface-disjoint proof (shared CODEOWNERS area is a conflict). Speculative
parallelization is prohibited — every parallel set traces to an evidence-backed
dependency map.

## Skill body rule

If body would exceed 120 lines, move checklist here; SKILL.md keeps one-line pointer.

## Acceptance

- `grep -c "sub-plan" content/skills/mugiwara-planning/SKILL.md` ≥1
- `validate-content --check-manifest --check-docs` 0
