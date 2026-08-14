---
name: mugiwara-pr
description: Use at closure to push branch + prepare PR material — plain git push, verdict file with ready PR summary. Never creates PR, merges, or deploys.
---

# PR Handoff (CI/CD Loop)

## Skip when

- Not at closure: PR material is terminal-step-only, never per-wave.
- User handles the PR themselves and declined the verdict file.

Mugiwara's evidence lands where the team reviews. At terminal, push the mission branch with plain `git` and write one structured verdict file. No PR is created by the crew — the user opens the PR and pastes the ready PR summary. Never per-wave.

## Verdict file

Write `.mugiwara/results/<mission>/07-pr-verdict.md` — ONE document that IS
the ready PR material (no separate report + PR-body copy). Exact order —
Title → Summary (key-point bullets) → What changed (compact file inventory
paragraph) → Per-wave evidence → Tests → Checks → Verdict. Full spec:
`references/verdict-format.md`.

## PR summary

The verdict file IS the PR summary. No second block: the user pastes the file
— title line into the PR title, the rest into the body. Order mirrors the
verdict file (title → summary → what changed → per-wave evidence → tests →
checks → verdict). Validate every interpolated value against the safe charset
and quote it.

The summary is material, never posted — the crew stops at push.

## Handoff rule

Push the branch + write the verdict file at terminal, after every wave passes (never a draft state — the user opens the PR when they choose). The verdict is delivered as a file, not posted; the user pastes it into their PR. Never per-wave (reviewer noise). With `auto_commit=off` (guided/semi only): nothing to push — write the verdict file, hand the UNCOMMITTED working tree to the user with the exact commit + push commands; `auto` mode always pushes.

## Push adapter (plain git, no gh)

- Push: `git push -u origin <branch>` (branch per the `branch` config key, default `feature/{type}-{issue}-{slug}`).
- No PR is created by the crew in any mode — the user opens the PR and pastes the PR summary block.
- Interpolated identifiers (branch, owner/repo) are harness- or repo-derived, never read from untrusted content. Derive owner/repo from `git remote get-url origin`. Quote every interpolated value in the shell command and validate it against a safe charset (alphanumerics, `-`, `_`, `/`) before use.

## Stop-at-PR invariant

The crew NEVER creates a PR, auto-reacts to review comments, or auto-heals CI failures in any mode. PR creation and review are the user's — the crew's job ends at push + a ready PR summary. Reacting is a future, explicitly-opted feature.

## Credentials

Use the host's git credential helper / SSH — never secrets in files. Missing auth or push failure → fall back to the local closure report and log the reason.

## Secret scrub before handoff

Before finalizing the verdict file, scan it for secret patterns (`.env`-style lines, API keys, tokens, private keys, credentials). On a match, redact and log the reason — a leaked secret in a pasted PR description is irreversible.

## Rules

1. Write the verdict file before pushing; hand off last, once.
2. Push branch + verdict file at terminal; never per-wave.
3. Verdicts come from captured evidence (command output), never asserted.
4. No PR is created, no auto-reaction to review comments or CI in any mode.
5. Auth missing → local closure fallback + logged reason.
6. Scan the verdict file for secrets before handoff; on a match, redact and log.

## Red flags

- Creating a PR, merging, or deploying — the crew never does.
- Pushing the branch before the verdict file is written.
- Verdicts asserted instead of drawn from captured evidence.
- Leaving a secret in the verdict file before handoff.
