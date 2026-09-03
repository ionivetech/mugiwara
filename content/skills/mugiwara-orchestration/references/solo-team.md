# Solo or team — Flow 0 decision

Decide before the first savepoint — this write fixes the state layout for the whole mission.

- **Lane 0/1** — always solo. Never ask.
- **Lane 2+ in `guided`/`semi`** — ask once, in the same question round as any other Flow 0 ambiguity: *"Is this solo or shared? If shared, who is on it?"*
- **`auto`** — never ask. Derive: member files already in .mugiwara/missions/<mission>/ -> team; none -> solo.

Record the verdict and the member list in the decision log.

| Verdict | First savepoint | Follows |
|---|---|---|
| Solo | `mugiwara savepoint <m> --flow 0` | `state.json` |
| Team | `mugiwara savepoint <m> <member> --flow 0` per member | `<member>.json` |

For team, also record `team_members: <n>` in the decision log — Nami reads it at Flow 2 to set execution posture, and it is the only input that can select the `team-scoped` posture.

**Never switch layout mid-mission.** If the mission turns out to be shared after Flow 0, stop, run `mugiwara migrate --to-team <member>`, and say so — do not write a second layout alongside the first.
