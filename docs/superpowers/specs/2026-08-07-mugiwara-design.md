# Mugiwara Framework — Design Spec

**Date:** 2026-08-07
**Status:** Approved (brainstorming decisions locked with owner)
**Next step:** implementation plan via writing-plans

---

## 1. Overview

**Mugiwara** is an installable distribution of AI agents and skills — the Straw Hat crew as a multi-agent software workflow. It is a **content pack** (10 agent definitions + 12 skills, all markdown with YAML frontmatter following the current cross-agent standard) plus a **zero-dependency Node.js CLI installer**.

Mugiwara is NOT a runtime. The host AI agent (Claude Code, opencode, GitHub Copilot, Gemini CLI, Codex, Windsurf, Cline, Kilo, Antigravity) loads the content and executes the crew workflow using its own native subagent/task mechanism. Mugiwara teaches the workflow; the host executes it. This matches how `obra/superpowers` and `DietrichGebert/ponytail` distribute skills, and avoids building an orchestrator that every host already provides.

**Install surface:**

```bash
npx mugiwara@latest                                  # interactive wizard
npx mugiwara@latest --global --target claude --yes   # non-interactive
curl -fsSL https://<raw>/mugiwara/scripts/install.sh | bash   # mac/linux wrapper → npx
# Windows: install.ps1 wrapper → npx
npx skills add mugiwara                              # ecosystem interop (skills only)
```

## 2. Goals

- One content tree, installable into 9 AI agent targets across macOS / Linux / Windows.
- Install scope: **global** (user-level config dirs) or **project** (repo-local dirs).
- Interactive wizard asks: scope → target agent → project type. Fully flag-driven + `--yes` for CI.
- Clean lifecycle: `install`, `uninstall` (exact, manifest-based), `update` (backup + overwrite), `list`.
- Workflow quality: crew behaves critically (expert CTO persona in brainstorm, superpowers-grade planning, evidence-based auditing, security engineering, self-healing with loop limits).
- General-purpose: works for frontend / backend / fullstack / general projects. Frontend work uses an anti-slop design skill (taste-skill-inspired).

## 3. Non-goals

- No runtime orchestrator, no `mugiwara run --wave X`. Waves are plan content produced by Nami-planner and consumed by Zoro-execution inside the host agent.
- No cross-agent-process orchestration (Mugiwara cannot spawn Claude from Copilot, etc.).
- No GUI/dashboard (future extension, out of scope).
- No auto-update daemon; update = re-run installer.

## 4. Locked Decisions (from brainstorming session)

| # | Decision | Choice |
|---|----------|--------|
| D1 | CLI scope | Content-only installer. No runtime. |
| D2 | Skill granularity | Hybrid, split-on-reuse: a jurus shared by ≥2 agents = own skill file; single-owner jurus folded into the role skill. Result: 12 skills. |
| D3 | Target strategy | Tiered: 3 native adapters (claude, opencode, copilot) + 1 generic adapter engine with per-target config (gemini, codex, windsurf, cline, kilo, antigravity). |
| D4 | Project type effect | Gates the frontend skill: `frontend`/`fullstack` include `mugiwara-frontend`; `backend`/`general` skip it. All other content always installed. |
| D5 | Content language | English for all skills/agents (best host-agent skill-matching). |
| D6 | Lifecycle | install + uninstall (manifest-based) + update (backup-then-overwrite). |
| D7 | Distribution | SKILL.md standard-compatible content (`npx skills add` interop) + own CLI for wizard, agents, uninstall. |
| D8 | Waves as files | No wave files. Wave model lives inside `mugiwara-workflow` skill content. |
| D9 | Workflow entry | Always starts at Luffy triage (Wave 0): Luffy decides brainstorm-first vs straight-to-planning. |

## 5. Content Model

### 5.1 Format standard

- **Skills:** `content/skills/<skill-name>/SKILL.md`. Frontmatter: `name` (== directory name, lowercase-hyphen), `description` (20–500 chars, third person, includes trigger conditions — this is how hosts auto-select skills). Body: imperative instructions.
- **Agents:** `content/agents/<agent-name>.md`. Frontmatter: `name` (== filename), `description`, `skills` (comma-separated skill names it uses). Body: role, dispatch conditions, rules, output format. Native subagent format for Tier-1 targets; rendered as rule sections for Tier-2 targets.

