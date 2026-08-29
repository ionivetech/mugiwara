# Large Campaign — Sub-Plan Governance (Workflow + Archive)

## When to split

Large campaigns (>3 phases or >1500-line plans) split into isolated phase slices. Master `plan.md` is index; detail lives in `sub-plan/`.

## Planning split (Nami)

- Trigger: `phase count >3` or `plan.md >1500 lines`
- Files: `sub-plan/01-phase01-<slug>.md` … `sub-plan/0N-phase0N-<slug>.md` + master index
- Master never appended to 2000+ lines

## Execution isolation (Zoro)

- `flows/phase-NN/` per phase holds `02-execution.md`, `02-audit.md`, `03-quality.md`, `04-gates.md`
- No flat `flows/02-execution.md` overwrite for large campaigns
- Per-phase evidence captured, merged at archive

## Archive merge (Luffy)

- `mugiwara archive` folds `sub-plan/*.md` + `flows/phase-*/` + `decisions.md` sections + `blockers.md` + `review.md`/`security.md` into single `report.md` seeded from `flows/06-closure.md`
- Final layout: `plan.md` (index) + `report.md` + `pr-verdict.md`/`provenance.md`/`rollback.sh`
- Idempotent — second run is no-op
- If code needs extend `src/mission.ts:archiveMission` with `sub-plan/` + `flows/phase-*/` allowlist; otherwise Luffy manual `cat flows/phase-*/... >> report.md` suffices

## References

- Precedent: `native-cost-governor` (9 phases, 2688-line plan.md, 22 Archived sections in report.md)
- Validation: `validate-content` accepts `sub-plan/` as plan source; `verify-install` green; body ≤120 via this reference
