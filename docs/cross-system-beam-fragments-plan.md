# Beams through a system break — the half-beam

Status: **PLANNED — ⭐ next up.** Extends `docs/cross-barline-beaming-plan.md`, which stops exactly
here: *"a pair straddling a break falls back to two ordinary groups with their flags intact… Real
engraving hangs a half-beam over the barline at the end of the line, which needs partial beams drawn
by hand and is not built."* This is that.

The rule does not change and no mark is added: `continue` at a barline still means *this note is
beamed on both sides*, and `docs/beaming.md` "Through the barline" remains the whole statement. What
changes is that the layout stops overruling it.

> Reviewed against the source 2026-07-24. Everything below the phases marked ⚠️ **amended** is what
> that review changed; the shape of the design survived it.

## Two reasons it does not work today, and the smaller one is VexFlow's

**We never propose the join.** `splitIntoRuns` (`CrossBarBeams.ts:228`) flushes the run whenever
`previous.line !== bar.line`, so at a system break the marks never form a `CrossBarJoin` at all.
Nothing downstream is ever asked to draw anything.

**VexFlow has the ingredient, not the feature.** It does draw partial beams — `getBeamLines()`
(beam.js:494) gives a segment with no partner `end = start ± partialBeamLength` (10px), and
`setPartialBeamSideAt` even lets you force which way one points. But it is only for *secondary*
levels inside a group; the primary beam always runs notehead to notehead, and the constructor
**hard-throws on a single note** (`'Too few notes for beam'`, beam.js:286) — which is precisely
`♪ | ♪`, the canonical case, with one note on each side of the break.

*(All beam.js line numbers here are the installed VexFlow 5.0.0 ESM build: the throw is 286,
`getBeamLines` 494, `drawStems` 573, `drawBeamLines` 583.)*

## The idea: plan whole, draw in sides

⭐ **A split join is not one beam drawn in two pieces. It is one group *planned* whole, drawn as N
independent half-groups, each with an open end.** The multi-system slur reached the same shape
(`begin` / `middle` / `end`), and it pays for itself three times: neither side needs the other's
geometry at draw time, a culled side cannot break a visible one, and a group crossing three systems
needs no special case.

Two facts nevertheless stay whole-group, and they are why the *planning* does not split:

- **The stem direction.** A beam group has one (`docs/beaming.md`). Resolve it per side and the two
  halves can point opposite ways.
- **The crossing beam count** — how many beam lines actually run *through* the break. It is the count
  common to both sides, so side A alone cannot know it. The planner settles it once per split point
  and hands the same number to both sides. ⚠️ It is not the whole answer for a side — see
  "How many lines the fragment shows" below.

And one fact must be re-based per side: `secondaryBreaks` are **group-local indices**
(`CrossBarBeams.ts:176`). Split the group and side B's are all wrong by side A's length. Cheap to
fix, silent if missed.

## What the picture is

Assumed, and stated so it can be argued with rather than discovered:

- **A short fixed stub, not a run to the system margin.** Roughly a notehead past the last note's
  stem, through the end barline and into the page margin; the same stub on the next system projects
  left from the first note's stem and stops well short of the clef. A beam running the full
  remaining width of a system reads as a long *empty* beam, not as one going somewhere. VexFlow's
  own `partialBeamLength` is 10px and is the honest starting value — **one named constant, tuned by
  eye.** (This is also why the slur's `lineLeftEdgeX` / `lineRightEdgeX` are not needed: no margin
  arithmetic is involved.)
- **The slope continues** on a side holding two or more notes, so the fragment reads as going
  somewhere. A lone note has no slope to continue: flat.

## ⚠️ How many lines the fragment shows — the shared count is not enough

The crossing count answers *how many beams run through the break*. It does not answer *how many the
fragment draws*, and the two differ in both directions.

**A lone side draws its own note's beam count, not the shared one.** A lone 𝅘𝅥𝅯 joined across the break
to an ♪: the shared count is 1, so a fragment obeying it shows one line and the note reads as an
eighth. That note's second beam has to go somewhere, and with nothing on its own side to point at,
the only place is across the break. So: **a one-note side draws `beamCount(its note)` levels, all
pointing at the break.** ❓ Open, and an engraving call rather than a code one: Gould has a fractional
beam point toward the notes it belongs with, and here they are on the other system — worth confirming
before it is built.

**A multi-note side will draw a wrong-way stub of its own, and we cannot stop it.** `getBeamLines`
gives the edge note's top level `end = start - partialBeamLength` (beam.js:547-570) whenever only
that note participates in that level *within the side*. If that same level also crosses the break, we
add a forward overhang on top of VexFlow's backward stub and the note wears a bowtie. Concrete: side
A `♪ 𝅘𝅥𝅯` with the 𝅘𝅥𝅯 beamed on to another 𝅘𝅥𝅯 across the break. `setPartialBeamSideAt` cannot save it —
`forcedPartialDirections` is only consulted in `getBeamLines`' `beamAlone` branch, which requires a
note on *both* sides of it inside the group, and the edge note by definition has none.
**Known limitation, shipped as one.** The escape, if it ever bites, is to draw the open-end level
ourselves and suppress VexFlow's whole partial-beam pass — which costs the primary beam its geometry
and is not worth it for the case.

