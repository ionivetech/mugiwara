# Enforcement

A markdown harness cannot force a model to comply with prose — that is the
ceiling of every skills pack, mugiwara included. This page splits what is
actually **ENFORCED** from what is **ASPIRATIONAL**, so nothing on it is a
promise the repo cannot keep. `harness-matrix.md` uses the same convention.

Measured, in this repo: **0 of 21** prose instructions were complied with
without a mechanism behind them. That number is the reason this page exists.

## ENFORCED — a validator or a hook fails the build

Something other than a model checks these. Drift breaks CI.

| Rule | Mechanism | Where |
|------|-----------|-------|
| Skip gates present | every skill declares `## Skip when` with 1–4 bullets | `scripts/validate-content.ts` |
| Body length | skill body ≤120 lines; section content-line ceiling | `scripts/validate-content.ts` |
| Description bounds | name + description length; no duplicate names | `scripts/validate-content.ts` |
| Index budget | skill + agent descriptions combined stay under the char ceiling | `scripts/validate-content.ts` |
| Manifest sync | manifest set-equals `content/`; docs list every skill + agent | `scripts/validate-content.ts --check-manifest --check-docs` |
| Doc integrity | documented lane thresholds must equal the source constants | `scripts/validate-content.ts --check-doc-integrity` |
| `write-scope: source` | only `zoro-execution` and `brook-healing` may declare it | `scripts/validate-content.ts` |
| Conformance | generated target files match `content/` | `scripts/conformance.ts` |
| Retrieval ratchet | retrieval quality may not regress below the recorded floor | `scripts/retrieval-eval.ts` |
| **Savepoint written at turn end** | `hooks/auto-savepoint.ts` (Stop + SubagentStop) refreshes the active mission's state with no model involvement | `hooks/hooks.json` — **Claude Code only** |

`hooks/auto-savepoint.ts` is the only mechanism in mugiwara that produces a
mission artifact without a model choosing to. It refreshes the *current* flow stage;
it never advances one. On every other harness, state is written only when the
crew remembers to run `mugiwara savepoint`.

## ASPIRATIONAL — prose only, model compliance

These are real rules and worth following. Nothing checks them at runtime, and
nothing fails if a model skips one. Treat every row as "the crew is asked to",
never "the harness guarantees".

| Rule | Stated in | Reality |
|------|-----------|---------|
| Lane re-run at each flow stage boundary | orchestration skill, check-ins | `lane.sh` computes honestly *when run*; nothing runs it |
| Evidence capture over claims | every skill's iron law | `evidence.sh` writes a real log *when invoked*; a spoken "tests pass" is unchecked |
| Heal cap (≤`heal_max_cycles`) | orchestration, healing | `savepoint.sh` computes `heal_halt` (`heal_cycle ≥ heal_max_cycles`, config default 3) into state; no mechanism stops a model that ignores it |
| Blocker-zero DoD | definition-of-done | verified by a model reading a ledger a model wrote |
| Lane monotonicity (rise, never drop) | triage-escalation | recorded in state; not enforced against a model that re-sizes downward |
| Config keys | `.mugiwara/config` | `verbosity`, `delegate_threshold`, `heal_max_cycles` are read by `savepoint.sh` (recorded/computed into `state.json`). The rest (`mode`, `branch`, `commit`, `auto_commit`, `review_depth`, `quality_depth`) are read by models only. |

## Per-target enforcement capability

Hooks are the only no-model mechanism, and hooks are not portable.

| Target | Turn-end enforcement | Basis |
|--------|----------------------|-------|
| `claude` | **enforced** | `Stop` + `SubagentStop` hooks run `auto-savepoint` |
| `opencode` | advisory only | no verified turn-end event to bind to |
| `codex`, `cursor`, `gemini`, `kimi`, `windsurf`, `cline`, `generic` | advisory only | no hook mechanism at all |

A documented gap beats a fake guarantee. If a rule matters on a target in the
bottom two rows, it has to be checked by a human or by CI — not assumed.

## Honest limits

Mugiwara cannot force an agent to follow a skill on any tier. Models can skip
a skill, rush a flow stage, or pass on a claim. The validator is the floor
everywhere and CI blocks drift; the Claude Code hook is the only runtime floor.
Everything else in this repo is discipline, and discipline is a hope, not a
mechanism.

Mugiwara is a skills pack, not a supervisor.

## Deliberate omissions (do not "fix" these)

- **`run-evals --run` is unwired by decision.** The behavioural rubric scoring
  stays in the code but no npm script or CI workflow runs it — 59 cases × one
  model call per run is a token cost the user declined. Do not add it to a gate.
- **OpenCode has no turn-end enforcement.** Only `tool.execute.before|after`,
  `chat.message`, and `experimental.chat.system.transform` exist; there is no
  verified turn-end event to bind a Stop hook to. It stays a documented gap —
  do not fake a guarantee.
- **Windows / Linux support is reasoned from source, not executed.** The
  cross-platform fixes are verified by reasoning and tests, but no Windows or
  musl-Linux machine has run the harness end to end. A manual test on those
  platforms is outstanding.
