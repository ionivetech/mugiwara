# Mugiwara Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `mugiwara` — a content pack of 10 Straw Hat agent definitions + 12 skills (markdown, standard frontmatter) with a zero-dependency Node CLI that installs it into 9 AI agent targets on macOS/Linux/Windows, global or per-project, with manifest-based uninstall/update. Spec: `docs/superpowers/specs/2026-08-07-mugiwara-design.md`.

**Architecture:** Content-only distribution (no runtime — host agents execute the workflow). One canonical `content/` tree (skills as `SKILL.md` dirs, agents as `.md` files). A small Node CLI parses args, prompts for missing choices, and copies content through per-target adapters: 3 native adapters (claude, opencode, copilot) + 1 generic engine with per-target config (gemini, codex, windsurf, cline, kilo, antigravity). Installs record a manifest; uninstall/update operate on it.

**Tech Stack:** Node.js ≥ 20, ESM, zero runtime deps (`node:fs`, `node:path`, `node:os`, `node:readline/promises`), `node:test` for tests, markdown + flat YAML frontmatter for content.

## Global Constraints

- Node ≥ 20; **zero runtime npm dependencies** — if you feel the need for one, write the ~20 LOC stdlib version instead.
- All paths via `node:path`/`node:os`; works on Windows (no hardcoded `/`, no shell-isms in CLI code).
- Frontmatter is a flat `key: value` YAML subset only (no nesting, no lists) — parsed by our own `src/frontmatter.js`.
- Skill `description` frontmatter: 20–500 chars, third person, starts with "Use when/Use for/Use at" trigger phrasing (hosts match on it).
- Skills named `mugiwara-*`; directory name == frontmatter `name`. Agent filename == frontmatter `name`.
- Never silently overwrite a differing user file: identical → skip; different → back up to `.mugiwara/backup/<timestamp>/` first (update/`--force` only).
- Installer < 800 LOC total across `src/`. Content authoring does not count.
- Tier-2 targets: project scope only. If user selects global + Tier-2 target, warn and skip that target.
- Tier-2 adapters must never modify an existing user context file (GEMINI.md/AGENTS.md): create only when absent, otherwise print a one-line manual instruction.
- Repo already exists at `/mnt/d/Project/Portfolio/mugiwara` (git initialized, spec committed, remote `origin` = `https://github.com/ionivetech/mugiwara.git`, identity `ionive <ionivetech@gmail.com>`). Do not re-init.

## Interface Contracts (cross-task; do not drift)

- `parseArgs(argv: string[])` → `{ command: 'install'|'uninstall'|'update'|'list'|'help'|'version', flags: { global?: boolean, project?: string, target?: string, type?: string, yes?: boolean, force?: boolean, dryRun?: boolean, help?: boolean, version?: boolean } }`. Throws `Error('Unknown flag: …')` on unknown `-`-prefixed arg; throws on flag missing its value.
- `parseFrontmatter(text)` → `{ data: Record<string,string>, body: string }`; `stringifyFrontmatter(data, body)` → `string`. Throws `/frontmatter/i` error when fence missing.
- `manifestPath({ scope, projectDir, home })` → project: `<projectDir>/.mugiwara/manifest.json`; global: `<home>/.mugiwara/manifest.json`.
- Manifest JSON: `{ version, scope, type, installedAt, targets: string[], files: string[] }` — `files` are absolute paths.
- Target adapter:
  ```js
  export const target = {
    id,                    // 'claude'
    label,                 // 'Claude Code'
    native,                // true (Tier 1) | false (Tier 2)
    paths({ scope, projectDir, home }),  // → { skillsDir, agentsDir } absolute (Tier 2: both = rules dir)
    transformSkill(data, body),          // → { relPath, text } | null
    transformAgent(data, body),          // → { relPath, text } | null
  };
  ```
  Engine writes each result to `join(dir, relPath)` where `dir` = `skillsDir` for skills, `agentsDir` for agents.
- `installTo(target, { scope, projectDir, type, home, dryRun, force })` → `{ written: string[], skipped: string[], backedUp: string[], notes: string[] }`.
- `collectContent({ includeFrontend })` → `{ skills: [{name, data, body}], agents: [{name, data, body}] }` — excludes `mugiwara-frontend` when `includeFrontend === false`.

## File Structure

```
mugiwara/
├── package.json
├── README.md
├── LICENSE                      # MIT
├── .gitignore
├── bin/mugiwara.js
├── src/
│   ├── cli.js                   # run(argv): command dispatch + install/uninstall/update/list flows
│   ├── args.js                  # parseArgs (pure)
│   ├── prompt.js                # choose / multiChoose / confirm (readline wrappers)
│   ├── frontmatter.js           # parse/stringify flat YAML frontmatter
│   ├── manifest.js              # manifestPath / readManifest / writeManifest
│   ├── installer.js             # CONTENT_DIR, collectContent, installTo, removeInstalled
│   └── targets/
│       ├── index.js             # registry: id → adapter; TARGET_IDS
│       ├── claude.js            # Tier 1
│       ├── opencode.js          # Tier 1
│       ├── copilot.js           # Tier 1
│       ├── gemini.js            # Tier 2 (uses generic.js)
│       ├── codex.js             # Tier 2
│       ├── windsurf.js          # Tier 2
│       ├── cline.js             # Tier 2
│       ├── kilo.js              # Tier 2
│       ├── antigravity.js       # Tier 2
│       └── generic.js           # makeGeneric() shared Tier-2 factory
├── content/
│   ├── skills/                  # 12 × <name>/SKILL.md
│   └── agents/                  # 10 × <name>.md
├── scripts/
│   ├── validate-content.mjs     # full-schema lint + `--check <file>` single-file mode
│   ├── install.sh               # curl installer (mac/linux) → npx wrapper
│   └── install.ps1              # Windows installer → npx wrapper
└── test/
    ├── args.test.js
    ├── frontmatter.test.js
    ├── manifest.test.js
    ├── installer.test.js
    ├── targets.test.js
    ├── validate-content.test.js
    └── e2e.test.js
```

---

## Wave 1 — Scaffold & Core Primitives `[SEQUENTIAL — each task depends on the previous]`

### Task 1: Package scaffold

**Files:**
- Create: `package.json`, `.gitignore`, `LICENSE`

- [ ] **Step 1: Check npm name availability**

Run: `npm view mugiwara name 2>&1 | head -1`
Expected: 404 error (name free). If taken, switch every reference in this plan to `@mugiwara/cli`.

- [ ] **Step 2: Write package.json**

```json
{
  "name": "mugiwara",
  "version": "0.1.0",
  "description": "The Straw Hat crew of AI agents and skills: brainstorm, plan, execute, checkpoint, quality, gates, review, security, self-healing. Installs into Claude Code, opencode, Copilot, Gemini, Codex, Windsurf, Cline, Kilo, Antigravity.",
  "type": "module",
  "license": "MIT",
  "bin": { "mugiwara": "bin/mugiwara.js" },
  "files": ["bin", "src", "content", "scripts/install.sh", "scripts/install.ps1", "README.md", "LICENSE"],
  "engines": { "node": ">=20" },
  "scripts": { "test": "node --test test/" },
  "keywords": ["ai", "agents", "skills", "claude-code", "opencode", "copilot", "gemini", "codex", "windsurf", "cline", "multi-agent", "workflow"]
}
```

- [ ] **Step 3: Write .gitignore**

```
node_modules/
.mugiwara/
*.tgz
```

- [ ] **Step 4: Write LICENSE (MIT, copyright 2026 ionive)**

Standard MIT text; Copyright (c) 2026 ionive.

- [ ] **Step 5: Commit**

```bash
git add package.json .gitignore LICENSE && git commit -m "chore: package scaffold"
```

**Acceptance criteria:** `node -e "console.log(JSON.parse(require('fs').readFileSync('package.json')).bin.mugiwara)"` prints `bin/mugiwara.js`; `npm pkg get name` prints `mugiwara`.

---

### Task 2: Frontmatter parser `[SEQUENTIAL]`

**Files:**
- Create: `src/frontmatter.js`, `test/frontmatter.test.js`

- [ ] **Step 1: Write failing test**

```js
// test/frontmatter.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter, stringifyFrontmatter } from '../src/frontmatter.js';

test('parses flat frontmatter', () => {
  const { data, body } = parseFrontmatter('---\nname: x\ndescription: y z\n---\nBody here\n');
  assert.equal(data.name, 'x');
  assert.equal(data.description, 'y z');
  assert.equal(body, 'Body here\n');
});

test('handles CRLF', () => {
  const { data, body } = parseFrontmatter('---\r\nname: x\r\n---\r\nB\r\n');
  assert.equal(data.name, 'x');
  assert.equal(body, 'B\r\n');
});

test('throws without fence', () => {
  assert.throws(() => parseFrontmatter('no fence'), /frontmatter/i);
});

test('throws on bad line', () => {
  assert.throws(() => parseFrontmatter('---\nno-colon-line\n---\n'), /bad frontmatter/i);
});

test('roundtrip', () => {
  const text = stringifyFrontmatter({ name: 'a', description: 'b' }, 'body\n');
  const { data, body } = parseFrontmatter(text);
  assert.deepEqual(data, { name: 'a', description: 'b' });
  assert.equal(body, 'body\n');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/frontmatter.test.js`
Expected: FAIL (cannot find module).

- [ ] **Step 3: Implement**

```js
// src/frontmatter.js
export function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) throw new Error('Missing frontmatter fence (---)');
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const i = line.indexOf(':');
    if (i === -1) throw new Error(`Bad frontmatter line: ${line}`);
    data[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { data, body: text.slice(m[0].length) };
}

export function stringifyFrontmatter(data, body) {
  const lines = Object.entries(data).map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join('\n')}\n---\n${body}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/frontmatter.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/frontmatter.js test/frontmatter.test.js && git commit -m "feat: flat-YAML frontmatter parser"
```

**Acceptance criteria:** 5/5 tests pass.

---

### Task 3: Content validator `[SEQUENTIAL]`

The quality gate for all of Wave 2. Two modes: `--check <file>` (single-file schema: fence parses, name matches dir/filename, description length) and full mode (all files + cross-references).

**Files:**
- Create: `scripts/validate-content.mjs`, `test/validate-content.test.js`

**Full-mode rules:**
1. Every `content/skills/*/SKILL.md`: frontmatter `name` == dir name; `description` 20–500 chars.
2. Every `content/agents/*.md`: frontmatter `name` == filename sans `.md`; `description` ≥ 20 chars; `skills` field present and non-empty.
3. No duplicate `name` across all skills + agents.
4. Every agent `skills:` entry resolves to an existing skill dir.
5. Every skill referenced by ≥ 1 agent, except `mugiwara-workflow`.

- [ ] **Step 1: Write failing test**

```js
// test/validate-content.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('full content validation passes', () => {
  execFileSync(process.execPath, ['scripts/validate-content.mjs'], { stdio: 'pipe' });
});

test('single-file check passes on a valid file', () => {
  execFileSync(process.execPath, ['scripts/validate-content.mjs', '--check', 'content/skills/mugiwara-workflow/SKILL.md'], { stdio: 'pipe' });
});
```

(Note: both tests stay red until Wave 2 content exists — that is the wave gate.)

- [ ] **Step 2: Implement**

```js
#!/usr/bin/env node
// scripts/validate-content.mjs
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parseFrontmatter } from '../src/frontmatter.js';

const root = join(import.meta.dirname, '..', 'content');
const errors = [];

function checkFile(file, wantName, kind) {
  let parsed;
  try { parsed = parseFrontmatter(readFileSync(file, 'utf8')); }
  catch (e) { errors.push(`${kind} ${file}: ${e.message}`); return null; }
  const { data } = parsed;
  if (data.name !== wantName) errors.push(`${kind} ${file}: name "${data.name}" != "${wantName}"`);
  const d = data.description ?? '';
  if (kind === 'skill' && (d.length < 20 || d.length > 500)) errors.push(`skill ${file}: description must be 20-500 chars (got ${d.length})`);
  if (kind === 'agent' && d.length < 20) errors.push(`agent ${file}: description too short`);
  return data;
}

const skillDirs = existsSync(join(root, 'skills'))
  ? readdirSync(join(root, 'skills')).filter(d => statSync(join(root, 'skills', d)).isDirectory())
  : [];
const names = new Map();
const usedSkills = new Set();

const checkArg = process.argv.indexOf('--check');
if (checkArg !== -1) {
  const file = process.argv[checkArg + 1];
  const isSkill = file.includes('skills');
  const want = isSkill ? basename(join(file, '..')) : basename(file).replace(/\.md$/, '');
  checkFile(file, want, isSkill ? 'skill' : 'agent');
  if (errors.length) { console.error(errors.map(e => `✗ ${e}`).join('\n')); process.exit(1); }
  console.log(`✓ ${file}`);
  process.exit(0);
}

for (const dir of skillDirs) {
  const file = join(root, 'skills', dir, 'SKILL.md');
  if (!existsSync(file)) { errors.push(`skill ${dir}: missing SKILL.md`); continue; }
  const data = checkFile(file, dir, 'skill');
  if (data) {
    if (names.has(data.name)) errors.push(`duplicate name: ${data.name}`);
    names.set(data.name, file);
  }
}

const agentDir = join(root, 'agents');
const agentFiles = existsSync(agentDir) ? readdirSync(agentDir).filter(f => f.endsWith('.md')) : [];
for (const f of agentFiles) {
  const data = checkFile(join(agentDir, f), f.replace(/\.md$/, ''), 'agent');
  if (!data) continue;
  if (names.has(data.name)) errors.push(`duplicate name: ${data.name}`);
  names.set(data.name, f);
  const skills = (data.skills ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (skills.length === 0) errors.push(`agent ${f}: skills field missing/empty`);
  for (const s of skills) {
    usedSkills.add(s);
    if (!skillDirs.includes(s)) errors.push(`agent ${f}: unknown skill "${s}"`);
  }
}

for (const dir of skillDirs) {
  if (dir !== 'mugiwara-workflow' && !usedSkills.has(dir)) errors.push(`skill ${dir}: not referenced by any agent`);
}

if (errors.length) { console.error(errors.map(e => `✗ ${e}`).join('\n')); process.exit(1); }
console.log(`✓ content valid: ${skillDirs.length} skills, ${agentFiles.length} agents`);
```