## Phases

Each is safe on its own, and the first two are deliberately invisible.

### P1 — the planner learns about sides. No visual change.

`CrossBarJoin` gains `sides`: `members` partitioned at every index where `line` changes, each side
carrying `openLeft` / `openRight`, its own `measures`, its re-based `secondaryBreaks`, the crossing
beam count at each open end, and `drawable` (see P3). The wall in `splitIntoRuns` **stays**, so no
join is ever actually split and nothing renders differently. Unit tests only.

⚠️ **Sides become the only truth, and P2 is where that lands.** Leaving `members` / `measures` /
`secondaryBreaks` standing beside `sides` is two descriptions of one group, and both current
consumers read the old ones — `spanAnchors` (`VexFlowRenderer.ts:1027`) and `registerCrossBarBeam`
(`:1830`) both take `join.measures`. P1 adds `sides`; **P2 migrates every consumer and deletes the
whole-group fields.** Only `stemDirection` stays on the join, because it genuinely is one.

### P2 — the drawer works in sides. Still no visual change.

`drawCrossBarBeams` (`VexFlowRenderer.ts:1806`) iterates sides instead of joins. With the wall still
standing every join has exactly one side, so **the regression bar is that today's cross-barline
beams look identical** — that is the whole point of isolating this commit.

### P3 — open the wall. The visible feature.

`splitIntoRuns` stops flushing on `previous.line !== bar.line`.

⚠️ **amended: the `!drawn` wall becomes per-side, it does not simply "stay".** As written before, P3
kept a wall that flushes the *whole run* while P4 removed the pinning that forces the neighbour bar
to be painted — and the two cannot both be true. At the cull-window edge the next system's first bar
is not drawn, the run flushes, no join forms, and side A's notes get their flags back; and because
`descriptorFor` feeds the shape key (`VexFlowRenderer.ts:2585`), the bar re-engraves and its flags
**flip on and off as you scroll**. A scroll changing the picture is the one thing the render
machinery exists to prevent.

So drawn-ness moves from the run to the side:

- **The planner is drawn-blind across a line break.** It must be: the stem direction and the crossing
  count are whole-group facts, and side A needs them whether or not side B is painted. Keeping the
  run open costs nothing, because nothing is *drawn* from it directly.
- **A side draws iff all of its own bars are drawn.** Side A renders its fragment whether or not side
  B exists on screen — which is exactly the independence the whole design is for.
- **Inside a side the `!drawn` wall is unchanged and still required**, because the real `Beam` needs
  both bars' `StaveNote`s.

That also makes the descriptor scroll-stable, which the "What does not change → the shape key"
section below asserts and could not otherwise earn.

*(Fallback if the per-side wall turns fiddly: keep the pairwise pinning across the break — i.e. drop
P4 — and leave the run wall alone. The cost it avoids is one bar on the vertically adjacent system,
almost always inside the overscan already. What cannot ship is the old P3 and the old P4 together.)*

Then, per side:

- **≥ 2 notes** — build the real `Beam` exactly as today; VexFlow draws the stems, the beam and the
  slope. We add one overhang quad per crossing beam level at the open end, from
  `getSlopeY(stemX, firstStemX, getBeamYToDraw(), slope)`, stepping `beamWidth * stemDirection * 1.5`
  per level — `drawBeamLines`' own arithmetic (beam.js:583-612), with `end` a stub length instead of
  a notehead. `slope`, `renderOptions`, `getSlopeY` and `getBeamYToDraw` are all **public** in
  `beam.d.ts`, so none of this needs a cast (unlike `PLACEHOLDER_BEAM`). ⚠️ Start the overhang at
  `note.getStemX() - Stem.WIDTH / 2` — the x `getBeamLines` itself uses for a line's end
  (beam.js:515) — not at `getStemX()`.
- **exactly 1 note** — `Beam` throws, so this side is ours. The placeholder has already suppressed
  the flag and the stem, so we take the note's **own** `Stem`: `adjustHeightForBeam()` +
  `setContext(ctx).drawWithStyle()`. Fragment at the natural stem tip, flat.

  ⚠️ **amended: two calls, not three.** `setExtension(ext)` takes an argument and there is nothing to
  pass — nothing has moved the stem tip, which is the whole meaning of "flat at the natural tip"
  (`applyStemExtensions` only exists to drag a stem to a *sloped* beam). And `drawStems`'
  `setNoteHeadXBounds(stemX, stemX)` is not needed either, because `StaveNote.draw()` already does it
  unconditionally, beamed or not (stavenote.js:821-824). `adjustHeightForBeam()` is the one that
  matters: it swaps the flag's −3 height adjustment for `-Stem.WIDTH / 2`.

