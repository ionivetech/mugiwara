# Changelog

All notable changes to mugiwara. Format follows [Keep a Changelog](https://keepachangelog.com/) and [Semantic Versioning](https://semver.org/). Pre-1.0: a renamed or removed skill name is a breaking change.

## [Unreleased] — 0.4.0

### Added
- **Lane sizing.** Wave 0 now sizes every mission and routes it to a lane (0 Direct / 1 Lean / 2 Standard / 3 Full / 4 Spike). Small work runs zero waves; sensitive work always runs the full pipeline. The lane escalates when the work outgrows the estimate.
- **Skip gates.** Every skill now carries a `## Skip when` block (1–4 bullets, numeric thresholds) so it knows when it does not apply. Enforced by the content validator.
- **`## Skip when` validation.** `bun run validate` fails the build on a skill without a skip gate.
- **Spec bridge.** Clear-work routes that skip brainstorm still write a short spec before planning, so `/mugiwara-plan` never reads an empty spec.
- **Eval harness.** `evals/cases/` with 11 routing cases (positive, negative, adversarial, lane); `bun run evals` validates the suite in CI.
- **Tiered emission.** Targets declare a capability tier (1/2/3). Tier-3 harnesses (rules-dir glob-loaders) get slim stubs in the rules dir with full bodies in `.mugiwara/refs/`, cutting the static token load from ~40k to ~4.8k.
- **References install.** The installer now copies each skill's `references/` files into the installed tree (previously dead content).
- **`mugiwara reset`.** Wipe mission state; `--keep-logs` preserves the lessons ledger.
- **Source-of-truth symlinks.** Repo-root `agents/` and `skills/` are now symlinks to `content/` — one physical source, no drift.

### Removed
- **CLI enforcement commands.** `skills`, `preflight`, `scan`, `budget`, `doctor`, `attest`, `verify`, and their flags were removed. The CLI is an installer tool only (install / update / uninstall / list / reset). Lane routing moved into the crew's triage prose, not a command.
- **`lane` config key.** The lane is a per-mission runtime decision by Luffy, not a repo setting.

### Changed
- **README rewritten** around why mugiwara, a mission walkthrough, and lane sizing. All docs reviewed and reworded to the current model.
- **Comparison rewritten** with a measured benchmark (32 skills, ~1.2k tok avg, ~80 lines avg) and an honest capabilities matrix.
- **Skip-gate content** added to all 32 skills; several skills tightened to stay within the 120-line body limit.

## [0.3.0] — 2026-08-11

### Added
- **Auto-activation.** The crew announces at session start and a non-trivial request runs the pipeline by itself — `/using-mugiwara` is now an optional router.
- **SessionStart hook** for Claude Code; plugin announce for opencode.
- **Per-stage slash commands** (`/mugiwara-plan`, `/mugiwara-execute`, `/mugiwara-review`, `/mugiwara-security`, `/mugiwara-heal`, `/mugiwara-ship`).
- **Mode contract.** `guided` / `semi` / `auto` autonomy levels owned by `mugiwara-mode`, with consent invariants and gated auto-GO.
- **Seven new skills** (frontend, security depth, and engineering discipline) and checkpoint reports with optional e2e gate and Brook worker subagents.
- **Plugin manifests** for Codex, Cursor, Kimi, opencode, Gemini, and pi.
- **Release automation** — manual GitHub release workflow (bump + tag + publish).

### Changed
- Closure now pushes the branch and hands a local PR-verdict file with a ready PR summary instead of auto-creating a PR.
- Workflow mandates wave banners, handoffs, and recorded no-skip.

## [0.2.0] — 2026-06

### Added
- **`mugiwara-deprecation` skill** — sunset & migration discipline.
- **User-test intake (ATDD)** — `mugiwara-testcases` with immutable-gold rule and consent; user ACs map into planning and gates.
- **Plugin manifests** for codex, cursor, kimi, opencode, gemini, and pi.
- **Modes documentation** and the `docs/` folder.

### Changed
- **Crew runs inline.** Wave audit deduped, logical-task commits, plain `git push` + local verdict handoff (removed the `gh` CLI dependency).
- Skill count corrected to 25; secrets scanned in the PR verdict before handoff; invalid config values fail-safe to defaults.

## [0.1.3] — 2026-05

### Removed
- `--type` project selection — installs always ship the full crew.

### Fixed
- Plugin manifest versions synced with the package version.

## [0.1.2] — 2026-05

### Fixed
- Version sync across plugin manifests.

## [0.1.1] — 2026-05

### Fixed
- Release packaging patch.

## [0.1.0] — 2026-04

### Added
- **The Straw Hat crew** — 15 agents (Luffy, Nami, Usopp, Zoro, Chopper, Sanji, Franky, Robin, Jinbe, Brook, Skeptic, Eval Runner, Resume Coordinator, Memory Keeper) and their skills.
- **Wave pipeline** — triage, brainstorm, planning, execution, checkpoint, quality, gates, review, healing, closure.
- **The `.mugiwara/` workspace** — spec, plans, results, review, issues, logs.
- **Installer CLI** — `mugiwara install / update / uninstall / list / skills` across 12 targets with dry-run, backup, and manifest-based uninstall.
- **100% TypeScript build** — validator, evals runner, and SessionStart hook ported to TS, run via bun.
- **Content validation** — skill/agent name checks, description length, body line limits.

[Unreleased]: https://github.com/ionivetech/mugiwara/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/ionivetech/mugiwara/releases/tag/v0.3.0
[0.2.0]: https://github.com/ionivetech/mugiwara/releases/tag/v0.2.0
[0.1.3]: https://github.com/ionivetech/mugiwara/releases/tag/v0.1.3
[0.1.2]: https://github.com/ionivetech/mugiwara/releases/tag/v0.1.2
[0.1.1]: https://github.com/ionivetech/mugiwara/releases/tag/v0.1.1
[0.1.0]: https://github.com/ionivetech/mugiwara/releases/tag/v0.1.0