- [ ] **Step 3: Run tests — expect FAIL (no content yet); also verify script itself runs**

Run: `node scripts/validate-content.mjs; echo $?`
Expected: exit 1 with `skill ...` (no crash / no stack trace).

- [ ] **Step 4: Commit**

```bash
git add scripts/validate-content.mjs test/validate-content.test.js && git commit -m "feat: content schema validator (Wave 2 gate)"
```

**Acceptance criteria:** Script exits 1 with readable violations on empty content; no stack trace; `--check` mode works standalone.

---

## Wave 2 — Content Authoring `[PARALLEL — all 22 tasks are independent files]`

Dispatch one subagent per task (or batches). Per-task verification uses `--check` mode; the wave gate (Task 26) runs full validation.

**Writing rules for every file:** English; imperative; dense; no emoji; skill bodies ≤ 120 lines; descriptions follow trigger phrasing. Full file contents are given below — write them exactly (they encode approved spec behavior).

### Task 4: Skill — mugiwara-workflow `[PARALLEL]`

**Files:**
- Create: `content/skills/mugiwara-workflow/SKILL.md`

- [ ] **Step 1: Create file with exact content**

````markdown
---
name: mugiwara-workflow
description: Use at the start of any non-trivial mission to run the Mugiwara crew pipeline - Luffy triage first, then brainstorm, planning, execution, checkpoint, quality, gates, review, healing, and closure waves.
---

# Mugiwara Workflow

The Straw Hat pipeline: Wave 0 triage + Waves 1-9. Waves are phases of the mission, not files — Nami writes them into the plan doc, Zoro executes them.

## Workspace layout

Every mission creates and works inside `.mugiwara/` at the repo root:

```
.mugiwara/
├── spec/          # brainstorm output (before planning)
├── plans/         # plan docs — single source of truth from Wave 2
├── results/       # wave results: audit reports, test output, gate verdicts
├── review/        # review + security findings, code review reports
└── ...            # any other mission artifacts
```

The owning agent creates the folder it needs on first write. No mission artifacts go outside `.mugiwara/`.

## Wave 0 — Luffy Triage (always first)

Dispatch `luffy-orchestrator`. NEVER start directly with brainstorming or planning.
Luffy routes: vague idea / unclear requirements → Wave 1 first. Clear requirements or small well-understood change → Wave 2 directly, skip reason recorded in the plan.

## Waves

| Wave | Owner | Skill | Output |
|------|-------|-------|--------|
| 0 Triage | Luffy | mugiwara-orchestration | route decision + reason |
| 1 Brainstorm | Usopp | mugiwara-brainstorm | refined direction, options, recommendation |
| 2 Planning | Nami | mugiwara-planning | plan doc: waves/tasks/criteria, parallel markers |
| 3 Execution | Zoro | mugiwara-execution | implemented tasks with evidence |
| 4 Checkpoint | Chopper | mugiwara-checkpoint | audit report + failure ledger |
| 5 Quality | Sanji | mugiwara-quality | formatter/linter/test results |
| 6 Gates | Franky | mugiwara-gates | coverage + build verdict |
| 7 Review | Robin ∥ Jinbe | mugiwara-review + mugiwara-security | severity-tagged findings |
| 8 Healing | Brook | mugiwara-healing | fixes, then loop back to Wave 4 |
| 9 Closure | Luffy | mugiwara-orchestration | closure report appended to plan |

## Rules

1. Evidence over claims: no wave passes on assertion. The owning agent runs the checks and shows output.
2. No wave skipped without the reason recorded in the plan doc.
3. Heal loop is bounded: Wave 8 → Wave 4, max 3 cycles. After that, escalate to the human with full history.
4. Any agent may consult Luffy mid-flight (re-dispatch `luffy-orchestrator`) for decisions and escalations.
5. Wave 7 runs Robin and Jinbe in parallel.
6. The plan doc (`.mugiwara/plans/YYYY-MM-DD-<mission>.md`) is the single source of truth from Wave 2 onward.
7. Frontend-touching tasks in Wave 3 must apply `mugiwara-frontend` in the same pass.
````

- [ ] **Step 2: Verify** — Run: `node scripts/validate-content.mjs --check content/skills/mugiwara-workflow/SKILL.md` → `✓`.

- [ ] **Step 3: Commit** — `git add content/skills/mugiwara-workflow && git commit -m "feat(content): mugiwara-workflow skill"`

**Acceptance criteria:** `--check` passes; file matches content above verbatim.

---

### Task 5: Skill — mugiwara-brainstorm `[PARALLEL]`

**Files:**
- Create: `content/skills/mugiwara-brainstorm/SKILL.md`

- [ ] **Step 1: Create file with exact content**

````markdown
---
name: mugiwara-brainstorm
description: Use when exploring a vague idea, feature direction, or architecture choice before planning. Expert principal-engineer sparring partner - probing questions, trade-offs, recommendations, web research when unsure.
---

# Brainstorm (Usopp)

You are a principal/CTO-level sparring partner, not a yes-man.

## Behavior

1. Interrogate the idea before endorsing it: purpose, users, constraints, success criteria, what breaks if it succeeds.
2. Never answer "yes, done". Give 2-3 options with trade-offs and one recommendation.
3. Challenge weak assumptions directly; say what will hurt later.
4. Unsure about current tech, libraries, versions, or APIs? Research with available web tools FIRST, then answer citing what you found. Never guess versions.
5. Ask ONE sharp question at a time; prefer multiple choice.
6. Ground every suggestion in the actual codebase — read files before proposing.

## Output

- Problem restatement (1-2 lines)
- Options with trade-offs
- Recommendation + reasoning
- Risks / unknowns
- Open questions for the user

## Mockup rule

For UI ideas, sketch structure in markdown/ASCII or minimal HTML before committing to implementation. No full application code during brainstorm.

## Handoff

When direction is locked, write a short brief (problem, chosen option + reasoning, risks, open questions) to `.mugiwara/spec/YYYY-MM-DD-<mission>.md` and hand to Nami (`mugiwara-planning`).
````

- [ ] **Step 2: Verify** — `node scripts/validate-content.mjs --check content/skills/mugiwara-brainstorm/SKILL.md` → `✓`.
- [ ] **Step 3: Commit** — `git add content/skills/mugiwara-brainstorm && git commit -m "feat(content): mugiwara-brainstorm skill"`

**Acceptance criteria:** `--check` passes; content verbatim.

---

### Task 6: Skill — mugiwara-planning `[PARALLEL]`

**Files:**
- Create: `content/skills/mugiwara-planning/SKILL.md`

- [ ] **Step 1: Create file with exact content**

````markdown
---
name: mugiwara-planning
description: Use when turning an approved idea or spec into an execution plan. Produces wave-structured plans with parallel/sequential markers, dependency order, and acceptance criteria per task. Asks questions up front and mid-plan.
---

# Planning (Nami)

Quality bar: an engineer with zero project context can execute Task 1 without asking questions.

## Before writing

Batch all blocking ambiguities into ONE question round before starting. If a major decision appears mid-plan, stop and ask then — never assume silently.

## Plan format

Save to `.mugiwara/plans/YYYY-MM-DD-<mission>.md`:

- Header: goal (one sentence), architecture (2-3 sentences), tech stack, global constraints.
- Waves: group tasks into waves; each wave ends in a reviewable, testable state.
- Tasks: smallest unit with its own test cycle. Each task declares:
  - **Files:** exact create/modify paths
  - **Marker:** `[PARALLEL]` (independent of sibling tasks) or `[SEQUENTIAL]` with `depends-on: Task N`
  - **Steps** as checkboxes, one action per step (failing test → run → implement → run → commit)
  - **Acceptance criteria:** observable, command-verifiable statements
- Ordering rule: foundation before dependents. Independent tasks in the same wave are marked `[PARALLEL]` so Zoro can dispatch them concurrently.
- Every code step shows real code. No "TBD", no "add appropriate error handling", no "similar to Task N".

## Parallelization analysis

Build the dependency graph explicitly: for each task, state what it consumes and produces (interfaces). Two tasks sharing no file and no interface dependency are parallel-safe — say so in the wave header: which tasks run concurrently, which chain.

## Acceptance criteria rules

Each criterion must be checkable by running a command or inspecting a file. "Works correctly" is not a criterion.

## Handoff

Plan reviewed by the user → hand to Zoro (`mugiwara-execution`).
````

- [ ] **Step 2: Verify** — `node scripts/validate-content.mjs --check content/skills/mugiwara-planning/SKILL.md` → `✓`.
- [ ] **Step 3: Commit** — `git add content/skills/mugiwara-planning && git commit -m "feat(content): mugiwara-planning skill"`

**Acceptance criteria:** `--check` passes; content verbatim.

---

### Task 7: Skill — mugiwara-orchestration `[PARALLEL]`

**Files:**
- Create: `content/skills/mugiwara-orchestration/SKILL.md`

- [ ] **Step 1: Create file with exact content**

````markdown
---
name: mugiwara-orchestration
description: Use to triage a new mission, coordinate wave transitions, answer inter-agent escalations, and close a mission. Captain behavior - triage criteria, periodic check-ins, decision log, closure report.
---

# Orchestration (Luffy)

Captain duties: triage, check-ins, decisions, closure. Luffy does not implement.

## Wave 0 triage

Score the incoming mission:

- Unknowns: are requirements, APIs, or scope unclear? (none / some / many)
- Spec: does a written spec or reference exist?
- Size: single file / single wave / multi-wave?
- Risk: touches money, security, data, or public API?

Route:

- Many unknowns, or no spec and size ≥ one wave → Wave 1 (brainstorm) first.
- Few/no unknowns and (spec exists or small well-understood change) → Wave 2 directly.

Record the decision plus a one-line reason at the top of the plan doc.

## Periodic check-ins

After every wave and at the end of each execution batch, verify:

1. Outputs match the plan's acceptance criteria (evidence, not claims).
2. No task silently dropped or reordered.
3. Loop counters (heal cycles) within bounds.

On drift: stop, diagnose with Chopper's ledger, decide continue / retry / escalate to human.

## Q&A hub

Any agent may route a question to Luffy. Answer with: decision + reason + impact on the plan. Log every decision in the plan doc.

## Closure (Wave 9)

Gate: every task's acceptance criteria verified; every gate passed; findings resolved or explicitly deferred with an owner.
Append the closure report to the plan doc: mission summary, per-wave outcomes, deferred items, lessons learned.
````

- [ ] **Step 2: Verify** — `node scripts/validate-content.mjs --check content/skills/mugiwara-orchestration/SKILL.md` → `✓`.
- [ ] **Step 3: Commit** — `git add content/skills/mugiwara-orchestration && git commit -m "feat(content): mugiwara-orchestration skill"`

**Acceptance criteria:** `--check` passes; content verbatim.

---

### Task 8: Skill — mugiwara-execution `[PARALLEL]`

**Files:**
- Create: `content/skills/mugiwara-execution/SKILL.md`

- [ ] **Step 1: Create file with exact content**

````markdown
---
name: mugiwara-execution
description: Use when executing an approved wave-structured plan. Splits tasks into parallel batches and sequential chains, dispatches subagents, verifies each task's acceptance criteria with evidence before reporting done.
---

# Execution (Zoro)

Execute the plan exactly. No silent reordering, no skipping steps, no "close enough".

## Ingestion

1. Read the plan doc fully before touching code.
2. Build the task graph from `[PARALLEL]`/`[SEQUENTIAL]` markers and depends-on fields.
3. Contradictory graph (cycle, missing dependency) → escalate to Luffy. Do not guess.

## Dispatch rules

