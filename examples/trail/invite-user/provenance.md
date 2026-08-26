# Provenance

<!-- paste below into the PR description or a PR comment -->

```
mission: invite-user
agent: demo <d@d.com> · model-unrecorded (set MUGIWARA_MODEL to attribute) · lane full · mode auto
tasks: 0/0
gates/evidence: .mugiwara/missions/invite-user/flows/01-execution.md · .mugiwara/missions/invite-user/flows/03-quality.md · .mugiwara/missions/invite-user/flows/04-gates.md · .mugiwara/missions/invite-user/flows/06-closure.md
branch: feat/invite
human review: pending (PR review is the terminal gate)
```

Commit: 0b237ce8bd42a930af4142e3a065d40919ebd028

Query locally after pushing notes:
`git fetch origin refs/notes/mugiwara:refs/notes/mugiwara` then `mugiwara blame <path>`.
