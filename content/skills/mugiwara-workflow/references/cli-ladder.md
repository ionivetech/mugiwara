# CLI ladder (every harness)

`mugiwara <cmd>` resolves down this ladder, highest working rung wins. Resolve
**once at Flow 0**, reuse the whole mission:

1. `mugiwara --version` → use `mugiwara`.
2. Else `npx -y @ionivetech/mugiwara@latest --version` → use the npx form.
3. Else `.mugiwara/bin/` shell fallbacks, installed by `mugiwara install` next
   to every project: `.mugiwara/bin/savepoint.sh` writes
   `.mugiwara/missions/<mission>/state.json | <member>.json` +
   `continue.json | continue-<member>.json`; `.mugiwara/bin/lane.sh` sizes the
   lane. Read-only commands (`continue`/`status`/`cost`) read
   `.mugiwara/missions/` directly per the layout in `mugiwara-resume` → State
   contract. Full state, no degradation.
4. Else (offline AND no fallbacks on disk) announce the degradation before doing
   any work:

```
⚠ mugiwara CLI unavailable — state will not be written this session.
  Resume, budget tracking, lane-escalation memory, and the closure
  integrity gate are inactive. Install with:
  npm i -g @ionivetech/mugiwara
```

Then continue degraded: keep flow banners and the inline report, admit at
closure that no machine state was recorded. Governance that fails silently is
worse than governance that admits it is off. Degraded is the last rung, never
the second — a plugin-only install with `.mugiwara/bin/` on disk is NOT
degraded.
