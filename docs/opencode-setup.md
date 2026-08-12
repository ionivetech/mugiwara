# opencode Setup

opencode is a fully supported target — native skills + agents via the opencode
plugin.

## Install via the plugin

Add to `opencode.json`:

```json
{ "plugin": ["@ionivetech/mugiwara"] }
```

Or from the git repo directly:

```json
{ "plugin": ["mugiwara@git+https://github.com/ionivetech/mugiwara.git"] }
```

## Install via CLI

```bash
# global install
npx @ionivetech/mugiwara@latest --global --target opencode --yes

# project install
npx @ionivetech/mugiwara@latest --project ./my-app --target opencode --yes
```

**Update** — bump the package version in the `plugin` array (or `mugiwara update`).

**Uninstall** — remove the entry from the array.

## What you get

- 32 skills in `.opencode/skills/` (project) or `~/.config/opencode/skills/`
  (global).
- 14 agents registered as subagents via the plugin.
- The plugin announces the crew at session start and injects the inline
  execution model into the system prompt.

## Use it

The workflow **auto-activates** — at session start the crew is announced, and a
non-trivial request runs the pipeline by itself. `/using-mugiwara` is an
optional explicit router if you want to hand-route a mission:

```
> add dark mode to the settings page
```

Restart opencode after installing — config is loaded once at startup. The crew
runs inline in your main conversation; subagents only for `[PARALLEL]` batches
and background checks. You never need to click into a subagent to see progress.