- Independent tasks in a wave → dispatch concurrently, one task per subagent (host's native task/subagent mechanism).
- Dependency chains → strictly sequential; a task starts only when its dependencies report done with evidence.
- Two tasks must never edit the same file concurrently. The plan should prevent this; if it doesn't, serialize them and note the deviation.
- Give every subagent: its task body verbatim, the interfaces it consumes/produces, and the rule to stop at task boundaries.

## Per-task discipline

1. Follow the task's steps in order — TDD steps included (write the failing test first).
2. Verify every acceptance criterion; capture command output as evidence.
3. Report done (with evidence) or blocked (with reason). Blocked → escalate to Luffy. Never work around a blocker silently.

## Frontend tasks

Any task touching UI markup, styling, or components applies `mugiwara-frontend` in the same pass.

## Report

After each wave: task table (status, evidence pointer, deviations) → hand to Chopper.
````

- [ ] **Step 2: Verify** — `node scripts/validate-content.mjs --check content/skills/mugiwara-execution/SKILL.md` → `✓`.
- [ ] **Step 3: Commit** — `git add content/skills/mugiwara-execution && git commit -m "feat(content): mugiwara-execution skill"`

**Acceptance criteria:** `--check` passes; content verbatim.

---

### Task 9: Skill — mugiwara-checkpoint `[PARALLEL]`

**Files:**
- Create: `content/skills/mugiwara-checkpoint/SKILL.md`

- [ ] **Step 1: Create file with exact content**

````markdown
---
name: mugiwara-checkpoint
description: Use after an execution wave to audit results against the plan. Verifies every acceptance criterion with runnable evidence and writes a categorized failure ledger. Auditor only - never fixes code.
---

# Checkpoint (Chopper)

Auditor, not fixer. Trust nothing; verify everything.

## Audit protocol

For every task in the completed wave:

1. Check each acceptance criterion by RUNNING the referenced command or inspecting the file — never accept "done" claims.
2. Check the task's commits exist and contain only the files the task declared.
3. Check parallel-batch claims: tasks marked parallel must not have touched shared files.

## Failure ledger

Record every failure as one row:

| task | criterion | category | evidence |
|------|-----------|----------|----------|

Categories:

- `test-fail` — a test/lint/build command fails
- `missing-impl` — criterion unverifiable, artifact absent
- `parallel-conflict` — concurrent tasks modified shared state
- `env` — failure caused by environment, not code
- `regression` — previously passing check now fails

## Output

Audit report: pass/fail per task, ledger rows, wave verdict.

- Verdict pass → Wave 5 (Quality).
- Any fail → report + ledger to Brook (Wave 8).

Chopper never edits code. Findings only.
````

- [ ] **Step 2: Verify** — `node scripts/validate-content.mjs --check content/skills/mugiwara-checkpoint/SKILL.md` → `✓`.
- [ ] **Step 3: Commit** — `git add content/skills/mugiwara-checkpoint && git commit -m "feat(content): mugiwara-checkpoint skill"`

**Acceptance criteria:** `--check` passes; content verbatim.

### Task 10: Skill — mugiwara-quality `[PARALLEL]`

**Files:**
- Create: `content/skills/mugiwara-quality/SKILL.md`

- [ ] **Step 1: Create file with exact content**

````markdown
---
name: mugiwara-quality
description: Use after checkpoint passes to run code quality checks - formatter, linter, unit tests, and with user consent integration tests. Detects project tooling first, never weakens configs to pass.
---

# Quality (Sanji)

Cook the checks properly; never cut corners to make them pass.

## Order

1. Detect tooling from the project (package.json scripts, pyproject.toml, Makefile, CI config). Use the project's own commands; do not invent parallel tooling.
2. Formatter — the project's formatter.
3. Linter — resolve all errors properly. Never disable rules, downgrade severity, or add ignore comments to pass.
4. Unit tests — full suite, capture output.
5. Integration tests — ASK THE USER FIRST: run automatically now / skip / run manually later. Record the answer in the report. Do not run integration tests without consent.

## No tooling found

Say so explicitly, propose the minimal standard setup for the stack, and continue with what exists. Never silently skip the wave.

## Report

Per check: command run, exit status, key output excerpt, pass/fail. Failures → Brook with the report.
````

- [ ] **Step 2: Verify** — `node scripts/validate-content.mjs --check content/skills/mugiwara-quality/SKILL.md` → `✓`.
- [ ] **Step 3: Commit** — `git add content/skills/mugiwara-quality && git commit -m "feat(content): mugiwara-quality skill"`

**Acceptance criteria:** `--check` passes; content verbatim; integration-test consent rule present.

---

### Task 11: Skill — mugiwara-gates `[PARALLEL]`

**Files:**
- Create: `content/skills/mugiwara-gates/SKILL.md`

- [ ] **Step 1: Create file with exact content**

````markdown
---
name: mugiwara-gates
description: Use after quality checks to enforce quality gates - test coverage thresholds (>=90% new files, >=80% modified files) and build validation. Binary verdicts with evidence, no negotiation.
---

# Gates (Franky)

Gates are binary: pass or fail, with evidence. No negotiation.

## Coverage gate

1. Measure coverage with the project's existing tooling (jest --coverage, pytest --cov, go test -cover, cargo tarpaulin, etc.).
2. Thresholds: NEW files >= 90%, MODIFIED files >= 80%. Identify new/modified via git diff against the mission's base.
3. No coverage tooling exists → the gate cannot pass silently: report the gap, propose the minimal tooling addition, ask the user to add it or waive the gate explicitly.

## Build gate

Run the project's build (or typecheck for interpreted stacks). Must exit 0. Capture the tail of output.

## Verdict

PASS only when both gates pass with evidence. Any FAIL → list exactly which files are under threshold and by how much → Brook.
````

- [ ] **Step 2: Verify** — `node scripts/validate-content.mjs --check content/skills/mugiwara-gates/SKILL.md` → `✓`.
- [ ] **Step 3: Commit** — `git add content/skills/mugiwara-gates && git commit -m "feat(content): mugiwara-gates skill"`

**Acceptance criteria:** `--check` passes; thresholds exactly 90/80 in file.

---

### Task 12: Skill — mugiwara-review `[PARALLEL]`

**Files:**
- Create: `content/skills/mugiwara-review/SKILL.md`

- [ ] **Step 1: Create file with exact content**

````markdown
---
name: mugiwara-review
description: Use after quality gates pass to review the diff - breaking-change analysis via caller mapping, code smells, duplication, unused code, documentation gaps. Severity-tagged findings.
---

# Review (Robin)

Review like the diff will be maintained by someone else at 3am.

## Breaking-change analysis (do this FIRST)

1. List every changed/removed/renamed public symbol, CLI flag, config key, API route, DB schema item.
2. For each: grep callers, imports, references across the repo.
3. Classify: safe (no external refs) / internal-break (callers updated?) / public-break (needs migration, changelog, deprecation).
4. Any public-break without a migration path = blocker.

## Sonar-style checks

- Duplication: copy-pasted logic that should be one function (3+ near-identical blocks).
- Unused code: dead functions, unreachable branches, orphaned imports/vars.
- Complexity: functions doing several jobs, deep nesting, long parameter lists.
- Naming/consistency: names that lie about behavior, deviation from repo conventions.
- Comments: commented-out code, stale comments contradicting the code.

## Documentation

Public API changes must be reflected in README/docs/changelog where the repo has them.

## Findings format

One line each: `path:line: [blocker|major|minor] problem → fix`.

Deep security concerns → flag and hand to Jinbe (`mugiwara-security`); do not duplicate that work here. Blockers/majors → Brook. Minors may be batched with Brook's fixes.
````

- [ ] **Step 2: Verify** — `node scripts/validate-content.mjs --check content/skills/mugiwara-review/SKILL.md` → `✓`.
- [ ] **Step 3: Commit** — `git add content/skills/mugiwara-review && git commit -m "feat(content): mugiwara-review skill"`

**Acceptance criteria:** `--check` passes; breaking-change step ordered first.

---

### Task 13: Skill — mugiwara-security `[PARALLEL]`

**Files:**
- Create: `content/skills/mugiwara-security/SKILL.md`

- [ ] **Step 1: Create file with exact content**

````markdown
---
name: mugiwara-security
description: Use for security review of a diff or system - OWASP surface, secrets, injection, authn/authz, dependency vulnerabilities, sonar security hotspots. Senior security engineer stance, severity-tagged report.
---

# Security (Jinbe)

Senior security engineer. Assume the diff is hostile until proven safe.

## Checklist (run all, in order)

1. Secrets: hardcoded keys/tokens/passwords, committed .env files, secrets in logs or error messages.
2. Injection: SQL/NoSQL/command/template injection paths; unsanitized input reaching exec/query/render.
3. Authn/Authz: missing or client-side-only authorization checks, token handling, session rules.
4. Data exposure: PII in logs, over-broad API responses, missing rate limiting on sensitive endpoints.
5. Dependencies: run project audit tooling when available (npm audit, pip-audit, cargo audit, govulncheck). Known-vulnerable dependency in the diff's path = major or higher.
6. Deserialization & file handling: unsafe parsing of untrusted input, path traversal in file operations.
7. Sonar security hotspots: weak crypto (MD5/SHA1 for security purposes, ECB mode, hardcoded IV), insecure randomness for security use, permissive CORS, disabled TLS verification.

## Rules

- Security findings are never "minor by default": classify by exploitability × impact.
- Every finding includes: location, one-line attack scenario, severity, concrete fix.
- Compliance notes (OWASP Top 10 mapping) appended when the project handles payments, health data, or PII.

## Report

Findings table + verdict: PASS (no blocker/major) / FAIL → Brook.
````

- [ ] **Step 2: Verify** — `node scripts/validate-content.mjs --check content/skills/mugiwara-security/SKILL.md` → `✓`.
- [ ] **Step 3: Commit** — `git add content/skills/mugiwara-security && git commit -m "feat(content): mugiwara-security skill"`

**Acceptance criteria:** `--check` passes; all 7 checklist items present.

---

### Task 14: Skill — mugiwara-healing `[PARALLEL]`

**Files:**
- Create: `content/skills/mugiwara-healing/SKILL.md`

- [ ] **Step 1: Create file with exact content**

````markdown
---
name: mugiwara-healing
description: Use when earlier waves produced failures - test failures, gate failures, review findings, security findings. Triages each failure, applies minimal root-cause fixes, prepares rollback for risky ones, re-runs failed checks.
---

# Healing (Brook)

Fix what failed, minimally, and prove it. One clean retry per cycle.

## Inputs

Failure ledger (Chopper), quality report (Sanji), gate verdict (Franky), review findings (Robin), security report (Jinbe).

## Triage matrix

| Failure | Action |
|---------|--------|
| lint/format error | auto-fix (formatter when supported), re-run |
| type error / simple test fail | minimal diff at ROOT CAUSE — grep all callers before patching; never fix only the symptom path |
| flaky / env failure | mark `env`, do not patch code, note for rerun |
| blocker security/review finding | smallest safe diff; add or extend the test that catches it |
| architectural finding / high-risk change | DO NOT auto-fix — prepare fix/rollback plan, escalate to Luffy → human |

## Rules

1. One fix = smallest diff resolving the finding. No drive-by refactors.
2. Every code fix ships with the failed check now passing (run it, capture output).
3. Never delete or weaken tests/configs to make a failure disappear.
4. Cycle counter: after this wave the flow returns to Wave 4 (Chopper). Same failure surviving 3 heal cycles → stop, escalate with full history.

## Output

Fixed list (finding → commit → evidence) and escalated list (finding → plan → owner).
````

- [ ] **Step 2: Verify** — `node scripts/validate-content.mjs --check content/skills/mugiwara-healing/SKILL.md` → `✓`.
- [ ] **Step 3: Commit** — `git add content/skills/mugiwara-healing && git commit -m "feat(content): mugiwara-healing skill"`

**Acceptance criteria:** `--check` passes; 3-cycle bound present.

---

### Task 15: Skill — mugiwara-frontend `[PARALLEL]`

**Files:**
- Create: `content/skills/mugiwara-frontend/SKILL.md`

- [ ] **Step 1: Create file with exact content**

````markdown
---
name: mugiwara-frontend
description: Use for any frontend implementation or redesign task - converting Figma/images to code or restyling UI. Audit-first for redesigns, extracts the design system from the reference, bans generic AI-slop patterns. Framework-agnostic.
---

# Frontend (Anti-Slop)

Interfaces built under this skill must not look templated.

## Redesigns: audit first

Before changing existing UI: capture current layout, spacing scale, type scale, palette, and component inventory. Fix real problems; do not restyle what works.

## From Figma / image references

1. Extract tokens BEFORE writing markup: spacing scale, type scale (sizes/weights/line-heights), palette with roles, radii, shadows, motion language.
2. Reproduce structure faithfully: hierarchy, alignment, whitespace ratios. Do not "improve" the layout unasked.
3. Name tokens semantically; store them where the stack keeps design tokens (CSS variables, Tailwind config, theme file).

## Banned AI-default patterns (the slop list)

- Centered hero trio: headline + subtitle + two buttons, dead center, gradient text.
- Row of 3-4 identical feature cards with icon-circle + title + two lines.
- Purple/indigo gradient everything; glassmorphism everywhere; emoji as icons.
- Placeholder content where real product copy exists.
- Stock hero illustrations when the design specifies otherwise.

If the brief genuinely calls for one of these, execute it well — but the default is: don't.

## Craft bar

- Typography: deliberate scale, weight contrast, line-length control.
- Spacing: consistent scale, breathing room, aligned grids.
- Motion: subtle and purposeful (hover/scroll states), respects `prefers-reduced-motion`.
- Responsive: every layout verified at mobile/tablet/desktop breakpoints.
- A11y baseline: semantic landmarks, contrast AA, visible focus states, alt text.

## Verify

Compare the result against the reference side by side; list remaining deltas before calling it done.
````

- [ ] **Step 2: Verify** — `node scripts/validate-content.mjs --check content/skills/mugiwara-frontend/SKILL.md` → `✓`.
- [ ] **Step 3: Commit** — `git add content/skills/mugiwara-frontend && git commit -m "feat(content): mugiwara-frontend skill"`

**Acceptance criteria:** `--check` passes; slop list + token-extraction order present.

### Task 16: Agent — luffy-orchestrator `[PARALLEL]`

**Files:**
- Create: `content/agents/luffy-orchestrator.md`

- [ ] **Step 1: Create file with exact content**

````markdown
---
name: luffy-orchestrator
description: Dispatch at mission start for triage (brainstorm vs plan-first), at wave boundaries for check-ins, for any inter-agent decision, and at mission end for closure. Captain of the crew - coordinates, never implements.
skills: mugiwara-workflow, mugiwara-orchestration
---

# Luffy — Orchestrator (Captain)

## Role

Owns the whole mission flow: triage routing, wave transitions, decisions, closure. Does not write implementation code.

## When dispatched

- Mission start — always (Wave 0 triage).
- Wave boundaries (check-ins).
- Any agent's escalation question.
- Mission end (closure report).

## Rules

1. Follow `mugiwara-orchestration` exactly (triage criteria, check-in protocol, closure format).
2. Every routing/decision answer = decision + reason + plan impact, logged in the plan doc.
3. Never let a wave pass on claims — require evidence from the owning agent.
4. Heal loop counter: max 3 cycles, then escalate to the human with a summary.

## Output

Triage decision / check-in verdict / decision record / closure report — appended to `.mugiwara/plans/<mission>.md`.
````

- [ ] **Step 2: Verify** — `node scripts/validate-content.mjs --check content/agents/luffy-orchestrator.md` → `✓`.
- [ ] **Step 3: Commit** — `git add content/agents/luffy-orchestrator.md && git commit -m "feat(content): luffy-orchestrator agent"`

**Acceptance criteria:** `--check` passes; skills field references existing skills.

---

### Task 17: Agent — nami-planner `[PARALLEL]`

**Files:**
- Create: `content/agents/nami-planner.md`

- [ ] **Step 1: Create file with exact content**

````markdown
---
name: nami-planner
description: Dispatch after brainstorm (or directly for clear missions) to write the execution plan - waves, tasks, subtasks with parallel/sequential markers, dependency order, and acceptance criteria. Asks clarifying questions before and during planning.
skills: mugiwara-planning
---

# Nami — Planner (Navigator)

## Role

Charts the course: turns an approved direction into a plan a zero-context engineer can execute.

## When dispatched

Wave 2 of `mugiwara-workflow`.

## Rules

1. Follow `mugiwara-planning` exactly (format, markers, criteria rules).
2. Ambiguity → ONE batched question round before writing; stop and ask mid-plan for major decisions.
3. The plan must already be parallel-ready: explicit dependency graph, `[PARALLEL]`/`[SEQUENTIAL]` on every task, unambiguous execution order.
4. Every task ends with verifiable acceptance criteria.

## Output

`.mugiwara/plans/YYYY-MM-DD-<mission>.md` — reviewed by the user before Zoro starts.
````

- [ ] **Step 2: Verify** — `node scripts/validate-content.mjs --check content/agents/nami-planner.md` → `✓`.
- [ ] **Step 3: Commit** — `git add content/agents/nami-planner.md && git commit -m "feat(content): nami-planner agent"`

**Acceptance criteria:** `--check` passes.

---

### Task 18: Agent — usopp-brainstorm `[PARALLEL]`

**Files:**
- Create: `content/agents/usopp-brainstorm.md`

- [ ] **Step 1: Create file with exact content**

````markdown
---
name: usopp-brainstorm
description: Dispatch for vague ideas, new features, or architecture exploration before planning. Expert principal-engineer sparring partner - critical, gives trade-offs and recommendations, researches the web when unsure instead of guessing.
skills: mugiwara-brainstorm, mugiwara-frontend
---

# Usopp — Brainstorm (Craftsman)

## Role

Expert ideation sparring partner: principal/CTO-level, critical friend — never a yes-man.

## When dispatched

Wave 1 of `mugiwara-workflow` (only when Luffy's triage routes there).

## Rules

1. Follow `mugiwara-brainstorm` exactly.
2. Do not declare "done" — deliver options + trade-offs + recommendation + risks.
3. Unknown tech/versions → research with web tools first, cite what was found.
4. UI ideas: apply `mugiwara-frontend` judgment early; call out slop directions before they get planned.

## Output

Refined direction brief for Nami: problem, chosen option + reasoning, risks, open questions.
````

- [ ] **Step 2: Verify** — `node scripts/validate-content.mjs --check content/agents/usopp-brainstorm.md` → `✓`.
- [ ] **Step 3: Commit** — `git add content/agents/usopp-brainstorm.md && git commit -m "feat(content): usopp-brainstorm agent"`

**Acceptance criteria:** `--check` passes.

---

### Task 19: Agent — zoro-execution `[PARALLEL]`

**Files:**
- Create: `content/agents/zoro-execution.md`

- [ ] **Step 1: Create file with exact content**

````markdown
---
name: zoro-execution
description: Dispatch with an approved plan to execute it - builds parallel batches and sequential chains from task markers, dispatches subagents, verifies acceptance criteria per task, escalates blockers to Luffy.
skills: mugiwara-execution, mugiwara-frontend
---

# Zoro — Execution (Dispatcher)

## Role

Executes the plan exactly as written; dispatches concurrent subagents for parallel-safe tasks.

## When dispatched

Wave 3 of `mugiwara-workflow`, with the plan doc path.

## Rules

1. Follow `mugiwara-execution` exactly (ingestion, dispatch rules, per-task discipline).
2. Parallel only when the plan proves independence (no shared files/interfaces). Otherwise serialize.
3. Every task done = evidence attached (command output / file inspection).
4. Blocked → Luffy. Never silent workarounds.
5. Frontend tasks apply `mugiwara-frontend` in the same pass.

## Output

Per-wave execution report: task table with status + evidence + deviations → Chopper.
````

- [ ] **Step 2: Verify** — `node scripts/validate-content.mjs --check content/agents/zoro-execution.md` → `✓`.
- [ ] **Step 3: Commit** — `git add content/agents/zoro-execution.md && git commit -m "feat(content): zoro-execution agent"`

**Acceptance criteria:** `--check` passes.

---

### Task 20: Agent — chopper-checkpoint `[PARALLEL]`

**Files:**
- Create: `content/agents/chopper-checkpoint.md`

- [ ] **Step 1: Create file with exact content**

````markdown
---
name: chopper-checkpoint
description: Dispatch after each execution wave to audit results against the plan - verifies every acceptance criterion with runnable evidence and writes the failure ledger. Auditor only; never fixes code.
skills: mugiwara-checkpoint
---

# Chopper — Checkpoint (Auditor)

## Role

Audits execution against the plan. Trusts nothing; verifies everything. Does not fix.

## When dispatched

Wave 4 of `mugiwara-workflow`, with the plan doc and execution report.

## Rules

1. Follow `mugiwara-checkpoint` exactly (audit protocol, ledger categories).
2. Every criterion checked by running a command or inspecting a file — claims are not evidence.
3. Never edit code; findings only.

## Output

Audit report + failure ledger → Luffy (pass) or Brook (fail).
````

- [ ] **Step 2: Verify** — `node scripts/validate-content.mjs --check content/agents/chopper-checkpoint.md` → `✓`.
- [ ] **Step 3: Commit** — `git add content/agents/chopper-checkpoint.md && git commit -m "feat(content): chopper-checkpoint agent"`

**Acceptance criteria:** `--check` passes.

---

### Task 21: Agent — sanji-quality `[PARALLEL]`

**Files:**
- Create: `content/agents/sanji-quality.md`

- [ ] **Step 1: Create file with exact content**

````markdown
---
name: sanji-quality
description: Dispatch after a clean checkpoint to run quality checks - formatter, linter, unit tests. Asks the user before running integration tests (auto/skip/manual). Uses project tooling, never weakens configs.
skills: mugiwara-quality
---

# Sanji — Quality (Cook)

## Role

Runs code quality checks in the right order with the project's own tooling.

## When dispatched

Wave 5 of `mugiwara-workflow`, after Chopper's verdict passes.

## Rules

1. Follow `mugiwara-quality` exactly (detection order, consent rule).
2. Integration tests require explicit user consent first — ask, record the answer.
3. Never disable/downgrade lint rules or add ignore comments to pass.

## Output

Quality report (per-check command, status, evidence) → Franky (pass) or Brook (fail).
````

- [ ] **Step 2: Verify** — `node scripts/validate-content.mjs --check content/agents/sanji-quality.md` → `✓`.
- [ ] **Step 3: Commit** — `git add content/agents/sanji-quality.md && git commit -m "feat(content): sanji-quality agent"`

**Acceptance criteria:** `--check` passes; consent rule present.

---

### Task 22: Agent — franky-gates `[PARALLEL]`

**Files:**
- Create: `content/agents/franky-gates.md`

- [ ] **Step 1: Create file with exact content**

````markdown
---
name: franky-gates
description: Dispatch after quality checks to enforce the quality gates - coverage thresholds (>=90% new files, >=80% modified) and build validation. Binary verdicts with evidence, no negotiation.
skills: mugiwara-gates
---

# Franky — Gates (Shipwright)

## Role

Guards the quality gates: coverage and build. Binary verdicts only.

## When dispatched

Wave 6 of `mugiwara-workflow`, after Sanji's report passes.

## Rules

1. Follow `mugiwara-gates` exactly (thresholds, missing-tooling protocol).
2. Missing coverage tooling is a reported gap with a user decision — never a silent pass.

## Output

Gate verdict (PASS/FAIL + evidence) → Robin/Jinbe (pass) or Brook (fail).
````

- [ ] **Step 2: Verify** — `node scripts/validate-content.mjs --check content/agents/franky-gates.md` → `✓`.
- [ ] **Step 3: Commit** — `git add content/agents/franky-gates.md && git commit -m "feat(content): franky-gates agent"`

**Acceptance criteria:** `--check` passes.

---

### Task 23: Agent — robin-reviewer `[PARALLEL]`

**Files:**
- Create: `content/agents/robin-reviewer.md`

- [ ] **Step 1: Create file with exact content**

````markdown
---
name: robin-reviewer
description: Dispatch after gates pass to review the diff - breaking-change analysis via caller mapping, sonar-style smells (duplication, unused code, complexity), documentation gaps. Runs in parallel with Jinbe.
skills: mugiwara-review, mugiwara-security
---

# Robin — Reviewer (Archaeologist)

## Role

Deep review of the diff: relations between files, breaking-change risk, code smells.

## When dispatched

Wave 7 of `mugiwara-workflow`, in parallel with Jinbe.

## Rules

1. Follow `mugiwara-review` exactly — breaking-change analysis FIRST (map every changed symbol to its callers).
2. Sonar-style checks: duplication, unused code, complexity, naming, stale comments.
3. Deep security concerns are flagged and handed to Jinbe via `mugiwara-security` — not duplicated here.

## Output

Severity-tagged findings → Brook (blockers/majors) and the mission record.
````

- [ ] **Step 2: Verify** — `node scripts/validate-content.mjs --check content/agents/robin-reviewer.md` → `✓`.
- [ ] **Step 3: Commit** — `git add content/agents/robin-reviewer.md && git commit -m "feat(content): robin-reviewer agent"`

**Acceptance criteria:** `--check` passes; references mugiwara-security (reuse link).

---

### Task 24: Agent — jinbe-security `[PARALLEL]`

**Files:**
- Create: `content/agents/jinbe-security.md`

- [ ] **Step 1: Create file with exact content**

````markdown
---
name: jinbe-security
description: Dispatch after gates pass for the security review - OWASP surface, secrets, injection, authz, dependency vulnerabilities, sonar security hotspots, compliance notes. Senior security engineer stance. Runs parallel with Robin.
skills: mugiwara-security
---

# Jinbe — Security (Helmsman)

## Role

Senior security engineer reviewing the mission's output.

## When dispatched

Wave 7 of `mugiwara-workflow`, in parallel with Robin.

## Rules

1. Follow `mugiwara-security` exactly (checklist order, severity rules, compliance notes).
2. Findings classified by exploitability × impact — never minor by default.

## Output

Security report (findings + verdict) → Brook (fail) or closure (pass).
````

- [ ] **Step 2: Verify** — `node scripts/validate-content.mjs --check content/agents/jinbe-security.md` → `✓`.
- [ ] **Step 3: Commit** — `git add content/agents/jinbe-security.md && git commit -m "feat(content): jinbe-security agent"`

**Acceptance criteria:** `--check` passes.

---

### Task 25: Agent — brook-healing `[PARALLEL]`

**Files:**
- Create: `content/agents/brook-healing.md`

- [ ] **Step 1: Create file with exact content**

````markdown
---
name: brook-healing
description: Dispatch when any wave produced failures - test failures, gate failures, review or security findings. Triages each failure, applies minimal root-cause fixes, prepares rollback for risky ones, re-runs the failed checks.
skills: mugiwara-healing
---

# Brook — Healing (Musician)

## Role

Self-healing: repairs what failed in earlier waves, minimally, and proves each fix.

## When dispatched

Wave 8 of `mugiwara-workflow`, with failure inputs from Chopper/Sanji/Franky/Robin/Jinbe.

## Rules

1. Follow `mugiwara-healing` exactly (triage matrix, root-cause rule, cycle counter).
2. Never weaken or delete tests/configs to silence a failure.
3. Same failure after 3 heal cycles → stop and escalate with full history.

## Output

Fixed list + escalated list → back to Wave 4 (Chopper) for re-audit.
````

- [ ] **Step 2: Verify** — `node scripts/validate-content.mjs --check content/agents/brook-healing.md` → `✓`.
- [ ] **Step 3: Commit** — `git add content/agents/brook-healing.md && git commit -m "feat(content): brook-healing agent"`

**Acceptance criteria:** `--check` passes.

---

### Task 26: Wave 2 gate — full content validation `[SEQUENTIAL, after Tasks 4-25]`

**Files:** none new

- [ ] **Step 1: Run full validator**

Run: `node scripts/validate-content.mjs`
Expected: `✓ content valid: 12 skills, 10 agents`, exit 0.

- [ ] **Step 2: Run the gated tests**

Run: `node --test test/validate-content.test.js`
Expected: PASS, 2 tests (both green now).

- [ ] **Step 3: If failures — fix content to match schema, re-run, commit fixes**

- [ ] **Step 4: Commit marker (empty commit allowed only if all content commits already landed)**

```bash
git log --oneline -25   # verify 22 content commits present
```

**Acceptance criteria:** full validator exits 0 listing 12 skills + 10 agents; `node --test test/validate-content.test.js` passes.

## Wave 3 — CLI Core `[SEQUENTIAL within wave; wave itself can start after Wave 1 only — content NOT required]`

Note: Wave 2 and Wave 3 touch disjoint files → the two waves can run concurrently as parallel tracks.

### Task 27: Args parser `[SEQUENTIAL]`

**Files:**
- Create: `src/args.js`, `test/args.test.js`

- [ ] **Step 1: Write failing test**

```js
// test/args.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../src/args.js';

test('default command is install', () => {
  assert.equal(parseArgs([]).command, 'install');
});

test('parses commands and flags', () => {
  const r = parseArgs(['install', '--global', '--target', 'claude,opencode', '--type', 'frontend', '--yes']);
  assert.equal(r.command, 'install');
  assert.equal(r.flags.global, true);
  assert.equal(r.flags.target, 'claude,opencode');
  assert.equal(r.flags.type, 'frontend');
  assert.equal(r.flags.yes, true);
});

test('parses uninstall/update/list/dry-run/force/project', () => {
  assert.equal(parseArgs(['uninstall']).command, 'uninstall');
  assert.equal(parseArgs(['update']).command, 'update');
  assert.equal(parseArgs(['list']).command, 'list');
  const r = parseArgs(['install', '--project', './x', '--dry-run', '--force']);
  assert.equal(r.flags.project, './x');
  assert.equal(r.flags.dryRun, true);
  assert.equal(r.flags.force, true);
});

test('help and version', () => {
  assert.equal(parseArgs(['--help']).flags.help, true);
  assert.equal(parseArgs(['--version']).flags.version, true);
});

test('unknown flag throws', () => {
  assert.throws(() => parseArgs(['--nope']), /unknown flag/i);
});

test('flag missing value throws', () => {
  assert.throws(() => parseArgs(['--target']), /missing value/i);
});
```

- [ ] **Step 2: Run test to verify it fails** — `node --test test/args.test.js` → FAIL (module not found).

- [ ] **Step 3: Implement**

```js
// src/args.js
const VALUE_FLAGS = { '--project': 'project', '--target': 'target', '--type': 'type' };
const BOOL_FLAGS = {
  '--global': 'global', '--yes': 'yes', '-y': 'yes', '--force': 'force',
  '--dry-run': 'dryRun', '--help': 'help', '-h': 'help', '--version': 'version', '-v': 'version',
};

export function parseArgs(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a in BOOL_FLAGS) { out.flags[BOOL_FLAGS[a]] = true; continue; }
    if (a in VALUE_FLAGS) {
      const v = argv[++i];
      if (v === undefined || v.startsWith('-')) throw new Error(`Flag ${a} missing value`);
      out.flags[VALUE_FLAGS[a]] = v;
      continue;
    }
    if (a.startsWith('-')) throw new Error(`Unknown flag: ${a}`);
    out._.push(a);
  }
  out.command = out._[0] ?? 'install';
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes** — `node --test test/args.test.js` → PASS, 6 tests.
- [ ] **Step 5: Commit** — `git add src/args.js test/args.test.js && git commit -m "feat(cli): args parser"`

**Acceptance criteria:** 6/6 tests pass; zero deps.

---

### Task 28: Prompt helpers `[SEQUENTIAL]`

**Files:**
- Create: `src/prompt.js`, `test/prompt.test.js`

- [ ] **Step 1: Write failing test (mock readline object)**

```js
// test/prompt.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { choose, multiChoose, confirm } from '../src/prompt.js';

function mockRl(answers) {
  return { question: async () => answers.shift() };
}

test('choose returns index, retries on invalid', async () => {
  const rl = mockRl(['9', 'x', '2']);
  const idx = await choose(rl, 'pick', ['a', 'b', 'c']);
  assert.equal(idx, 1);
});

test('multiChoose parses list and all', async () => {
  assert.deepEqual(await multiChoose(mockRl(['1,3']), 'q', ['a', 'b', 'c']), [0, 2]);
  assert.deepEqual(await multiChoose(mockRl(['all']), 'q', ['a', 'b']), [0, 1]);
});

test('multiChoose dedupes and retries invalid', async () => {
  const rl = mockRl(['0,5', '2,2']);
  assert.deepEqual(await multiChoose(rl, 'q', ['a', 'b', 'c']), [1]);
});

test('confirm y/n', async () => {
  assert.equal(await confirm(mockRl(['y']), 'ok?'), true);
  assert.equal(await confirm(mockRl(['no']), 'ok?'), false);
  assert.equal(await confirm(mockRl(['']), 'ok?'), false);
});
```

- [ ] **Step 2: Run test to verify it fails** — `node --test test/prompt.test.js` → FAIL.

- [ ] **Step 3: Implement**

```js
// src/prompt.js
import readline from 'node:readline/promises';

export function createRl() {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

export async function choose(rl, question, options) {
  for (;;) {
    console.log(`\n${question}`);
    options.forEach((o, i) => console.log(`  ${i + 1}) ${o}`));
    const n = Number((await rl.question('choice> ')).trim());
    if (Number.isInteger(n) && n >= 1 && n <= options.length) return n - 1;
    console.log(`Enter a number between 1 and ${options.length}.`);
  }
}

export async function multiChoose(rl, question, options) {
  for (;;) {
    console.log(`\n${question} (comma-separated numbers, or "all")`);
    options.forEach((o, i) => console.log(`  ${i + 1}) ${o}`));
    const raw = (await rl.question('choices> ')).trim().toLowerCase();
    if (raw === 'all') return options.map((_, i) => i);
    const nums = raw.split(',').map(s => Number(s.trim()));
    if (nums.length > 0 && nums.every(n => Number.isInteger(n) && n >= 1 && n <= options.length)) {
      return [...new Set(nums.map(n => n - 1))];
    }
    console.log('Invalid selection.');
  }
}

export async function confirm(rl, question) {
  const raw = (await rl.question(`${question} [y/N] `)).trim().toLowerCase();
  return raw === 'y' || raw === 'yes';
}
```

- [ ] **Step 4: Run test to verify it passes** — PASS, 4 tests.
- [ ] **Step 5: Commit** — `git add src/prompt.js test/prompt.test.js && git commit -m "feat(cli): interactive prompt helpers"`

**Acceptance criteria:** 4/4 tests pass; functions take injected `rl` (testable, no real stdin in tests).

---

### Task 29: Manifest `[SEQUENTIAL]`

**Files:**
- Create: `src/manifest.js`, `test/manifest.test.js`

- [ ] **Step 1: Write failing test**

```js
// test/manifest.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { manifestPath, readManifest, writeManifest } from '../src/manifest.js';

const home = mkdtempSync(join(tmpdir(), 'mugi-home-'));
const proj = mkdtempSync(join(tmpdir(), 'mugi-proj-'));

test('manifestPath project vs global', () => {
  assert.equal(manifestPath({ scope: 'project', projectDir: proj, home }), join(proj, '.mugiwara', 'manifest.json'));
  assert.equal(manifestPath({ scope: 'global', projectDir: proj, home }), join(home, '.mugiwara', 'manifest.json'));
});

test('readManifest returns null when absent', () => {
  assert.equal(readManifest(join(proj, 'nope.json')), null);
});

test('write then read roundtrip', () => {
  const file = manifestPath({ scope: 'project', projectDir: proj, home });
  const data = { version: '0.1.0', scope: 'project', type: 'general', installedAt: 'x', targets: ['claude'], files: ['/a/b.md'] };
  writeManifest(file, data);
  assert.deepEqual(readManifest(file), data);
});
```

- [ ] **Step 2: Run test to verify it fails.**
- [ ] **Step 3: Implement**

```js
// src/manifest.js
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function manifestPath({ scope, projectDir, home }) {
  return scope === 'global'
    ? join(home, '.mugiwara', 'manifest.json')
    : join(projectDir, '.mugiwara', 'manifest.json');
}

export function readManifest(file) {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

export function writeManifest(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}
```

- [ ] **Step 4: Run test to verify it passes** — PASS, 3 tests.
- [ ] **Step 5: Commit** — `git add src/manifest.js test/manifest.test.js && git commit -m "feat(cli): install manifest read/write"`

**Acceptance criteria:** 3/3 tests pass; manifest creates parent dirs automatically.

---

### Task 30: Install engine `[SEQUENTIAL]`

**Files:**
- Create: `src/installer.js`, `test/installer.test.js`

**Interfaces:**
- Consumes: `parseFrontmatter`/`stringifyFrontmatter` (Task 2), manifest helpers (Task 29), package.json `version`
- Produces: `CONTENT_DIR`, `VERSION`, `collectContent({includeFrontend})`, `installTo(target, opts)`, `removeInstalled(manifest, opts)` — used by cli.js (Task 37) and target tests (Tasks 32-36).

- [ ] **Step 1: Write failing test**

```js
// test/installer.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectContent, installTo, removeInstalled } from '../src/installer.js';

const fakeTarget = {
  id: 'fake', label: 'Fake', native: true,
  paths: ({ scope, projectDir, home }) => ({
    skillsDir: join(scope === 'global' ? home : projectDir, 'sk'),
    agentsDir: join(scope === 'global' ? home : projectDir, 'ag'),
  }),
  transformSkill: (d, b) => ({ relPath: join(d.name, 'SKILL.md'), text: `S:${d.name}\n${b}` }),
  transformAgent: (d, b) => ({ relPath: `${d.name}.md`, text: `A:${d.name}\n${b}` }),
};

const projectDir = mkdtempSync(join(tmpdir(), 'mugi-t-'));
const home = mkdtempSync(join(tmpdir(), 'mugi-h-'));
const opts = { scope: 'project', projectDir, home, type: 'frontend', dryRun: false, force: false };

test('collectContent includes frontend for frontend type', () => {
  const { skills, agents } = collectContent({ includeFrontend: true });
  assert.ok(skills.some(s => s.name === 'mugiwara-frontend'));
  assert.ok(agents.some(a => a.name === 'luffy-orchestrator'));
});

test('collectContent excludes frontend when gated', () => {
  const { skills } = collectContent({ includeFrontend: false });
  assert.ok(!skills.some(s => s.name === 'mugiwara-frontend'));
});

test('installTo writes skills and agents, rerun skips identical', () => {
  const r1 = installTo(fakeTarget, opts);
  assert.ok(r1.written.length >= 21); // 11 skills (frontend incl) + 10 agents
  assert.ok(existsSync(join(projectDir, 'sk', 'mugiwara-workflow', 'SKILL.md')));
  assert.ok(existsSync(join(projectDir, 'ag', 'luffy-orchestrator.md')));
  const r2 = installTo(fakeTarget, opts);
  assert.equal(r2.written.length, 0);
  assert.equal(r2.skipped.length, r1.written.length);
});

test('conflicting file not overwritten without force; backed up with force', () => {
  const f = join(projectDir, 'sk', 'mugiwara-workflow', 'SKILL.md');
  writeFileSync(f, 'USER EDIT');
  const r1 = installTo(fakeTarget, opts);
  assert.equal(readFileSync(f, 'utf8'), 'USER EDIT');
  assert.ok(r1.notes.some(n => n.includes('conflict')));
  const r2 = installTo(fakeTarget, { ...opts, force: true });
  assert.notEqual(readFileSync(f, 'utf8'), 'USER EDIT');
  assert.equal(r2.backedUp.length, 1);
});

test('dryRun writes nothing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-dry-'));
  const r = installTo(fakeTarget, { ...opts, projectDir: dir, dryRun: true });
  assert.ok(r.written.length > 0);
  assert.ok(!existsSync(join(dir, 'sk')));
});

test('removeInstalled deletes exactly manifest files + prunes empty dirs', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mugi-rm-'));
  const r = installTo(fakeTarget, { ...opts, projectDir: dir });
  removeInstalled({ files: r.written }, {});
  assert.ok(!existsSync(join(dir, 'sk')));
  assert.ok(!existsSync(join(dir, 'ag')));
});
```

- [ ] **Step 2: Run test to verify it fails.**
- [ ] **Step 3: Implement**

```js
// src/installer.js
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { parseFrontmatter } from './frontmatter.js';

