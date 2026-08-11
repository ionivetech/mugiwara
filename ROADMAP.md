# Roadmap

What is planned next, in rough priority. This is a living document — items move
in and out as the project learns.

## Near term

- **Eval rank-1 ratchet in CI.** The suite already validates structure and
  coverage (11 cases). Add a score floor (e.g. `--min-rank1 80`) that fails the
  build when routing regresses — once running cases against a model is cost-viable.
- **Lane router eval.** A dedicated task set (≥20 tasks) asserting lane
  accuracy with zero under-routing of full-pipeline work.
- **Model compliance matrix.** Run the eval suite on ≥3 models (Claude, Gemini,
  Codex) and publish which lanes each reliably follows.

## Medium term

- **Cross-model verification for framework-touching work.** When a change
  touches an API or framework, ground it in the official docs before
  implementation — closes the top hallucination source.
- **Permission boundaries per agent.** Robin read-only, Jinbe without write,
  Zoro without network — real security function on tier-1 harnesses.
- **CI-triage reference.** After a push, a dedicated failure-triage playbook
  for the common CI failure classes.

## Long term

- **Per-repo calibration.** After ~15 missions in a repo, tune the lane
  thresholds to that repo's actual history using `.mugiwara/` + lessons.
- **Foreign-repo validation.** Run the crew on ≥10 external repos spanning
  ≥1 harness per capability tier, and record lane-accuracy, token use, and
  wall-clock per mission. This is the slowest item — it cannot be accelerated.

## Explicitly not planned

- A runtime / daemon. Mugiwara is a skills pack; orchestration stays in the
  harness and the crew's own skills.
- Auto-merge or auto-deploy. Human review at the PR is the terminal gate.
- A mandatory skill cap increase. The current 32 skills hold; new skills must
  justify their own weight or replace an existing one.
