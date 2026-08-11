# Failure Taxonomy

Classification for healing triage. Matches Brook's triage matrix.

## Categories

| Category | Signal | Action |
|----------|--------|--------|
| **test-fail** | Test, lint, or build command fails with specific error | Reproduce → localize → reduce → fix root cause + guard test |
| **missing-impl** | Acceptance criterion unverifiable, artifact absent | Check if task was skipped; if not, implement the missing piece |
| **parallel-conflict** | Two tasks modified the same file concurrently | Serialize, merge the changes, re-verify |
| **env** | Failure reproduced only in specific environment | Mark env, do not patch code. Note for rerun. Must be proven on clean checkout |
| **regression** | Previously passing check now fails | git bisect to find breaking commit, fix root cause |
| **type-error** | TypeScript/mypy/pyright fails on changed code | Fix at root cause, grep all callers, re-run typecheck |
| **flaky** | Intermittent failure, random seed | Identify race condition or timing dependency. Retry N times. Mark flaky only after proving non-determinism |

## Proven-env rule

A failure classified `env` must be reproducible on a clean checkout in the same environment OR must fail only on one OS/CI. "Probably env" is not proof — it stays as code failure until proven otherwise.

## Escalation

After 3 heal cycles on the same failure → stop. Escalate to human with full repro, attempted fixes, and root-cause hypothesis.
