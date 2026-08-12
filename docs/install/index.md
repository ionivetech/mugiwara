# Install Mugiwara

Mugiwara installs as a native plugin on every supported platform. Pick your
platform below for detailed instructions.

Requires **Node.js >= 20.11** on the host machine.

## Platforms

| Platform | Install doc | Native plugin? |
|----------|-------------|:---:|
| Claude Code | [claude](claude.md) | ✅ |
| OpenCode | [opencode](opencode.md) | ✅ |
| Gemini CLI | [gemini](gemini.md) | ✅ |
| Codex | [codex](codex.md) | ✅ |
| GitHub Copilot | [copilot](copilot.md) | ✅ |
| Cursor | [cursor](cursor.md) | ✅ |
| Antigravity | [antigravity](antigravity.md) | ✅ |
| Kimi Code | [kimi](kimi.md) | ✅ |
| Pi | [pi](pi.md) | ✅ |
| Windsurf / Cline / Kilo | [cli](cli.md) | CLI-based |

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

See [config.md](../concepts/config.md) for all `.mugiwara/config` options.

## Report issues

https://github.com/ionivetech/mugiwara/issues
