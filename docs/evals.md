# How is it evaluated?

A skill whose prose drifted from its promise fails silently: the description advertises behavior the body no longer teaches. The eval suite catches that rot by scoring skill behavior against rubrics, in CI, with no model needed for the structural gates.

Example: the execution skill promises worker surfacing with evidence links. Its case file names the skill, describes the finished batch as the task, and lists surfacing rule, evidence link, and inline summary as rubric items. The harness scores each item by keyword match and the case passes at 70% or more.

## Suite format

One JSON file per case under `evals/cases/`, subdirectories allowed. Each file names a unique case id, a skill directory that must exist under `content/skills/`, an optional type among positive, negative, adversarial, and lane (inferred from filename when omitted), and behavioral entries pairing a task string with a non-empty rubric array. Files without behavioral sections hold trigger fixtures only and the scorer skips them. Every behavioral entry counts as its own case in the report.

## Coverage gates

Validation fails with no model invoked unless the suite holds at least one behavioral case, every skill names a real directory, every type is allowed, and the suite carries 2 or more adversarial cases plus 1 or more lane cases. Adversarial and lane coverage are mandatory because positive-only suites prove nothing under pressure.

## Judge protocol and loop

Never judge a case with the agent that authored the skill under test. Keyword scoring stays deliberately blunt: it catches prose that stopped naming its concept, not nuance, so treat borderline scores as reading prompts. Suite passes at 70% overall. A failing case means fixing the skill, never the eval; rewriting rubrics to match degraded skills is the one survival failure. Bound retries at three cycles, then ledger the row as eval-fail and escalate through Luffy to Brook. Results land in the mission flows dir with an inline summary. Run on every skill or agent change, before release, on demand, and whenever rot is suspected.
