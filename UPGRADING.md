PUBLIC

# Upgrading to the next major release

This release removes and merges things. Read "What to do" first.

## What changed

**Skills: 21 to 14.** `workflow`, `resume` and `lessons` are folded into `orchestration`, `git` into `execution`, `gates` and `testcases` into `quality`, `root-cause` into `healing`. Old tokens in `features=` still work as aliases:

| Old token | Now |
|---|---|
| `gates`, `testcases` | `quality` |
| `git` | `execution` |
| `root-cause` | `healing` |
| `resume`, `lessons`, `workflow` | `orchestration` |

Adding an old token adds its new owner. Removing one with `-token` does nothing, so a merged core skill cannot be dropped by an old name. Unknown tokens still fail.

**Agents.** `eval-runner` is a test persona for this repo's own suite. It moved to `evals/agents/` and is no longer installed. The package ships 11 agents plus 2 internal ones.

**Codex and Cursor.** Both now get full skills and agents in the format their documentation describes: Codex in `.agents/skills` and `.codex/agents` (TOML), Cursor in `.cursor/skills` and `.cursor/agents`. Neither host was run during this work, so treat both as untested in the real host. Neither has hooks, so write boundaries and the command guard are instructions only there. Details: [install](docs/install.md).

**Independent review (new, default on).** On hosts that can dispatch subagents (Claude Code), a full-lane mission or one touching a sensitive path now runs Robin and Jinbe as separate subagents in parallel, with a fresh context. Before, review was the same model re-reading its own work inline. The new config key `independent_review` (`on` or `off`, default `on`) controls it. Lower lanes, `off`, and hosts that cannot dispatch run inline as before. On opencode the agent switch is not verified to give a fresh context. The risk reminder now also matches Indonesian terms and risky paths, and the Stop hook names the next step. `mugiwara archive` exits 1 for an unknown mission and lists absent review or security files under Not verified.

The cost is real: this repo measured about 132k tokens per subagent dispatch against about 5k inline (`mugiwara-orchestration`, `references/posture-routing.md`). Two dispatches per mission add roughly a quarter million tokens (expected from that figure, not measured). To keep the old behavior, set `independent_review=off` in `.mugiwara/config`.

The report now starts the Review and Security sections with `*Checked independently: ...*` or `*Checked inline: ...*`. A hook derives it from `.mugiwara/review-dispatch.jsonl`, a ledger of real dispatches, not from review text. A Stop-hook warning fires when a full-lane or sensitive-path mission has review artifacts and no recorded dispatch. It warns and does not block.

**Enforcement on Claude Code.** Typing `/mugiwara <request>` records an explicit request. At stop, a risky change (sensitive path, or standard or full lane) with no mission recorded blocks the end of the turn, at most 2 times per session, then warns. Only `enforce=off` disables it; `enforce` stays `warn` for sessions that did not use `/mugiwara`. `mugiwara archive` now refuses to close a full-lane or sensitive-path mission unless the hook ledger shows Robin and Jinbe ran as separate agents; `--force` closes anyway, labeled inline, and `independent_review=off` removes the requirement. Other hosts have no ledger and are not blocked. The order of stages is not enforced.

**Cost section.** The report prints the process estimate against budget and, separately, the provider-reported tokens including cache reads and writes; the provider number is not divided by the budget.

**Governors removed.** The record-only modules for adaptive budget, cognition and investigation are gone. The `investigation_*` config keys no longer appear in the default config. Old configs that set them are still read without error.

**Sign is an add-on.** The signing code lives in `src/addons/attest/` and loads only when you run `mugiwara sign` or when policy sets `attestation.required`. Behavior and the `mugiwara sign` command are unchanged.

**Config.** `coverage=<n>` sets the threshold for new and modified code (default 85). `coverage_new` and `coverage_modified` still win per kind when set. `enforce` now defaults to `warn`: the stop hook warns when a session skipped triage and no longer forces extra model turns. The command guard keeps `block`. When a key is set twice the first line wins, and `doctor` warns. A mission keeps the mode it started in: editing `mode=` does not change a running mission, and `status` says so.

**Cost.** The Stop hook now reads the session transcript and records provider-reported token counts (numbers only, no content). `mugiwara cost` and the closing report show them next to the process estimate. A session that spans several missions attributes its full total to each mission. `mugiwara cost` also prints how many times the stop hook forced a continuation.

**What you see.** Stage banners read `<emoji> <Name> · <what it does> (n/N)`. Hook messages are short plain sentences. `references/wave-banners.md` is renamed `flow-banners.md`. `mugiwara crew` lists who does what.

**Reports.** `report.md` opens with a summary and verdict, then topic sections. Crew names and Flow numbers appear only in the Evidence appendix. Tooling details sit in a collapsed block. `mugiwara handoff` and the provenance block no longer print your git email.

**Small requests.** `/mugiwara` now works a small request (one feature or fix, a few files, no risk area) directly: no skill load, no mission, no report. Risky requests and `use the full crew` still run the full process.

**Risk reminder.** On Claude Code, `/mugiwara <request>` that names a risk area (auth, roles, payments, tenant, tokens, migrations) gets a one-line reminder to take the full process, because the model did not always follow the sizing text on its own.

**Doctor and corrupt state.** `mugiwara doctor` is a read-only check of install, hooks, config, lane, mission files and the npx pin, with one fix line per failure and exit 1 on any failure. `continue`, `status`, `cost` and `archive` now stop with exit 1 on a truncated or invalid mission file, naming it and the fix, instead of reporting no mission.

**Fewer surprises.** Reading config from code no longer creates `.mugiwara/config`; every CLI command except `doctor` still writes the default file when it is missing. Parallel workers are chosen only for the full lane with at least two independent tasks. The `npx` fallback the crew runs when no global CLI exists is pinned to the plugin's own version; install lines in the docs stay `@latest`.

**For contributors.** `bun test` runs the fast suites. `bun run test:slow` runs the six slow ones. `bun run gate` runs everything.

## What to do

1. Update the package or plugin, then run `mugiwara update` so installed copies refresh (it backs up files you edited). `update` keeps an existing `.claude/commands/mugiwara.md`, so its npx pin stays old: if `mugiwara doctor` reports an older pin, delete that file and run `mugiwara update` again.
2. If your `features=` line names an old skill, nothing breaks. You can switch to the new names at your pace.
3. If you installed `eval-runner` by name anywhere, point it at `evals/agents/eval-runner.md`.
4. Replace `coverage_new` and `coverage_modified` with `coverage=<n>` in `.mugiwara/config`. Optional.
5. Do not hand-edit old archived reports. They keep their old format.

## What is not changed

- `flows/NN-*.md` file names stay as they are on purpose, so in-flight missions resume without a migration.
- Mission directories, `state.json` fields (three token fields were added) and the `.mugiwara/` layout.
- `mugiwara waste`, `plan` and `join`: runbooks and skills still use them.

## Measured so far

A benchmark harness exists ([benchmark](docs/contributing/benchmark.md)). On small tasks the crew costs about 10% more than an unaided agent with no quality benefit. On three risky tasks it passed hidden checks in 12 of 30 runs against 1 of 30, at about 4 times the cost. Three tasks is too few for a general claim.
