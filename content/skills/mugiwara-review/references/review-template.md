# review.md template

Write `review.md` as plain prose for the person who opens the PR. Verdict first, then the findings, then what was not checked. No placeholders left in, no tables where a sentence works.

Shape:

1. One or two sentences: the verdict (pass or fail), how many blockers and majors, and the reliability rating.
2. The damage map: one line per changed public symbol, saying who calls it and whether the callers were checked.
3. Findings, one per line: `path:line: [blocker|major|minor] problem → fix`.
4. A short "not checked" paragraph: what the review could not cover and why.

Do not state how the check was done (independent or inline). The report adds that line from the dispatch ledger.

Good example:

```
Review fails: 1 blocker, 2 majors, rating E. The renamed `parseInvite` breaks
the CLI importer, which still calls the old name.

Damage map
- parseInvite (renamed): 4 callers found, 3 updated, src/cli/import.ts not updated.
- InviteDto.expiresAt (type changed): 2 consumers checked, both compile.

Findings
- src/cli/import.ts:41: [blocker] still calls parseInvite, which no longer exists → use parseInviteToken.
- src/api/invite.ts:88: [major] error code changed from 404 to 410 with no changelog entry → document it or restore 404.
- src/api/invite.ts:112: [major] new query inside a loop → batch it.

Not checked: runtime behavior behind the feature flag, because no test covers it.
```
