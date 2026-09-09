# Where did this come from?

`git blame` answers who touched a line, then stops. It never says under which lane, which model, or which evidence the change passed. Provenance attaches that record to the commit instead of losing it at closure.

Example: an archived mission leaves this block beside its report:

```
mission: invitation-accepted
agent: zoro · lane full · mode auto
tasks: 5/5
gates/evidence: flows/04-gates.md · review.md · security.md
human review: pending (PR review is the terminal gate)
```

The model line renders from `MUGIWARA_MODEL` when set and says so plainly otherwise; mid-mission model switches render as a set, never silently as the last value.

## Two layers

The git note on the branch head is the local precision archive for CLI users. The `provenance.md` file in the mission dir is paste-ready for PR descriptions on any host, since hosting UIs never render notes and plain clones never fetch them.

## Hygiene

Notes live outside history: SHAs, diffs, and rebases stay untouched, with rewrite refs keeping notes attached across rebases. Delete the ref to remove every note at once. Push the ref once for sharing; teammates add the matching fetch refspec. Query with `mugiwara blame <path>`, which prints the last touching commit plus its note and admits when a commit carries none.
