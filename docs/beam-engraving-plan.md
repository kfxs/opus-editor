# P4 — THE BEAM, taken one piece of ink at a time

> 📄 The parent is `docs/own-engraving-engine.md`; this document is its **P4**. ⛔ Read §0 of that
> document first — the goal order, the twelve standing rules, and the one-line test. `docs/beaming.md`
> is the neighbour that answers a *different* question: **which notes are beamed together**. ⭐ That
> half has been ours since long before this migration; what P4 is about is **what the drawn line
> looks like once the grouping is settled.**
>
> **Status: P4a ✅ the beam's LINES — 2026-09-01.** ⏳ What is left is the SHAPE: the slope, the
> hooks, and the stem lengths a beam imposes.

---

## 0. ⭐⭐ What P4 actually is

`Beam.draw()` is two things in a fixed order:

```js
ctx.openGroup('beam', id)
this.drawStems(ctx)      // ← each note's own Stem
this.drawBeamLines(ctx)  // ← the quads
ctx.closeGroup()
```

⭐ **So P4 is smaller than P3 was, and that is a dividend of doing P3 first.** A beamed note's stem
is drawn by the BEAM, not by the note — `StaveNote.draw` skips a stem whose `beam` is set — and
**P3c already moved that ink** into `engrave/notes/stem` through the `Stem` subclass. Half of
`Beam.draw()` was ours before P4 started, without anybody aiming at it.

### 0.1 The order, and the reason for it

| | piece | why here | state |
|---|---|---|---|
| **P4a** | **the beam's LINES** | ⭐ the ink had **four owners**, three of which already shared our quad — VexFlow's was the odd one out; ⛔ no engraving opinion needed, the x's and the slope are read as public API | ✅ **2026-09-01** |
| **P4b** | ⏳ the **SLOPE** | ⛔ **gated on research.** `calculateSlope` is a cost solve (`slopeCost`, `slopeIterations`, `maxSlope`, `minSlope`); the books state the rule as a table of pitch-interval → rise. ⚠️ Nobody has complained about the current picture | ⏭️ |
| **P4c** | ⏳ the **HOOKS** (partial beams) | ⛔ **gated**: §6.1 of the parent names beam hooks among the places *"where we currently have no opinion"* — `getBeamLines` decides left/right on its own, and this editor has never stated a rule | ⏭️ |
| **P4d** | the **cross-system fragments**, folded in | ⭐ cheap once P4b/P4c exist: the renderer's two hand-drawn fragments continue *"the group's own slope and levels"* by hand today, which is a copy of arithmetic that would then have a home | ⏭️ |
| … | the beam's own **stem lengths** | `applyStemExtensions` — ⚠️ the same research as P3e (`docs/stem-length-research.md`), from the other end | ⏭️ |

⛔ **Nothing below P4a is scheduled**, and none of it is a defect list: the beams on his screen are
not wrong, they are *unsourced*. Taking a rule we cannot state is the one move this project reverts.

---

## 1. ✅ P4a — THE BEAM'S LINES (2026-09-01)

### 1.1 Why it was the right first piece — the measurement, not the taste

**The ink had four owners, and three of them already agreed.**

| who filled a beam quad | for what |
|---|---|
| `Beam.drawBeamLines` (VexFlow) | every ordinary beam |
| `FanPass` | a feathered beam's levels |
| `VexFlowRenderer.drawCrossBarSideBeam` | the half-beam hung over a system break |
| `VexFlowRenderer.drawCrossBarLoneFragment` | the same, for a side of one note |

🚨 This is §3.1's *"the second owner is the tell"* with the sign reversed. The last three had **already
been given one owner** — `beamInk.fillBeamQuad`, extracted for exactly that reason — so the finding
was that **VexFlow's copy was the only beam in this editor not drawn by our own primitive**. Every
beam a reader would call unusual was ours; the ordinary one was not.

⭐ And a **second** copied number, found by doing it: the LEVEL STACK. `beamY0 + k * thickness * 1.5`
appears in VexFlow's loop and twice more in the cross-barline fragments. It has one owner now.

### 1.2 What landed

- ⭐ **`engine/engrave/beams/beamLines.ts` — the ONE owner** of the quad ({@link fillBeamQuad}, moved
  out of `rendering/beamInk`), of a whole beam's run of them ({@link drawBeamLines}), and of the
  level stack ({@link beamLevelY} + `BEAM_LEVEL_STRIDE`). Pure, no DOM, no `vexflow`.
- ⭐ **`engine/rendering/EngravedBeam.ts`** — the adapter, the same seam shape as `EngravedNote` /
  `EngravedStem`: `setInkSurface` + `drawBeamInkThrough`, and an override of the public `draw()`.
