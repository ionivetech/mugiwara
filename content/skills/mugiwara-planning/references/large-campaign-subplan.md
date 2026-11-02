# Large campaign: sub-plan split (planning)

Trigger: more than 3 phases, or `plan.md` over 1500 lines (`wc -l`). When triggered, Nami splits the plan.

## Naming

- `sub-plan/NN-phaseNN-<slug>.md`: zero-padded, slug from `Phase N: Title` lowercased with each run of non-alphanumerics turned into `-`. Example: `sub-plan/01-phase01-foundation.md`.
- The master `plan.md` holds the mission split table (index), the definition of done, and how to start. Detail lives in `sub-plan/`. The master stays under 1500 lines.
- Evidence for each phase lives in `flows/phase-NN/` with the usual file names: `01-execution.md`, `02-audit.md`, `03-quality.md`, `04-gates.md`. The archive step folds them into `report.md`. Execution side: `mugiwara-execution`.

## Phase isolation vs sub-mission

- Phase isolation: one mission, one plan. Slices carry the detail, `flows/phase-NN/` carries the evidence. Phase-local choices live in the slice.
- True sub-mission: a separate, independently mergeable unit with its own branch, done-criteria, continuation pointer, and mergeable end state. Only Nami creates one, explicitly.

## Write conflicts

Each slice's task index names its write-conflict groups: tasks that write the same file or area are never parallel. `[PARALLEL]` needs file-disjoint and interface-disjoint proof; a shared CODEOWNERS area is a conflict. Every parallel set traces to an evidence-backed dependency map.