### 5.2 Agents (10)

| Agent file | Duty | Skills used |
|---|---|---|
| `luffy-orchestrator.md` | Captain. Wave-0 triage (brainstorm vs plan-first), periodic check-ins, inter-agent Q&A hub, conflict resolution, closure report | mugiwara-orchestration, mugiwara-workflow |
| `nami-planner.md` | Navigator. Superpowers-grade plans: waves → tasks → subtasks, explicit parallel/sequential markers + depends-on ordering, acceptance criteria per task, asks clarifying questions up-front and mid-plan | mugiwara-planning |
| `usopp-brainstorm.md` | Expert sparring partner (principal/CTO persona). Critical, no yes-man, trade-off analysis, researches the web when unsure before answering | mugiwara-brainstorm, mugiwara-frontend |
| `zoro-execution.md` | Executor/dispatcher. Consumes plan, builds parallel batches vs sequential chains, dispatches host subagents, enforces acceptance-criteria verification per task | mugiwara-execution, mugiwara-frontend |
| `chopper-checkpoint.md` | Auditor. Verifies plan completion against evidence (runs commands, checks files — never trusts claims), writes failure ledger, does not fix | mugiwara-checkpoint |
| `sanji-quality.md` | Quality. Formatter, linter, unit tests; asks user before running integration tests (auto / skip / manual) | mugiwara-quality |
| `franky-gates.md` | Gates. Coverage thresholds (≥90% new files, ≥80% modified files), build validation, binary pass/fail with evidence | mugiwara-gates |
| `robin-reviewer.md` | Reviewer. Breaking-change detection via caller/import mapping, sonar-style smells (duplication, unused code, complexity), documentation check | mugiwara-review, mugiwara-security (delegates deep scans) |
| `jinbe-security.md` | Security engineer. OWASP surface, secrets, injection, authn/authz, dependency audit, sonar security hotspots, compliance notes | mugiwara-security |
| `brook-healing.md` | Healer. Consumes failure reports, auto-fixes small issues (minimal diff), rollback guidance for large ones, re-runs failed checks | mugiwara-healing |

### 5.3 Skills (12)

| Skill | Owner(s) | Content summary |
|---|---|---|
| `mugiwara-workflow` | Luffy | Master pipeline: Wave 0 triage + 9 waves, handoff rules, loop-back policy (max 3 heal cycles then escalate to human), evidence-over-claims rule, no-skip-without-reason rule |
| `mugiwara-brainstorm` | Usopp | Expert ideation: probing questions, options + trade-offs + recommendation, challenge assumptions, web-research-when-unsure protocol, mockup/draft guidance |
| `mugiwara-planning` | Nami | Plan format spec (mission → waves → tasks → subtasks), `[PARALLEL]`/`[SEQUENTIAL]` markers + depends-on, acceptance criteria required per task, file mapping per task, clarifying-question protocol, plan saved to `docs/plans/YYYY-MM-DD-<mission>.md` |
| `mugiwara-orchestration` | Luffy | Triage criteria, periodic check-in cadence, Q&A hub protocol, escalation decisions (continue/retry/abort), closure report format |
| `mugiwara-execution` | Zoro | Plan ingestion, topological batching (independent tasks → parallel batch, dependency chains → sequential), subagent dispatch rules, blocked-task escalation, per-task verify-and-report |
| `mugiwara-checkpoint` | Chopper | Audit protocol: walk every task's acceptance criteria with runnable evidence, failure ledger schema (test-fail / missing-impl / parallel-conflict / env), strict no-fix rule |
| `mugiwara-quality` | Sanji | Tooling detection, formatter → linter → unit test order, integration-test consent prompt, no-weakening-lint-config rule |
| `mugiwara-gates` | Franky | Coverage measurement with project tooling, thresholds (90% new / 80% modified), build validation, gate report format |
| `mugiwara-review` | Robin | Caller-mapping for breaking changes, sonar smell checklist (duplication, dead code, complexity, naming), severity tagging (blocker/major/minor) |
| `mugiwara-security` | Jinbe (referenced by Robin) | Senior security review: OWASP top-10 surface, secret scanning, injection, authz, dependency audit, sonar security rules, severity-tagged report |
| `mugiwara-healing` | Brook | Failure triage matrix, minimal-diff auto-fix, rollback procedure, re-verification requirement, loop counter (max 3 cycles) |
| `mugiwara-frontend` | Zoro + Usopp | Anti-slop frontend (taste-skill-inspired): audit-first for redesigns, design-token extraction from Figma/image (spacing/type scales, palette, radii, motion), banned AI-default patterns list, responsive + a11y baseline, visual verification against reference |

