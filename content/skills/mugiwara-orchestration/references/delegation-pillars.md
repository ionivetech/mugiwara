# Delegation Pillars

Size the mission against five pillars. The highest gate determines the route.

## Pillar 1: Size

| Files | Delegation |
|-------|-----------|
| 1 file <20 LOC | Zoro directly |
| 2-8 files | Nami planning → Zoro |
| 9+ files | Full pipeline (Usopp or Nami depending on clarity) |

## Pillar 2: Clarity

| Signal | Delegation |
|--------|-----------|
| Spec explicit, acceptance criteria written | Skip Usopp → Nami |
| Vague, ambiguous, "maybe" | Usopp first |

## Pillar 3: Risk

| Signal | Delegation |
|--------|-----------|
| auth/payment/migration/deploy/public API | Full pipeline, never shortcut |
| Internal refactor, test-only, docs | Standard pipeline OK |

## Pillar 4: Mode

| Mode | Behavior |
|------|----------|
| `guided` | Ask user before Zoro or Brook executes. "Approve plan?" / "Fix these findings?" |
| `semi` | Auto-go unless high-risk (pillar 3) |
| `auto` | Auto-go unless high-risk AND blocking ambiguity |

## Pillar 5: Healing vs execution

| Finding type | Delegation |
|-------------|-----------|
| Test fail, lint, typo, format | Zoro (normal execution) |
| Root cause, architecture, 3+ files, regression | Brook (healing pipeline) |
