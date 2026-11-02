# Delegation pillars

Size the mission against five pillars. The highest gate sets the route. Lane contents and mode meanings are in the stage table (stages.md); this file only lists the questions.

## 1. Size

| Files | Route |
|-------|-------|
| 1 file under 20 lines | Zoro directly |
| 2-8 files | Nami plans, then Zoro |
| 9+ files | Full pipeline (Usopp first if the request is unclear, else Nami) |

## 2. Clarity

| Signal | Route |
|--------|-------|
| Explicit spec with acceptance criteria | Skip Usopp, go to Nami |
| Vague, ambiguous, "maybe" | Usopp first |

## 3. Risk

| Signal | Route |
|--------|-------|
| auth, payment, migration, deploy, public API | Full pipeline, no shortcut |
| Internal refactor, test-only, docs | Standard pipeline is enough |

## 4. Mode

Read the mode from config and apply its definition from the stage table. High-risk work (pillar 3) gets a stop for the user in `guided` and `semi`.

## 5. Fix versus build

| Finding type | Route |
|-------------|-------|
| Test failure, lint, typo, format | Zoro (normal build) |
| Root cause unclear, architecture, regression, 3+ files | Brook |
