# CLI Install (Windsurf, Cline, Kilo)

These platforms don't have native plugin systems. Use the mugiwara CLI
installer to copy files into the platform's config directory.

## Prerequisites

- Node.js >= 20.11

## Install

```bash
npx @ionivetech/mugiwara@latest install --target <id> --yes
```

Replace `<id>` with one of: `windsurf`, `cline`, `kilo`.

Or install globally first:

```bash
npm i -g @ionivetech/mugiwara
mugiwara install --target <id> --yes
```

### What gets written

| Target | Skills/agents | References | Bootstrap |
|--------|---------------|------------|-----------|
| Windsurf | `.devin/rules/*.md` (stubs) | `.mugiwara/refs/*.md` | — |
| Cline | `.clinerules/*.md` (stubs) | `.mugiwara/refs/*.md` | — |
| Kilo | `.kilo/rules/*.md` (stubs) | `.mugiwara/refs/*.md` | `kilo.jsonc` |

Tier 3 targets use stubs (pointer + routing) to keep rule files small.
Full skill bodies live in `.mugiwara/refs/` — the agent loads them on demand.

### Interactive mode

Drop `--yes` for the interactive wizard:

```bash
npx @ionivetech/mugiwara install
```

Pick scope (global/project), target(s), and confirm before writing.

### Multiple targets

```bash
npx @ionivetech/mugiwara install --target windsurf,cline,kilo --yes
```

Or all available targets:

```bash
npx @ionivetech/mugiwara install --target all --yes
```

## Verify

Ask your agent:

```
what mugiwara crew members are available?
```

## Update

```bash
npx @ionivetech/mugiwara@latest update --project . --target <id> --yes
```

Or with global CLI:

```bash
mugiwara update --project . --target <id> --yes
```

## Uninstall

```bash
npx @ionivetech/mugiwara@latest uninstall --project .
```

Or with global CLI:

```bash
mugiwara uninstall --project .
```

## Global install

```bash
mugiwara install --global --target <id> --yes
```

Installs to `~/.devin/rules/` (Windsurf), `~/.clinerules/` (Cline), or
`~/.kilo/rules/` (Kilo).

## Configuration

After install, configure mugiwara in `.mugiwara/config` (project) or
`~/.mugiwara/config` (global). See [docs/config.md](config.md).

## CLI reference

```bash
mugiwara install                                  # wizard (interactive)
npx @ionivetech/mugiwara@latest install --yes     # non-interactive (project + all)
mugiwara update --project . --target <id> --yes   # replace existing files
mugiwara uninstall --project .                    # remove what manifest recorded
mugiwara list                                     # show installations
mugiwara list --check                             # health check (missing files)
mugiwara reset --keep-logs                        # wipe mission state, keep lessons
mugiwara reset --force                            # override multi-actor guard
```
