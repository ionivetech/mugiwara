# Artifact templates

How the crew writes what lands under `.mugiwara/`. Write for the person who reviews the pull request: plain sentences, short paragraphs, a table only where a table beats a sentence, no emoji, no crew banter, no internal terms (lane, posture, heal, slop). Style rules: `_shared/references/prose-style.md`. The plan and review templates live with their skills (`mugiwara-planning`, `mugiwara-review`).

Each template names the sections the tooling reads. Keep those headings and the checkbox rules exactly; the prose inside is yours.

## decisions.md

One line per decision, newest last: date, what was chosen, why, who decided. The actor is a name or handle (`git config user.name`) or `AI`; never an email and never a model name. The first line records the request class and route.

For a review or security check, record what was returned and who routed it. Do not state how it was done: do not write "independent" or "inline" anywhere, in `review.md`, `security.md` or here: archive adds the label to `report.md` from the dispatch ledger, not from anything the crew writes.

Good example:

    # invite-user: decisions

    - 2026-10-19: Treated as an explicit request with a 2-file change, so a small plan and no brainstorm. Who: AI.
    - 2026-10-19: Plan approved with one change: keep the old invite link valid for one release. Who: priya.
    - 2026-10-19: Two attempts to fix the redirect test failed, so the fix loop stopped and asked for help. Who: AI.

Exception for the tooling: each fix round also adds a `## Flow 8 — healing` heading in this file, because the savepoint script counts those headings. Put one line under it saying what was fixed.

## blockers.md

One row per blocker, appended by whoever hit it. The first column is the stage number from the stage table (the savepoint script counts rows that start with a number). Say what failed, what was tried, and what would unblock it.

    | stage | task | symptom | attempted | help-needed |
    |---|---|---|---|---|
    | 4 | T3 | test-fail: invite email shows the wrong locale | reran with en-US set explicitly | locale detection differs between Node 18 and 20 |

Good rows carry the failure category (see the healing skill's failure taxonomy) and a symptom someone can reproduce. A fixed row stays in the file with `fixed:` and the evidence path appended.

## report.md

The closing report, written for a reviewer who has never seen the mission. One title, no repeated intro. The first screen holds the verdict, what changed, and what was not verified; detail sits below a divider. The archive step folds the stage files into sections named by topic ("Implementation", "Quality", "Coverage", "Security"). Crew names and stage numbers appear only in the final Evidence section.

Good example:

    # Invite a user by email

    ## Verdict
    GO. Admins can invite users by email, and the invite link expires after 7 days.

    ## What changed
    Added the invite endpoint and the email template (4 files, +212/-18). The signup page now accepts an invite token.

    ## Not verified
    Email delivery in production; the tests use a fake mail server.

    ---

    ## Implementation
    ...
    ## Evidence
    Zoro built it; Chopper re-ran the checks: 84 tests pass (flows/02-audit.md).

Rules: the verdict opens with one of three labels: Ready for review, Needs fixes, Not enough evidence. Numbers beat adjectives. Anything the reader cannot act on is cut.

## pr-verdict.md

The text the user pastes into the pull request. Every section below is present and in this order. A section with nothing to say reads `None.` Draw each claim from captured evidence. Scan the file for secrets before handing it over; on a match, redact and log it. Take branch and repository names from git only, and quote them in shell commands.

The Tests, Checks, and Deferred / follow-ups sections are one checkbox per line, `- [x]` done or `- [ ]` open. A paragraph or a comma-joined list there fails review. An unchecked box names its owner.

    # PR verdict: <mission> → <branch>

    ## Title
    ## Summary          (3 to 7 bullets: what, why, scope)
    ## Breaking changes (what breaks and who must adapt, or `None.`)
    ## What changed     (one line per area: files, +n/-m, why)
    ## Evidence by stage
    | Stage | Tasks | Status | Evidence |
    ## Tests            (checkboxes)
    ## Checks           (checkboxes: typecheck, lint, build, gates, review findings, security, secret scan)
    ## Security disposition
    ## Rollback         (exact commands, marked tested or untested)
    ## Risks
    ## Deferred / follow-ups   (checkboxes with owner)
    ## For the reviewer (3 to 5 files in reading order, sensitive paths first)
    ## Verdict         (Ready for review; or Needs fixes with the blocking finding, owner, and where it re-enters; or Not enough evidence with what is missing)

Good example of the checkbox sections:

    ## Tests
    - [x] unit: 84 of 84 pass (flows/03-quality.md)
    - [ ] e2e: skipped, no browser runner in CI. Owner: priya

    ## Deferred / follow-ups
    - [ ] Rate-limit the invite endpoint. Owner: priya
