# Solo or team — Flow 0 decision

Decide before the first savepoint. That write fixes the state layout for the
whole mission and cannot be changed afterwards without a migration.

**In `guided` and `semi`: always ask. This question is never skipped, at any
lane.** It costs one line and it determines the shape of everything after it.

    Is this mission solo or shared?
    If shared: who is on it, and which area does each person own?

Collect the answer as a roster — **name plus area**, one line per person:

    jane-doe — api
    john-smith — frontend
    eleanor-vance — shared types

The area matters as much as the name. Nami derives each sub-mission's
`Touched Files` from the area map at Flow 2, so an accurate area now means
conflict detection works later.

**In `auto`: never ask.** Derive it — member files already in
`.mugiwara/missions/<mission>/` means team; none means solo. Log what was
derived and why.

Record the roster in `.mugiwara/missions/<mission>/decisions.md` before the
first savepoint:

    | # | Decision | By | Why |
    |---|----------|----|-----|
    | 1 | Team mission: jane-doe (api), john-smith (frontend), eleanor-vance (shared types) | user | Flow 0 roster |

| Verdict | First savepoint | State layout |
|---|---|---|
| Solo | `mugiwara savepoint <mission> --flow 0` | `state.json` |
| Team | `mugiwara savepoint <mission> <member> --flow 0` per person | `<member>.json` |

**Never switch layout mid-mission.** If a solo mission turns out to be shared,
stop and run `mugiwara migrate --to-team <member>`. Writing a second layout
beside the first orphans one of them.

**The roster lives in exactly one place: the sub-mission table Nami writes at
Flow 2.** Do not create a separate roster file. Two sources of member names is
the defect this section exists to remove.

For team, also record the roster size in the decision log — Nami reads it
at Flow 2 to set execution posture, and a roster larger than one is the only
input that can select the `team-scoped` posture.