⚠️ **Use VexFlow's `Stem`, never a hand-drawn line.** The selection highlight resolves a beamed
note's stem *by identity* through the `Stem` object's SVG element (`getStaveNoteSVGGroup`,
`VexFlowRenderer.ts:3331`), because a beamed stem is drawn inside the beam's group and not the
note's. `Stem.draw()` opens its own `<g>` under the Stem's id (stem.js:123), which is what makes that
lookup work at all. A hand-drawn stem is invisible to it and the note highlights with a hole in it.

⚠️ **amended: no `openGroup` per fragment — a registry entry instead.** The earlier draft wrapped each
fragment in a group "so hit-testing and recolouring can find it", and nothing would have. Today's
join is drawn in no group at all; hit-testing is an `ElementRegistry` bbox (`registerCrossBarBeam`,
`VexFlowRenderer.ts:1830`) and `type: 'beam'` exists solely to be *ignored* by measure box-select
(`MouseController.ts:26`). Nothing recolours a beam. The real gap is the other end of that function:
`registerCrossBarBeam` reads `beam.getBoundingBox()`, and **a one-note side has no `Beam` to ask** —
its bbox has to be built from the stem x, the beam y and the stub length. Add the group only when a
consumer appears.

### P4 — `spanAnchors` per side.

Today a join pins **both** its bars so a half-drawn group cannot happen
(`VexFlowRenderer.ts:960-963`). Per-side independence retires that reason across a break, and keeping
it would force a bar on another system to be painted for nothing. A split join contributes **one
anchor group per side**. Within a side the pinning is unchanged and still required.

⚠️ **This depends on P3's per-side wall and must not land without it** — that is the amendment above.
Note also what a one-bar side contributes: nothing to `spans.list` (there is no pair to force), but
still `measures.add`, because the fragment is drawn outside the measure group from the note's *drawn*
coordinates and a translated bar would leave it behind.

### P5 — docs.

`docs/beaming.md` "Where it stops" is rewritten (it currently documents the fallback as permanent),
and `docs/cross-barline-beaming-plan.md` gains the fragment as its second drawing case. This file
then folds into those two and goes away.

## What does not change, and why each is a claim rather than a hope

- **The shape key.** A joined bar's interior is *identical* whether or not its group is split: notes
  flagless and stemless at direction D either way, because the beam and the stems both live outside
  the `<g>`. `descriptorFor` already flips correctly between "wall" (no entry → flags) and "join"
  (entry → flagless), so the split point never needs to reach it. **This holds only with P3's
  drawn-blind planner** — otherwise the descriptor is a function of the cull window.
- **The width key.** `MeasureLayout` measures a bar with no beams built at all, so none of this
  reaches it, and the overhang lives in the page margin rather than in any bar's width.
- **The two-pass plan.** `planCrossBarBeams(plans, () => true)` → `spanAnchors` →
  `planCrossBarBeams(plans, i => draws[i])` (`VexFlowRenderer.ts:2553-2582`) is untouched. The line
  boundary stops being a wall; the draw decision still is *within a side*, and that is the pass the
  split exists for.
- **`getBeamRole` and the palette.** The role is a fact about the score and the break a fact about
  the layout. `beamRoleAtRef` is already layout-blind, so it is unchanged — except that intent and
  engraving now agree, which is the point.
- **⚠️ No circularity — but only just.** The join depends on `line`, and `line` comes from layout;
  that is safe *only because layout is beam-blind*, which `docs/cross-barline-beaming-plan.md`
  verified rather than assumed. **If a bar's width ever learns about beams, this design breaks.**

## ⚠️ One thing to measure, not assume

A run stops being line-bounded, so on a fully-drawn score it becomes the whole staff. `planCrossBarBeams`
then takes `voices` as the union over the *entire* staff and calls `laneSlots` (which sorts) once per
bar per voice in that union — where today a run is ~4 bars and sees only its own voices. The total
work stays linear-ish and this may well be noise, but it is a per-render function in a codebase that
counts renders. **Measure it before and after P3** (`renderCensus`), and if it shows: cut runs at any
barline no group could cross — neither side's edge slot marked `continue` — which is a cheap pre-pass
that restores short runs without touching the design.

## Tests

`crossBarBeams.test.ts` has the `drawFilter` seam already. Add: a split lands where the line changes;
a three-system group yields three sides, the middle one open at both ends; one note per side; sides
re-base their secondary breaks; a side whose own bar is undrawn does not draw **while its partner
side still does** (the amended wall — this is the P3 regression bar); and, for P2, that a same-line
join is byte-for-byte the join it was.

⚠️ **All of it on the plan, never on pixels.** jsdom cannot measure glyphs, so a geometry assertion
passes vacuously (`reference_jsdom_cannot_measure_glyphs`). The fragment's appearance is judged by
eye, which is what the tuning constant is for.
