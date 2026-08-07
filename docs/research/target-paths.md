# Verified target install paths

Research verifying install directories, frontmatter dialects, and global-scope support for each
mugiwara install target against live official documentation. Checked **2026-08-08**.

Deviations from the plan's expected paths are called out inline and summarized in
[Deviations from plan](#deviations-from-plan). Where docs give a newer/deprecated location, the
current official location is recorded as the verified path; the plan's path is kept for reference.

---

## 1. Claude (Claude Code)

- **Verified dirs**
  - Skills (project): `.claude/skills/<skill-name>/SKILL.md`
  - Skills (personal/global): `~/.claude/skills/<skill-name>/SKILL.md`
  - Skills (plugin): `<plugin>/skills/<skill-name>/SKILL.md`; enterprise via managed settings
  - Agents (project): `.claude/agents/*.md` (subfolders allowed; identity from `name` frontmatter)
  - Agents (user/global): `~/.claude/agents/*.md`
  - Agents (plugin): `<plugin>/agents/*.md`; session-only via `--agents` CLI flag
  - Legacy: `.claude/commands/*.md` still works (custom commands merged into skills)
- **Frontmatter dialect**
  - Skills (`SKILL.md`): YAML frontmatter. Fields: `name`, `description` (recommended),
    `when_to_use`, `argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable`,
    `allowed-tools`, `disallowed-tools`, `model`, `effort`, `context`, `agent`, `background`,
    `hooks`, `paths`, `shell`, `metadata`, `license`, `compatibility`. Outside Claude Code (claude.ai
    uploads, Skills API) only the Agent Skills spec fields are allowed: `name`, `description`,
    `license`, `compatibility`, `metadata`, `allowed-tools`.
  - Agents (`*.md`): YAML frontmatter. Required: `name`, `description`. Others: `tools`,
    `disallowedTools`, `model`, `permissionMode`, `maxTurns`, `skills`, `mcpServers`, `hooks`,
    `memory`, `background`, `effort`, `isolation`, `color`, `initialPrompt`. Body = system prompt.
- **Global scope:** Yes — `~/.claude/` (skills + agents)
- **Docs:** https://code.claude.com/docs/en/skills and https://code.claude.com/docs/en/sub-agents
- **Date checked:** 2026-08-08
- **Deviation:** None — matches plan exactly.

## 2. OpenCode

- **Verified dirs**
  - Skills (project): `.opencode/skills/<name>/SKILL.md`
  - Skills (global): `~/.config/opencode/skills/<name>/SKILL.md`
  - Skills (compat, project + global): `.claude/skills/`, `.agents/skills/` and
    `~/.claude/skills/`, `~/.agents/skills/` are also searched
  - Agents (project): `.opencode/agents/*.md` (markdown filename = agent name)
  - Agents (global): `~/.config/opencode/agents/*.md`
  - Agents can also be defined in `opencode.json` under `agent` (JSON config)
- **Frontmatter dialect**
  - Skills (`SKILL.md`): YAML frontmatter. **Required:** `name`, `description`. Optional: `license`,
    `compatibility`, `metadata` (string-to-string map). Unknown fields ignored. `name` must match
    the directory name, lowercase alphanumeric + single hyphens; `description` 1–1024 chars.
  - Agents (`.md`): YAML frontmatter. Required: `description`. Others: `mode` (`primary`/`subagent`/
    `all`, default `all`), `model`, `temperature`, `permission`, `steps`, `disable`, `hidden`,
    `color`, `top_p`, `tools` (deprecated).
- **Global scope:** Yes — `~/.config/opencode/`
- **Docs:** https://opencode.ai/docs/skills/ and https://opencode.ai/docs/agents/
- **Date checked:** 2026-08-08
- **Deviation:** Official agents dir is **`.opencode/agents/`** (plural) — plan wrote `.opencode/agent(s)`. Use plural `agents`.

## 3. GitHub Copilot (VS Code + GitHub.com)

- **Verified dirs**
  - Agents (workspace): `.github/agents/` — any `.md` detected; recommended `.agent.md` extension
  - Agents (workspace, Claude format): `.claude/agents/` (`.md`, Claude frontmatter)
  - Agents (user/global): `~/.copilot/agents`
  - Instructions (always-on, repo-wide): `.github/copilot-instructions.md`
  - Instructions (path-scoped): `.github/instructions/*.instructions.md` (glob-scoped via `applyTo`)
  - Instructions (Claude format): `.claude/rules/*` (uses `paths` instead of `applyTo`)
  - Instructions (user/global): `~/.copilot/instructions` or `~/.claude/rules`
  - Also reads `AGENTS.md` (nearest wins) and root `CLAUDE.md` / `GEMINI.md`
- **Frontmatter dialect**
  - Agents (`.agent.md`): `description`, `name` (default = filename), `argument-hint`, `tools`,
    `agents`, `model`, `user-invocable`, `disable-model-invocation`, `target` (`vscode` /
    `github-copilot`), `mcp-servers`, `handoffs` (with `label`/`agent`/`prompt`/`send`/`model`),
    `hooks` (preview). Claude-format agents in `.claude/agents` use `name`, `description`, `tools`
    (comma-separated string), `disallowedTools`.
  - Instructions (`.instructions.md`): `name`, `description`, `applyTo` (glob; comma-separated
    patterns). `excludeAgent` (`code-review`/`cloud-agent`) on GitHub.com. No frontmatter = not
    auto-applied.
- **Global scope:** Yes — `~/.copilot/agents` and `~/.copilot/instructions`
- **Docs:** https://code.visualstudio.com/docs/agent-customization/custom-agents,
  https://code.visualstudio.com/docs/agent-customization/custom-instructions,
  https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions
- **Date checked:** 2026-08-08
- **Deviation:** `.github/agents/*.md` and `.github/instructions/*.instructions.md` confirmed. Adds:
  (a) repo-wide always-on `.github/copilot-instructions.md`; (b) `.instructions.md` files are
  path-scoped only and require an `applyTo` frontmatter glob; (c) user-level dirs are `~/.copilot/`
  (not `~/.config/`); (d) Claude-format `.claude/agents` and `.claude/rules` are also honored.

## 4. Gemini (Gemini CLI)

- **Verified dirs**
  - Context file (project): `GEMINI.md` in configured workspace dirs and parent directories
    (hierarchical, concatenated); Just-in-time scans on file access up to trusted root
  - Context file (global): `~/.gemini/GEMINI.md`
  - Filename configurable via `context.fileName` in `settings.json` (e.g. `["AGENTS.md",
    "CONTEXT.md", "GEMINI.md"]`)
- **Frontmatter dialect:** None — plain Markdown instructions. Supports `@file.md` imports
  (relative/absolute) to compose context from other files.
- **Global scope:** Yes — `~/.gemini/GEMINI.md`
- **Docs:** https://raw.githubusercontent.com/google-gemini/gemini-cli/main/docs/cli/gemini-md.md
  (rendered at https://gemini-cli.google.com/docs/cli/gemini-md)
- **Date checked:** 2026-08-08
- **Deviation:** None — GEMINI.md context file confirmed. Note it is not a per-skill/agent install
  path; it is a single hierarchical context file.

## 5. Codex (OpenAI)

- **Verified dirs**
  - Project: `AGENTS.md` from repo root down to cwd (at most one per directory; nearest wins;
    root → cwd concatenated, later = higher precedence)
  - Project override: `AGENTS.override.md` takes precedence over `AGENTS.md` in each directory
  - Global: `~/.codex/AGENTS.md` (or `AGENTS.override.md`; first non-empty wins). Home dir is
    `~/.codex` by default, overridable via `CODEX_HOME`
  - Fallback filenames via config: `project_doc_fallback_filenames` (e.g. `TEAM_GUIDE.md`)
  - Size cap: `project_doc_max_bytes` (default 32 KiB combined)
- **Frontmatter dialect:** None — plain Markdown instructions. Special `## Code Review Rules`
  section for Codex code-review rules in GitHub.
- **Global scope:** Yes — `~/.codex/AGENTS.md`
- **Docs:** https://developers.openai.com/codex/agent-configuration/agents-md
- **Date checked:** 2026-08-08
- **Deviation:** None — AGENTS.md confirmed, plus the `AGENTS.override.md` mechanism.

## 6. Windsurf (now Devin Desktop)

- **Verified dirs**
  - Workspace rules: `.devin/rules/*.md` (**preferred**) or `.windsurf/rules/*.md` (fallback) — in
    workspace, subdirectories, and up to git root
  - Legacy: single `.windsurfrules` file at workspace root still read
  - Global rules: `~/.codeium/windsurf/memories/global_rules.md` (single always-on file, 6000-char
    limit)
  - System (enterprise): `/etc/devin/rules/` (legacy `/etc/windsurf/rules/`); per-OS equivalents
  - Auto memories: `~/.codeium/windsurf/memories/` (legacy Cascade only)
  - `AGENTS.md` processed by the same rules engine (root = always-on, subdir = auto-glob)
- **Frontmatter dialect:** Workspace rules use YAML frontmatter with `trigger` field:
  `always_on` | `model_decision` | `glob` | `manual`. `globs` pattern used when `trigger: glob`.
  Global `global_rules.md` and root `AGENTS.md` use no frontmatter (always on).
- **Global scope:** Yes — `~/.codeium/windsurf/memories/global_rules.md`
- **Docs:** https://docs.windsurf.com/windsurf/cascade/memories (now serves Devin Desktop docs:
  https://docs.devin.ai/desktop/cascade/memories)
- **Date checked:** 2026-08-08
- **Deviation:** `.windsurf/rules/` confirmed but **`.devin/rules/` is now the preferred location**
  (Windsurf merged into Devin). Global rules are a single `global_rules.md` file, not a dir.

## 7. Cline

- **Verified dirs**
  - Workspace rules: `.clinerules/` at project root (all `.md` and `.txt` files combined; numeric
    prefixes optional)
  - Global rules: `~/Documents/Cline/Rules` (macOS/Linux; Windows `Documents\Cline\Rules`; Linux
    fallback `~/Cline/Rules`)
  - Cross-tool auto-detect: `.cursorrules`, `.windsurfrules`, `AGENTS.md`, `~/.agents/AGENTS.md`
- **Frontmatter dialect:** Optional YAML frontmatter for conditional rules — `paths` (array of glob
  patterns). No frontmatter = rule always active. Invalid YAML fails open (rule stays active).
- **Global scope:** Yes — `~/Documents/Cline/Rules`
- **Docs:** https://docs.cline.bot/features/cline-rules
- **Date checked:** 2026-08-08
- **Deviation:** None — `.clinerules/` confirmed.

## 8. Kilo (Kilo Code)

- **Verified dirs**
  - Project rules: declared in project `kilo.jsonc` under `instructions` array, e.g.
    `.kilo/rules/formatting.md`, `.kilo/rules/*.md`
  - Global rules: declared in global `~/.config/kilo/kilo.jsonc` under `instructions`
  - Legacy (backward compatible, auto-included): `.kilocode/rules/` directories
- **Frontmatter dialect:** None — plain Markdown (or text) rule files. Rules are wired via the
  `instructions` config key, not auto-discovery of a fixed dir.
- **Global scope:** Yes — `~/.config/kilo/kilo.jsonc`
- **Docs:** https://docs.kilocode.ai/docs/customize/custom-rules
- **Date checked:** 2026-08-08
- **Deviation:** Plan said "rules location (kilocode.ai)". Current official format is the
  **`kilo.jsonc` `instructions` array + `.kilo/rules/`**; legacy `.kilocode/rules/` still works but
  is deprecated. Adapter should target `.kilo/rules/` + `kilo.jsonc` wiring.

## 9. Antigravity (Google Antigravity)

- **Verified dirs**
  - Workspace rules: `.agents/rules/` (**current default**) in workspace or git root
  - Workspace rules (legacy, still supported): `.agent/rules/`
  - Global rules: `~/.gemini/GEMINI.md` (applied across all workspaces)
- **Frontmatter dialect:** Activation mode set at the rule level: Manual, Always On, Model Decision,
  or Glob. Docs do not show exact frontmatter field names on this page; works like Windsurf/Devin's
  `trigger` + `globs`. Rule files support `@filename` references to other files. (Frontmatter field
  names not fully verified — see report.)
- **Global scope:** Yes — `~/.gemini/GEMINI.md`
- **Docs:** https://antigravity.google/docs/rules-workflows
- **Date checked:** 2026-08-08
- **Deviation:** Expected `.agent/rules/` — official default is **`.agents/rules`**; `.agent/rules`
  is the legacy path (still supported). Global rules share Gemini's `~/.gemini/GEMINI.md`.

---

## Deviations from plan

| Target | Plan expected | Verified (official, current) | Impact |
|--------|--------------|------------------------------|--------|
| opencode | `.opencode/agent(s)` | **`.opencode/agents/`** (plural) | Use plural dir |
| copilot | `.github/agents/*.md`, `.github/instructions/*.instructions.md` | Confirmed, **plus** `.github/copilot-instructions.md` (always-on repo-wide); `.instructions.md` requires `applyTo` frontmatter; user dirs `~/.copilot/` | Wire both instruction mechanisms; don't assume repo-wide instructions from `.instructions.md` alone |
| windsurf | `.windsurf/rules/` | `.windsurf/rules/` still works but **`.devin/rules/` preferred** (product merged into Devin); global = single `~/.codeium/windsurf/memories/global_rules.md` | Install to `.devin/rules/` for forward compatibility; fall back to `.windsurf/rules/` |
| kilo | "rules location (kilocode.ai)" | **`kilo.jsonc` `instructions` array + `.kilo/rules/`**; legacy `.kilocode/rules/` deprecated | Adapter must write `kilo.jsonc` + rule files |
| antigravity | `.agent/rules/` | **`.agents/rules`** default; `.agent/rules` legacy-but-supported | Use `.agents/rules` |
| gemini | GEMINI.md context file | Confirmed; global `~/.gemini/GEMINI.md`; filename configurable | None |
| claude | `.claude/skills/<n>/SKILL.md`, `.claude/agents/*.md`, `~/.claude/` | Confirmed exactly | None |
| codex | AGENTS.md | Confirmed; global `~/.codex/AGENTS.md`; `AGENTS.override.md` precedence | None |
| cline | `.clinerules/` | Confirmed; global `~/Documents/Cline/Rules` | None |
