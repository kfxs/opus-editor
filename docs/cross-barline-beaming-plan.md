# Cross-barline beaming — how it is built

Shipped: `f420d70` (the grouping), `79f622b` (the joined beam), and `d4a13bd` (the cross-*system*
half-beam — a join straddling a system break, drawn as one fragment per line).

**The rule — what the mark does — is in `docs/beaming.md`, "Through the barline" and "Through a system
break too".** This file is the rendering: what a join costs the bars it crosses, how a group that
straddles a system break is drawn in independent per-line fragments, and the things that fail silently
if it is done any other way.

## The obstacle

A beam is not drawn *on top of* finished notes the way a tie or a slur is. It changes how the notes
themselves draw: VexFlow drops a note's flag **and its stem** only when the note already has a beam at
draw time (`shouldDrawFlag()` is `hasStem && hasFlag && this.beam === undefined && !isRest`; `draw()`
gates the stem on `!this.beam`), and the beam draws the stems itself. But a `Beam` cannot be built
until every note in it is formatted and on a stave — and bar N is drawn before bar N+1 has been built
at all.

So the job splits by what each half can know.

## In the bar, before `formatter.format`

`applyCrossBarPlaceholders` gives each joined note the group's shared stem direction and a
**placeholder** beam, so it formats and draws with no flag and no stem. Both facts come from the
model, so bar N settles them without bar N+1's geometry existing.

Order is load-bearing twice, and both are silent if reversed:

