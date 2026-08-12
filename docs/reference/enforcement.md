# Enforcement

A markdown harness cannot force a model to comply with prose — that is the
ceiling of every skills pack, mugiwara included. What keeps the pipeline honest
is a mix of mechanism and discipline.

## Mechanisms (computed, no model)

| Rule | Mechanism |
|------|-----------|
| Lane sizing | `scripts/lane.sh` computes lane from `git diff --name-only` |
| State persistence | `scripts/savepoint.sh` writes `state.json` at every wave boundary |
| Evidence capture | `scripts/evidence.sh <mission> <label> -- <cmd>` writes stdout/stderr to `.mugiwara/results/<mission>/<label>-<hash>.log` |
| Index budget | validator enforces 12k char ceiling on skill + agent descriptions |
| Manifest sync | validator asserts manifest set-equals `content/`; CI blocks drift |
| Skill format | validator checks name, description length, body ≤120 lines, skip gate, duplicate names |

## Discipline (prose the model follows)

| Rule | Enforced by |
|------|------------|
| Skip gates | Every skill declares `## Skip when` (1-4 bullets, numeric threshold). Validator fails build without it. |
| Evidence over claims | Iron law in every skill: no wave passes on assertion. Checked by Chopper's re-verification. |
| Wave boundaries | Every wave opens with `## Wave N — <crew>` banner, closes with checkpoint report. |
| Heal loop bound | Max 3 cycles (Wave 8 → Wave 4). After 3, escalate to human. |
| DoD canonical | `references/definition-of-done.md` — one bar, linked from checkpoint + gates. |

## Honest limits

Mugiwara cannot force an agent to follow a skill on any tier. Models can skip
a skill, rush a wave, or pass on a claim. Mechanisms (savepoint, lane, evidence)
leave a trace regardless of model cooperation. Discipline rules rely on the
model reading and choosing to follow them.

That is true on every tier and every harness. Mugiwara is a skills pack, not a supervisor.