## 6. Workflow Model (lives in `mugiwara-workflow`)

```
Mission ──► Wave 0: Luffy Triage
              │
              ├─ vague idea / unclear requirements / exploratory
              │      ──► Wave 1 Brainstorm (Usopp) ──► Wave 2
              │
              └─ clear requirements / spec exists / small well-understood change
                     ──► Wave 2 directly (skip reason recorded in plan)

Wave 1  Brainstorm     Usopp (+Luffy sanity check)      → refined direction, options, recommendation
Wave 2  Planning       Nami                              → plan doc: waves/tasks/subtasks, ∥/→ markers, acceptance criteria
Wave 3  Execution      Zoro + host subagents             → implemented tasks, each verified against its criteria
Wave 4  Checkpoint     Chopper                           → audit report + failure ledger
Wave 5  Quality        Sanji                             → formatter/linter/unit results (integration: user consent first)
Wave 6  Gates          Franky                            → coverage + build verdict (binary, evidenced)
Wave 7  Review         Robin ∥ Jinbe (parallel)          → review findings + security findings (severity-tagged)
Wave 8  Healing        Brook                             → fixes; loop back to Wave 4; max 3 cycles then escalate human
Wave 9  Closure        Luffy                             → closure report appended to plan doc
```

**Cross-cutting rules:**
1. Entry is always Luffy triage — never straight to brainstorm or planning.
2. Any agent may consult Luffy mid-flight (host re-dispatches `luffy-orchestrator`) for decisions/escalations.
3. Evidence over claims: no wave passes on assertion; checks must be run and output captured.
4. No wave skipped without the reason recorded in the plan doc.
5. Brook's heal loop is bounded (3 cycles) to prevent infinite churn; after that, a human decides.

## 7. Installer Design

### 7.1 Commands & flags

```bash
mugiwara install     # default command; wizard when flags missing
mugiwara uninstall   # removes exactly the files recorded in the manifest
mugiwara update      # install --force: backs up differing files, overwrites
mugiwara list        # shows installed targets, versions, locations
mugiwara --help | --version
```

Flags: `--global`, `--project <dir>`, `--target <id|all>` (comma-separated ok), `--type <frontend|backend|fullstack|general>`, `--yes` (skip prompts; requires enough flags to decide), `--dry-run` (print actions, write nothing).

### 7.2 Wizard flow

1. Scope: global / project (project → confirm directory, default cwd).
2. Target agent(s): multi-select from 9 + `all`.
3. Project type: frontend / backend / fullstack / general (gates `mugiwara-frontend`).
4. Summary + confirm (skipped with `--yes`).

### 7.3 Targets

| Tier | Target | Skills land in | Agents land in |
|---|---|---|---|
| 1 native | claude | `.claude/skills/<name>/SKILL.md` | `.claude/agents/<name>.md` (global: `~/.claude/…`) |
| 1 native | opencode | `.opencode/skills/<name>/SKILL.md` | `.opencode/agents/<name>.md` (global: `~/.config/opencode/…`) |
| 1 native | copilot | `.github/instructions/*.instructions.md` | `.github/agents/*.md` |
| 2 generic | gemini | `GEMINI.md` section / `~/.gemini/` | rendered as section |
| 2 generic | codex | `AGENTS.md` / `~/.codex/AGENTS.md` | rendered as section |
| 2 generic | windsurf | `.windsurf/rules/` | rendered as rule files |
| 2 generic | cline | `.clinerules/` | rendered as rule files |
| 2 generic | kilo | `.kilocode/rules/` | rendered as rule files |
| 2 generic | antigravity | `.agent/rules/` | rendered as rule files |

**Verification requirement:** exact Tier-2 paths/dialects MUST be verified against each vendor's current official docs during implementation (dedicated research task). Vendor formats churn; do not trust remembered paths.

**Adapter interface (one small file per target):**

