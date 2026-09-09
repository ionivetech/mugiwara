# What is enforced?

Every skills pack faces one ceiling: prose cannot force a model to comply. This page splits what a validator or hook actually checks from what the crew is merely asked to do, so no line here promises what the repo cannot keep. It absorbs the former concepts page on the same question; nothing from that page lives anywhere else now.

Example: a skill ships without its `Skip when` block. The validator fails the build naming the file, before any model ever reads it. Contrast a model skipping lane re-runs at a boundary: nothing fails, and the audit trail is the only witness. Same repo, two realities, and this page never mixes them.

## Enforced: a validator or hook fails the build

Something other than a model checks each row below, and drift breaks CI. Presence of skip gates with numeric thresholds, skill body line ceilings, description bounds with no duplicate names, the 5,500-char index budget, manifest parity with `content/`, lane thresholds equal to source constants, write-scope limited to the executor and healer skills, generated target files matching `content/`, retrieval quality never regressing below its floor (95.4% rank-1 over 221 probes, 342 pointers resolving with 0 broken), and the turn-end savepoint hook refreshing mission state on Claude Code. That hook is the only mechanism producing an artifact without model involvement, and it never advances a flow stage.

Full mechanism mapping lives in the validator source and the hooks manifest; this page states the split, not the wiring.

## Aspirational: prose only, model compliance

Real rules, worth following, unchecked at runtime. Lane re-runs at each boundary compute honestly when run, and nothing runs them. Evidence over claims proves a check ran while a spoken pass stays unchecked. The heal cap records its halt flag in state without stopping a model that ignores it. Blocker-zero readiness is verified by a model reading a ledger a model wrote. Lane monotonicity persists in state against a model resizing downward. Config keys split: budgets, coverage thresholds, heal caps, and context ceilings are computed into state or checked by gates, while mode, branch, commit style, and depth knobs are read by models only.

## Per-target capability

| Target | Turn-end enforcement | Basis |
|------|-----------|-------|
| claude | enforced | Stop hooks run the savepoint |
| opencode | advisory only | no verified turn-end event |
| every other target | advisory only | no hook mechanism at all |

Hooks are the only no-model mechanism and hooks are not portable. A documented gap beats a fake guarantee: where a rule matters on an advisory target, a human or CI checks it. Deliberate omissions stay omitted: behavioral rubric scoring stays unwired by decision (token cost declined, never add it to a gate), OpenCode keeps no faked turn-end guarantee, and untested platforms stay marked untested until a machine runs them. Mugiwara is a skills pack, not a supervisor.
