# Cross-barline beaming — plan

Beams that run through a barline. Common in modern music, and today impossible: beam groups are
computed one bar at a time, so a barline is a wall nothing crosses.

```
 bar 1                    | bar 2
   ♪  ♪  ♪  ♪ ═════════════════ ♪  ♪
                the beam runs through the barline
```

## The gesture: `continue` at the boundary

**No new field, no new button.** `continue` already means *this note has a beam coming in and a beam
going out* — it bridges exactly one boundary, from either side (`docs/beaming.md`). A barline is the
strongest boundary in the bar, but it is still a boundary: mark the note on either side of it
`continue` and the beam carries through.

Two reasons this is the right shape and not just the cheap one:

- The mark says the same thing wherever it sits. A second field ("beam across barline") would be the
  same statement written twice, and the two could then disagree.
- `docs/DESIGN-PRINCIPLES.md` keeps the measures spine **removable**. A feature that needs a special
  field for "the boundary that happens to be a barline" is a feature that has baked bars in.

**Either side, because `continue` is symmetric.** The last note of bar N marked `continue` has a beam
going out; the first note of bar N+1 marked `continue` has one coming in — across a barline there is
nowhere else it could come from. Reading only the left-hand note would reintroduce exactly the
where-does-it-sit dependence that the 2026-07-24 fix removed.

**An unclosed `begin` does not cross.** It is a statement about *this* bar, and unbounded — a `begin`
nobody closed would run to the end of the score. `begin` … `continue`(at the barline) … `end` is how
a manual group spans two bars, and it reads correctly.

Chaining falls out: `continue` at two successive barlines runs the beam through both. The default
never joins — only an explicit mark opens a barline.

## P0 — the grouping, pure

`computeBeamGroups` today takes one bar's slots and one `MeterInfo`. Add a cross-bar entry point:

```ts
computeCrossBarBeamGroups(
  bars: { slots: ChordRest[]; meter: MeterInfo }[],
): { bar: number; slot: number }[][]
```

**A meter per bar**, because a run of bars may contain a time-signature change. **One lane per call**
— one voice of one staff, sorted by beat — the same slice `beamRoleAt` already insists on, or a
voice-2 note is scored against voice 1's grouping.

The bar boundary is an **unconditional break** unless the last slot of bar N *or* the first slot of
bar N+1 carries `continue` — the metric grouping must never join bars by accident, because beat 0 of
bar N+1 has the same beat-group index as beat 0 of bar N. When the mark is there, the boundary
behaves exactly like the existing `bridgeNext`: it joins across, and normal grouping resumes from the
next note's own beat group, so one mark opens one barline.

Rests, non-beamable durations and the min-2 rule all still apply unchanged — a bar ending in a rest
or a quarter has nothing to join with, whatever is marked.

Tests, no visual change.

## P1 — the joined beam

### The one real obstacle

A beam is not drawn *on top of* finished notes the way a tie or slur is. It changes how the notes
themselves draw: VexFlow drops a note's flag **and its stem** only when the note already has a beam
at draw time (`shouldDrawFlag()` is `hasStem && hasFlag && this.beam === undefined && !isRest`;
`draw()` gates the stem on `!this.beam`). But a `Beam` cannot be built until every note in it is
formatted and on a stave — and bar N is drawn before bar N+1 has been built at all.

### The way through: suppress in the bar, join in the post-measure pass

Split the job by what each half needs to know.

