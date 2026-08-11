# Planning Anti-Patterns

Patterns that fail the quality bar. Every one means: fix the plan before handoff.

| Anti-pattern | Why it fails | Fix |
|-------------|-------------|-----|
| "TBD" in a step | Leaves executor guessing | Fill in the exact command or file path |
| "add appropriate error handling" | Vague, uncheckable | Specify: "wrap in try/catch, log with context, return 500" |
| "similar to Task N" | Assumes executor has context | Write the full task out |
| No file paths | Executor invents paths | Name exact files: create/modify `src/auth/login.ts` |
| "works correctly" acceptance | Unverifiable | Command: `npm test -- auth/login.test.ts` |
| `[PARALLEL]` without proof | Race conditions | State disjoint files + no shared interface in wave header |
| Missing `depends-on` edge | Execution order wrong | `depends-on: Task M (file: src/types.ts)` |
| No Break point on 8+ file task | Unreviewable commit | Split into 2 tasks at natural seam |
| Gold-plating | Speculative features | Cut to minimum that satisfies acceptance |
| No rollback on high-risk task | Can't undo if it fails | Add: "revert commit X, re-deploy" |
| "Executor will figure it out" | Fiction — wave stalls or ships wrong | Write the plan so a zero-context engineer can execute |
