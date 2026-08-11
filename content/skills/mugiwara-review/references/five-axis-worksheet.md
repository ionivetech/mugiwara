# Five-Axis Review Worksheet

One verdict + evidence per axis. No axis passes on assertion.

## Axes

| Axis | Question | Evidence required |
|------|----------|-------------------|
| Correctness | Does the change break anything that currently works? | Re-run caller tests, verify edge cases |
| Readability | Can a new team member understand the diff in 5 minutes? | Naming convention check, function length, comment quality |
| Architecture | Does the change fit the existing system structure? | No parallel patterns, no new abstraction without need |
| Security | Any security regression or new attack surface? | STRIDE on changed surface, checklist pass |
| Performance | Any N+1, O(n²), or unbounded resource use introduced? | Profiler output or manual analysis of hot path |

## Example

```
Axis: Correctness
Verdict: PASS
Evidence: npm test -- --shard=1/2 passes (312 tests), caller grep confirms all
          imports of renamed function updated
```

```
Axis: Security
Verdict: FAIL
Evidence: New endpoint POST /api/export has no authz middleware. Missing rate
          limit on file generation (DoS risk).
```

## Rules

- One verdict per axis. "Partial pass" = FAIL.
- Evidence is command output or file path, never a paraphrase.
- FAIL on any axis → overall review FAIL → Brook (Wave 8).
- PASS on all 5 → forward to closure.
