# How do I close a mission?

Closing early once wiped a teammate's resume point: one member archived while another still had live state. Closure gates exist so a finished trail folds instead of deleting live work.

Example: you run `mugiwara archive payment-gateway` while a teammate sits at Flow 5. The command refuses and prints the blocker table with each assignee's position. Everyone reaches Flow 9, then the archive folds the trail.

## Team gate

Archive deletes session state, so every assignee in the `plan.md` sub-mission table must reach Flow 9 first. Assigned-but-never-started, in-flight below Flow 9, and state with no sub-mission row all block. `--force` archives anyway and in-flight resume points are lost.

## Closure integrity gate

The trail validates itself before it folds. Archive fails when a relative markdown link points at a missing file, when any trail file matches a secret shape (API keys, tokens, private-key blocks, pasted JWTs, credential assignments), or when an evidence path in `state.json` does not exist. Fix the trail and re-archive. No flag bypasses this gate.

## Rollback map

Closure writes `rollback.sh` into the mission dir: branch, base, newest-first revert commands, touched files. The human runs it; mugiwara never does.

## Review routing and footprint

The report gains a ranked reading order, sensitive paths first, docs last. It orders the reading, never the verdict. The report also records the byte size of everything left behind, against an optional `context_budget_chars` ceiling that fails the archive like a failed test.

Signing is optional and covered in the signing runbook.
