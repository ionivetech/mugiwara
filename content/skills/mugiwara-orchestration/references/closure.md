# Closure — full reference

Detailed closure summary, terminal step, and lessons.
Read after deciding to close a mission — never mid-argument.

## Detailed closure summary (mandatory, inline)

Present a detailed summary to the user — never a one-liner:

- Mission summary — goal, mode, flow stages, task count.
- Per-flow-stage outcome table — flow stage, tasks, status, evidence link (clickable `[path](relative/path)`). Flow files under `missions/<mission>/flows/` are evidence — archive folds them into report.md rather than deleting them.
- Gate verdicts — quality, gates (coverage/build/DoD), review + security findings with dispositions, e2e (run / skipped + why).
- Tests — unit/integration results; ATDD oracle verdict when user tests were declared.
- Risks / rollback — remaining risk and the rollback path (revert commit / feature flag).
- Deferred items + owner.
- Next steps — PR material pointer, anything the user must do.

## Terminal step

Save-point commit → push branch with plain `git push -u origin <branch>` → write
`.mugiwara/missions/<mission>/flows/07-pr-verdict.md` → hand branch + verdict to user.
Crew never creates PR, never merges, never deploys. On push failure, fall back
to local closure report.

**Verdict file = ready PR material.** ONE document the user pastes into their
PR. Every section below is mandatory and in order; a section with nothing to
say writes `None.` explicitly — never omit, never one-line the whole file.
Draw every verdict from captured evidence, never assertion. Scan the file for
secret patterns before handoff — on a match, redact and log; a leaked secret
in a pasted PR description is irreversible. Interpolated identifiers (branch,
owner/repo) come from git config/remote only — validate against a safe
charset (`[A-Za-z0-9._/-]`) and quote them in shell commands.

Checklist rule: the Tests, Checks, and Deferred sections are ALWAYS one item
per line with `- [x]` done / `- [ ]` open — the todo shape, never a paragraph,
never comma-joined. An unchecked box names its owner.

```
# PR verdict: <mission> → <branch>

## Title
<one line, the PR title>

## Summary
- <3–7 key-point bullets: what, why, scope>

## Breaking changes
- <each: what breaks, who must adapt> / `None.`

## What changed
- `<area>`: <files> (+<n>/-<m>) — <one-line why>

## Per-flow-stage evidence
| Flow | Tasks | Status | Evidence |
|---|---|---|---|
| 3 | 4/4 | PASS | [03-exec](flows/03-execution.md) |

## Tests
- [x] unit 969/969 → <path>
- [ ] e2e skipped — <why>

## Checks
- [x] typecheck clean
- [x] lint 0
- [x] build exits 0
- [x] gates (coverage/build/DoD) PASS
- [x] review findings disposed
- [x] security 0 high
- [x] secret scan clean

## Security disposition
<STRIDE/OWASP outcome, deferred findings + owner, or `None — docs-only lane`.>

## Rollback
<exact commands, newest-first; mark tested or untested>
<e.g.> `git revert <sha>  # tested` / `rollback.sh` path when generated

## Risks
- <remaining risk + likelihood + mitigation> / `None known.`

## Deferred / follow-ups
- [ ] <item> — owner: <name>

## For the reviewer
<ranked reading order: 3–5 files, sensitive paths first>

## Verdict
<GO — ship it | NO-GO — <blocking finding, owner, re-entry stage>>
```

**`auto_commit=off` (guided/semi only).** No save-point commit, no push — the
working tree stays uncommitted. Write the verdict file exactly as usual, then
hand the user: the branch name, the exact commands to commit and push
(`git status` first, then `git add` of the mission's files only — never bare
`git add -A`, which would stage unrelated or secret files — then
`git commit -m "<suggested message>" && git push -u origin <branch>`), and the
verdict pointer. In `auto` mode `auto_commit` is ignored — the terminal step
runs unchanged.

## Lessons

At Flow 0 triage read `.mugiwara/lessons.md` and surface relevant rows to
the owning agent. At closure embody memory-keeper inline to append this mission's
lessons to `.mugiwara/lessons.md` — one row per real lesson, append-only,
never overwrite.
