# Prose Style — how mugiwara writes

Applies to every sentence a human reads in the output: mission reports,
review findings prose, PR descriptions, closure summaries, code comments.
Findings keep their one-line format; this governs everything around them.

## Openings

- Start with the substance — the verdict, the number, the file. Never with a
  warm-up.
- Banned openers: "It's worth noting", "It should be noted", "It's important
  to remember", "First of all", "In this report".
- No meta-commentary: never describe the writing ("This section will cover…")
  — just cover it.

## Words

- Cut hedges and intensifiers: very, quite, fairly, somewhat, rather,
  extremely. The evidence carries the weight, not the adverb.
- Prefer the plain verb: use over utilize/leverage, help over facilitate,
  start over commence, show over demonstrate.
- No inflation adjectives: robust, seamless, comprehensive, powerful,
  cutting-edge, state-of-the-art. If a thing is robust, say what it survives.
- Concrete over abstract: "3 tests fail on empty cart" beats "several issues
  affect checkout stability".

## Sentences

- Active voice by default. Name the actor: "Zoro added pagination" not
  "pagination was added".
- One idea per sentence. Vary length deliberately; never settle into
  uniform staccato or uniform sprawl.
- No rhetorical setup-then-answer ("So what does this mean? It means…").
  Ask nothing you then answer yourself.

## Structure

- Verdict first, evidence after, reasoning last. A reader who stops early
  still has the conclusion.
- No binary-contrast crutch: "not just X but Y", "it's not about X, it's
  about Y". State X and Y plainly if both matter.
- Lists carry items, not introductions. No "The following are some reasons
  why:" before a list that explains itself.
- No dramatic fragmentation for effect. Fragments are for pace where the
  reader already has context, not for emphasis theater.

## Honesty

- Severity words follow the rubric only — "critical" means critical, never
  emphasis. No marketing language in reports: a fix is merged, not shipped
  with confidence.
- Numbers beat adjectives everywhere both exist.
- Before sending user-facing prose: delete every sentence that survives its
  own removal. If nothing changes meaning, it was filler.