export const CONTENT_DIR = join(import.meta.dirname, '..', 'content');
export const VERSION = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8')).version;

export function collectContent({ includeFrontend }) {
  const skillNames = readdirSync(join(CONTENT_DIR, 'skills'), { withFileTypes: true })
    .filter(e => e.isDirectory()).map(e => e.name)
    .filter(name => includeFrontend || name !== 'mugiwara-frontend');
  const skills = skillNames.map(name => {
    const { data, body } = parseFrontmatter(readFileSync(join(CONTENT_DIR, 'skills', name, 'SKILL.md'), 'utf8'));
    return { name, data, body };
  });
  const agents = readdirSync(join(CONTENT_DIR, 'agents'))
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const { data, body } = parseFrontmatter(readFileSync(join(CONTENT_DIR, 'agents', f), 'utf8'));
      return { name: f.replace(/\.md$/, ''), data, body };
    });
  return { skills, agents };
}

export function installTo(target, opts) {
  const { scope, projectDir, type, dryRun = false, force = false } = opts;
  const home = opts.home ?? homedir();
  const { skills, agents } = collectContent({ includeFrontend: type === 'frontend' || type === 'fullstack' });
  const dirs = target.paths({ scope, projectDir, home });
  const backupRoot = join(scope === 'global' ? home : projectDir, '.mugiwara');
  const result = { written: [], skipped: [], backedUp: [], notes: [] };

  const writeOne = (absPath, text) => {
    if (existsSync(absPath)) {
      if (readFileSync(absPath, 'utf8') === text) { result.skipped.push(absPath); return; }
      if (!force) {
        result.skipped.push(absPath);
        result.notes.push(`conflict (not overwritten; run update to replace with backup): ${absPath}`);
        return;
      }
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = join(backupRoot, 'backup', ts, absPath.replace(/[^a-zA-Z0-9]+/g, '_'));
      if (!dryRun) { mkdirSync(dirname(backupFile), { recursive: true }); copyFileSync(absPath, backupFile); }
      result.backedUp.push(absPath);
    }
    if (!dryRun) { mkdirSync(dirname(absPath), { recursive: true }); writeFileSync(absPath, text); }
    result.written.push(absPath);
  };

  for (const s of skills) {
    const out = target.transformSkill(s.data, s.body);
    if (out) writeOne(join(dirs.skillsDir, out.relPath), out.text);
  }
  for (const a of agents) {
    const out = target.transformAgent(a.data, a.body);
    if (out) writeOne(join(dirs.agentsDir, out.relPath), out.text);
  }

  if (target.postInstall) {
    const post = target.postInstall({ scope, projectDir, home, dryRun, files: result.written });
    result.written.push(...post.written);
    result.notes.push(...post.notes);
  }
  return result;
}

