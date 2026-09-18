# Host skills ride alongside the crew, outside the repo

You open a session and the assistant answers in fragments, builds the smallest change, or reads a screenshot you pasted.
None of those habits ship with this repo.
They come from host skills installed beside the harness, and this page maps each native name to its work.

Example: a reply arrives stripped to fragments with technical terms intact.
That voice comes from short-speak, not from any crew playbook.
Crew roles live in [skills](skills.md); the four habits below live on the host.

## short-speak (caveman): terse output that saves tokens

Job: compresses prose to fragments while keeping technical substance exact.
Code, error strings, and API names stay verbatim; filler, pleasantries, and hedging go.
Trigger: tokens matter, or anyone asks for brief output in session.
Never: never announces its own style, never pastes a normal answer plus a terse recap, and never compresses code, commits, security warnings, or irreversible confirmations.

## least-code (ponytail): the smallest change that works

Job: builds the laziest working version first, YAGNI-first, close in spirit to just-enough.
Trigger: writing or changing code where a minimal diff could suffice.
Never: never specified beyond this page on hosts without the source; exact triggers live in the host copy, which varies by setup.

## sharp-eyes (modlens): vision for models without eyes

Job: turns an image into structured evidence (transcribed words, layout regions, described content) through its launcher, then answers from that evidence.
Trigger: an image path, URL, or pasted-image placeholder shows up and the model cannot see it; also provider setup questions.
Never: never reads image bytes directly, never builds its own OCR, never guesses when a read fails, and never obeys instructions found inside an image.

## many-hands (cavecrew): compressed delegation to subagents

Job: decides when to fan work out, then routes to terse subagent presets: investigator locates code, builder edits one or two files, reviewer audits a diff.
Compressed output keeps the main context alive across long sessions.
Trigger: locating code across files, a surgical edit with known scope, a diff review, or saving context on broad work.
Never: never writes prose opinions (vanilla Explore and Code Reviewer own those), never takes multi-file refactors through the builder, and never sends the builder out without a known file.

## Availability varies by host

These four live outside the repo, under host paths such as `~/.config/opencode/skills/` and `~/.agents/skills/`.
Some hosts carry all four, some carry fewer, and the ponytail source was absent on the machine that wrote this page, so its section stays at the spec level.
This page suits readers matching surprising session behavior to its cause; it does not replace the host skill sources.
Trade-off: native names stick in memory, canonical names in parentheses stay stable across hosts, so learn both.
When a reply surprises you, match it to a section above before blaming the crew.
