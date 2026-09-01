# P4 — THE BEAM, taken one piece of ink at a time

> 📄 The parent is `docs/own-engraving-engine.md`; this document is its **P4**. ⛔ Read §0 of that
> document first — the goal order, the twelve standing rules, and the one-line test. `docs/beaming.md`
> is the neighbour that answers a *different* question: **which notes are beamed together**. ⭐ That
> half has been ours since long before this migration; what P4 is about is **what the drawn line
> looks like once the grouping is settled.**
>
> **Status: P4a ✅ the beam's LINES · P4b ✅ the SLOPE (a table of rules) · P4d ✅ the cross-system
> fragments folded in — all 2026-09-01. ⏭️ P4c (the hooks) is the one lettered step left.**
> ⭐⭐ **P4b moved no pixel**: five rules are on the shelf, the one his eye kept is the one we already
> drew, and `__beams.rule(…)` swaps them live. ⏳ What is left is the HOOKS (P4c) and the stem lengths
> a beam imposes.
>
> 📄 **P4b's research is DONE and is `docs/beam-slope-research.md`** (2026-09-01) — four treatises,
> three engines, and our own drawn beams measured through the scene. ⛔ **It builds nothing**: its §7
> is a decision list and every row on it is HIS.

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
| **P4b** | the **SLOPE** | ✅ **2026-09-01 — researched (`docs/beam-slope-research.md`), then BUILT AS A TABLE OF FIVE RULES with an instrument.** ⭐ His eye picked `vexflow`, the one we already drew ⇒ **no pixel moved**. ⛔ Which rule is *right* stays open, on purpose | ✅ **built, ⏳ undecided** |
| **P4c** | ⏳ the **HOOKS** (partial beams) | ⛔ **gated**: §6.1 of the parent names beam hooks among the places *"where we currently have no opinion"* — `getBeamLines` decides left/right on its own, and this editor has never stated a rule | ⏭️ |
| **P4d** | the **cross-system fragments**, folded in | ✅ **2026-09-01** — and cheaper than this row predicted, because P4a had already given the two fragments `fillBeamQuad` and `beamLevelY`. What was left was the level LOOP and the start-x rule; both now live in `engrave/beams/beamLines` ({@link beamLevelRun}, {@link beamLineStartX}), and the lone fragment's hit box is DERIVED from its run instead of accumulated inside the fill loop | ✅ |
| … | the beam's own **stem lengths** | `applyStemExtensions` — ⚠️ the same research as P3e (`docs/stem-length-research.md`), from the other end | ⏭️ |

⛔ **Nothing below P4a is scheduled**, and none of it is a defect list: the beams on his screen are
not wrong, they are *unsourced*. Taking a rule we cannot state is the one move this project reverts.

---

## ✅ P4b — WHAT LANDED, AND IT MOVED NO PIXEL (2026-09-01)

> *"i prefer vexflow angle for the moment… interval is really angled so is not nice.. and probably we
> should ad also verovio and lylypond solutions so is easy to explore later and to take a real
> solution"*

⭐⭐ **His eye saw all of it on his own music within the hour, and the verdict was the picture we
already had.** So P4b ships as: **the research, the instrument, five rules — and the same page.**

| | |
|---|---|
| **ACTIVE rule** | ⭐ `vexflow` — the angle cap. ⛔ **No pixel moved**, and the scene spec asserts exactly that (an octave still climbs 0.60, a 2nd 0.24). |
| what he rejected | `musescore` *"too flat"* · `interval` *"really angled so is not nice"* |
| the instrument | `__beams.rule(…)` / `.dump()` / `.reset()` — `dev/beamSlopeConsole.ts` |
| the rules | `engine/engrave/beams/beamSlope.ts`, five rows, each with its source and its **divergences** written down |

🚨 **AND A REAL BUG CAME OUT OF HIM TESTING IT** — *"im changing it but dont see any difference on
screen"*. The armed rule was in the renderer's **view key**, which decides whether a render RUNS; a
beam is drawn INSIDE a measure group, and groups are **reused** unless the **SHAPE key** changes. So
the render ran, every group was replayed, and the old beams came back — silently, exactly as
`reference_render_width_key_vs_shape_key` warns. ⇒ `measureShapeKey` gained a `pictureGeneration`,
and the regression test renders the SAME renderer twice on purpose (a fresh one has nothing to reuse
and would pass while the app stayed broken).

