# Release Guide

How to ship a new version of `@ionivetech/mugiwara` to npm.

## Overview

A release is: **bump version → run all checks → publish to npm → tag → push → GitHub Release**.

- **You run manually:** version bump, local checks, npm publish, tag push, GitHub Release, plugin smoke test.
- **CI does the same:** GitHub Actions (`.github/workflows/ci.yml`) runs typecheck/test/build/validate on every push and PR to `main`. `.github/workflows/release.yml` runs on `v*` tag pushes and re-runs the checks, publishes to npm, packs a tarball, and creates a GitHub Release — so a successful tag push can do most of Step 4–9 for you. The steps below are the manual path so you can ship even if CI is down or you want to verify everything locally first.

**One caveat about double-publishing:** if you publish manually (Step 4) *and* push the `v*` tag (Step 8), the Release workflow will try to publish the same version again and fail with a version-conflict error. Pick one path:

- **CI path:** bump version → push tag → let `release.yml` publish + create the Release.
- **Manual path (this guide):** publish manually, then push. If the workflow's publish step errors because the version already exists, that's expected — the GitHub Release step is separate and will still run.

## Prerequisites

Installed and working:

- **Node.js >= 20.11** (`node --version`) — required by `engines` in package.json.
- **Bun** (`bun --version`) — the build/test tool (`prepack` runs `bun run build`).
- **npm account** logged in with publish rights to `@ionivetech/mugiwara` — check with `npm whoami`. If not logged in: `npm login`.
- **git** and **GitHub repo access** — remote `origin` is `https://github.com/ionivetech/mugiwara.git`.

> Note: the package is **scoped** (`@ionivetech/mugiwara`). A scoped package **defaults to private** on first publish — every publish command must include `--access public` or it will fail.

## Release checklist

### Step 0 — Branch and working tree

Work on `main`, with a clean tree.

```bash
git checkout main
git status
```

Expected: `On branch main` and `nothing to commit, working tree clean` (no uncommitted changes). The release tag will be created on top of the current `main` HEAD.

### Step 1 — Run all checks

```bash
bun run typecheck
bun run test
bun run build
node scripts/validate-content.mjs
node dist/mugiwara.js --version
```

Expected output:

| Command | Expected |
|---|---|
| `bun run typecheck` | Exit 0, no errors (`tsc --noEmit`) |
| `bun run test` | `Test Files ... passed`, all suites green |
| `bun run build` | Recreates `dist/mugiwara.js` |
| `node scripts/validate-content.mjs` | `✓ content valid: 19 skills, 12 agents` |
| `node dist/mugiwara.js --version` | `mugiwara 0.1.0` (current version) |

If any step fails, fix before releasing — never ship a release that fails its own checks.

### Step 2 — Bump the version

```bash
npm version patch
```

`npm version patch|minor|major` bumps `package.json`, creates a `vX.Y.Z` git commit, and creates the matching git tag. Recommended for the first release after `0.1.0`: **`npm version patch`** → `0.1.1`.

Expected: `v0.1.1` printed, `git log -1` shows the version commit, `git tag` lists `v0.1.1`.

Semver policy for this package (see "Version bump conventions" below):

- **patch** — bug fixes, docs, non-breaking tweaks
- **minor** — new features (new agent/skill, new target), backwards compatible
- **major** — breaking changes (changed install paths, removed flags, incompatible content schema)

### Step 3 — Dry-run publish

```bash
npm publish --dry-run --access public
```

This does **not** publish. It runs `prepack` (`bun run build`), builds the tarball, and prints its contents. Verify the tarball contains:

- `package.json`
- `dist/mugiwara.js` — the `bin` target
- `content/` — **31 files** (12 agents + 19 skills)
- `scripts/install.sh`, `scripts/install.ps1`
- `src/` (cli, installer, targets)
- `README.md`, `LICENSE`

And **does NOT contain**:

- `test/` — excluded via `files`
- `docs/` — excluded via `files`
- `node_modules/`, `.git/`, `*.tgz` — excluded via `.gitignore` / `files`

Expected: `npm notice total files: 46` and no warnings about missing `dist/mugiwara.js`. If `dist/mugiwara.js` is missing from the tarball, run `bun run build` and re-check.

### Step 4 — Publish

```bash
npm publish --access public
```

Expected final line:

```
+ @ionivetech/mugiwara@0.1.1
```

### Step 5 — Verify on npm

```bash
npm view @ionivetech/mugiwara version
```

Expected: prints the new version (e.g. `0.1.1`). May lag a few seconds after publish.

### Step 6 — Verify `npx` install (published artifact under plain Node)

