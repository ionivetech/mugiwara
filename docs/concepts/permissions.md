# Permission boundaries

Personas with teeth. Each crew member declares the tools its role allows;
auditors get narrower scopes than executors.

## Declared scopes

| Agent | Tools allowed | Hard limits |
|-------|---------------|-------------|
| chopper-checkpoint | read + shell for inspection (`git show/log/diff`, test re-runs) | never writes source; artifacts under `.mugiwara/` only |
| robin-reviewer | read + grep/glob | no shell execution, no writes outside artifacts, no network |
| brook-healing | read + write in-repo + shell for tests/builds | no network — new dependencies escalate to Luffy |

The pattern extends to any persona: scope follows role. An auditor that can
edit code is not an auditor.

## Enforcement tiers

| Harness tier | What you get |
|--------------|--------------|
| Tier 1 (native tool permissions) | scopes enforced by the harness itself — see snippets below |
| Tier 2/3 (agents as markdown) | the `## Tool scope` section is the contract; the model is asked to obey it, and the audit trail shows when it did not |

**Stated plainly:** on tier 2/3 you do not have enforcement, and nothing in
mugiwara pretends otherwise. Read your harness's capability row in
[reference/harness-matrix.md](reference/harness-matrix.md) before relying on
a boundary.

## Isolation for permission, never for autonomy

Scoping a subagent's tools does not hide its work. Scoped crew still report
findings inline in the main conversation; hours of unattended subagent work
is the thing mugiwara refuses to do. The boundary constrains _what a persona
may touch_, never _who sees what it did_.

## Tier-1 snippets

Claude Code (`.claude/settings.json`):

```json
{
  "permissions": {
    "deny": ["Write(src/**)", "Edit(src/**)", "WebFetch", "WebSearch"]
  }
}
```

Attach the deny list to the agent's invocation context per the harness's own
permission model; keep `Read`, `Grep`, `Glob` available for reviewers.

opencode (`opencode.json`):

```json
{
  "permission": {
    "webfetch": "deny",
    "bash": { "*": "allow", "git push*": "deny" }
  }
}
```

Scope the config to the agent entry that runs the persona, not globally —
global denies belong to your own governance, not to mugiwara's defaults.
