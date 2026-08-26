# Provenance

Who wrote this code, under what lane, verified by what — attached to the
commit instead of lost at closure. `git blame` answers _who_; provenance
answers _what checked it_.

## What is recorded

At `mugiwara archive`, the mission's state produces one provenance block:

```
mission: invitation-accepted
agent: zoro <z@team> · claude-sonnet-4.6 · lane full · mode auto
tasks: 5/5
gates/evidence: flows/04-gates.md · review.md · security.md
branch: feat/invitation-accepted
human review: pending (PR review is the terminal gate)
```

The model line comes from `MUGIWARA_MODEL` (or `ANTHROPIC_MODEL`) when set;
otherwise it says so plainly instead of inventing an attribution.

Every savepoint also records the active model into state (`model` in the
stage's state file). At closure, provenance renders the unique set across all
stages as `model(s): a, b` — so switching models mid-mission stays visible
instead of every line attributing to the last env value. **Set
`MUGIWARA_MODEL` whenever you switch models**; that is the value each stage
records.

## Two layers

| Layer | Where | Who sees it |
|-------|-------|-------------|
| Git note | `refs/notes/mugiwara` on the branch head | CLI users |
| `provenance.md` | inside the archived mission dir; PR-paste-ready | everyone, any host |

Hosting UIs never render git notes and a plain clone does not fetch them —
so the note is the local precision archive, and the markdown file (paste it
into the PR description or a comment) is the distribution channel.

## Commands

```bash
# attach + write (automatic at archive)
mugiwara archive <mission>

# query after fetching notes from the remote
git fetch origin 'refs/notes/mugiwara:refs/notes/mugiwara'
mugiwara blame src/auth/invitation.ts
```

`mugiwara blame <path>` prints the last commit that touched the path plus its
note; commits without one say so honestly.

## Hygiene

- Notes live outside history: SHAs, diffs, and rebases are untouched.
  `notes.rewriteRef=refs/notes/mugiwara` keeps them attached across rebases.
- Delete the ref to remove every note at once — no residue in history.
- Sharing: push the ref once (`git push origin refs/notes/mugiwara`);
  teammates add the matching fetch refspec.