⏭️ **What is still open after P4b** — ⛔ none of it decided by this commit:
- **which rule** is right. Five are on the shelf; one is armed; the comparison is his to make.
- ⭐ **whether our SPACING is what the books assume.** A quaver stands ~2.4 spaces here — under
  **LilyPond's** log law, his own call, ⛔ **not** Gould's (corrected by him, 2026-09-01) — while her
  plates draw beamed quavers at ~4.5. ⭐ Which also means Ross's width thresholds were written for a
  different spacing house than the one we live in. Until that is understood, every width-based rule
  is being fed a number the books may not recognise.
- **what *"closer than three spaces"* measures** — stem to stem, head centre to head centre, or the
  white gap. ⛔ UNKNOWN.

---

## ⏳⏳ HIS STANDING DECISION — THE SLOPE ALGORITHM STAYS OPEN (2026-09-01)

> *"lets not fix the rule, but leave it open, i would like to test the three engine solutions… but we
> dont have to do it now, so make a note about this and lets built it as you propose but in a way we
> dont close the door to change the algorithm so we can in the future test the posibilities and try an
> optimal solution"*

⛔ **So the question "which beam-slope algorithm is best?" is NOT answered, and ⛔ nothing in this
repo may be written as if it were.** What P4b builds is **one row in a table of rules**, chosen
because it is the best-sourced one available today — ⛔ not because it won a comparison. The
comparison has not happened.

⭐ **What "the three engine solutions" means**, and each is measured in `docs/beam-slope-research.md`
§4, ready to become a row:

| engine | its answer | state |
|---|---|---|
| **MuseScore** | two integer tables in quarter-spaces — the smaller of the interval's budget and the width's | ✅ `musescore` — ⛔ minus its concave FLAT rule and its line attachment |
| **LilyPond** | least squares → `0.6·tanh(slope)/damping` → quanting onto sit/straddle/hang with demerits | ✅ `lilypond` — ⛔ **the damping only**: no concaveness, no quanting, no minimum-dy |
| **Verovio** | a step ladder in half-spaces, branching on note count, distance and duration | ✅ `verovio` |
| — | Ross's interval table with Gould's close-notes flattening left out | ✅ `interval` — a hybrid, ⛔ nobody's engine |
| **VexFlow** | the ANGLE cap, `maxSlope 0.25` | ✅ `vexflow` — ⭐ **THE ACTIVE ONE, his call** |

⚠️ **And the fourth row is what we drew before P4b** — VexFlow's angle cap — kept deliberately as
`vexflow`, so *"what did it look like yesterday"* is a one-word edit rather than an archaeology
exercise.

### 🚨 HIS EYE, THE SAME DAY: *"to my eyes the angle looks too flat now"* (2026-09-01)

⭐⭐ **The instrument earned its place within minutes of the first rule reaching the page.** `tables`
is the flattest of the three readings, and at this editor's spacing it is *very* flat: every ordinary
beam lands on the width ladder's bottom rung, **¼ space**, whatever the interval.

🚨 **And there was a real question underneath his reaction: *"closer than three spaces" is not defined
on Gould's page.*** She gives the threshold and never says three spaces *between what*.

> ✅ **ANSWERED 2026-09-01, from ROSS — it is the WHITE GAP between noteheads**, and I had recorded it
> here as UNKNOWN the same morning. Printed p. 112: *"notes that have **less than 3 spaces between
> noteheads or stems** … our beams in close spacing will slant ¼ to ½ space at all times"* — which is,
> word for word, the source of Gould's sentence. ⭐ Corroborated by his own eight-example ruler figure
> (p. 100: the too-close/normal boundary lands at a **gap of ≈2.4 sp**, his "normal" examples spanning
> 2.81→3.79 — literally *"between three or four spaces apart"*), and by Gould's own compressed
> example, which measures **3.66 centre-to-centre but 2.45 as a gap**: only the gap reading makes her
> picture agree with her own caption. 📄 `docs/spacing-model-research.md` §1c.

⚠️ **The two numbers in these books are measured differently ON PURPOSE**: note-value spacing is
left-to-left / centre-to-centre (Ross p. 75 states it outright), the beam threshold is the gap.
**Converter, with her measured 1.20 sp notehead: gap 3 sp ⇔ 4.2 sp centre-to-centre.**

