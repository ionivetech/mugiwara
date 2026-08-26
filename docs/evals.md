# Evals

The eval suite is how mugiwara proves a skill still behaves the way its
description promises. `content/agents/eval-runner.md` mandates following this
document exactly; this is that document.

Harness: `scripts/run-evals.ts`. Cases: `evals/cases/**.json`.

## Two modes

```bash
bun scripts/run-evals.ts          # validate the suite — structure + coverage gates. CI-safe, no model.
bun scripts/run-evals.ts --run    # execute every case against a model CLI and score the rubric.
```

`--run` invokes `claude -p` by default. Override with `MUGIWARA_EVAL_CMD`
(e.g. `MUGIWARA_EVAL_CMD="opencode run"`). The command must print only the
model's answer on stdout.

## Suite format

One JSON file per case, anywhere under `evals/cases/` (subdirectories allowed):

```json
{
  "name": "execution-worker-surfacing",
  "skill": "mugiwara-execution",
  "type": "positive",
  "behavioral": [
    {
      "task": "A parallel batch of three tasks finished in worker subagents.",
      "rubric": ["surfacing rule", "evidence link", "inline summary"]
    }
  ]
}
```

| Field | Required | Meaning |
|---|---|---|
| `name` | yes | Case id, unique across the suite. |
| `skill` | yes | Skill directory under `content/skills/`. Must exist. |
| `type` | no | `positive` \| `negative` \| `adversarial` \| `lane`. Inferred from the filename when omitted. |
| `behavioral[]` | yes[^1] | One entry per scored task. Each needs a `task` string and a non-empty `rubric` array. |
| `expect_lane` | no | Expected lane for `lane`-type cases. |

[^1]: A file with no `behavioral` section (or `"skill": "_no-skill"`) is skipped
by the scorer — those files exist to hold trigger fixtures only.

Every `behavioral` entry registers as its own case, so a file with three tasks
contributes three rows to the report.

## Coverage gates

Validation fails — exit 1, no model invoked — unless:

- at least one behavioral case exists;
- every `skill` names a real directory under `content/skills/`;
- every `type` is one of the four allowed values;
- the suite has **≥ 2 adversarial** cases;
- the suite has **≥ 1 lane** case.

Adversarial and lane coverage are mandatory because a suite of only positive
cases proves nothing about routing under pressure.

## Judge protocol

1. **Fresh judge.** Never judge a case with the agent that authored the skill
   under test. A self-judging skill scores its own intent, not its text.
2. The harness scores each rubric item by keyword match: the item is met when
   the answer contains any of its significant terms (>3 characters, stopwords
   removed).
3. A case passes at **≥ 70%** of its rubric items.
4. The suite passes at **≥ 70%** overall; below that `run-evals` exits non-zero.
5. Ranking or selection cases use tournament judging — pairwise comparison, a
   fresh judge per match (see `mugiwara-orchestration`, adversarial verification).

The keyword scorer is deliberately blunt. It catches skill rot — prose that
stopped naming the concept it teaches — not nuance. Treat a borderline score
as a prompt to read the skill, not as a verdict.

## Loop and bound

1. Run the suite.
2. A failing case means **fix the skill, never the eval.** Rewriting a rubric
   to match a degraded skill is the one thing this harness cannot survive.
3. Re-run. **Bound: 3 cycles.** Still failing after the third → stop, write the
   row to `.mugiwara/missions/<mission>/blockers.md` with category
   `eval-fail`, and escalate to Brook (healing) via Luffy.
4. Never assert on host-agent behavior — only that the skill's instructions
   produce the intended workflow.

## Reporting

Write the pass/fail table to `.mugiwara/missions/<mission>/flows/eval.md`, summarize
inline for Luffy, and route failures through the blocker ledger.

## When to run

- On any skill or agent change, after the edit lands.
- Before release, as a full-suite run.
- On demand, to prove a skill or agent works.
- Whenever skill rot is suspected.