export function removeInstalled(manifest, { dryRun = false } = {}) {
  const removed = [];
  for (const f of manifest.files) {
    if (existsSync(f)) { if (!dryRun) rmSync(f); removed.push(f); }
  }
  if (!dryRun) {
    for (const f of manifest.files) {
      let d = dirname(f);
      while (existsSync(d) && readdirSync(d).length === 0) {
        rmSync(d);
        const parent = dirname(d);
        if (parent === d) break;
        d = parent;
      }
    }
  }
  return removed;
}
```

- [ ] **Step 4: Run test to verify it passes** — PASS, 6 tests (requires Wave 2 content present for `collectContent`; if Wave 2 runs concurrently, sequence this task after Task 26).

- [ ] **Step 5: Commit** — `git add src/installer.js test/installer.test.js && git commit -m "feat(cli): install engine with backup/dry-run/frontend gating"`

**Acceptance criteria:** 6/6 tests pass; identical-file rerun is a no-op; conflicts never silently overwritten.

---

## Wave 4 — Target Adapters `[Task 31 SEQUENTIAL gate, then Tasks 32-35 PARALLEL, Task 36 gate]`

### Task 31: Target path research (verification gate) `[SEQUENTIAL — blocks Tasks 32-35]`

Adapter paths below are best-current-knowledge. Vendor formats churn — verify each against live official docs before coding, and record the verified path (with URL + date) so future maintainers can re-check.

- [ ] **Step 1: Verify each target against official docs**

| Target | Check |
|--------|-------|
| claude | https://code.claude.com/docs/en/skills and /sub-agents — skills in `.claude/skills/<name>/SKILL.md`, agents in `.claude/agents/*.md`, global `~/.claude/` |
| opencode | https://opencode.ai/docs/skills/ and /agents — `.opencode/skills`, `.opencode/agent(s)`, global `~/.config/opencode/` |
| copilot | VS Code docs "custom agents" + GitHub docs "custom instructions" — `.github/agents/*.md`, `.github/instructions/*.instructions.md` |
| gemini | gemini-cli repo docs — GEMINI.md context file behavior |
| codex | openai/codex repo — AGENTS.md behavior |
| windsurf | docs.windsurf.com — `.windsurf/rules/` |
| cline | docs.cline.bot — `.clinerules/` |
| kilo | kilocode.ai docs — rules location |
| antigravity | antigravity.google docs — `.agent/rules/` |

- [ ] **Step 2: Write verified findings**

Create `docs/research/target-paths.md`: one section per target — verified dir(s), frontmatter dialect notes, global-scope support (yes/no), doc URL, date checked. If any path differs from the adapter specs in Tasks 32-35, UPDATE THE ADAPTER CODE accordingly (the adapter code in this plan is the template; verified docs win).

- [ ] **Step 3: Commit** — `git add docs/research/target-paths.md && git commit -m "docs: verified target install paths"`

**Acceptance criteria:** `docs/research/target-paths.md` covers all 9 targets with URL + date; deviations from this plan listed explicitly.

---

### Task 32: Adapter — claude (Tier 1) `[PARALLEL]`

**Files:**
- Create: `src/targets/claude.js`

- [ ] **Step 1: Implement**

```js
// src/targets/claude.js
import { join } from 'node:path';
import { stringifyFrontmatter } from '../frontmatter.js';

export const target = {
  id: 'claude',
  label: 'Claude Code',
  native: true,
  paths({ scope, projectDir, home }) {
    const root = scope === 'global' ? join(home, '.claude') : join(projectDir, '.claude');
    return { skillsDir: join(root, 'skills'), agentsDir: join(root, 'agents') };
  },
  transformSkill(data, body) {
    return {
      relPath: join(data.name, 'SKILL.md'),
      text: stringifyFrontmatter({ name: data.name, description: data.description }, body),
    };
  },
  transformAgent(data, body) {
    const fm = { name: data.name, description: data.description };
    if (data.tools) fm.tools = data.tools;
    return { relPath: `${data.name}.md`, text: stringifyFrontmatter(fm, body) };
  },
};
```

- [ ] **Step 2: Verify via node** — Run:
```bash
node -e "import('./src/targets/claude.js').then(m => console.log(JSON.stringify(m.target.paths({scope:'project',projectDir:'/p',home:'/h'}))))"
```
Expected: `{"skillsDir":"/p/.claude/skills","agentsDir":"/p/.claude/agents"}` (platform separators).

- [ ] **Step 3: Commit** — `git add src/targets/claude.js && git commit -m "feat(targets): claude adapter"`

**Acceptance criteria:** paths correct for both scopes; transforms preserve name/description frontmatter.

---

### Task 33: Adapter — opencode (Tier 1) `[PARALLEL]`

**Files:**
- Create: `src/targets/opencode.js`

- [ ] **Step 1: Implement**

```js
// src/targets/opencode.js
import { join } from 'node:path';
import { stringifyFrontmatter } from '../frontmatter.js';

export const target = {
  id: 'opencode',
  label: 'opencode',
  native: true,
  paths({ scope, projectDir, home }) {
    const root = scope === 'global' ? join(home, '.config', 'opencode') : join(projectDir, '.opencode');
    return { skillsDir: join(root, 'skills'), agentsDir: join(root, 'agent') };
  },
  transformSkill(data, body) {
    return {
      relPath: join(data.name, 'SKILL.md'),
      text: stringifyFrontmatter({ name: data.name, description: data.description }, body),
    };
  },
  transformAgent(data, body) {
    const fm = { name: data.name, description: data.description };
    if (data.tools) fm.tools = data.tools;
    return { relPath: `${data.name}.md`, text: stringifyFrontmatter(fm, body) };
  },
};
```

(Adjust `agent` vs `agents` dir name if Task 31's verification says otherwise.)

- [ ] **Step 2: Verify via node** — same pattern as Task 32; expect `…/.opencode/skills` and `…/.opencode/agent` for project scope, `~/.config/opencode/…` for global.
- [ ] **Step 3: Commit** — `git add src/targets/opencode.js && git commit -m "feat(targets): opencode adapter"`

**Acceptance criteria:** paths match verified docs from Task 31.

---

### Task 34: Adapter — copilot (Tier 1) `[PARALLEL]`

**Files:**
- Create: `src/targets/copilot.js`

- [ ] **Step 1: Implement**

```js
// src/targets/copilot.js
import { join } from 'node:path';
import { stringifyFrontmatter } from '../frontmatter.js';

export const target = {
  id: 'copilot',
  label: 'GitHub Copilot',
  native: true,
  paths({ scope, projectDir, home }) {
    const root = scope === 'global' ? join(home, '.copilot') : join(projectDir, '.github');
    return { skillsDir: join(root, 'instructions'), agentsDir: join(root, 'agents') };
  },
  transformSkill(data, body) {
    return {
      relPath: `${data.name}.instructions.md`,
      text: stringifyFrontmatter({ description: data.description, applyTo: '**/*' }, body),
    };
  },
  transformAgent(data, body) {
    return {
      relPath: `${data.name}.md`,
      text: stringifyFrontmatter({ name: data.name, description: data.description }, body),
    };
  },
};
```

- [ ] **Step 2: Verify via node** — expect `…/.github/instructions`, `…/.github/agents` (project) and `~/.copilot/…` (global; if Task 31 found Copilot has no global dir, change `paths()` to throw for global like Tier-2 adapters and record it).
- [ ] **Step 3: Commit** — `git add src/targets/copilot.js && git commit -m "feat(targets): copilot adapter"`

**Acceptance criteria:** skill files named `*.instructions.md` with `applyTo` frontmatter.

---

### Task 35: Generic engine + Tier-2 adapters `[PARALLEL]`

**Files:**
- Create: `src/targets/generic.js`, `src/targets/gemini.js`, `src/targets/codex.js`, `src/targets/windsurf.js`, `src/targets/cline.js`, `src/targets/kilo.js`, `src/targets/antigravity.js`

- [ ] **Step 1: Implement generic factory**

```js
// src/targets/generic.js
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function makeGeneric({ id, label, rulesDir, bootstrapFile, bootstrapPointer }) {
  return {
    id,
    label,
    native: false,
    paths({ scope, projectDir }) {
      if (scope === 'global') throw new Error(`${label} supports project scope only`);
      const dir = join(projectDir, rulesDir);
      return { skillsDir: dir, agentsDir: dir };
    },
    transformSkill(data, body) {
      return { relPath: `${data.name}.md`, text: `# ${data.name}\n\n> ${data.description}\n\n${body}` };
    },
    transformAgent(data, body) {
      return { relPath: `agent-${data.name}.md`, text: `# Agent: ${data.name}\n\n> ${data.description}\n\nSkills used: ${data.skills ?? ''}\n\n${body}` };
    },
    postInstall({ projectDir, dryRun }) {
      if (!bootstrapFile) return { written: [], notes: [] };
      const notes = [];
      const written = [];
      const file = join(projectDir, bootstrapFile);
      if (!existsSync(file)) {
        if (!dryRun) writeFileSync(file, `${bootstrapPointer}\n`);
        written.push(file);
      } else {
        notes.push(`add this line to ${bootstrapFile} so the agent finds the crew: "${bootstrapPointer}"`);
      }
      return { written, notes };
    },
  };
}
```

- [ ] **Step 2: Implement the six Tier-2 adapters**

Each file is 3 lines: import, `makeGeneric` config, export. Configs:

| id | rulesDir | bootstrapFile | bootstrapPointer |
|----|----------|---------------|------------------|
| windsurf | `.windsurf/rules` | `null` | — |
| cline | `.clinerules` | `null` | — |
| kilo | `.kilocode/rules` | `null` | — |
| antigravity | `.agent/rules` | `null` | — |
| gemini | `.gemini/mugiwara` | `GEMINI.md` | `Mugiwara crew installed in .gemini/mugiwara/ — read .gemini/mugiwara/mugiwara-workflow.md to run the pipeline.` |
| codex | `.codex/mugiwara` | `AGENTS.md` | `Mugiwara crew installed in .codex/mugiwara/ — read .codex/mugiwara/mugiwara-workflow.md to run the pipeline.` |

(`rulesDir`/`bootstrapFile` are joined onto projectDir; the 4 rules-dir targets need no bootstrap because their files land directly in the rules dir the host already reads.)

```js
// src/targets/windsurf.js — pattern for all six
import { makeGeneric } from './generic.js';

