| flow stage | task | symptom | attempted | help-needed |
|-----------|------|---------|----------|-------------|
| 6 (gates) | T5 full gate | `enforcement.test.ts` "guard: plan written + no planner dispatched" fails intermittently (mtime/first_seen timing flake) — reproduced on clean `main` (1 fail / 3 pass) | re-ran test in isolation, manual hook repro green, verified pre-existing on main worktree | separate fix mission: harden `planTouched()` mtime comparison / test fixture timing |
| 6 (gates) | T5 full gate | `bun run gate` full-suite run left `content/skills/mugiwara-security/SKILL.md` replaced with older content (some test's fixture collateral — restored to HEAD) | restored file, tree clean; full enforcement suite re-run leaves tree clean | identify which gate suite mutates repo files; fixture isolation bug |

## Healed (Flow 8)
| flow stage | task | symptom | attempted | help-needed |
|-----------|------|---------|----------|-------------|
| 7 (review) | R1 [High] | gate-math parity vs savepoint.sh not test-enforced (constants-only) | added savepoint.sh formula parser + bash-evaluated parity tests (warnAt/stopAt/delegateAt per lane) + budgetStatus branch-order test — 75 pass | HEALED — 2339f86 |
| 7 (review) | R2 [Med] | cost-events.jsonl (ext .jsonl) outside TRAIL_EXTS → bypasses closure secret-scan | added .jsonl to TRAIL_EXTS; regression test: secret in cost-events.jsonl flagged | HEALED — 2339f86 |
| 7 (review) | H1 [High] | context-registry.jsonl not folded/removed at archive → survives loose; parity broken with cost-events.jsonl | added registry to fold+removal path; integration test: archived registry in report.md + file gone | HEALED — 17b4c7c |
| 7 (review) | M1 [Med] | efficiency row hardcodes duplicate_chars:0/read_avoidance_chars:0 beside real reuse_rate>0 (contradiction) | registry entries now carry chars; real char accounting; n/a fallback when no char payloads | HEALED — 115785a |
| 7 (review) | M2 [Med] | context_status:'over' unreachable — archive throws before event write, every persisted event 'ok' | moved throw after appendCostEvent; over-budget closure records 'over' then throws | HEALED — 5ca71bb |
| 6 (gates) | T5 full gate | `enforcement.test.ts` guard flake blocks green gate on this branch (reproduced on parent commit 02c4d78 2/5 in session; all other 485 tests + every post-test gate step pass) | re-verified it is the tracked row-3 flake, not a Phase-2 regression; diff coverage of evidence.ts (100) + mission.ts (94.4) exceeds limits | STILL OPEN — separate fix mission (row 3); escalate to Luffy |