🚨 **What that does to us.** `BeamShape.widthSpaces` is **stem-to-stem** — the centre-to-centre family
— fed into a threshold the books define as a gap. ⇒ **we flatten LESS often than the books intend**,
not more: ours bites below 3 centre-to-centre (a gap of 1.8), theirs below 4.2. ⛔ Not changed; the
rule is his open question and this is a fact for that decision.

⭐⭐ **AND HERE IS WHY THE TABLES LOOKED WRONG TO HIS EYE.** Ross's ¼–½ rule is explicitly a
**TWO-NOTE-GROUP** rule — *"In normal spacing two notes and an interval dictate the amount of slant …
in close spacing, almost without exception **one note alone serves as a dictator**"* (p. 112) — and
Stone's footnote confirms the shape of the material: *"charts with close to 300 different **two-note**
single beam slants alone"*. **Gould dropped the qualifier**, and her own engraving breaks the rule as
she wrote it: a six-note group on her p. 490 is drawn at a **1.08 sp** angle where the sentence allows
¼–½. ⇒ ⏭️ **the honest next experiment is a row that flattens TWO-NOTE groups only** and lets longer
groups take the interval table. ⛔ His call; not built.

⚠️ **And our ~2.4 is LilyPond's number, not Gould's** — see the research doc's §3.1d correction.

⇒ `interval` was added as a third row the same hour: **Ross's interval table with Gould's width rule
left out**, which is the middle ground between yesterday's picture and the flattest reading.

### What "not closing the door" cost, concretely

- ⭐ `engine/engrave/beams/beamSlope.ts` is a **table keyed by rule name**, not a function. Adding
  LilyPond's or Verovio's is adding a row and a spec, and touches nothing else.
- ⭐ `ACTIVE_BEAM_SLOPE_RULE` is **one identifier**. Comparing two algorithms is that word plus
  `npm run dev`.
- ⚠️ **One honest limit, written down so it is not discovered later**: a rule currently returns a
  **budget** (the most a beam may climb) and VexFlow's own solver picks inside it. LilyPond and
  Verovio both want to **choose** the rise outright. ⇒ that needs one more line in
  `rendering/EngravedBeam.postFormat` — assign `this.slope` after `super.postFormat()` and re-run
  `applyStemExtensions()`. ⛔ Deliberately not written until somebody is actually comparing, because
  an untested branch that exists is worse than a documented one that does not.
- ⏭️ **If comparing by eye on the same page becomes the job**, the next step is a dev-only setter so
  the rule can be swapped without a rebuild. ⛔ Not built — nobody has asked yet.

⛔ **The old behaviour is not gone and must not be deleted**: `BEAM_SLOPE_RULES.vexflow` is the
baseline every future comparison is measured against.

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

- ✅ **The SLOPE (P4b) — RESEARCHED, ⛔ not built: `docs/beam-slope-research.md`.** Six rules are
  unanimous across the four treatises and three engines; **two of them we do not implement at all**
  (a beam end must sit on / hang from / straddle a stave-line — VexFlow's `Beam` never consults the
  stave; and *"closer than three spaces ⇒ ¼ or ½ regardless of interval"*), and one we implement
  **in the wrong currency** (we cap the ANGLE at 0.25; every source caps the RISE in stave-spaces).
  ⭐ What we already get right: a 2nd is drawn at 0.24 sp = Ross's ¼, and a 3rd at 0.48 = Gould's own
  drawn ½. ⏳ §7 of that document is the decision list, and it is HIS.
- **The HOOKS (P4c).** Which side a partial beam points is a real engraving rule (it follows the
  beat's subdivision, not the neighbour's duration), and `getBeamLines` decides it with
  `lookupBeamDirection`. ⛔ Until the rule is written down, changing it is inventing one.
- **The cross-system fragments (P4d).** Two places in `VexFlowRenderer` continue a beam's slope and
  levels by hand. They are correct and they are copies; they fold in once the slope has an owner.
- **`Stave.padding`** is ⛔ **not** here. It is a LAYOUT number and it moves with **P5**
  (`docs/note-engraving-plan.md` §0.1 carries the correction).
