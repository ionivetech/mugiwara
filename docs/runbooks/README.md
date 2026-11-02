# Runbooks

You have a specific job to do and no wish to read the concepts first. Find your situation below and open that runbook. Each one says when to use it, what you need, the steps with real output, what can go wrong, and what you end up with.

| Your situation | Runbook | What it covers |
|---|---|---|
| First time, or an everyday change you want reviewed | [Your first mission](solo-mission.md) | Install, `/mugiwara <request>`, answering questions, reading the report. Also when the crew does not engage. |
| The change touches auth, payments, secrets, CI or a migration | [Run a risky change](risky-change.md) | What the full lane does, which questions to expect, what you must still verify yourself, when to take over. |
| You review a pull request that carries a report | [Review a mission's report](review-a-mission.md) | Checklist, red flags, and what to ask the author. |
| Several people share one plan | [Team mission](team-mission.md) | Lead and handles, joining mid-mission, closing together. |
| The session died or you changed machine | [Resume after a crash](resume-after-crash.md) | Print the exact resume point, hand work over. |
| One repo, many packages | [Monorepo](monorepo.md) | Size the lane from one package. |
| A new release, tidy-up, or removal | [Upgrade, clean up, uninstall](upgrade-and-uninstall.md) | `update`, `list --check`, `clean`, `reset`, `uninstall`. |
| Something did not work | [Troubleshooting](troubleshooting.md) | Crew did not engage, thin report, guided mode waiting, blocked command, error messages. |

If you are new, start with the first row. Every capability and its page is listed in [capabilities](../capabilities.md).