1. **Inside `renderMeasure`, before `formatter.format`** — the notes that join across a barline get a
   **placeholder** beam, so they format and draw with no flag and no stem, and they get the union's
   shared stem direction (`calculateBeamGroupStemDirection` over both bars' slots, not per bar).
   Both facts come from the **model**, so bar N can settle them without bar N+1's geometry existing.
   Before format, not after: `preFormat` adds a glyph-width for a flagged stem-up note, and a beamed
   note must not reserve it.
2. **After every measure is drawn**, beside `renderTies`, build the real `Beam` over the union of both
   bars' `StaveNote`s — resolved from `pass.staveNoteMap` — and draw it there, **outside** either
   bar's `<g>`. It belongs to neither, exactly as ties and slurs do. Its constructor re-points every
   note at itself, replacing the placeholder.

**Why the post-measure pass and not bar N+1's own render.** `clearForRender` tears down every
top-level SVG child each render and keeps only the reused measure groups. A beam drawn at top level
but rebuilt only when bar N+1 re-engraves would therefore vanish on any pass where both bars are
reused — an edit ten bars away, a scroll, a staff-spacing drag — leaving both bars' notes standing
flagless *and* stemless. `replaySnapshot` repopulates `staveNoteMap` for reused measures, so the
post-pass can rebuild the beam from bars that were never redrawn. That is precisely how a tie
survives the same passes.

Two implementation notes for step 2: chord slots are keyed in `staveNoteMap` by
`slot.notes[0].id` (only rests are keyed by slot id), and `secondaryBreakIndices` is fed the union's
slots, so a subdivision inside a joined group needs nothing new.

**The placeholder cannot always be a `Beam`.** `new Beam()` throws on a single note, and `♪ | ♪` — one
note each side — is the canonical case. Use a stub (`Object.create(Beam.prototype)` assigned through
`setBeam`); it exists only to make `beam !== undefined`, is never drawn, and is replaced in step 2.

Slope, stem extension, stem drawing and secondary breaks all stay VexFlow's. We contribute the
grouping and the draw order, no geometry.

### The three things that ship *with* it, not after it

Snapshot reuse is unconditional, so none of these is a follow-up — without them P1 is wrong on the
first edit.

- **The shape key.** Bar N's group now holds flagless notes at a stem direction its neighbour helped
  decide, so bar N's picture depends on bar N+1. What goes in `measureShapeKey` is *not* the
  neighbour's fingerprint but the small derived descriptor — *which of my slots are joined, and at
  which stem direction* — for both bars. The beam's own geometry needs no key at all: it is rebuilt
  every render. (`docs/ARCHITECTURE.md`, "Adding a new engraved element".)
- **The span anchors.** Register each join in **both** halves of `spanAnchors`: `measures`, so neither
  bar is ever translated with stale coordinates, and `list`, so `forcedSpanGroups` drags the partner
  in whenever the join intersects the window. The second one is what makes "the partner is drawn this
  pass" true by construction instead of a condition to test.
- **The role.** `ScoreModel.getBeamRole` builds its run from one measure's slots, so a joined last
  note would still report `end` while it is engraved `continue`. It has to ask the cross-bar run —
  the palette's slate half is the only feedback this feature has.

## P2 — the doc

A section in `docs/beaming.md`; this file then describes only what was built.

## Where it stops

If the pair straddles a **system break**, the two notes are on different lines and one `Beam` cannot
span them. They draw as two ordinary groups — no placeholder is set, so the flags come back — and the
mark is kept, it simply has nothing to join today. Real engraving hangs a half-beam over the barline
at the end of the line; that needs partial beams drawn by hand and is a separate job, not part of
this.

The palette still reads `continue` there: the role is a fact about the **score**, the break is a fact
about the **layout**, and `ScoreModel` does not know where the lines fall. Intent and engraving
disagreeing is the row working, not a bug.

## Traps (each one fails silently)

- **The placeholder must never outlive the pass.** A note left holding a placeholder that is never
  replaced draws with no flag *and no stem*. Step 2 always runs, for reused and redrawn bars alike;
  the only case that must skip step 1 is the system break, and that is knowable before the draw loop
  (`plans`/`isFirstInLine` are computed up front).
- **The stem direction is per bar today.** `buildBeams` takes `forcedStem` from *that bar's*
  `multiVoice`, so a two-voice bar joining a one-voice bar resolves the two halves differently. The
  union needs one answer, applied in both bars' renders.
- **The width key is not affected — verify it stays that way.** `MeasureLayout` measures a bar with no
  beams built at all, so flag suppression never reached it, and the ×1.15 buffer plus the
  events×`MIN_NOTE_SPACING` floor swamp a flag's width regardless. `MeasureWidthCache`'s "a measure's
  width cannot depend on a neighbour" invariant survives this feature intact — which is exactly the
  claim to re-read if a bar ever changes width when its neighbour is edited.
- **`getMeasureNotes` does not project `beam`** (`docs/beaming.md`). Read the mark off the slot or the
  engine's projection, never from there.
- **`registerBeams` keys a beam to one measure number**, and a joined beam has two. Low impact —
  `MEASURE_BOX_IGNORE_TYPES` already ignores beams for box-select — but pick a side deliberately.
