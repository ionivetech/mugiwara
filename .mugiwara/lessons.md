| Date | Mission | Area | Lesson |
|---|---|---|---|
| 2026-09-04 | manual | general | coverage-gate measures whole-file line pct: any change to a measured file forces lifting the whole file to threshold, not just new lines (cli.ts 75 to 90 via 21 tests) |
| 2026-09-04 | manual | general | dual-runner tests: bun ignores HOME for homedir and node freezes ESM namespaces for spyOn; mock-free branches pass under both bun test and vitest |
| 2026-09-04 | manual | general | full suite flakes under parallel load in constrained sandboxes (gitActor env + timing); --maxWorkers=2 gives a stable 905/905 baseline for gate measurement |