export const target = makeGeneric({
  id: 'windsurf',
  label: 'Windsurf',
  rulesDir: '.windsurf/rules',
  bootstrapFile: null,
  bootstrapPointer: null,
});
```

- [ ] **Step 3: Verify each via node** — for every Tier-2 id:
```bash
node -e "import('./src/targets/windsurf.js').then(m => console.log(m.target.id, JSON.stringify(m.target.paths({scope:'project',projectDir:'/p'}))))"
node -e "import('./src/targets/gemini.js').then(m => { try { m.target.paths({scope:'global',projectDir:'/p'}); } catch(e) { console.log('global rejected OK'); } })"
```
Expected: correct dirs; global scope rejected for all six.

- [ ] **Step 4: Commit** — `git add src/targets/generic.js src/targets/gemini.js src/targets/codex.js src/targets/windsurf.js src/targets/cline.js src/targets/kilo.js src/targets/antigravity.js && git commit -m "feat(targets): generic engine + 6 tier-2 adapters"`

**Acceptance criteria:** all six adapters load; global scope throws for each; gemini/codex bootstrap only when file absent.

---

### Task 36: Registry + adapter test suite (Wave 4 gate) `[SEQUENTIAL, after 32-35]`

**Files:**
- Create: `src/targets/index.js`, `test/targets.test.js`

- [ ] **Step 1: Implement registry**

```js
// src/targets/index.js
import { target as claude } from './claude.js';
import { target as opencode } from './opencode.js';
import { target as copilot } from './copilot.js';
import { target as gemini } from './gemini.js';
import { target as codex } from './codex.js';
import { target as windsurf } from './windsurf.js';
import { target as cline } from './cline.js';
import { target as kilo } from './kilo.js';
import { target as antigravity } from './antigravity.js';

