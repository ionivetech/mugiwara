# Stage table, lanes, modes, fix loop

The single source for stage numbers, lane contents, mode meaning, and the fix-loop cap. Other skills, agents, and references link here and never restate these facts. Numbers below match `scripts/lane-base.ts` (stages per lane), `scripts/lib/lane-base.sh` (budgets), and `src/config.ts` (config defaults); a change there changes this file.

## Stage table

"Flow N" is the internal stage number. It appears in `savepoint --flow N`, in state files, and in internal notes. Users never see "Flow N": chat shows the name and a plain action (see `_shared/references/flow-banners.md`).

| Flow | Stage | Owner | Skill | Chat action | Handoff line | Artifact |
|---|---|---|---|---|---|---|
| 0 | Triage | Luffy | `mugiwara-orchestration` | sizing up the request | `→ Luffy sizes up the request` | `decisions.md` |
| 1 | Brainstorm | Usopp | `mugiwara-brainstorm` | exploring options | `→ Usopp explores the options` | `spec.md` |
| 2 | Plan | Nami | `mugiwara-planning` | planning | `→ Nami writes the plan` | `plan.md` |
| 3 | Build | Zoro | `mugiwara-execution` | building | `→ Zoro builds it` | `flows/01-execution.md` |
| 4 | Check | Chopper | `mugiwara-checkpoint` | checking the result | `→ Chopper checks the result` | `flows/02-audit.md` |
| 4.5 | Doubt pass (optional) | Skeptic | `mugiwara-checkpoint` (adversarial) | stress-testing the result | `→ Skeptic stress-tests the result` | `flows/08-verifier.md` |
| 5 | Quality | Sanji | `mugiwara-quality` | running quality checks | `→ Sanji runs the quality checks` | `flows/03-quality.md` |
| 6 | Gates | Franky | `mugiwara-quality` (gates) | running coverage and build gates | `→ Franky runs the gates` | `flows/04-gates.md` |
| 7 | Review and security | Robin and Jinbe, in parallel | `mugiwara-review`, `mugiwara-security` | reviewing the diff / checking security | `→ Robin and Jinbe review the diff` | `review.md`, `security.md` |
| 8 | Fix | Brook | `mugiwara-healing` | fixing the failures | `→ Brook fixes the failures` | `flows/05-healing.md` |
| 9 | Close and ship | Luffy | `mugiwara-orchestration`, `mugiwara-ship` | wrapping up | `→ Luffy wraps up` | `flows/06-closure.md`, `flows/07-pr-verdict.md` |

Rules:

- **File prefixes are order, not Flow numbers.** `flows/01-` to `flows/08-` only sort the files; `05-healing.md` is Flow 8 and `08-verifier.md` is Flow 4.5. Never infer a Flow from a prefix. Use the table above.
- A stage reached from Flow 8 returns to Chopper (Flow 4) for a re-check. A return is a routing decision by Luffy, not a restart.
- The one machine heading: each fix round is logged in `decisions.md` as `## Flow 8 — healing` because savepoint counts those headings. Keep that exact text there and nowhere else.
- The ship gate (go/no-go verdict) belongs to Luffy at Flow 9 through `mugiwara-ship`. Franky owns Flow 6 only.
- Agents outside the pipeline (Resume, MemoryKeeper) have no Flow number.

## Lane table

A lane sizes the process to the change. It rises when the diff grows or a sensitive path appears, and never falls within a mission. Lanes are an internal label: in chat say "small change, doing it directly" or "touches auth, adding a security review".

| Lane | Name | Size signal | Stages run (Flow) | Token budget |
|---|---|---|---|---|
| 0 | Direct | 1 file under 20 lines | none | none |
| 1 | Lean | 1-2 files, or 1 file of 20+ lines | 0, 3, 5 | 12,000 |
| 2 | Standard | 3-8 files | 0, 2, 3, 4, 7 | 30,000 |
| 3 | Full | 9+ files, or auth, payment, migration, secrets paths | 0, 1, 2, 3, 4, 4.5 (optional), 5, 6, 7, 8 | 50,000 |
| 4 | Spike | exploratory, direction unknown | 0, 1, then re-size | 9,000 |

Flow 9 (closing) always runs when a mission ran. Budgets warn at 1.5 times and stop at 3 times the lane base; bases are measured by `scripts/lane-base.ts`. Sensitive-path patterns live in `scripts/lib/patterns.sh`.

## Modes

One definition, used everywhere.

| Mode | Behavior |
|---|---|
| `guided` | Stops for the user's go at every stage handoff and before commits or branch choices. |
| `semi` | Runs stages back to back. Stops only for: the plan go (Flow 2), the solo-or-team question, a real ambiguity round, high-risk work (auth, payment, migration, deploy, public API), and commits when `auto_commit` is off. |
| `auto` | Never asks. Stops only for a genuine blocker, a rise to lane 3 (announce once, ask for a go, mode stays `auto`), or the fix-loop halt. Unclear scope is brainstormed with Usopp before any decision. |

A mode flip applies from the next stage, never mid-stage. The mode never drops by itself: a lane rise, a sensitive path, or a fix round changes how much process runs, not the mode.

## Fix loop

`heal_max_cycles` is the cap on fix rounds. Default 3 (`src/config.ts`), read from `.mugiwara/config`. One round is Brook fixing and Chopper re-checking.

- Savepoint computes `heal_cycle` and `heal_halt` (`heal_cycle >= heal_max_cycles`) into `state.json`. When `heal_halt` is `true`, stop and escalate with the full history. Never start another round.
- Per-row attempts: a single blocker row gets at most 2 attempts. Then it escalates (finding, plan, owner) while the other rows continue.
- Every other file says "`heal_max_cycles`" or links here. A literal cap number appears nowhere else.
- In chat: "Tried 3 fixes, still failing. Details in <file>. Take over, or drop the mission?"

## Coverage thresholds

Defaults from `src/config.ts`: `coverage_new=85`, `coverage_modified=85`. Policy may raise them, never lower. A missing key or 0 means no threshold.

## Words used in this plugin

- **Flow**: a pipeline stage (table above). Internal number only.
- **Wave**: an ordered group of tasks Zoro runs together. Used only in Nami's plan table and Zoro's execution, never as a stage name.
- **Phase**: only the large-campaign split (more than 3 phases or a plan over 1500 lines).
- **Mission**: one task from request to closing, under `.mugiwara/missions/<mission>/`.
- User-facing text never contains lane, posture, governor, slop, savepoint, heal, or dispatch. Those words belong in internal files.
