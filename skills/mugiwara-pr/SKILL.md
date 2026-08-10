---
name: mugiwara-pr
description: Use at closure to push the mission branch and prepare the PR material - one provider-agnostic verdict file the user pastes into the PR, one local check-run summary. Plain git push, no gh CLI, no auto-reaction to review comments or CI in any mode.
---

# PR Handoff (CI/CD Loop)

Mugiwara's evidence lands where the team reviews. At terminal, push the mission branch with plain `git`, write one structured verdict file the user pastes into the PR, and stop. No `gh` CLI, no PR API calls, no posting. Never per-wave.

## Verdict file

Write `.mugiwara/results/YYYY-MM-DD-<mission>-pr-verdict.md`:

- Mission summary — goal, waves, task count.
- Per-wave evidence table — wave, task, status, evidence pointer.
- Gate verdicts — quality (per-check status), gates (coverage/build/DoD), review (Robin/Jinbe findings).
- User-test verdict — when user tests were declared, the ATDD oracle result (per `mugiwara-testcases`), from real runs, never asserted.
- Closure-report link — `.mugiwara/results/YYYY-MM-DD-<mission>-closure.md`.
- Final verdict line — PASS / FAIL with the single blocking reason, if any.
- Optional PR description block — copy-paste title + body ready for the user's PR.

## Handoff rule

Push the branch + write the verdict file at terminal, after every wave passes (never a draft state — the user opens the PR when they choose). The verdict is delivered as a file, not posted; the user pastes it into their PR. Never per-wave (reviewer noise).

## Push adapter (plain git, no gh)

- Push: `git push -u origin <branch>` (branch per the `branch` config key, default `feature/{type}-{issue}-{slug}`).
- No PR is created by the crew — the user opens the PR and pastes the verdict block.
- Interpolated identifiers (branch, owner/repo) are harness- or repo-derived, never read from untrusted content. Derive owner/repo from `git remote get-url origin`. Quote every interpolated value in the shell command and validate it against a safe charset (alphanumerics, `-`, `_`, `/`) before use.

## Stop-at-PR invariant

The crew NEVER auto-reacts to review comments or auto-heals CI failures in any mode. That is a future, explicitly-opted feature.

## Credentials

Use the host's git credential helper / SSH — never secrets in files. Missing auth or push failure → fall back to the local closure report and log the reason.

## Secret scrub before handoff

Before finalizing the verdict file, scan it for secret patterns (`.env`-style lines, API keys, tokens, private keys, credentials). On a match, redact and log the reason — a leaked secret in a pasted PR description is irreversible.

## Rules

1. Write the verdict file before pushing; hand off last, once.
2. Push branch + verdict file at terminal; never per-wave.
3. Verdicts come from captured evidence (command output), never asserted.
4. No auto-reaction to review comments or CI in any mode.
5. Auth missing → local closure fallback + logged reason.
6. Scan the verdict file for secrets before handoff; on a match, redact and log.
