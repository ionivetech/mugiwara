# Mission flow

You asked for a change and cannot tell who runs first, how heavy the process will be, or when the agent stops to ask you. This page answers those three questions: the stages, the lane that decides how many of them run, and the mode that decides how often you are asked.

Example: you ask for role-based access control. Luffy looks at the diff, sees `auth/` paths and picks the full lane. Nami writes a plan with acceptance checks. Zoro implements it test-first. Chopper re-runs every check. Sanji and Franky run quality and coverage. Robin and Jinbe review the diff and the security surface in parallel. Brook fixes what failed. Luffy closes with `report.md` and a ready PR summary. In guided mode you approve each step. For a one-word typo fix the same request would run none of this.

Rule: evidence over claims. A stage passes only when its owner ran the check and showed the output. A skipped stage is logged, never silent.

## Stages

Each stage has one owner and runs inline in your main conversation. The exception is stage 7, described under [How work runs](#how-work-runs).

| Stage | Owner | Output |
|---|---|---|
| 0 Triage | Luffy | Lane and mode, with the reason |
| 1 Brainstorm | Usopp | Options with trade-offs |
| 2 Planning | Nami | `plan.md` with tasks and acceptance checks |
| 3 Execution | Zoro | Tasks done, one commit per logical task |
| 4 Checkpoint (4.5 adversarial pass) | Chopper (Skeptic) | Audit and a failure ledger |
| 5 Quality | Sanji | Format, lint, test, duplication, complexity |
| 6 Gates | Franky | Coverage, build, Definition of Done |
| 7 Review and security | Robin, Jinbe | Severity-tagged findings, from separate subagents on the full lane or a sensitive path |
| 8 Healing | Brook | Fixes, then back to stage 4 |
| 9 Closure | Luffy | `report.md`, pushed branch, PR summary for you to open |

The files under `flows/` are numbered in the order they were written (`01-execution.md`, `02-audit.md`), not by stage number.

Gates compare against a starting point. The plan records the repo's own test and type-check output before Zoro starts, so a red baseline never ships as a green gate. Healing stops after `heal_max_cycles` attempts (3 by default, see [config](config.md)) and hands the failure to a human.

A **wave** is an ordered group of tasks Zoro runs together. Nami's plan lists tasks in waves. It is never another word for a stage.

## Lanes: how many stages run

The lane is computed from `git diff`, never guessed, and it only rises during a mission. Over-processing a small change costs less than under-processing a large one.

- **Direct**: a typo, a rename, one file under 20 lines. No stages. Budget none.
- **Lean**: a bug in one or two files, under 50 lines. Execute, then quality. Budget 12,000 tokens.
- **Standard**: a feature in 3 to 8 files. Plan, execute, audit, review. Budget 30,000 tokens.
- **Full**: 9 or more files, an architecture or migration change, or anything touching a sensitive path. Every stage, with security review. Budget 50,000 tokens.
- **Spike**: exploratory work with no clear direction. Brainstorm, then size it again. Budget 9,000 tokens.

Budgets count the process the crew adds, not model input and output. The warn and stop points are in [cost](cost.md). Each lane starts from the load of the instructions it reads: Lean 7,137, Standard 11,732, Full 20,424 tokens.

Sensitive paths always send a mission to full, whatever the file count: `auth/`, `oauth`, `payments/`, `billing/`, `crypto/`, `secrets/`, credentials, sessions, tokens, RBAC and permissions, IAM, `.env` files, key and certificate files, migrations and schema files, Terraform, Dockerfiles, CI workflows and webhooks. Names that only look similar, such as `authors/`, stay out.

The patterns live in one place: `scripts/lib/patterns.sh`, shared by lane sizing and savepoints. Display form below, regex escapes stripped; a test fails when this block drifts from the source.

```
auth/
oauth2?/
payment/
payments/
billing/
crypto/
secrets/
credential
sessions?/
tokens?/
rbac
permissions?/
acls?/
iam/
.env
.env.
config/.*key
.p12
.key
.pem
migration/
migrations/
migrate/
.sql
schema.
.prisma
.terraform
.tf
Dockerfile
docker-compose
.github/workflows/
webhooks?/
secret/
secrets?.ya?ml
.tfvars
```

Two scoping rules. A change with no code in it (docs only) is sized standard, never full, however many files it touches. In a monorepo, `lane_scope_glob` sizes the lane from one package, while sensitive-path escalation still reads the whole diff. Policy `force_full` wins over both: see [policy](policy.md). To see the lane for the current diff, run `mugiwara status`.

## Modes: how closely you watch

- **guided** (default): you approve the plan and each stage, and the crew asks you its questions. Fits unfamiliar or risky work.
- **semi**: you approve the written plan, then the crew runs from execution to closure and asks only when a question matters. Fits a plan you trust but want to bless.
- **auto**: the crew runs from triage to closure and resolves ambiguities itself, pausing only on a real blocker. In a team it covers your own scope only. Fits well-defined fixes you will review the next morning.

A mode flip applies from the next stage, never mid-stage: say `mugiwara mode auto` in session. Mode only decides how often you are asked. It does not change the lane or the budget.

## Branches and commits

Zoro commits during the work, one commit per logical task, so a regression found three tasks later points `git bisect` at one commit. Commits stage named files only, never a sweeping add, and match your repo's message style. One branch per mission, named from the `branch` config key, never force-pushed once pushed. The crew never opens the PR, merges or deploys. Whether it commits and pushes for you is the `auto_commit` key, explained in [config](config.md#what-auto_commit-does).

## How work runs

Work runs inline in your conversation by default. Workers (separate sub-sessions) are meant for tasks proven independent, such as parallel fixes or parallel review, and each returns a one-line verdict with an evidence path. A worker costs many times the tokens of the same work done inline, so sequential work stays inline. Review is the one deliberate exception: on the full lane or a sensitive path, with `independent_review=on` on a host that can dispatch, Robin and Jinbe run in parallel as subagents with no memory of the build, so the diff is read by something other than its author. Luffy names what they read, records what they return and routes blockers; the subagents never route. Smaller lanes review inline. On Claude Code, closing such a mission is refused until the hook ledger shows both ran as separate agents; `--force` closes it labeled inline. The order of stages is not enforced, only that the artifacts exist. Each stage opens with one heading line so you can see where the mission is.
