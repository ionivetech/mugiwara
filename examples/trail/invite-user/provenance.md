# Provenance

<!-- paste below into the PR description or a PR comment -->

```
mission: invite-user
agent: Demo Author · model-unrecorded (set MUGIWARA_MODEL to attribute) · lane full · mode auto
tasks: 2/2
gates/evidence: flows/01-execution.md · flows/03-quality.md · flows/04-gates.md · flows/06-closure.md
branch: feat/invite
human review: pending (PR review is the terminal gate)
```

Commit: f1fcc323c428af4b4017e47792279e23486fceb3

Query locally after pushing notes:
`git fetch origin refs/notes/mugiwara:refs/notes/mugiwara` then `mugiwara handoff <mission> --path <path>`.