In a temp directory (so you don't touch local `node_modules`):

```bash
mkdir -p /tmp/mugiwara-verify && cd /tmp/mugiwara-verify
npx -y @ionivetech/mugiwara@latest --version
```

Expected: `mugiwara 0.1.1` — proves the published tarball's `bin` target runs under plain Node (`node dist/mugiwara.js`).

### Step 7 — Verify the curl installer (macOS / Linux)

The installer forwards all args to `npx @ionivetech/mugiwara@latest "$@"`, so `--version` reaches the CLI:

```bash
curl -fsSL https://raw.githubusercontent.com/ionivetech/mugiwara/main/scripts/install.sh | bash -s -- --version
```

Expected: `mugiwara 0.1.1`.

> The raw URL points at branch `main` — it always fetches the latest committed installer, so push must happen (Step 8) before this reflects new content. The script itself just `exec`s the published npm package, so version output comes from npm regardless.

### Step 8 — Push

```bash
git push origin main --tags
```

Expected: pushes `main` and all `vX.Y.Z` tags. This is also what triggers `.github/workflows/release.yml` if you're using the CI publish path.

### Step 9 — Create a GitHub Release

Pack the tarball (requires the version already bumped):

```bash
npm pack
gh release create v0.1.1 --generate-notes --latest ./ionivetech-mugiwara-0.1.1.tgz
```

Replace `v0.1.1` with your tag. The `*.tgz` asset is gitignored, so it won't pollute the repo. `--generate-notes` auto-drafts notes from merged PRs.

> If `release.yml` already ran on your tag push, a Release may already exist — check `gh release view v0.1.1` and attach the tarball to it instead of creating a duplicate.

Web UI alternative: **github.com/ionivetech/mugiwara/releases/new** → pick tag `v0.1.1` → "Generate release notes" → drag in `ionivetech-mugiwara-0.1.1.tgz` → "Publish release".

### Step 10 — Verify the Claude plugin

In a Claude Code project:

```
/plugin marketplace add ionivetech/mugiwara
/plugin install mugiwara
```

If the `claude` CLI is available, also run strict validation:

```bash
claude plugin validate --strict
```

Expected: marketplace resolves, plugin installs, validation passes with no strict-mode errors. The marketplace lives in `.claude-plugin/marketplace.json` and `hooks/` ships install hooks for the CLI agents.

## Version bump conventions

| Bump | Command | Use when |
|---|---|---|
| **patch** | `npm version patch` | Bug fixes, docs, internal refactors, non-breaking tweaks |
| **minor** | `npm version minor` | New features: a new agent, new skill, or new target platform, backwards compatible |
| **major** | `npm version major` | Breaking changes: changed install paths, removed CLI flags, incompatible content/frontmatter schema |

The package currently has 12 agents + 19 skills (`content/`), 8 targets (`src/targets/`), and is at `0.1.0` — pre-1.0, so per semver `0.x` behaves loosely; treat "feature → minor, fix → patch" as the default until `1.0.0`.

## Rollback / troubleshooting

### Wrong version published

```bash
npm unpublish @ionivetech/mugiwara@<version> --force
```

⚠️ **Only works within 72 hours** of the publish. After that the version is permanent — the fix is to publish a new (higher) version.

### Bad tag pushed

```bash
git tag -d v0.1.1
git push origin :refs/tags/v0.1.1
```

Local tag deleted, remote tag removed. Then re-tag from the correct commit.

### Publish failed

Check, in order:

1. `npm whoami` — are you logged in?
2. Scoped package needs `--access public`. First publish of a scoped package defaults to **private** and errors with `You must sign up for private packages`. Re-run with `--access public` (never rely on a default).
3. `npm config get registry` — should be `https://registry.npmjs.org/`.

### `npx @ionivetech/mugiwara@latest` fails with ENOENT

The `bin` target `dist/mugiwara.js` is missing from the published tarball. `prepack` runs `bun run build`, so this shouldn't happen — but if it does: `bun run build`, then `npm publish --access public` again (the fixed build overwrites the version). Verify with Step 3 before republishing.

### Node version error

`mugiwara requires Node.js >= 20` — the CLI's `engines` field and the install scripts both enforce `>= 20.11`. Install Node 20+ and retry.

## Checklist summary

| # | Command / action | ✓ |
|---|---|---|
| 0 | `git checkout main && git status` (clean tree) | ☐ |
| 1 | `bun run typecheck` | ☐ |
| 1 | `bun run test` | ☐ |
| 1 | `bun run build` | ☐ |
| 1 | `node scripts/validate-content.mjs` → `✓ content valid` | ☐ |
| 1 | `node dist/mugiwara.js --version` → `mugiwara <version>` | ☐ |
| 2 | `npm version patch` | ☐ |
| 3 | `npm publish --dry-run --access public` → check tarball (46 files, no test//docs/) | ☐ |
| 4 | `npm publish --access public` → `+ @ionivetech/mugiwara@<version>` | ☐ |
| 5 | `npm view @ionivetech/mugiwara version` → new version | ☐ |
| 6 | `cd /tmp/... && npx -y @ionivetech/mugiwara@latest --version` | ☐ |
| 7 | `curl -fsSL .../install.sh | bash -s -- --version` | ☐ |
| 8 | `git push origin main --tags` | ☐ |
| 9 | `npm pack && gh release create <tag> --generate-notes --latest *.tgz` | ☐ |
| 10 | `/plugin marketplace add ionivetech/mugiwara` + `/plugin install mugiwara` | ☐ |
| 10 | `claude plugin validate --strict` (if CLI available) | ☐ |