export const targets = { claude, opencode, copilot, gemini, codex, windsurf, cline, kilo, antigravity };
export const TARGET_IDS = Object.keys(targets);
```

- [ ] **Step 2: Write test**

```js
// test/targets.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { targets, TARGET_IDS } from '../src/targets/index.js';
import { parseFrontmatter } from '../src/frontmatter.js';

test('registry has 9 targets', () => {
  assert.deepEqual(TARGET_IDS, ['claude', 'opencode', 'copilot', 'gemini', 'codex', 'windsurf', 'cline', 'kilo', 'antigravity']);
});

test('every adapter has the full interface', () => {
  for (const t of Object.values(targets)) {
    assert.ok(t.id && t.label);
    assert.equal(typeof t.native, 'boolean');
    assert.equal(typeof t.paths, 'function');
    assert.equal(typeof t.transformSkill, 'function');
    assert.equal(typeof t.transformAgent, 'function');
  }
});

test('native adapters resolve project and global scopes', () => {
  for (const id of ['claude', 'opencode', 'copilot']) {
    const p = targets[id].paths({ scope: 'project', projectDir: '/p', home: '/h' });
    const g = targets[id].paths({ scope: 'global', projectDir: '/p', home: '/h' });
    assert.ok(p.skillsDir && p.agentsDir && g.skillsDir && g.agentsDir, id);
  }
});

test('tier-2 adapters reject global scope', () => {
  for (const id of ['gemini', 'codex', 'windsurf', 'cline', 'kilo', 'antigravity']) {
    assert.throws(() => targets[id].paths({ scope: 'global', projectDir: '/p', home: '/h' }), /project scope only/i, id);
  }
});

