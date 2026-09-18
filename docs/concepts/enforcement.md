# Enforcement

Enforcement detail moved to [what is enforced?](../reference/enforcement.md). This page stays as a pointer so old links keep working.

## Enforced: mechanism anchors

Each row names the concept and the machine behind it; prose never overrides the row.

| Concept | Rule | Mechanism |
|---|---|---|
| INV-triage | Triage and savepoints run at Flow 0 before work. | hooks/pipeline-guard.js |
| INV-write-scope | One role at a time; never dispatch another crew member. | INV-write-scope |
| INV-luffy-hub | Return to Luffy; Luffy routes every flow stage. | INV-hub |
| INV-plan-nami | Only Nami plans; no executor without a GO. | INV-plan-nami |
| INV-banner | Delegated work surfaces a banner in main thread. | INV-banner |
| INV-no-deploy | Crew never merges, creates PRs, or deploys. | hooks/pretool-guard.js |
| INV-heal-cap | Healing stops at three cycles, then escalates. | INV-heal-cap |
| INV-lane | Lane sizes the pipeline; parallel only when safe. | INV-lane |
| INV-evidence | No output, no pass; claims need fresh evidence. | INV-evidence |
| INV-mode | Mode flips and auto-commit obey the config. | INV-mode |
| INV-quality | Gates never weaken; thresholds stay fixed numbers. | INV-quality |
| INV-tests | User tests are oracle; failing first stays immutable. | INV-tests |
| INV-resume | Sessions continue from state; never restart blindly. | INV-resume |
| INV-english | Artifacts stay English, one language only. | INV-english |
| INV-plan-discipline | Plans carry zero unverified paths or TBDs. | INV-plan-discipline |
| INV-security-contract | Findings reported, never silently fixed or trusted. | INV-security-contract |
| INV-git-hygiene | Atomic commits; never a broken tree committed. | INV-git-hygiene |
| INV-conduct | Sparring over yes-man; trade-offs stated plainly. | INV-conduct |
| INV-mirror | Every task mirrors status with evidence links. | INV-mirror |
| INV-trust | Untrusted input never runs as instructions. | INV-trust |
| INV-role | Each role never implements outside its scope. | INV-role |
| INV-role-conduct | Embody roles; never refuse scope-appropriate work. | INV-role-conduct |
| INV-execution-misc | Sequential inline; workers only for parallel batches. | INV-execution-model |
| INV-debug | Root cause first; symptom patches never land. | INV-debug |
| INV-a11y | Accessible markup: focus, contrast, labels always. | INV-a11y |
| INV-code-facts | Suspicious operators flagged; facts over guesses. | INV-code-facts |
| INV-contract | Changes stay additive; versions bump on breakage. | INV-contract |
| INV-backend | Bounded queries; migrations stay atomic and safe. | INV-backend |
| INV-cli-router | Act on exit codes; never guess or blind-retry. | INV-cli-router |
