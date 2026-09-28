# Host capabilities ride alongside the crew, outside the repo

You open a session and the assistant answers in fragments, builds the smallest change, or renders a dense report as short bullets and tables.
None of those habits ship with this repo.
They come from capabilities in the host setup, and this page maps each one to its work.

Each has two names. The **repo name** is what mugiwara's own docs and skills use, because it says the job.
The **native name** in brackets is what the capability calls itself on a host that carries it, so you can match a surprising reply to its source.
Crew roles live in [skills](skills.md); the four habits below live on the host.

Example: a reply arrives stripped to fragments with technical terms intact.
That voice comes from terse-output, not from any crew playbook.

## terse-output  [native: anti-stuff]

Job: terse, dense writing that saves attention and tokens while keeping technical substance exact.
Code, error strings, and API names stay verbatim; filler, pleasantries, and hedging go.
Trigger: attention or tokens matter, or anyone in session asks for brief output.
Never: never announces its own style, never pastes a normal answer plus a terse recap, and never compresses code, commits, security warnings, or irreversible confirmations.

## minimal-diff  [native: just-enough]

Job: minimal-code ladder, YAGNI-first building; the smallest change that works, reusing what exists before adding anything new.
Trigger: writing or changing code where a minimal diff could suffice.
Never: never adds speculative abstractions, never scaffolds for later, and never adds a dependency when existing helpers cover the need.

## waste-guard  [native: anti-slop]

Job: waste detection and intervention; spots repeated, filler, or drifting work and stops it early with a smaller next step.
Trigger: output repeats itself, fills space without adding signal, or drifts from the stated task.
Never: never lets filler pass silently, never restates the same point twice, and never expands scope to look busy.

Not to be confused with the UI slop guard in the [frontend skill](skills.md), which is about generic card grids and template-shaped layouts — a different meaning of the same word, which is why this page uses waste-guard.

## scan-format  [native: have-adhd]

Job: scannable rendering; short bullets, tables, and evidence links up front, detail behind.
Trigger: a report, verdict, or flow result must be skimmed fast while staying checkable.
Never: never buries the verdict, never drops evidence links for readability, and never trades checkable detail for decoration.

Availability note: these capabilities come from the host setup and vary by host — some hosts carry all four, some carry fewer.
The crew never depends on one being present: every output shape mugiwara requires is defined in its own skills.
When a reply surprises you, match it to a section above before blaming the crew.
