# Mission: invitation-accepted-flow

Invitation acceptance now signs the user in, returns them to the page they came from, and expires the invitation after one use.

11 files changed (+340 / -82) on branch `feature/invitation-flow`, closed 2026-10-19. Sensitive paths touched: `src/auth/invitation.ts`.

## Verdict

**Ready for review.** All gates passed. 1 finding deferred, with an owner.

## Audit

The plan matches the spec. No missing acceptance criteria.

## Quality

Lint and format are clean. No duplicated code. The unit suite passes.

## Coverage

Coverage on new code is 94%, on modified code 87%. The build exits 0.

## Decisions

2026-09-03 · Redirect through a `flow` query parameter · it avoids server-side state · Demo Author

## Not verified

- e2e: the repo has no e2e setup. Logged, not waived silently.

## Cost

Used **8,781** of 30,000 tokens (29%).

## Where to start reviewing

Suggested reading order, most important first. It says where to look first, not what is correct:

1. `src/auth/invitation.ts` — sensitive path; production code; not covered by recorded evidence
2. `src/routes/index.ts` — production code; not covered by recorded evidence

## Evidence

Where each part of this report came from. Crew names and Flow numbers appear only here.

| Section | Source file | Flow | Crew |
|---|---|---|---|
| Decisions | `decisions.md` | - | - |
| Audit | `02-audit.md` | 4 | Chopper |
| Quality | `03-quality.md` | 5 | Sanji |
| Coverage | `04-gates.md` | 6 | Franky |

<details>
<summary>Tooling log</summary>

Lane `standard`, 1 heal cycle.

</details>
