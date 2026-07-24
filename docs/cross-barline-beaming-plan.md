# Cross-barline beaming — how it is built

Shipped: `f420d70` (the grouping) and `79f622b` (the joined beam).

**The rule — what the mark does and where it stops — is in `docs/beaming.md`, "Through the barline".**
This file is the rendering: what a join costs the bars it crosses, and the four things that fail
silently if it is done any other way.

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

`drawCrossBarBeams` builds the one real `Beam` over both bars' `StaveNote`s, resolved from
`staveNoteMap`, and draws it **outside either measure group**. It belongs to neither, exactly as a tie
does.

**Here, and not in the second bar's own render.** `clearForRender` tears down every top-level SVG
child each render while measure groups are **reused**, so a beam rebuilt only when its bars are
re-engraved would vanish on any pass that reuses them — an edit ten bars away, a scroll, a
staff-spacing drag — leaving both bars' notes standing flagless *and* stemless. `replaySnapshot`
repopulates `staveNoteMap` for a reused measure, so this pass can rebuild a beam over bars nobody
redrew.

Slope, stem extension, stem drawing and secondary breaks all stay VexFlow's. We contribute the
grouping and the draw order, no geometry.

## The planning runs twice (`CrossBarBeams.ts`)

A run of bars is bounded by anything a beam cannot cross: the **system break** (one `Beam` cannot span
two lines) and any bar **tier 2 is not painting** (no `StaveNote`s to beam to, and a placeholder that
never gets its beam is the flagless-stemless note again).

That second wall is why there are two passes. The first decides which barlines are open, so
`spanAnchors` can pin both bars of each join — against translation, *and* to force both to be drawn
when the join crosses the window. The second re-plans against the resulting draw decision. Under
culling the two agree by construction; the forcing is what makes that a fact rather than an
assumption, and the split is what keeps it safe when it isn't (the `drawFilter` test seam).

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
