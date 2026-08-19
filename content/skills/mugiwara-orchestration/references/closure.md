# Closure — full reference

Detailed closure summary, terminal step, initiative writeback, and lessons.
Read after deciding to close a mission — never mid-argument.

## Detailed closure summary (mandatory, inline)

Present a detailed summary to the user — never a one-liner:

- Mission summary — goal, mode, flow stages, task count.
- Per-flow-stage outcome table — flow stage, tasks, status, evidence link (clickable `[path](relative/path)`). Step results `results/<mission>/01..05` are evidence — never deleted at cleanup.
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

**`auto_commit=off` (guided/semi only).** No save-point commit, no push — the
working tree stays uncommitted. Write the verdict file exactly as usual, then
hand the user: the branch name, the exact commands to commit and push
(`git status` first, then `git add` of the mission's files only — never bare
`git add -A`, which would stage unrelated or secret files — then
`git commit -m "<suggested message>" && git push -u origin <branch>`), and the
verdict pointer. In `auto` mode `auto_commit` is ignored — the terminal step
runs unchanged.

When this mission is a sub-mission of a team initiative, after closure set
that sub-mission's status cell to `done` in the initiative plan doc (`mugiwara initiative set-status <plan> --id <id> --status done` automates it).
When all sub-missions show `[x]`, present initiative-level closure summary.

## Lessons

At Flow 0 triage read `.mugiwara/logs/lessons.md` and surface relevant rows to
the owning agent. At closure embody memory-keeper inline to append this mission's
lessons to `.mugiwara/logs/lessons.md` — one row per real lesson, append-only,
never overwrite.
