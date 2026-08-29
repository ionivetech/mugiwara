# native-cost-governor — execution todos

Mode: auto · Branch: feat/native-cost-governor · Commit: conventional (auto per task)

- [ ] T1 — cost.ts domain module (constants, pure functions, types) — [test/cost.test.ts](test/cost.test.ts)
- [ ] T2 — mission.ts consumes cost.ts (kill hardcoded budgets/thresholds) — [src/mission.ts](src/mission.ts)
- [ ] T3 — cost events (JSONL + closure wiring + archive fold) — [src/cost.ts](src/cost.ts), [src/mission.ts](src/mission.ts)
- [ ] T4 — optimization decision records — [src/cost.ts](src/cost.ts)
- [ ] T5 — full gate + evidence — [flows/01-execution.md](.mugiwara/missions/native-cost-governor/flows/01-execution.md)
