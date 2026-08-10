# Rule-Based Targets: Cline, Kilo, Antigravity, pi, Kimi

These targets install the crew as markdown rule files your tool picks up from a
conventions directory. Skills-only — the crew pipeline runs through the rules.

## Install

```bash
# all rule-based targets in one go
npx @ionivetech/mugiwara@latest --project ./my-app --target cline,kilo,antigravity --yes
```

| Harness | Target id | Installs as |
|---------|-----------|-------------|
| Cline | `cline` | Rules in `.clinerules` |
| Kilo Code | `kilo` | Rules in `.kilo/rules` + `kilo.jsonc` pointer |
| Antigravity | `antigravity` | Rules in `.agents/rules` |

## pi and Kimi

- **pi** — `pi install git:github.com/ionivetech/mugiwara` (declared via the
  `"pi"` key in `package.json`).
- **Kimi Code** — `/plugins install https://github.com/ionivetech/mugiwara`
  (`.kimi-plugin/plugin.json`).

## Notes

All rule-based targets are **project-only** — skipped (with a note) on
`--global` installs. Targets with a bootstrap file (Gemini, Codex, Kilo) create
it if absent and otherwise tell you the line to add, so your tool points at the
crew.
