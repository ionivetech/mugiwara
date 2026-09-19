# Repo memory

Re-discovering stable repo facts every mission burns tokens. One curated file holds them instead: `.mugiwara/MEMORY.md`, capped at 40 non-empty lines and read once at Flow 0.

## Schema

Four sections, one fact per line, no prose essays:

- Facts: commands and paths that hold across missions.
- Conventions: commit style, language rules.
- Preferences: reuse order, diff taste, evidence discipline.
- Never: hard prohibitions, including the never-secrets rule below.

The versioned canonical lives at [memory-template.md](../../references/memory-template.md). Copy it to `.mugiwara/MEMORY.md` on first closure write (lazy-create); the runtime file is gitignored, so review checks the template.

## Reads stay bounded

- Flow 0 performs a single read of `.mugiwara/MEMORY.md`.
- The lessons ledger stays selective, never a full-file scan past 50 rows:

```bash
grep <area> .mugiwara/lessons.md | tail -20
```

- At most 3 ledger rows reach the owning agent.

## Split bar

Temporal surprise goes to `.mugiwara/lessons.md` (append-only, one row per lesson). Stable truth goes to `.mugiwara/MEMORY.md` (edit-in-place). One row never lives in both files.

## Never secrets

No tokens, keys, or credentials of any kind enter MEMORY.md. A fact that needs a credential stays in the secret store; record the lookup pattern, never the value.

Full rules live in the [mugiwara-lessons skill](../../content/skills/mugiwara-lessons/SKILL.md).