```js
export const target = {
  id, label,
  paths({ scope, projectDir, home }),       // → { skillsDir?, agentsDir?, rulesDir? } absolute
  transformSkill(data, body),               // → { data, body } in target's frontmatter dialect
  transformAgent(data, body),               // → { data, body } | null when agents unsupported
};
```

Tier-2 targets share one generic engine; per-target modules only supply paths + dialect config.

### 7.4 Manifest & safety

- Project scope: `<projectDir>/.mugiwara/manifest.json`. Global scope: `~/.mugiwara/manifest-<target>.json`.
- Manifest: `{ version, target, scope, type, installedAt, files: [relative paths] }`.
- Uninstall deletes only manifest-listed files, then removes empty dirs, then the manifest.
- Update/overwrite policy: identical file → skip; different file → copy to `.mugiwara/backup/<timestamp>/` first, then overwrite. Never silent overwrite.
- `--dry-run` prints the full action list without writing.

### 7.5 Tech constraints

- Node.js ≥ 20, ESM, **zero runtime dependencies** (`node:fs`, `node:path`, `node:os`, `node:readline/promises`).
- Cross-platform paths via `node:path`/`node:os` only.
- Installer target: < 800 LOC total.
- Frontmatter: flat `key: value` YAML subset only (parseable in ~20 LOC; no yaml dependency).

## 8. Distribution

- npm package `mugiwara` (Task 0 of the plan verifies name availability; fallback `@mugiwara/cli`). `bin` entry, `files` allowlist, `engines: node >= 20`.
- `scripts/install.sh` (mac/linux): checks Node ≥ 20, then `exec npx -y mugiwara@latest "$@"`.
- `scripts/install.ps1` (windows): same via PowerShell.
- README: install matrix, crew table, workflow diagram, uninstall, troubleshooting.

## 9. Testing Strategy

`node:test` only (zero deps):

- **Unit:** frontmatter parse/stringify, args parser, manifest read/write/apply, each adapter's `paths()` + transforms, prompt logic (with mocked readline).
- **Content gate:** `scripts/validate-content.mjs` enforces the content schema — name matches dir/filename, description 20–500 chars, no duplicate names, agent `skills:` refs resolve, every skill referenced by ≥1 agent (exempt: `mugiwara-workflow`). Runs inside the test suite, so every content authoring task is auto-verified.
- **E2E:** with fake `HOME` and fake project in tmp dirs — install per target, assert exact file layout; uninstall, assert clean removal; update, assert backup created.

## 10. Project Structure

```
mugiwara/
├── package.json
├── README.md
├── LICENSE                     # MIT
├── bin/mugiwara.js
├── src/
│   ├── cli.js                  # command dispatch
│   ├── args.js                 # argv parsing (pure)
│   ├── prompt.js               # readline wrappers
│   ├── frontmatter.js          # flat-YAML parse/stringify
│   ├── manifest.js             # manifest read/write/apply
│   ├── installer.js            # copy engine: content tree → target paths
│   └── targets/
│       ├── index.js            # registry
│       ├── claude.js  opencode.js  copilot.js          # Tier 1
│       └── gemini.js  codex.js  windsurf.js  cline.js  kilo.js  antigravity.js  # Tier 2
├── content/
│   ├── skills/                 # 12 dirs, each <name>/SKILL.md
│   └── agents/                 # 10 .md files
├── scripts/
│   ├── validate-content.mjs
│   ├── install.sh
│   └── install.ps1
├── test/                       # *.test.js (node:test)
└── docs/superpowers/
    ├── specs/2026-08-07-mugiwara-design.md   # this file
    └── plans/                                 # implementation plan goes here
```

## 11. Open Items (resolved during implementation, not blockers)

1. npm name availability (`mugiwara` vs `@mugiwara/cli`).
2. Tier-2 target directory/frontmatter verification against live vendor docs (dedicated research task before adapter code).
3. Curl installer hosting URL (raw.githubusercontent until a domain exists).
4. Copilot skills support is evolving (preview); adapter may need follow-up as GitHub ships native skills.

## 12. Future Extensions (explicitly out of scope now)

- Plugin system for custom crew members.
- Visual dashboard for wave progress.
- CI/CD pipeline integration (gate as GitHub Action).
- Auto-update of skills from an official registry.