test('transforms produce relPath + text; native skills keep parseable frontmatter', () => {
  const skill = { name: 'mugiwara-workflow', description: 'Use at mission start for the crew pipeline.' };
  for (const t of Object.values(targets)) {
    const out = t.transformSkill(skill, 'BODY\n');
    assert.ok(out.relPath.endsWith('.md'), t.id);
    assert.ok(out.text.includes('BODY'), t.id);
  }
  const claudeOut = targets.claude.transformSkill(skill, 'BODY\n');
  assert.equal(parseFrontmatter(claudeOut.text).data.name, 'mugiwara-workflow');
});
```

- [ ] **Step 3: Run test** — `node --test test/targets.test.js` → PASS, 5 tests.
- [ ] **Step 4: Commit** — `git add src/targets/index.js test/targets.test.js && git commit -m "feat(targets): registry + adapter contract tests"`

**Acceptance criteria:** 5/5 tests pass; registry exports exactly 9 adapters.

## Wave 5 — CLI Wiring `[SEQUENTIAL]`

### Task 37: cli.js + bin entry `[SEQUENTIAL]`

**Files:**
- Create: `src/cli.js`, `bin/mugiwara.js`

**Interfaces:**
- Consumes: `parseArgs` (Task 27), prompt helpers (Task 28), manifest (Task 29), `installTo`/`removeInstalled`/`VERSION` (Task 30), registry (Task 36).
- Produces: `run(argv)` used by bin; CLI surface: install/update/uninstall/list/help/version.

- [ ] **Step 1: Implement cli.js**

```js
// src/cli.js
import { existsSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { parseArgs } from './args.js';
import { createRl, choose, multiChoose, confirm } from './prompt.js';
import { targets, TARGET_IDS } from './targets/index.js';
import { installTo, removeInstalled, VERSION } from './installer.js';
import { manifestPath, readManifest, writeManifest } from './manifest.js';

const TYPES = ['frontend', 'backend', 'fullstack', 'general'];

export async function run(argv) {
  const { command, flags } = parseArgs(argv);
  if (flags.help || command === 'help') return help();
  if (flags.version) { console.log(`mugiwara ${VERSION}`); return; }
  switch (command) {
    case 'install': return install(flags);
    case 'update': return install({ ...flags, force: true });
    case 'uninstall': return uninstall(flags);
    case 'list': return list(flags);
    default: throw new Error(`Unknown command: ${command}`);
  }
}

async function resolveOptions(flags) {
  const interactive = !flags.yes;
  const rl = interactive ? createRl() : null;
  try {
    let scope = flags.global ? 'global' : flags.project ? 'project' : null;
    if (!scope) {
      if (!interactive) throw new Error('Specify --global or --project <dir> with --yes');
      scope = (await choose(rl, 'Install scope?', ['global (user-wide)', 'project (this repo)'])) === 0 ? 'global' : 'project';
    }
    const projectDir = resolve(flags.project ?? process.cwd());
    if (scope === 'project' && !existsSync(projectDir)) throw new Error(`Project dir not found: ${projectDir}`);

    let targetIds = flags.target ? flags.target.split(',').map(s => s.trim()) : null;
    if (targetIds && targetIds.includes('all')) targetIds = [...TARGET_IDS];
    if (!targetIds) {
      if (!interactive) throw new Error('Specify --target <ids|all> with --yes');
      const idx = await multiChoose(rl, 'Target AI agents?', ['all targets', ...TARGET_IDS]);
      targetIds = idx.includes(0) ? [...TARGET_IDS] : idx.map(i => TARGET_IDS[i - 1]);
    }
    for (const id of targetIds) {
      if (!targets[id]) throw new Error(`Unknown target: ${id} (valid: ${TARGET_IDS.join(', ')}, all)`);
    }

    let type = flags.type ?? null;
    if (!type) {
      if (!interactive) throw new Error('Specify --type with --yes');
      type = TYPES[await choose(rl, 'Project type?', TYPES)];
    }
    if (!TYPES.includes(type)) throw new Error(`Unknown type: ${type} (valid: ${TYPES.join(', ')})`);
    return { scope, projectDir, targetIds, type };
  } finally {
    if (rl) rl.close();
  }
}

async function install(flags) {
  const { scope, projectDir, targetIds, type } = await resolveOptions(flags);
  const home = homedir();
  const allFiles = [];
  const allNotes = [];
  for (const id of targetIds) {
    const t = targets[id];
    if (scope === 'global' && !t.native) {
      console.log(`! ${t.label}: project scope only — skipped for global install`);
      continue;
    }
    console.log(`\n-> ${t.label} (${scope})`);
    const r = installTo(t, { scope, projectDir, type, home, dryRun: !!flags.dryRun, force: !!flags.force });
    console.log(`   written ${r.written.length}, skipped ${r.skipped.length}, backed up ${r.backedUp.length}`);
    for (const n of r.notes) console.log(`   note: ${n}`);
    allFiles.push(...r.written);
    allNotes.push(...r.notes);
  }
  if (flags.dryRun) { console.log('\nDry run — nothing written.'); return; }
  const file = manifestPath({ scope, projectDir, home });
  const prev = readManifest(file);
  writeManifest(file, {
    version: VERSION,
    scope,
    type,
    installedAt: new Date().toISOString(),
    targets: [...new Set([...(prev?.targets ?? []), ...targetIds])],
    files: [...new Set([...(prev?.files ?? []), ...allFiles])],
  });
  console.log(`\nOK mugiwara ${VERSION} installed (manifest: ${file})`);
  if (allNotes.length) console.log(`${allNotes.length} note(s) above may need attention.`);
}

async function uninstall(flags) {
  const scope = flags.global ? 'global' : 'project';
  const projectDir = resolve(flags.project ?? process.cwd());
  const home = homedir();
  const file = manifestPath({ scope, projectDir, home });
  const manifest = readManifest(file);
  if (!manifest) { console.log('Nothing installed (no manifest found).'); return; }
  console.log(`Will remove ${manifest.files.length} files (targets: ${manifest.targets.join(', ')}).`);
  if (!flags.yes) {
    const rl = createRl();
    const ok = await confirm(rl, 'Proceed?');
    rl.close();
    if (!ok) { console.log('Aborted.'); return; }
  }
  const removed = removeInstalled(manifest, { dryRun: !!flags.dryRun });
  if (!flags.dryRun) rmSync(file);
  console.log(`OK removed ${removed.length} files`);
}

function list() {
  const home = homedir();
  const projectDir = resolve(process.cwd());
  let found = false;
  for (const [label, file] of [
    ['project', manifestPath({ scope: 'project', projectDir, home })],
    ['global', manifestPath({ scope: 'global', projectDir, home })],
  ]) {
    const m = readManifest(file);
    if (!m) continue;
    found = true;
    console.log(`${label}: v${m.version} targets=${m.targets.join(',')} files=${m.files.length} installed=${m.installedAt}`);
  }
  if (!found) console.log('No mugiwara installation found.');
}

function help() {
  console.log(`mugiwara ${VERSION} — the Straw Hat crew for AI agents

Usage:
  mugiwara [install]     install the crew (default; wizard when flags missing)
  mugiwara update        replace existing files (backs up differences first)
  mugiwara uninstall     remove installed files via manifest
  mugiwara list          show installations
  mugiwara --help        this help
  mugiwara --version     print version

Flags:
  --global               user-wide install
  --project <dir>        project install (default: cwd)
  --target <ids|all>     comma-separated: ${TARGET_IDS.join(', ')}
  --type <t>             frontend | backend | fullstack | general
  --yes, -y              non-interactive (needs --global/--project, --target, --type)
  --force                overwrite differing files (with backup)
  --dry-run              print actions without writing`);
}
```

- [ ] **Step 2: Implement bin entry + make executable**

```js
#!/usr/bin/env node
// bin/mugiwara.js
import { run } from '../src/cli.js';

run(process.argv.slice(2)).catch(err => {
  console.error(`mugiwara: ${err.message}`);
  process.exit(1);
});
```

```bash
chmod +x bin/mugiwara.js
```

- [ ] **Step 3: Smoke check**

Run: `node bin/mugiwara.js --version && node bin/mugiwara.js --help | head -5`
Expected: prints `mugiwara 0.1.0` and usage header.

- [ ] **Step 4: Commit** — `git add src/cli.js bin/mugiwara.js && git commit -m "feat(cli): command wiring (install/update/uninstall/list)"`

**Acceptance criteria:** `--version`, `--help`, `list` run; error messages name the offending flag/value.

---

### Task 38: E2E tests `[SEQUENTIAL]`

**Files:**
- Create: `test/e2e.test.js`

- [ ] **Step 1: Write test**

```js
// test/e2e.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BIN = join(import.meta.dirname, '..', 'bin', 'mugiwara.js');
const runCli = args => execFileSync(process.execPath, [BIN, ...args], { encoding: 'utf8' });

test('install claude project scope, then uninstall clean', () => {
  const proj = mkdtempSync(join(tmpdir(), 'mugi-e2e-'));
  runCli(['install', '--project', proj, '--target', 'claude', '--type', 'frontend', '--yes']);
  assert.ok(existsSync(join(proj, '.claude', 'skills', 'mugiwara-workflow', 'SKILL.md')));
  assert.ok(existsSync(join(proj, '.claude', 'agents', 'luffy-orchestrator.md')));
  assert.ok(existsSync(join(proj, '.claude', 'skills', 'mugiwara-frontend', 'SKILL.md')));
  assert.ok(existsSync(join(proj, '.mugiwara', 'manifest.json')));
  runCli(['uninstall', '--project', proj, '--yes']);
  assert.ok(!existsSync(join(proj, '.claude', 'skills', 'mugiwara-workflow')));
  assert.ok(!existsSync(join(proj, '.mugiwara', 'manifest.json')));
});

test('backend type excludes frontend skill', () => {
  const proj = mkdtempSync(join(tmpdir(), 'mugi-e2e-'));
  runCli(['install', '--project', proj, '--target', 'opencode', '--type', 'backend', '--yes']);
  assert.ok(!existsSync(join(proj, '.opencode', 'skills', 'mugiwara-frontend')));
  assert.ok(existsSync(join(proj, '.opencode', 'skills', 'mugiwara-planning', 'SKILL.md')));
});

test('tier-2 target installs flat rule files (project scope)', () => {
  const proj = mkdtempSync(join(tmpdir(), 'mugi-e2e-'));
  runCli(['install', '--project', proj, '--target', 'cline', '--type', 'general', '--yes']);
  assert.ok(existsSync(join(proj, '.clinerules', 'mugiwara-workflow.md')));
  assert.ok(existsSync(join(proj, '.clinerules', 'agent-luffy-orchestrator.md')));
});

test('dry-run writes nothing', () => {
  const proj = mkdtempSync(join(tmpdir(), 'mugi-e2e-'));
  runCli(['install', '--project', proj, '--target', 'claude', '--type', 'general', '--yes', '--dry-run']);
  assert.ok(!existsSync(join(proj, '.claude')));
});

test('version and unknown flag behavior', () => {
  assert.match(runCli(['--version']), /mugiwara \d+\.\d+\.\d+/);
  assert.throws(() => runCli(['--bogus']), /Unknown flag/i);
});
```

- [ ] **Step 2: Run test** — `node --test test/e2e.test.js` → PASS, 5 tests.

- [ ] **Step 3: Commit** — `git add test/e2e.test.js && git commit -m "test: e2e install/uninstall per scope and type"`

**Acceptance criteria:** 5/5 e2e tests pass on Linux/macOS; paths asserted with `join` (Windows-safe).

---

## Wave 6 — Packaging & Distribution `[PARALLEL — Task 39 ∥ Task 40]`

### Task 39: curl/PowerShell installers `[PARALLEL]`

**Files:**
- Create: `scripts/install.sh`, `scripts/install.ps1`

- [ ] **Step 1: Write install.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail

PKG="mugiwara"

if ! command -v node >/dev/null 2>&1; then
  echo "mugiwara requires Node.js >= 20. Install it first: https://nodejs.org" >&2
  exit 1
fi

MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$MAJOR" -lt 20 ]; then
  echo "mugiwara requires Node.js >= 20 (found $(node --version))." >&2
  exit 1
fi

exec npx -y "${PKG}@latest" "$@"
```

```bash
chmod +x scripts/install.sh
```

- [ ] **Step 2: Write install.ps1**

```powershell
#Requires -Version 5.1
$ErrorActionPreference = 'Stop'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error 'mugiwara requires Node.js >= 20. Install it from https://nodejs.org first.'
}

$major = [int](node -p 'process.versions.node.split(".")[0]')
if ($major -lt 20) {
  Write-Error "mugiwara requires Node.js >= 20 (found $(node --version))."
}

npx -y mugiwara@latest @args
exit $LASTEXITCODE
```

- [ ] **Step 3: Verify sh syntax** — Run: `bash -n scripts/install.sh` → no output (ps1 verified on a Windows machine later; note in commit).
- [ ] **Step 4: Commit** — `git add scripts/install.sh scripts/install.ps1 && git commit -m "feat: curl/powershell installer wrappers"`

**Acceptance criteria:** `bash -n` passes; both wrappers forward args and check Node ≥ 20.

---

### Task 40: README `[PARALLEL]`

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README with this structure**

```markdown
# Mugiwara

The Straw Hat crew of AI agents and skills. One install gives your AI coding
agent a complete multi-agent workflow: brainstorm → plan → execute → checkpoint
→ quality → gates → review → security → heal → closure.

- **Agents** = the crew (10): Luffy orchestrates, Nami plans, Zoro executes,
  Chopper audits, Sanji checks quality, Franky guards the gates, Robin reviews,
  Jinbe secures, Brook heals, Usopp brainstorms.
- **Skills** = their techniques (12): each agent calls its skills; shared
  skills (frontend, security) are used by several crew members.
- **No runtime**: Mugiwara ships markdown. Your AI agent (Claude Code,
  opencode, Copilot, Gemini, Codex, Windsurf, Cline, Kilo, Antigravity)
  runs the crew with its own subagent machinery.

## Install

Requires Node.js >= 20.

```bash
# interactive wizard (scope, target agent, project type)
npx mugiwara@latest

# examples
npx mugiwara@latest --global --target claude --type general --yes
npx mugiwara@latest --project ./my-app --target opencode,copilot --type frontend --yes

# mac/linux
curl -fsSL https://raw.githubusercontent.com/ionivetech/mugiwara/main/scripts/install.sh | bash

# windows (PowerShell)
irm https://raw.githubusercontent.com/ionivetech/mugiwara/main/scripts/install.ps1 | iex
```

## Commands

| Command | Effect |
|---------|--------|
| `mugiwara install` | wizard install (default) |
| `mugiwara update` | replace files, backing up differences |
| `mugiwara uninstall` | remove exactly what the manifest recorded |
| `mugiwara list` | show installations |

Flags: `--global`, `--project <dir>`, `--target <ids|all>`,
`--type <frontend|backend|fullstack|general>`, `--yes`, `--force`, `--dry-run`.

`--type frontend|fullstack` includes the anti-slop frontend skill; other types skip it.

## The workflow

Every mission starts with **Luffy's triage**: vague idea → brainstorm with Usopp
first; clear requirements → straight to Nami's plan. Nami writes a wave-structured
plan (tasks marked parallel/sequential with acceptance criteria), Zoro executes it
through subagents, Chopper audits with evidence, Sanji cooks the checks (asking
before integration tests), Franky enforces coverage/build gates, Robin and Jinbe
review code and security in parallel, Brook heals failures (max 3 cycles), and
Luffy closes the mission with a report.

## Targets

| Target | Scope | Installs as |
|--------|-------|-------------|
| Claude Code | global + project | native skills + agents |
| opencode | global + project | native skills + agents |
| GitHub Copilot | global + project | instructions + agents |
| Gemini CLI | project | `.gemini/mugiwara/` + GEMINI.md pointer |
| Codex | project | `.codex/mugiwara/` + AGENTS.md pointer |
| Windsurf / Cline / Kilo / Antigravity | project | rules files |

## Development

```bash
npm test                # node:test suites
node scripts/validate-content.mjs   # content schema lint
```

Zero runtime dependencies. MIT.
```

(Adjust curl URLs if the default branch isn't `main`.)

- [ ] **Step 2: Commit** — `git add README.md && git commit -m "docs: README"`

**Acceptance criteria:** README covers install (all 3 entry points), commands, workflow summary, target matrix.

---

## Wave 7 — Final Gate `[SEQUENTIAL]`

### Task 41: Full verification + package + push `[SEQUENTIAL]`

**Files:** none new (verification only)

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all suites pass (frontmatter 5, args 6, prompt 4, manifest 3, installer 6, targets 5, validate-content 2, e2e 5 = 36 tests).

- [ ] **Step 2: Content gate**

Run: `node scripts/validate-content.mjs`
Expected: `✓ content valid: 12 skills, 10 agents`.

- [ ] **Step 3: Pack and verify tarball contents**

Run: `npm pack && tar -tzf mugiwara-0.1.0.tgz | sort | head -40`
Expected: contains `package.json`, `bin/mugiwara.js`, `src/**`, `content/**` (22 files), `scripts/install.sh`, `scripts/install.ps1`, `README.md`, `LICENSE`; NO `test/`, NO `docs/`.

- [ ] **Step 4: Install-from-tarball smoke**

```bash
TMP=$(mktemp -d) && node "$(tar -xzf mugiwara-0.1.0.tgz -C "$TMP" && echo "$TMP/package/bin/mugiwara.js")" --version
```
Expected: `mugiwara 0.1.0`. Then `rm -rf "$TMP" mugiwara-0.1.0.tgz`.

- [ ] **Step 5: Wizard sanity (manual)**

Run: `node bin/mugiwara.js install --dry-run` in an empty temp dir; answer prompts scope=project, target=all, type=general.
Expected: prints per-target write counts, "Dry run — nothing written.", Tier-2 targets accepted in project scope.

- [ ] **Step 6: Push to GitHub**

```bash
git branch -M main
git push -u origin main
```
(Requires `https://github.com/ionivetech/mugiwara` to exist on GitHub and git credentials available. If it doesn't exist yet: create the empty repo first — do NOT initialize with README, we have one.)

- [ ] **Step 7: Publish checklist (do not publish without owner confirmation)**

```bash
npm publish --dry-run    # preview only
```
Owner confirms → `npm publish` (or `npm publish --access public` if switched to `@mugiwara/cli`).

**Acceptance criteria:** 36/36 tests green; tarball contains exactly the shipped files; repo pushed to `ionivetech/mugiwara`.

---

## Parallelism Summary

| Wave | Mode | Tasks |
|------|------|-------|
| 1 Scaffold | sequential chain | 1 → 2 → 3 |
| 2 Content | fully parallel (22 tasks) | 4-25, gate at 26 |
| 3 CLI core | sequential chain; parallel to Wave 2 | 27 → 28 → 29 → 30 |
| 4 Targets | 31 gate → 32 ∥ 33 ∥ 34 ∥ 35 → 36 gate | |
| 5 Wiring | sequential; needs Waves 2-4 done | 37 → 38 |
| 6 Packaging | parallel | 39 ∥ 40 |
| 7 Final gate | sequential | 41 |

## Dependency Note

Task 30 (`installer.test.js`) reads real `content/` — sequence it after Task 26 if Wave 2 runs concurrently. Everything else in Wave 3 is content-independent.

---

## Self-Review Record

1. **Spec coverage:** content pack (§5 spec) → Tasks 4-26; installer CLI (§7) → Tasks 27-30, 36-38; targets (§7.3) → Tasks 31-36; manifest/safety (§7.4) → Tasks 29-30; distribution (§8) → Tasks 1, 39-41; testing (§9) → every task + 38, 41; Luffy-triage entry (D9) → Task 4 skill + Task 16 agent; frontend gating (D4) → Task 30/38; hybrid skill split (D2) → 12 skills in Tasks 4-15 with cross-references enforced by validator rule 4/5. No gaps found.
2. **Placeholder scan:** no TBD/TODO; all code blocks complete; all content files given verbatim.
3. **Type/name consistency:** `parseArgs` flags (`global/project/target/type/yes/force/dryRun`) identical across args.js, cli.js, tests; adapter interface (`paths/transformSkill/transformAgent/postInstall`) identical in contract, generic.js, native adapters, targets.test.js; manifest shape identical in manifest.js, cli.js, tests.
4. **Known deviations from original user sketch:** waves are not files (user-approved); ~33 micro-skills consolidated to 12 (user-approved hybrid); `mugiwara run --wave` dropped (user-approved); Franky kept despite missing spec table row.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-08-mugiwara-framework.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks; fits this plan's heavy parallel waves (Wave 2: 22 parallel content tasks).
2. **Inline Execution** — execute tasks in this session with checkpoints.

Which approach?

