# native-cost-governor — execution todos

Mode: auto · Branch: feat/native-cost-governor · Commit: conventional (auto per task)

- [x] T1 — cost.ts domain module (constants, pure functions, types) — [test/cost.test.ts](test/cost.test.ts)
- [x] T2 — mission.ts consumes cost.ts (kill hardcoded budgets/thresholds) — [src/mission.ts](src/mission.ts)
- [x] T3 — cost events (JSONL + closure wiring + archive fold) — [src/cost.ts](src/cost.ts), [src/mission.ts](src/mission.ts)
- [x] T4 — optimization decision records — [src/cost.ts](src/cost.ts)
- [x] T5 — full gate + evidence — [flows/01-execution.md](.mugiwara/missions/native-cost-governor/flows/01-execution.md)
