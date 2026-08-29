# native-cost-governor — Phase 2 (Context Governor) todos

Mode=auto, branch=feat/native-cost-governor, commit=conventional, auto_commit=on.
Harness note: no subagent/task tool — parallel waves executed inline in plan order
(disjointness preserved by construction, one task = its declared files only).

## Wave 1
- [x] T1 context accounting + budget gate + metrics (`475cfe9`)
- [x] T2 evidence registry + dedup + reuse refs (`1d8feb3`)
- [x] T3 investigation config keys (`804972f`)
- [x] T4 cost.ts hygiene (P1 clamp + S2 sanitize) (`b7712bf`)

## Wave 2
- [x] T5 investigation limits state machine (`46301e4`)
- [x] T6 mission.ts integration (C2/Q1/Q2 + metrics) (`740af37`)

## Wave 3
- [x] T7 full gate + evidence (`bun run gate` exit 0)
