# How do I measure Mugiwara against plain Claude?

Compare hidden defect catches and provider-reported token use. Results are measured only after a real CLI run.

## Two steps: calibrate, then compare

The first tasks were too easy, so calibration now selects tasks plain misses at least once. Compare those tasks on fresh runs.

```bash
bun scripts/benchmark-real.ts --dry-run --calibrate
bun scripts/benchmark-real.ts --calibrate --out calibration
bun scripts/benchmark-real.ts --dry-run --tasks-from calibration/calibration.json --run-offset 3 --runs 3
bun scripts/benchmark-real.ts --tasks-from calibration/calibration.json --run-offset 3 --runs 3 --out comparison
```

Dry runs verify fixtures, reference solutions and hidden checks locally; they make no model calls.

1. `--calibrate` means plain arm, 3 runs. It writes per-task pass counts and a `discriminating` flag to `calibration.json` and `.md`.
2. `--tasks-from <calibration.json>` selects discriminating tasks. `--run-offset N` gives comparison runs fresh ids; overlaps are rejected.

Full calibration is 66 calls (22 tasks x 3 runs), about $9 at the measured rate. Comparing k tasks at 3 runs costs 6k calls.

### Why selection bias matters

Selection favors tasks plain failed. Reusing calibration runs would bias results further, so compare on fresh runs. Rates still apply only to this hard-task set.

## Other flags

Flags: `--host claude|codex` (default Claude), `--arm plain|mugiwara|both`, and `--tasks a,b`. Codex installs its native target and invokes `$mugiwara-orchestration` via `codex exec --json --ephemeral --sandbox workspace-write`. `--prompt-suffix <text>` adds the same wording to either arm. Repeat `--config key=value` to vary Mugiwara config. `MUGIWARA_EVAL_CMD` overrides the host command; credentials stay in the CLI environment.

## How each arm runs

Each run gets a fresh git repo and the same host flags. Keep separate output dirs per host; resume keys include the host.

- Plain: fixture plus task prompt.
- Claude Mugiwara: install target, set `mode=auto`, invoke `/mugiwara <request>`.

Codex uses `--target codex` and explicitly invokes the orchestration skill. Its benchmark command must keep the session persistent: `--ephemeral` can prevent reviewer subagents from loading the parent rollout. Codex reports tokens but not USD. The review-dispatch hook ledger is Claude-only; a zero count alone does not prove a review agent did not run.

Installed host files and `.mugiwara/` are ignored when counting changes. A skill, crew agent or mission report marks a run engaged; otherwise it is reported separately.

## The defect tasks

Prompts and visible tests omit the trap; hidden tests check it afterward. Trap notes and reference solutions are never shown to the model.

| Task | Trap |
|---|---|
| reset-token | Expiry and single use |
| download-path | Upload path traversal |
| order-total | Cent rounding and invalid amounts |
| role-check | Unknown and prototype-key roles |
| search-query | SQL sort-column injection |
| add-months | Month-end overflow |
| stock-reserve | Concurrent overselling |
| pay-order | Duplicate in-flight charge |
| split-bill | Rounded shares do not add up |
| csv-rows | Quoted commas, quotes, newlines and CRLF |
| signup-email | Email case, spaces and Unicode duplicates |
| login-redirect | Redirect allowlist bypasses |
| merge-config | `__proto__` pollution |
| rate-limit | Boundary burst and denied-call quota |
| merge-blocks | Touching ranges and mutation |
| login-lockout | Lockout leaks which accounts exist (authentication) |
| tenant-notes | Get and bulk update skip the tenant check (permissions) |
| refund-payment | Over-refund across partial and concurrent refunds (payments) |
| api-token | Raw tokens stored; malformed values throw (token) |
| slug-migration | Rewrites done rows; unsafe to re-run or resume (migration) |
| role-assign | Grants above own role, self-edit, case variants (permissions) |
| control-unique | No defect; overhead control |

## Cost and rate limits

Calls = tasks x runs x arms. Start with `--tasks control-unique --runs 1`. Results append to `<out>/runs.jsonl`; `--resume` skips recorded host/task/arm/run/config combinations. A rate limit stops with exit code 3; rerun the same command with `--resume`.

## Read the report

Reports contain verdict, engagement, control overhead and per-task results. Pass rates use Wilson 95% intervals; tokens and USD are CLI-reported. The harness requires at least 5 tasks and 3 runs per arm before calling one better. Errors without usage are invalid and excluded.

## Results (2026-10-20, anecdote)

Calibration (plain only, 16 tasks): 4 tasks left a defect (`csv-rows`, `order-total`, `signup-email`, `merge-config`). Claude Code, four tasks, three fresh runs each, hidden checks passed:

| | Hidden passed | Median tokens | Median cost |
|---|---|---|---|
| Plain | 3 of 12 | 121k | $0.13 |
| Plain plus one sentence: "Treat each edge case the request implies as part of the work" | 9 of 12 | 144k | $0.15 |
| Crew, full pipeline for every request | 1 of 12 | 315k | $0.20 |
| Crew, small requests worked directly (two runs) | 6 and 5 of 12 | 133k | $0.15 |

The sentence, not the crew, explains the gain: plain with the sentence did better than the crew's fast path. Most extra tokens in the full-pipeline row were cache reads. Fast-path runs load no skill, so the harness counts them as not engaged. Fewer than five tasks and overlapping intervals: no conclusion.

### Risky tasks (2026-10-20, Claude Code, anecdote)

Four tasks that name a risk area, plain missed each at least once in calibration, three fresh runs per arm, with the prompt hook that reminds the crew to take the full process. Hidden checks passed: plain 2 of 12, crew 3 of 12. Only `refund-payment` moved: plain 1 of 3, crew 3 of 3 (5 of 6 across two sessions, plain 1 of 6), with Robin as a separate agent in the passing runs. `api-token`, `role-assign` and `tenant-notes` stayed at or near 0 in both arms. The crew engaged in all 12 runs (before the hook, 1 of 3 on `tenant-notes`) and sent a separate reviewer in 5. Cost: $3.92 against $1.69 over 12 runs, median $0.22 against $0.14. No `report.md` was written headless. One task of four shows a gain, which is no conclusion.

### Codex CLI diagnostic (2026-10-19, one run per task)

On four calibrated tasks, plain passed hidden checks in 2/4 runs without the edge-case sentence and 1/4 with it. Median tokens, including cache reads, were 136k and 153k. One run per task is inconclusive; Codex reported no USD cost.

Two earlier risky RBAC runs passed hidden checks but did not engage the workflow. After tightening the risk instructions, a fresh Codex CLI run created a full-lane mission and ran implementation and focused tests. Its reviewer worker failed with `no rollout found` because the benchmark used `--ephemeral`; the run wrote no archived `report.md`. The default command now keeps the rollout. Independent review and successful archive still need a fresh run; token usage for this run was 967,376 total (904,192 cached input), with no USD figure from Codex.