- **`setStemDirection` clears `note.beam`** (VexFlow's `StemmableNote`), so the direction goes on
  first and the placeholder second.
- **Before `format`**, because `preFormat` reserves a glyph-width for a flagged stem-up note, and a
  beamed note must not pay for a flag it will not draw.

**The placeholder cannot be a `Beam`.** Its constructor throws on fewer than two notes, and `♪ | ♪` —
one note each side of the barline — is the canonical case. It is `{ postFormat: () => {} }`:
existence is all VexFlow tests, and `postFormat` is the one method ever called on it (forwarded by
`StemmableNote.postFormat` during formatting).

## After every measure, beside `renderTies`

`drawCrossBarBeams` draws each join **outside every measure group** — it belongs to no bar, exactly as
a tie does — iterating not the join but its **sides** (see the split, below). A same-line join is one
side; a join across a break is two or three.

**Here, and not in a bar's own render.** `clearForRender` tears down every top-level SVG child each
render while measure groups are **reused**, so a beam rebuilt only when its bars are re-engraved would
vanish on any pass that reuses them — an edit ten bars away, a scroll, a staff-spacing drag — leaving
both bars' notes standing flagless *and* stemless. `replaySnapshot` repopulates `staveNoteMap` for a
reused measure, so this pass can rebuild a beam over bars nobody redrew.

### Two drawing cases per side

A side draws iff **all of its own bars are painted** (`side.drawable`, proven at draw time by every
member resolving to a `StaveNote`); an undrawn side simply skips itself.

- **Two or more notes** — the ordinary case. Build the real `Beam` over the side's `StaveNote`s and
  draw it: slope, stem extension, stem drawing and secondary breaks all stay VexFlow's. If the side is
  **open at a system break**, add one half-beam *overhang* quad per crossing beam level at the open
  end — replaying `drawBeamLines`' own public arithmetic (`getBeamYToDraw`, step `beamWidth ×
  stemDirection × 1.5`, `getSlopeY` for the slope) with the line's `end` a fixed stub instead of the
  next notehead, starting at `getStemX() − Stem.WIDTH / 2` (the x VexFlow itself ends a line at).
- **Exactly one note** — `♪ | ♪`, which `new Beam()` throws on (fewer than two notes). The placeholder
  already suppressed the flag and the stem, so this side draws the note's **own** `Stem`
  (`adjustHeightForBeam` + `drawWithStyle`), flat at its natural tip, plus a flat stub of the note's
  own beam count pointing at the break.

⚠️ **The stem is always VexFlow's `Stem`, never a hand-drawn line.** The selection highlight resolves a
beamed note's stem *by identity* through the `Stem` object's SVG group (a beamed stem is drawn inside
the beam's group, not the note's), so a hand-drawn stem would leave the note highlighting with a hole in
it.

### What stays whole-group, and the two stub ends

Two facts a side alone cannot know are settled once for the group and handed to every side: its **one
stem direction**, and the **crossing beam count** at each split point (the lines common to both sides —
`min` of the two boundary notes' counts, or 1 if a secondary break cuts it). `secondaryBreaks` are
group-local and re-based per side. The stub is **not** a run to the system edge (that reads as a long
empty beam), but the two ends differ. The **start-of-line** end is a short fixed length past the first
note's stem (`…LINE_START`). The **end-of-line** end has to **cross the closing barline into the
margin**, and how far that is depends on where justification puts the last note — so it is **computed to
the barline** (`measureBounds` → `measureX + measureWidth`) plus a margin overshoot, not a fixed length;
a fixed stub is only the fallback when that measure's bounds are unknown. A fixed end-length was the
first cut and stopped short of a justified barline (reported, screenshot).

Two known limitations, shipped as such. A **lone side draws its own note's beam count**, all pointing at
the break (its higher beams have nowhere on their own side to go) — an engraving call worth confirming,
since Gould points a fractional beam back at the notes it belongs with. And a **multi-note side can wear
a wrong-way partial stub** VexFlow draws for its edge note, which `setPartialBeamSideAt` cannot suppress
for an edge note; the escape (drawing the open level ourselves and killing VexFlow's partial pass) costs
the primary beam its geometry and is not worth it.

## The split, and the planning runs twice (`CrossBarBeams.ts`)

A run of bars used to be walled at the **system break**; it is not any more. A group *can* cross a
break — that is the half-beam — so the run walk **stays open across it and the planner is drawn-blind
there**: the stem direction and crossing count are whole-group facts side A needs whether or not the
next system is on screen. `computeSides` then partitions each crossing group into one side per line.
What *is* still a wall is a bar **tier 2 is not painting** — but only **within a line**, because a real
`Beam` needs both bars' `StaveNote`s and a placeholder that never gets its beam is the flagless-stemless
note again. Across a break the same undrawn bar is harmless: it is just an undrawn side that skips
itself.

That within-line wall is why there are two passes. The first is **drawn-blind** (`() => true`), so it
sees every join and every side regardless of culling; `spanAnchors` then pins each side's bars — against
translation, *and*, **per side**, to force a side's bars drawn together when it crosses the window. The
two sides of a split are **independent and not cross-pinned**, so seeing one system never forces the
other's bar to be painted for nothing (docs `cross-system-beam-fragments` P4). The second pass re-plans
against the resulting draw decision. Within a line the two passes agree by construction; the forcing is
what makes that a fact, and the split keeps it safe when it isn't (the `drawFilter` test seam).

Because the join a drawn-blind planner produces does not depend on the cull window, a joined bar's
**shape-key descriptor is scroll-stable** — the property the two-pass plan below rests on.

⚠️ One cost to keep an eye on: a run is no longer line-bounded, so on a fully-drawn score it is the
whole staff, and `planCrossBarBeams` takes `voices` as the union over the entire staff and sorts each
bar's lane once per voice in it. Likely noise, but it is a per-render function in a codebase that counts
renders — measure with `renderCensus` if it shows, and the fix is a cheap pre-pass that cuts the run at
any barline no group could cross (neither edge slot marked `continue`).

The in-bar groups come from the **same run walk**, not from a per-bar call: a `continue` on the first
note of bar N+1 is an *orphan* when that bar is read alone — it starts a forced group that runs to the
end of the bar — and a *join* when it is read after bar N.

## What ships with it, and why not after

Snapshot reuse is unconditional, so both of these are correctness, not polish.

- **The shape key** gains `crossBarBeams`: *which of my slots draw flagless, at which stem direction*.
  It is the one place a bar's picture is decided by its **neighbour's** content, and `laneFingerprint`
  hashes only its own slots. The descriptor, not the neighbour's fingerprint — the beam itself is
  drawn outside every measure group and rebuilt from scratch each render, so its geometry never needs
  a key; only what it leaves *inside* the bar's `<g>` does.
- **`getBeamRole`** reads the whole lane (`beamRoleAtRef`), or the joined note reports the `end` its
  own bar would call it.

**The width key is untouched, and that was verified rather than assumed:** `MeasureLayout` measures a
bar with **no beams built at all**, so flag suppression never reached it, and the ×1.15 buffer plus
the events × `MIN_NOTE_SPACING` floor swamp a flag's width regardless. `MeasureWidthCache`'s "a
measure's width cannot depend on a neighbour" invariant survives this feature intact — which is
exactly the claim to re-read if a bar ever changes width when its neighbour is edited.

## Known: a joined note draws its modifiers against a stem the beam has not stretched yet

Anything positioned from a note's **stem extents at draw time** — a stem-side articulation, a tuplet
bracket — is placed before the joined `Beam` runs `postFormat`, because that beam is built after both
bars are painted. An in-bar beam has no such gap: it exists during formatting, so `postFormat` has
already run when its notes draw.

Measured (staff space = 10px), as how far `postFormat` moves a stem tip:

| beam group | shift |
|---|---|
| flat, or stepwise | 0–2 px |
| zigzag with a 6th | 25 px |
| zigzag with an octave | 30 px |
| two-octave leap | 31 px |

So it is invisible for ordinary stepwise writing and ~3 staff spaces for a joined group containing a
leap. It needs all three: the group crosses a barline, it leaps, and one of its notes carries a
stem-side mark.

Two ways out if it ever bites. Cheap: capture each member's extents in `drawCrossBarBeams` before
`postFormat` and translate the affected marks by the delta afterwards — geometry of ours, which this
feature has otherwise avoided. Structural: split `drawMeasureContent` into build/format and paint, so
a joined pair can be formatted, beamed and `postFormat`ted before either bar draws. The second is the
real answer and a real refactor.
