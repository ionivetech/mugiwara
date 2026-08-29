| flow stage | task | symptom | attempted | help-needed |
|-----------|------|---------|----------|-------------|
| 6 (gates) | T5 full gate | `enforcement.test.ts` "guard: plan written + no planner dispatched" fails intermittently (mtime/first_seen timing flake) — reproduced on clean `main` (1 fail / 3 pass) | re-ran test in isolation, manual hook repro green, verified pre-existing on main worktree | separate fix mission: harden `planTouched()` mtime comparison / test fixture timing |
| 6 (gates) | T5 full gate | `bun run gate` full-suite run left `content/skills/mugiwara-security/SKILL.md` replaced with older content (some test's fixture collateral — restored to HEAD) | restored file, tree clean; full enforcement suite re-run leaves tree clean | identify which gate suite mutates repo files; fixture isolation bug |

## Healed (Flow 8)
| flow stage | task | symptom | attempted | help-needed |
|-----------|------|---------|----------|-------------|
| 7 (review) | R1 [High] | gate-math parity vs savepoint.sh not test-enforced (constants-only) | added savepoint.sh formula parser + bash-evaluated parity tests (warnAt/stopAt/delegateAt per lane) + budgetStatus branch-order test — 75 pass | HEALED — 2339f86 |
| 7 (review) | R2 [Med] | cost-events.jsonl (ext .jsonl) outside TRAIL_EXTS → bypasses closure secret-scan | added .jsonl to TRAIL_EXTS; regression test: secret in cost-events.jsonl flagged | HEALED — 2339f86 |
