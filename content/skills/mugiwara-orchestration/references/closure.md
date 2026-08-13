# Closure — full reference

Detailed closure summary, terminal step, initiative writeback, and lessons.
Read after deciding to close a mission — never mid-argument.

## Detailed closure summary (mandatory, inline)

Present a detailed summary to the user — never a one-liner:

- Mission summary — goal, mode, waves, task count.
- Per-wave outcome table — wave, tasks, status, evidence link (clickable `[path](relative/path)`). Step results `results/<mission>/01..05` are evidence — never deleted at cleanup.
- Gate verdicts — quality, gates (coverage/build/DoD), review + security findings with dispositions, e2e (run / skipped + why).
- Tests — unit/integration results; ATDD oracle verdict when user tests were declared.
- Risks / rollback — remaining risk and the rollback path (revert commit / feature flag).
- Deferred items + owner.
- Next steps — PR material pointer, anything the user must do.

## Terminal step + initiative writeback

Save-point commit → push branch with plain `git push -u origin <branch>` → write
`.mugiwara/results/<mission>/07-pr-verdict.md` per `mugiwara-pr` → hand branch +
verdict to user. Crew never creates PR, never merges, never deploys. On push
failure, fall back to local closure report.

When this mission is a sub-mission of a team initiative, after closure run
`bun scripts/initiative.ts set-status <initiative-plan> --id <sub-id> --status done`.
When all sub-missions show `[x]`, present initiative-level closure summary.

## Lessons

At Wave 0 triage read `.mugiwara/logs/lessons.md` and surface relevant rows to
the owning agent. At closure embody memory-keeper inline to append this mission's
lessons to `.mugiwara/logs/lessons.md` — one row per real lesson, append-only,
never overwrite.
