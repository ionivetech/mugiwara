# Skill Versioning Policy

What happens to an existing `.mugiwara/` when a skill changes shape mid-mission.

## Version stamp

the mission state carries a `skill_version` field:

```json
{
  "skill_version": "1",
  ...
}
```

Set by `mugiwara savepoint` from the installed package version (`package.json`
→ `version` → major). Incremented on breaking changes to skill format, state
schema, or workspace layout.

## Resume mismatch behavior

On resume, compare `skill_version` in the mission state with the installed version:

| Match | Behavior |
|-------|----------|
| Same major | Resume normally |
| Different major | Warn: "Skill version changed since this mission started (v1 → v2). Plan doc and state may be out of date." Ask: continue / restart / reconcile |

Never silently resume with a version mismatch. A stale plan doc read by a newer
skill is the exact failure class the workspace contract exists to prevent.

## Breaking changes (bump major)

- State schema changes (new required fields, renamed fields)
- Workspace layout changes (directories renamed/moved)
- Skill name changes (old agents reference dead skills)
- Agent dispatch model changes (crew member behavior changes)

## Non-breaking changes (bump minor/patch)

- New optional fields in the mission state
- New reference files
- Description trimming (same retrieval vocabulary)
- Body rewrites within same contract
