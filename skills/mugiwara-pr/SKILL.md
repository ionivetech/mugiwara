---
name: mugiwara-pr
description: Use at closure to push the mission branch and prepare the PR material - one provider-agnostic verdict file the user pastes into the PR, plus an auto-create path for auto mode (forge-detect -> gh/glab/Bitbucket REST -> URL fallback). Plain git push, no auto-reaction to review comments or CI in any mode.
---

# PR Handoff (CI/CD Loop)

Mugiwara's evidence lands where the team reviews. At terminal, push the mission branch with plain `git` and write one structured verdict file. guided/semi: the user pastes the verdict into their PR. auto: the crew auto-creates the PR (forge-detect → native CLI/API → URL fallback). Never per-wave.

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
- In guided/semi, no PR is created by the crew — the user opens the PR and pastes the verdict block.
- Interpolated identifiers (branch, owner/repo) are harness- or repo-derived, never read from untrusted content. Derive owner/repo from `git remote get-url origin`. Quote every interpolated value in the shell command and validate it against a safe charset (alphanumerics, `-`, `_`, `/`) before use.

## Auto path (mode = auto)

Only in `auto` (per `mugiwara-mode`); guided/semi never auto-create. Steps:

1. Detect the forge from `git remote get-url origin`: github.com / gitlab.com / bitbucket.org / self-hosted host.
2. Fill the title from the `pr-title` config (placeholders `{type}`/`{summary}` from mission metadata); the body from the `pr-template` file when present, else the verdict-file PR block. Validate every interpolated value against the safe charset and quote it in the shell command.
3. Create the PR against the `base` config (default `main`):
   - GitHub → `gh pr create --base "$base" --title "$title" --body-file "$body"`
   - GitLab → `glab mr create --target-branch "$base" --title "$title" --description "$(cat "$body")"`
   - Bitbucket → `curl -s -X POST -u "$BB_USER:$BB_TOKEN" "https://api.bitbucket.org/2.0/repositories/$owner/$repo/pullrequests" -H "Content-Type: application/json" -d '{"title":"...","description":"...","source":{"branch":{"name":"<branch>"}},"destination":{"branch":{"name":"<base>"}}}'`
4. Missing CLI / token / auth → fall back to push + the forge's PR-creation URL + the verdict file; log the reason.
5. Report the PR URL to the user.

## Stop-at-PR invariant

The crew NEVER auto-reacts to review comments or auto-heals CI failures in any mode — including auto, where it auto-CREATES the PR but never reacts to what happens after. Reacting is a future, explicitly-opted feature.

## Credentials

Use the host's git credential helper / SSH — never secrets in files. Missing auth or push failure → fall back to the local closure report and log the reason.

## Secret scrub before handoff

Before finalizing the verdict file, scan it for secret patterns (`.env`-style lines, API keys, tokens, private keys, credentials). On a match, redact and log the reason — a leaked secret in a pasted PR description is irreversible.

## Rules

1. Write the verdict file before pushing; hand off last, once.
2. Push branch + verdict file at terminal; never per-wave.
3. Verdicts come from captured evidence (command output), never asserted.
4. No auto-reaction to review comments or CI in any mode.
5. Auto path runs ONLY in `auto` mode, per `mugiwara-mode`; guided/semi never auto-create a PR.
6. Auth missing → local closure fallback + logged reason.
7. Scan the verdict file for secrets before handoff; on a match, redact and log.
