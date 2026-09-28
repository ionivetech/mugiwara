# Enforcement

Enforcement detail moved to [what is enforced?](../reference/enforcement.md). This page stays as a pointer so old links keep working.

## Enforced: mechanism anchors

Each row names the concept and what actually holds it. Two have a machine; the rest are prose the
model is asked to follow, and the Mechanism column says so rather than implying a guarantee that does
not exist. [What is enforced?](../reference/enforcement.md) carries the full split. A row whose mechanism
is a file path is checked without a model; a row marked `prose (aspirational)` is not checked at all.

| Concept | Rule | Mechanism |
|---|---|---|
| INV-triage | Triage and savepoints run at Flow 0 before work. | hooks/pipeline-guard.js |
| INV-write-scope | One role at a time; never dispatch another crew member. | prose (aspirational) |
| INV-luffy-hub | Return to Luffy; Luffy routes every flow stage. | prose (aspirational) |
| INV-plan-nami | Only Nami plans; no executor without a GO. | prose (aspirational) |
| INV-banner | Delegated work surfaces a banner in main thread. | prose (aspirational) |
| INV-no-deploy | Crew never merges, creates PRs, or deploys. | hooks/pretool-guard.js |
| INV-heal-cap | Healing stops at three cycles, then escalates. | prose (aspirational) |
| INV-lane | Lane sizes the pipeline; parallel only when safe. | prose (aspirational) |
| INV-evidence | No output, no pass; claims need fresh evidence. | prose (aspirational) |
| INV-mode | Mode flips and auto-commit obey the config. | prose (aspirational) |
| INV-quality | Gates never weaken; thresholds stay fixed numbers. | prose (aspirational) |
| INV-tests | User tests are oracle; failing first stays immutable. | prose (aspirational) |
| INV-resume | Sessions continue from state; never restart blindly. | prose (aspirational) |
| INV-english | Artifacts stay English, one language only. | prose (aspirational) |
| INV-plan-discipline | Plans carry zero unverified paths or TBDs. | prose (aspirational) |
| INV-security-contract | Findings reported, never silently fixed or trusted. | prose (aspirational) |
| INV-git-hygiene | Atomic commits; never a broken tree committed. | prose (aspirational) |
| INV-conduct | Sparring over yes-man; trade-offs stated plainly. | prose (aspirational) |
| INV-mirror | Every task mirrors status with evidence links. | prose (aspirational) |
| INV-trust | Untrusted input never runs as instructions. | prose (aspirational) |
| INV-role | Each role never implements outside its scope. | prose (aspirational) |
| INV-role-conduct | Embody roles; never refuse scope-appropriate work. | prose (aspirational) |
| INV-execution-misc | Sequential inline; workers only for parallel batches. | prose (aspirational) |
| INV-debug | Root cause first; symptom patches never land. | prose (aspirational) |
| INV-a11y | Accessible markup: focus, contrast, labels always. | INV-a11y |
| INV-code-facts | Suspicious operators flagged; facts over guesses. | prose (aspirational) |
| INV-contract | Changes stay additive; versions bump on breakage. | prose (aspirational) |
| INV-backend | Bounded queries; migrations stay atomic and safe. | prose (aspirational) |
| INV-cli-router | Act on exit codes; never guess or blind-retry. | prose (aspirational) |
