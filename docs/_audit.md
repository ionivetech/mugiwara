# Docs audit — working file, deleted at phase end (T7)

Measured 2026-09-09. Drift vs roadmap: 52 files / 35,464 words under `docs/`
(roadmap cites 62 files / 38,537 words at write time).

| File | Words | Reader question it answers | Verdict |
|---|---|---|---|
| `concepts/features.md` | 4367 | "what can it do?" | **split** — index 900 + link to concepts |
| `concepts/cost.md` | 4085 | "what does it cost?" | **cut to 800** |
| `concepts/config.md` | 1738 | "what can I set?" | **cut to 600**, reference table only |
| `getting-started.md` | 1379 | "how do I start?" | **cut to 800** |
| `reference/harness-matrix.md` | 1364 | "which harness supports what?" | **cut to 700** |
| `concepts/audit-trail.md` | 1207 | "what is recorded?" | **cut to 700** |
| `concepts/workflow.md` | 1199 | "how does a mission run?" | **cut to 700**, absorbs execution-model |
| `concepts/modes.md` | 1045 | "guided, semi, or auto?" | **cut to 600** |
| `concepts/execution-model.md` | 993 | "how does execution work?" | **merge into workflow** |
| `concepts/enforcement.md` | 980 | "what is enforced?" | **merge into reference/enforcement** |
| `troubleshooting.md` | 892 | "something broke, what now?" | **merge into runbooks/troubleshooting** |
| `concepts/lanes.md` | 877 | "which lane for my change?" | **cut to 600** |
| `reference/enforcement.md` | 821 | "what is enforced?" | **cut to 700**, absorbs concepts/enforcement |
| `reference/compliance-matrix.md` | 808 | "what is proven?" | **keep** |
| `concepts/policy-as-code.md` | 692 | "how is policy coded?" | **cut to 600** |
| `reference/glossary.md` | 630 | "what does this word mean?" | **cut to 450** |
| `concepts/closure-tools.md` | 630 | "how do I close a mission?" | **cut to 450** |
| `install/cli.md` | 610 | "how do I install the CLI?" | **cut to 500** |
| `evals.md` | 607 | "how is it evaluated?" | **cut to 500** |
| `concepts/security.md` | 581 | "is it safe?" | **cut to 500** |
| `install/opencode.md` | 561 | "how do I use it with opencode?" | **cut to 400** |
| `reference/developer-onboarding.md` | 546 | "how do I onboard a developer?" | **cut to 400** |
| `cost-governor.md` | 506 | "how is cost governed?" | **cut to 400** |
| `reference/adoption-guide.md` | 490 | "how do I adopt it?" | **cut to 400** |
| `concepts/agents.md` | 454 | "who does what?" | **cut to 400** |
| `concepts/git-strategy.md` | 447 | "how are branches handled?" | **cut to 400** |
| `adoption.md` | 439 | "should my team adopt it?" | **cut to 300** |
| `runbooks/team-mission.md` | 421 | "how do I run a team mission?" | **reshape to 450**, skeleton fix |
| `concepts/comparison.md` | 402 | "how does it compare?" | **merge into features** |
| `concepts/skills.md` | 390 | "what skills exist?" | **cut to 350** |
| `reference/agent-anatomy.md` | 383 | "what is an agent made of?" | **cut to 300** |
| `runbooks/troubleshooting.md` | 383 | "something broke mid-mission, what now?" | **reshape to 600**, absorbs root troubleshooting |
| `runbooks/resume-after-crash.md` | 371 | "crashed, how do I resume?" | **reshape to 400**, skeleton fix |
| `concepts/permissions.md` | 371 | "what may each role touch?" | **cut to 300** |
| `concepts/provenance.md` | 337 | "where did this come from?" | **cut to 300** |
| `runbooks/solo-mission.md` | 311 | "how do I run a solo mission?" | **reshape to 350**, skeleton fix |
| `runbooks/signing-and-attestation.md` | 296 | "how are reports signed?" | **reshape to 300**, skeleton fix |
| `runbooks/policy-for-a-team.md` | 289 | "how does a team set policy?" | **reshape to 300**, skeleton fix |
| `runbooks/joining-a-mission.md` | 288 | "how do I join a mission?" | **reshape to 300**, skeleton fix |
| `install/claude.md` | 280 | "how do I use it with claude?" | **cut to 200** |
| `runbooks/monorepo.md` | 263 | "how does it work in a monorepo?" | **reshape to 300**, skeleton fix |
| `install/index.md` | 177 | "how do I install it?" | **cut to 700**, absorbs six stubs below |
| `concepts/lessons.md` | 174 | "what did past missions learn?" | **keep** |
| `index.md` | 117 | "where am I?" | **keep** |
| `install/codex.md` | 96 | "how do I install on codex?" | **merge into install/index** |
| `install/gemini.md` | 95 | "how do I install on gemini?" | **merge into install/index** |
| `install/copilot.md` | 93 | "how do I install on copilot?" | **merge into install/index** |
| `install/antigravity.md` | 91 | "how do I install on antigravity?" | **merge into install/index** |
| `install/pi.md` | 91 | "how do I install on pi?" | **merge into install/index** |
| `install/cursor.md` | 70 | "how do I install on cursor?" | **merge into install/index** |
| `install/kimi.md` | 77 | "how do I install on kimi?" | **merge into install/index** |
| `CONTRIBUTING-DOCS.md` | 150 | "what rules govern docs?" | **keep** (new, Phase 1) |

Projected total: about 17,700 words — under 18,000 before any rewriting begins.
Merges: execution-model into workflow; concepts/enforcement into
reference/enforcement; root troubleshooting into runbooks/troubleshooting;
comparison into features; six install stubs into install/index.
