---
description: Run the mugiwara crew workflow or switch runtime mode (guided | semi | auto)
---
Mugiwara mode: $ARGUMENTS

Run the crew pipeline inline. To switch autonomy mode:

```
/mugiwara guided    # human decides every GO
/mugiwara semi      # auto branch + commit, plan needs GO
/mugiwara auto      # hands-off except high-risk
/mugiwara           # show current mode
```

The flip applies from the next wave, never mid-wave. If a flip arrives
mid-wave, acknowledge it — "recorded, applies from Wave N+1" — never apply
silently, never ignore. Valid modes: guided, semi, auto.

For workflow: `mugiwara-orchestration` auto-loads as gatekeeper — classify, route, check-in, close. See skills/mugiwara-workflow for the full pipeline. `mugiwara off` for a request stands the crew down.
