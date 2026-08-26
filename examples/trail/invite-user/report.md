# Mission: invite-user

Email-shape validation added at the boundary with a contract test.
All gates pass; trail archived by the real pipeline for docs/examples/trail.

## Archived: 01-execution.md

## Flow 3 — Zoro (execution)

T1: boundary check added, empty-catch none. Evidence: diff src/auth/invite.ts.
T2: contract test asserts 422 shape per docs/concepts error envelope.

## Archived: 03-quality.md

## Flow 5 — Sanji (quality)

formatter/lint clean · duplication 0% · cyclomatic max 2 · cognitive max 1 · unit suite green.

## Archived: 04-gates.md

## Flow 6 — Franky (gates)

coverage new 100% · build exit 0 · DoD 5/5 → PASS (evidence in quality wave).

## Archived: 06-closure.md

# Mission: invite-user

Email-shape validation added at the boundary with a contract test.
All gates pass; trail archived by the real pipeline for docs/examples/trail.
## Review routing

Ranked reading order for `invite-user` (heuristic ordering — it decides where to look first, never correctness):

1. `src/auth/invite.ts` — sensitive path; production code; not covered by recorded evidence

Context footprint: 728 chars (no budget configured)

