# Auto-PR (auto mode)

At the end of a mission, `mugiwara-pr` pushes the branch and either hands you a
ready PR (guided / semi) or **auto-creates the PR** (auto). This page covers
enabling and configuring the auto-create path.

## How it works

In `auto` mode the terminal step runs the `mugiwara-pr` auto path:

1. **Detect the forge** — `git remote get-url origin` → github.com / gitlab.com /
   bitbucket.org / self-hosted host.
2. **Fill the title** from the `pr-title` config (placeholders `{type}` /
   `{summary}` from mission metadata) and the **body** from the `pr-template`
   file when present, else the verdict-file PR block.
3. **Create the PR** against the `base` config (default `main`):
   - GitHub → `gh pr create --base "$base" --title "$title" --body-file "$body"`
   - GitLab → `glab mr create --target-branch "$base" --title "$title" --description "$(cat "$body")"`
   - Bitbucket → `curl` REST
     `POST /2.0/repositories/{workspace}/{repo}/pullrequests` with `BB_USER` + `BB_TOKEN`.
4. **Report the PR URL.**
5. **Fallback** — missing CLI / token / auth: push + the forge's PR-creation
   URL + the verdict file; the reason is logged.

## Enable

1. Flip to `auto` (the only autonomy lever):

   ```
   mugiwara mode auto
   ```

   or set it in `.mugiwara/config` (project) / `~/.mugiwara/config` (global).

2. Set the writing standards (optional — defaults shown):

   ```
   mode=auto
   branch=feature/{type}-{issue}-{slug}
   commit=conventional
   base=main
   pr-title={type}: {summary}
   pr-template=.mugiwara/pr-template.md
   ```

3. Make sure the forge credentials exist (next section).

## Prerequisites per forge

| Forge | Requirement |
|-------|-------------|
| GitHub | `gh` CLI installed and authenticated (`gh auth login`), **or** `GITHUB_TOKEN` env for the curl REST fallback |
| GitLab | `glab` CLI installed and authenticated (`glab auth login`) |
| Bitbucket | `BB_USER` + `BB_TOKEN` env (App password / PAT) |

`gh`:

```bash
brew install gh        # macOS
gh auth login          # interactive — pick HTTPS, then browser login
```

`glab`:

```bash
brew install glab      # macOS
glab auth login
```

Test before a mission: `gh auth status` (or `glab auth status`) should report a
logged-in host.

## What is NOT covered

Auto-PR creates the PR and then **stops**. In every mode the crew never:

- auto-reacts to review comments,
- auto-heals CI failures after the PR is up,
- merges, or deploys.

Reviewing the PR stays your job — the crew's evidence lands in the PR body.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `gh: command not found` / spawn error | install `gh`, run `gh auth login`, re-run the mission terminal |
| `gh auth status` shows not logged in | `gh auth login` before the terminal step |
| Push fails (no auth / no remote) | the crew falls back to the local closure report and logs the reason — no PR is created |
| PR lands without the body | `pr-template` path unreadable or absent → the verdict-file PR block is used instead |

See [`mugiwara-mode`](../content/skills/mugiwara-mode/SKILL.md) for the mode
contract and [`mugiwara-pr`](../content/skills/mugiwara-pr/SKILL.md) for the
terminal procedure.
