# Repo memory template

<!-- Canonical schema for `.mugiwara/MEMORY.md`. Copy this file to `.mugiwara/MEMORY.md` on first closure write (lazy-create). Cap: 40 non-empty lines. One fact per line, no prose essays. -->

## Facts

- `bun run gate` is the full CI gate.
- `mugiwara lesson "<text>"` appends one row to `.mugiwara/lessons.md`.
- `references/*.md` install to `_shared/references` via `src/installer.ts`.

## Conventions

- Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`.
- One commit per logical task, message carries the task id.
- English only in code, docs, and mission artifacts.

## Preferences

- Reuse helpers before stdlib before new code.
- Boring diffs over clever abstractions.
- Evidence per task: command output, not claims.

## Never

- Never store secrets in MEMORY.md: no tokens, keys, or credentials of any kind.
- Never duplicate a lessons-ledger row as a memory fact; temporal goes to lessons, stable goes here.
- Never exceed 40 non-empty lines; cut stale rows first.
