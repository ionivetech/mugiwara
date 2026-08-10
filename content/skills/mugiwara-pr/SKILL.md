---
name: mugiwara-pr
description: Use at closure to post the mission verdict onto the PR - one provider-agnostic verdict file, one comment + one check-run via the gh adapter, no auto-reaction to review comments or CI in any mode.
---

# PR Verdict (CI/CD Loop)

Mugiwara's evidence lands where the team reviews. At terminal, write one structured verdict file and post it as ONE comment + ONE check-run on the ready PR. Never per-wave.

## Verdict file

Write `.mugiwara/results/YYYY-MM-DD-<mission>-pr-verdict.md`:

- Mission summary — goal, waves, task count.
- Per-wave evidence table — wave, task, status, evidence pointer.
- Gate verdicts — quality (per-check status), gates (coverage/build/DoD), review (Robin/Jinbe findings).
- User-test verdict — when user tests were declared, the ATDD oracle result (per `mugiwara-testcases`), from real runs, never asserted.
- Closure-report link — `.mugiwara/results/YYYY-MM-DD-<mission>-closure.md`.
- Final verdict line — PASS / FAIL with the single blocking reason, if any.

## Posting rule

ONE batch comment + ONE check-run, posted only at terminal when the PR is created as `ready`. The PR opens only after every wave passes — never a draft. Never post per-wave (reviewer noise).

## GitHub adapter (MVP; glab / Bitbucket later)

- Head SHA: `gh pr view <n> --json headRefOid --jq .headRefOid`
- Comment: `gh pr comment <n> --body-file .mugiwara/results/YYYY-MM-DD-<mission>-pr-verdict.md`
- Check-run: `gh api repos/{owner}/{repo}/check-runs` with `name`, `status=completed`, `conclusion=<success|neutral|failure>`, `head_sha`, `output[title]`, `output[summary]`

Interpolated identifiers (`<n>`, `{owner}/{repo}`, branch) are harness- or repo-derived, never read from untrusted content. Derive owner/repo from `git remote get-url origin`, `<n>` from the `gh pr create` output. Quote every interpolated value in the shell command and validate it against a safe charset (alphanumerics, `-`, `_`, `/`) before use.

## Stop-at-PR invariant

The crew NEVER auto-reacts to review comments or auto-heals CI failures in any mode. That is a future, explicitly-opted feature.

## Credentials

Use the host's `gh auth` — never secrets in files. Missing auth or push failure → fall back to the local closure report and log the reason.

## Secret scrub before posting

Before posting, scan the verdict file for secret patterns (`.env`-style lines, API keys, tokens, private keys, credentials). On a match, redact or refuse to post and log the reason — a leaked secret in a possibly-public PR comment is irreversible.

## Rules

1. Write the verdict file before posting; post last, once.
2. ONE comment + ONE check-run at terminal; never per-wave.
3. Verdicts come from captured evidence (command output), never asserted.
4. No auto-reaction to review comments or CI in any mode.
5. Auth missing → local closure fallback + logged reason.
6. Scan the verdict file for secrets before posting; on a match, redact or refuse and log.
