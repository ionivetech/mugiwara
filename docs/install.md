# Install Mugiwara

Mugiwara installs as a native plugin on every supported platform. Pick your
platform below for detailed instructions.

Requires **Node.js >= 20.11** on the host machine.

## Platforms

| Platform | Install doc | Native plugin? |
|----------|-------------|:---:|
| Claude Code | [install-claude](install-claude.md) | ✅ |
| OpenCode | [install-opencode](install-opencode.md) | ✅ |
| Gemini CLI | [install-gemini](install-gemini.md) | ✅ |
| Codex | [install-codex](install-codex.md) | ✅ |
| GitHub Copilot | [install-copilot](install-copilot.md) | ✅ |
| Cursor | [install-cursor](install-cursor.md) | ✅ |
| Antigravity | [install-antigravity](install-antigravity.md) | ✅ |
| Kimi Code | [install-kimi](install-kimi.md) | ✅ |
| Pi | [install-pi](install-pi.md) | ✅ |
| Windsurf / Cline / Kilo | [install-cli](install-cli.md) | CLI-based |

## One-liner

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/ionivetech/mugiwara/main/scripts/install.sh | bash
# Windows
irm https://raw.githubusercontent.com/ionivetech/mugiwara/main/scripts/install.ps1 | iex
```

## Global CLI

```bash
npm i -g @ionivetech/mugiwara
mugiwara install --target all --yes
```

## Verify

On any platform, ask:

```
what mugiwara crew members are available?
```

## Configuration

See [docs/config.md](config.md) for all `.mugiwara/config` options.

## Report issues

https://github.com/ionivetech/mugiwara/issues