- ⭐ `rendering/beamInk.ts` keeps only what is genuinely the renderer's: the cross-**system** stub
  lengths and the fragment's width, which are measured against `measureBounds` rather than drawn by
  anyone else.
- ⭐⭐ **The first beam ink in the SCENE.** `VexFlowRenderer.scene.test.ts` gained a chapter that
  renders beamed eighths and sixteenths in jsdom and asserts *one filled quad per beam line, five
  vertices, 0.5 staff spaces thick, two levels exactly one stride apart, four stems still drawn under
  four beamed notes, and a group carrying its id*. ⚠️ Every one of those needed a browser the day
  before.

**⛔ NO PIXEL MOVED.** 6097 unit tests green; `tsc` and all five lint gates clean.

### 1.3 ⚠️ Why the override is `draw()` and not `drawBeamLines()`

`drawBeamLines` is `protected` **and takes VexFlow's `RenderContext`**, so an override could not be
typed without naming that type — which is precisely what `npm run lint:paint` refuses outside its
allowlist. ⭐ The ratchet did its job here as a *design* pressure rather than a lint failure: it
pushed the seam onto the public `draw()`, where every number the adapter reads (`notes`, `slope`,
`renderOptions`, `getBeamLines`, `getSlopeY`, `getBeamYToDraw`) is public API rather than a reach
into a protected field.

⚠️ The stems keep the VexFlow context, deliberately: `drawStems` hands it to each `Stem`, and an
`EngravedStem` ignores it in favour of its own ink surface anyway (P3c).

---

## 2. ⭐ THREE SMALL FINDINGS, and one of them is good news

### 2.1 ⭐⭐ The level stride is the FIRST two-sources number that AGREES

`docs/note-engraving-plan.md` §3 collects four places where *the room we reserve and the ink we draw
come from two different sources* — the ledger overhang, the ledger weight, the stem's thickness, the
notehead glyph table — and in every one the font and VexFlow **disagree**, leaving a taste call open.

Here they agree, exactly:

| | says | as a stride |
|---|---|---|
| VexFlow | `beamY += beamThickness * 1.5` | **1.5** |
| Bravura | `beamThickness` 0.5, `beamSpacing` 0.25 | (0.5 + 0.25) / 0.5 = **1.5** |

⭐ Asserted in `beamLines.test.ts` against `engravingDefault()` rather than written down as a comment,
so the day the font's numbers change the test says so. ⛔ **Nothing here for his eye.**

### 2.2 ⭐ VexFlow ends a beam ONE PIXEL past where it measured it

`ctx.lineTo(lastBeamX + 1, …)` while `lastBeamY` comes from `lastBeamX` — a fudge that closes the
seam where a beam meets its last stem. ⛔ **Kept, and kept in the ADAPTER** (`BEAM_END_OVERSHOOT`),
not in `engrave/`: it is not a rule anybody would state, and P4a moves no pixel. ⏭️ It is the kind of
number that dies with P4b, when the line's ends become ours.

### 2.3 ⛔ `Beam.unbeamable` is dead upstream

`draw()` opens with `if (this.unbeamable) return`. The field is `private unbeamable?` in `beam.d.ts`
and is **written nowhere in `beam.js`** — a local of the same name inside the static `generateBeams`
is a different thing. ⚠️ So the guard is dead code, and the override does not transcribe it;
reproducing it would mean casting to read a field that is always `undefined`. Recorded here because
*"we left a branch out"* is exactly the claim a later reader should be able to check.

---

## 3. ⏭️ WHAT IS NEXT — ⛔ not a queue

- **The SLOPE (P4b).** VexFlow solves it as a cost function; Gould and Stone state it as a table
  (interval spanned → rise, in spaces, with a ceiling). ⭐ The research shape is the same one
  `docs/stem-length-research.md` used, and the sources are on the shelf. ⚠️ Note the trap that work
  found: **a book's plate can disagree with the book's own sentence**, and the plate wins
  (`docs/note-engraving-plan.md` §3.4).
- **The HOOKS (P4c).** Which side a partial beam points is a real engraving rule (it follows the
  beat's subdivision, not the neighbour's duration), and `getBeamLines` decides it with
  `lookupBeamDirection`. ⛔ Until the rule is written down, changing it is inventing one.
- **The cross-system fragments (P4d).** Two places in `VexFlowRenderer` continue a beam's slope and
  levels by hand. They are correct and they are copies; they fold in once the slope has an owner.
- **`Stave.padding`** is ⛔ **not** here. It is a LAYOUT number and it moves with **P5**
  (`docs/note-engraving-plan.md` §0.1 carries the correction).
