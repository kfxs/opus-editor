# P3 — THE NOTE, taken one piece of ink at a time

> 📄 The parent is `docs/plans/own-engraving-engine.md`; this document is its **P3**, the item that plan
> calls *"⚠️ THE BIG ONE"*. ⛔ Read §0 of that document first — the goal order, the twelve standing
> rules, and the one-line test — because everything below is an application of it.
>
> **Status: P3a ✅ ledger lines · P3b ✅ flag · P3c ✅ stem INK · P3d ✅ NOTEHEADS — all 2026-09-01;
> P3f ✅ the ACCIDENTAL + the DOT · P3g ✅ the ARTICULATION — both 2026-09-14.**
> ⭐⭐ **All five of `StaveNote.draw()`'s drawing calls are ours** (the pointer rect is the RULER, not
> ink), ⭐⭐ **and with P3g every glyph an ordinary bar draws is in the SCENE** — that is the census,
> asserted, in `ScoreRenderer.scene.test.ts`. ⏳ **What is left is the stem's LENGTH**, gated on
> `docs/research/stem-length-research.md`.
>
> ⚠️ **2026-09-19: VexFlow is REMOVED** (S14, `docs/history/vexflow-removal-map.md` §9). Every piece this
> plan leaves *"VexFlow's"* — the head objects, the stem's reach, the articulation's placement, the
> ghost, the fan's marks, the painter itself — is our code now (`EngravedNote`, `EngravedHead`,
> `engrave/notes/stemLength`, `engrave/notes/articulationPlacement`, `rendering/painter/SvgPainter`…). The
> sections below are the record of how the ink moved, ⛔ not a description of today's owners.
>
> 🚨🚨 **READ §1b.5 BEFORE EMPTYING ANOTHER `draw()`.** VexFlow writes POSITION as a side effect of
> painting, so an override that takes the ink must reproduce the **write-back** — P3b did not, and an
> unbeamed flagged note reported a bounding box merged with the origin for thirteen days. ⛔ *"No
> pixel moved"* does not mean *"no ruler moved"*.

---

## 0. ⭐⭐ What P3 actually is, and why it cannot be one commit

`StaveNote.draw()` is five things in a fixed order:

```js
ctx.openGroup('stavenote', id)
this.drawLedgerLines()        // ← P3a, ✅ ours
if (shouldRenderStem) this.drawStem()
this.drawNoteHeads()          //    …and each head draws its own modifiers (accidental, dot, articulation)
this.drawFlag()
ctx.pointerRect(bb…)
ctx.closeGroup()
```

⭐⭐ **The trap, and it is the whole reason this is not a rewrite:** the same object is also the
**RULER** — `docs/plans/own-engraving-engine.md` §2.3 measured it — and **seven of our own renderers read
it**: `SlurRenderer`, `TieRenderer`, `TrillRenderer`, `OttavaRenderer`, `PedalRenderer`,
`HairpinRenderer`, `FanPass`, plus `ElementRegistry`'s hit-testing and the six highlight maps. So a
`StaveNote` that stops *painting* must keep *answering* — `getStemX`, `getStemExtents`, `getYs`,
`getNoteHeadBeginX`, `getAbsoluteX` — and that is not a thing you can do halfway through a big-bang
replacement.

⭐ **So the shape of P3 is: keep the object, empty the drawing, one method at a time.**
`engine/rendering/engraved/EngravedNote.ts` is that seam — a `StaveNote` subclass whose override list is the
progress bar. ⛔ It is not a monkeypatch: the audit names the live `getModifierStartXY` patch as
*"the shape of the whole problem"* (§2.4), and this is typed, one file, and undone by deleting a
method.

⭐⭐ **And each piece pays for itself the moment it lands**, because of P1d: ink drawn through a
`DrawContext` is recorded by `SceneRecorder`, so *"this note has exactly one ledger line, at this
y"* becomes a jsdom unit test. §6.3's gate is answered element by element — **the scene's coverage
IS the migration's progress**, the same number `lint:paint` reports from the other side.

### 0.1 The order, and the reason for it

| | piece | why here | state |
|---|---|---|---|
| **P3a** | **ledger lines** | ⭐ the only piece with **three owners already**; pure arithmetic; no font in it; no formatter interaction; ⛔ nothing else reads it | ✅ **2026-09-01** |
| **P3b** | **the flag** | ⭐ the only piece with **no owner at all** — no selection kind, no anchor map, no registry entry — and 🚨 it is §3's **bug class in the open**: VexFlow places it with a runtime `measureText` | ✅ **2026-09-01** |
| **P3c** | **the stem's INK** | ⭐ a third element with **three owners** (VexFlow's `Stem.draw` + `FanPass` twice); ⛔ the LENGTH left behind deliberately — see below | ✅ **2026-09-01** |
| **P3d** | **the noteheads** | ⭐ the last drawing call, and it needs **no engraving opinion**: the glyph is chosen by duration, the x by our own column solve, the y by the staff line. ⚠️ Its ink stayed INLINE in `EngravedNote` until 2026-09-01, when it moved to **`engrave/notes/noteheads.ts`** beside its three siblings — see §1d.5 | ✅ **2026-09-01** |
| **P3e** | **the stem's LENGTH** | ⛔ was **gated** on `docs/research/stem-length-research.md` stating the rule first (§6.1 of the parent) — ⭐ and the research CONFIRMED the inherited number rather than replacing it: 3½ stave-spaces from the notehead centre, four treatises for four, which is exactly `Tables.STEM_HEIGHT` = 35. `engrave/notes/stemLength` + `STEM_LENGTH_PX`; no pixel moved | ✅ **2026-09-16** |
| **P3f** | **the MODIFIERS — the accidental and the augmentation dot** | ⭐ they draw from inside a head's group, and both are selectable kinds with registered hit boxes. 🚨 **And they were the last glyph ink on an ordinary bar, invisible to the gauge**: `lint:paint` counts `vexContext`, and a modifier never mentions it — see §1f | ✅ **2026-09-14** |
| **P3g** | **the ARTICULATION** | ⚠️ This row used to read *"⛔ **not ink alone**: its `draw()` is a placement RULE (above/below, clear of the staff, between lines), so it is gated on research the way the stem's length is"* — ⭐⭐ **and the correction is the step's whole finding: the ink IS separable, just not at `draw()`.** Cut at `renderText` and the rule keeps its ONE owner — see §1g | ✅ **2026-09-14** |
| **last** | the pointer rect + `getBoundingBox` | ⛔ **DEFERRED TO P1e — his call, 2026-09-01.** It is not ink and it is not a P3 question; **§1e** has the audit | ⏸️ |

⚠️ **A CORRECTION to the parent plan, found by doing the work.** `own-engraving-engine.md` §5 says
P3 *"unblocks `Stave.padding`"*. ⛔ **Owning the note's INK does not** — and P3d proved it: every one
of the five drawing calls is ours and `Stave.padding` is untouched, because it is a **LAYOUT** number
(where the note area starts inside the stave), not a drawn one. It moves when the STAVE's geometry
moves, which is **P5**. ⭐ The residue of P3 that could reach it is the *ruler*, not the ink.

---

## 1. ✅ P3a — THE LEDGER LINE (2026-09-01)

### 1.1 Why it was the right first piece — the measurement, not the taste

**It had three owners, and two of them said so in their own comments.**

| who drew it | for what | what its comment said |
|---|---|---|
| `StaveNote.drawLedgerLines` | every real note | (VexFlow's) |
| `FanPass.drawFanLedgerLines` | a fanned member's hand-drawn head | *"🚨 LEDGER LINES BY HAND. `drawLedgerLines` belongs to `StaveNote`; a bare `NoteHead` only swaps to the ledger glyph"* |
| `ScoreRenderer.drawRestLedgerLines` | a rest a manual shift pushed off the staff | *"VexFlow's `StaveNote.drawLedgerLines()` hard-returns for rests… so we draw it ourselves"* |

🚨 That is `own-engraving-engine.md` §3.1's **"the second owner is the tell"** — *a rule with no
home, copied because there was no module to import* — found three times inside one element. And the
two copies had been written from VexFlow's source, so the agreement between them was maintained by
hand and by nobody in particular.

⭐ Plus four properties that make it the cheapest possible first move:

1. **No font in it.** Two points and a stroke; the head width is a parameter. So the whole rule is
   arithmetic and its spec runs in jsdom.
2. **No formatter interaction.** A ledger line reserves no width (`ledgerAccidentalClearance` states
   why that is deliberate: reserving would make bar width clef-dependent, and this editor measured
   its way out of that at 47% of layout time).
3. **Nothing downstream reads it.** ⛔ Not the registry, not a highlight map, not an anchor.
4. **It draws inside the note's own group already**, because VexFlow's `draw()` opens
   `stavenote` *before* calling `drawLedgerLines()` — so the selection highlight keeps working
   for free, with no new seam.

### 1.2 What landed

- ⭐ **`engine/engrave/notes/ledgerLines.ts` — the ONE owner**, of both the rule
  ({@link ledgerLineRuns}) and the ink ({@link drawLedgerLines}). Pure, no DOM, no `vexflow`, and
  fenced as such: `.eslintrc.boundary.json` gained an `src/engine/engrave/**` block (§8.2 rule 11,
  arriving with the directory it governs, exactly as `paint/` and `scene/` did).
- ⭐ **`engine/engrave/` exists**, and its first inhabitant is `notes/`. §8.3's rule held: *"a file
  migrates into its `engrave/` folder on the commit that touches it anyway"* — ⛔ no rename move.
- ⭐ `engine/rendering/engraved/EngravedNote.ts` — the subclass seam (§0), plus `drawNoteInkThrough` (points a
  bar's notes at the render's own surface, so the ink we have taken back reaches the SCENE) and
  `trimLedgers`.
- ⭐ **One `renderOptions` poke retired.** `clearLedgersForAccidentals` used to write
  `note.renderOptions.strokePx` — one of §2.4's *"`renderOptions` written as a field, not an API"*
  repairs. It calls `trimLedgers` now.
- ⭐⭐ **The first note ink in the scene.** `ScoreRenderer.scene.test.ts` gained a chapter that
  renders four real bars in jsdom and asserts *one ledger line per bar, all at the same y, marching
  left to right, black, at the pinned weight, overhanging its head at both ends*. ⚠️ Every one of
  those needed a browser the day before.

**⛔ NO PIXEL MOVED.** The generic rule reproduces VexFlow's `doubleWidth` special case to the pixel
— that equivalence is asserted in the spec rather than assumed — and every number
(overhang 3 px, the ink style) is the one that was already on his screen. 6060 unit tests green.

### 1.3 🚨 The one thing this cost, and it is worth naming

`ScoreRenderer.scene.test.ts`'s break-test read `primitives.every(p => 'x' in p …)`. That was true
only while nothing in that fixture drew a **path** — a path keeps its coordinates in `ops`. The
first note ink to arrive broke it, which is the correct signal and not a flake: ⭐ **an assertion
over "every primitive" is an assertion about what the renderer currently draws**, and P3 changes
that by design. It is generalised now, not weakened.

---

## 1b. ✅ P3b — THE FLAG (2026-09-01)

### 1b.1 Why it was the second piece

**Because it has no owner at all, and because of what it exposes.**

- ⭐ **Eight lines, one glyph, one placement.** Grepped: `flag` is read by nothing in `src/`, the
  flag is not a kind in the `selectedElement` union, and no anchor or highlight map holds one. It
  draws inside the note's own `stavenote` group, so the selection recolour keeps working
  untouched — the same free ride P3a got.
- 🚨🚨 **It is `own-engraving-engine.md` §3's BUG CLASS, sitting in the open.** VexFlow places the
  flag vertically with `this.flag.getTextMetrics().actualBoundingBoxDescent` — a **runtime
  `measureText` on a canvas**. That is the identical mechanism that put every whole rest ~9.7 px
  off-centre until `musicFontReady` gated the first render. It answers **0 in jsdom**, and
  `engine/fonts/` has held Bravura's own answer to the same question since P2 (`flagGlyph`,
  `flagDropFromTip`).

### 1b.2 The rule, stated

> ⭐ **The flag's own outer edge meets the stem TIP** — its top for an up-stem, its bottom for a
> down-stem — **and it stands on the stem's left edge**, half a stem back from its centre line.

That is VexFlow's two branches with the sign of `Stem.getHeight()` folded out, and it agrees with
Gould from the other end (printed p. 16): a stem is measured so *"the tail should avoid overshooting
the notehead"* — ⭐ the flag hangs FROM the tip and the STEM is what grows, never the flag that
moves. ⛔ So nothing in `engrave/notes/flag.ts` clamps or nudges: a flag that looks wrong is a
stem-length question, and that is P3's stem piece.

### 1b.3 What landed

- `engine/engrave/notes/flag.ts` — `flagPlacement` (the rule, pure) + `drawFlag` (the ink).
- `EngravedNote.drawFlag()` — the adapter's half: the four numbers only a `StaveNote` can answer.
  ⚠️ `shouldDrawFlag()` stays VexFlow's and is **not** second-guessed; its `!beam` half is
  load-bearing here (a fanned slot wears a placeholder beam precisely to suppress its flag, and
  `applyTremoloStemStretch` keys off the same predicate).
- ⭐⭐ **The first GLYPH of a note in the scene**, where P3a put the first line: a `flag` group with
  one `text` primitive, asserted in jsdom — *a lone eighth draws one, a quarter draws none, two
  beamed eighths draw none.*

**⛔ NO PIXEL MOVED.** The glyph, its x, its baseline and its FACE are the ones VexFlow used — the
face is handed over as a value (`this.flag.fontInfo`), which is also what keeps `engrave/` free of
`vexflow`. 6060+ unit tests and 275 browser tests green.

### 1b.5 🚨🚨 …AND IT MOVED A RULER IT NEVER DREW ON — the bug this step shipped (found 2026-09-14)

⛔ *"No pixel moved"* was true and **not sufficient**, and that is the finding worth more than the
step itself.

**`Flag.draw` is not only ink: it is where the flag learns WHERE IT IS.** VexFlow's own
`StaveNote.drawFlag` is `this.flag.setContext(ctx).setX(flagX).setY(flagY).drawWithStyle()` — the
position is written onto the object **as a side effect of painting it**. And
`StaveNote.getBoundingBox()` then merges `this.flag.getBoundingBox()` whenever `hasFlag()`.

⇒ taking the ink without the write-back left every **unbeamed flagged note** (an eighth, a
sixteenth, a thirty-second not in a beam) reporting a box merged with the ORIGIN: an `Element`'s box
is `(x + xShift, y + yShift − ascent, w, h)`, so an untouched flag contributes `(0, −ascent)`.
Measured on his score: **`{x: 0, y: −33, w: 258, h: 122}` — the whole system.**

🚨 **It surfaced as a SLUR**, thirteen days later (his report: *"the slur is completely crazy"*).
Five sixteenths, four beamed into a beat and a fifth standing alone: the slur's obstacle solver read
that note's box as an intrusion spanning the bar and lifted the arch **361 px**, drawing
`M180 65 C198 −313.7, 234 −261.7, 252 45`. ⭐ Every part of the slur code was correct — it was
handed a false measurement, and *a guessing fallback gets believed* has a twin: **a ruler that
answers confidently gets believed too.**

⭐ **THE RULE, and it now stands at the top of `EngravedNote`:** *an override that takes the ink must
reproduce the WRITE-BACK.* `EngravedAccidental` and `EngravedDot` state it for `this.x`/`this.y`, and
the notehead's `setX` obeys it — the flag was the one member of the family that stopped painting
without keeping its answer, because it is the only one whose write-back is somebody ELSE's field.

⚠️ **Why no test caught it for thirteen days:** the picture was right (the ink is stamped at the same
place either way), the scene was right (it records what we draw), and `lint:paint` was right (the
ink is ours). **The only witness is a geometry READER**, and the note's box had no spec.
`EngravedNote.test.ts` is that spec now — and `npm run audit:tests` had been listing this module as
untested the whole time. ⭐ A jsdom test is enough: the flag's box has no measurable SIZE without a
font, but `mergeWith` merges the POINT, so `x === 0` is visible with no font at all.

#### 1b.5a ⭐ THE WHOLE FAMILY, AUDITED — one missed write-back implies others

Read from vexflow 5's source: what each base `draw()` ASSIGNS, and whether our override reproduces
it. ⭐ The flag was the only gap.

| base method | what it writes | ours |
|---|---|---|
| `StaveNote.drawFlag` | `this.flag.setX(…).setY(…)` | ❌ → **fixed 2026-09-14** |
| `NoteHead.draw` | `this.x = this.getAbsoluteX()` | ✅ `head.setX(x)` in `drawNoteHeads`, documented as a write-back |
| `Dot.draw` | `this.x`, `this.y` | ✅ `EngravedDot` |
| `Articulation.draw` | `this.x`, `this.y` | ✅ — we cut at `renderText`, so `draw()` still runs and writes them |
| `Accidental.draw` | `this.x`, `this.y` | ✅ `EngravedAccidental` |
| `Stem.draw` | nothing but `setRendered()` | ✅ |
| `Beam.draw`, `Stave.draw` | nothing | ✅ |

🚨 **And the reason the flag was the one that got missed is worth keeping**: it is the only override
whose write-back is on **somebody ELSE'S object**. Every other one writes `this.x`/`this.y` on the
class being overridden, so reading the method you are replacing shows it to you. `drawFlag` writes
`this.flag`'s fields — a different object, which the method you are reading only *mentions*.
⇒ ⭐ **the check is not "what does this method assign", it is "what does this method assign
ANYWHERE".**

#### 1b.5b ⭐⭐ WHAT IT SAYS ABOUT P6, and it reorders that queue — his question, 2026-09-14

> *"the whole project is to get rid of vexflow at the end, correct? so is the fix correct based on
> this?"*

⭐ **Yes, and the write-back is temporary BY CONSTRUCTION**: those two lines are calls *on* the object
being deleted, so they cannot be left behind — they go when the `Flag` does. While `StaveNote` is
still the RULER (§2.3: seven renderers, the registry, six highlight maps), an override that stops
writing a field the base wrote is a regression, and restoring it is the only honest answer.

⭐⭐ **But the deeper answer is that this bug is the strongest evidence yet for P6's premise**, and not
for the reason P6 was written down. *A box is COMPUTED from what was drawn, ⛔ not asked of an
object* — and **under a scene-derived box this bug is structurally impossible**: there is no field
for a draw to forget to write. The flag's glyph was in the scene, and on the page, in the right
place, the whole time. What was wrong was a *field*. That failure mode belongs to *asking an object
where it is*, and it does not exist on the other side.

⇒ ⏭️ **P6b's next kind should be the NOTE's own box, ⛔ not the dot or the articulation.** It is the
box with the most consumers, it is the one this bug cost an afternoon on, and taking it would also
retire `rendering/engraved/noteInkBox`'s splice hack — which today lifts the dynamics `Annotation` out of
VexFlow's LIVE modifier array, asks `getBoundingBox()`, and puts it back, because *"a union cannot be
un-merged"*. ⭐ The scene answer to that is `sceneInkBox`'s *"the caller chooses which children
count"*, which P6a built and which P3f/P3g's per-mark groups made findable.
⚠️ **The one thing to check before starting it**: whether any caller asks a note for its box BEFORE
it is drawn. VexFlow's is meaningless then too, but it returns a rectangle rather than null, so
something may be leaning on the number without knowing it.

### 1b.4 ⚠️ The one rule it bends, and the sentence that keeps it honest

`rendering/painter/glyphPainter` is *"the one place VexFlow still paints a glyph"*, and `flag.ts` stamps its
own. ⭐ **That is not a second copy**: what `glyphPainter` owns is **font RESOLUTION** — `new
Element(tag)` turning a tag into a `FontInfo`, its own header's *"the tag is not a comment, it
selects the font"*. The flag's face is already resolved, so `Element.renderText` is exactly the two
primitives we own. ⭐ And it has to be that way round: a layer that needed an `Element` to put a
glyph down could never be painted to PDF or recorded as a scene. Both files now say so.
(⚠️ 2026-09-19: `glyphPainter` has used no VexFlow since S13a — the resolution is ours too, from
`fonts/fontCategories` + `fonts/fontFace`.)

---

## 1c. ✅ P3c — THE STEM'S INK (2026-09-01), and ✅ P3e — its LENGTH (2026-09-16)

### 1c.1 The split, and it is the whole point of the commit

⛔ **P3c did not take the stem's LENGTH.** `own-engraving-engine.md` §6.1 listed stem length among
the places *"where we currently have no opinion"*, and its own rule is that a re-implementation
without an opinion is **strictly worse than a dependency**. ⛔ Taking the length then would have been
inventing a rule, which is the failure mode this project catches hardest.

⭐⭐ **THE GATE OPENED, AND THE ANSWER WAS THE NUMBER WE ALREADY HAD — P3e, 2026-09-16.**
`docs/research/stem-length-research.md` found **four treatises for four**, saying the same thing in the same
words: *a stem is one octave long, 3½ stave-spaces, measured from the CENTRE of the notehead* (Gould
p. 14, Ross p. 83, Stone p. 47, Gerou & Lusk p. 137). ⭐ And `Tables.STEM_HEIGHT` is 35 px = 3.5 × 10.
⇒ the length moved into `engrave/notes/stemLength` (`stemExtents`, `stemLineHeight`) with
`STEM_LENGTH_PX` in `inheritedDefaults` — **the one row in that table the research confirms rather
than disputes** — and no pixel moved. Verified against a plain `Stem` over 2,700 combinations of head
span, direction, extension and both y-offsets.

⭐ **The general lesson, and it is worth more than the stem**: *"we have no opinion"* is a claim with a
DATE on it. Before treating a port as gated, check whether the opinion has since been written down —
§6.1's list was written before the research library existed.

⛔ **What P3e did NOT take**: how much EXTENSION a note asks for — a flag's overhang, the per-duration
beam table, and the ramp that makes a stem reach the middle stave-line (the research's rule 2). It
reads a MEASURED flag height and is the NOTE's question, not the stem's; it arrives as an input.
⏭️ It meets `applyStemExtensions` from the other end in `docs/plans/beam-engraving-plan.md` §54.

⭐ **So the ink came alone, and it earned the trip on its own**, for P3a's reason: three owners.

| who stroked a stem | for what |
|---|---|
| `Stem.draw` (VexFlow) | every ordinary note |
| `FanPass`, the member loop | a fanned member's hand-drawn stem |
| `FanPass`, `geometry.stemLift` | the real note's stem, topped up to a lifted beam line |

The two in `FanPass` were the same four lines written twice — 🚨 *"the second owner is the tell"* for
the third time inside one element.

### 1c.2 🚨 The seam it had to keep, and it is an ID

The stem is the **first piece with a downstream reader**. The editor finds a stem's ink with
`note.getStem().getSVGElement()` — `document.getElementById(prefix(attrs.id))` — and then recolours
`querySelectorAll('path, line')` inside it (`HighlightController.applyStemHighlight`).

⭐ So `EngravedStem.draw()` opens `openGroup('stem', this.getAttribute('id'))` **exactly as VexFlow
did**, and the seam needs no change at all. ⛔ Drop the id and stem selection stops painting
silently, with nothing failing — which is why the scene spec asserts the group carries one.

⭐ **A `Stem` SUBCLASS, because every number `Stem.draw` reads is `protected`**: `xBegin`/`xEnd`,
`yTop`/`yBottom`, both y-offsets, both base offsets, `renderHeightAdjustment`, the stemlet pair.
From outside that is a cast per field; from inside it is ordinary access, and the expression is
VexFlow's own **moved rather than rewritten** — which is what "no pixel moved" means here.

⚠️ `EngravedNote.buildStem()` runs inside `StaveNote`'s CONSTRUCTOR, before the subclass's own field
initialisers — so it may touch nothing but the base's `isRest()`. That is why the ink surface is a
later setter rather than a constructor argument.

### 1c.3 ⏳ …and a third two-sources number, ⛔ not settled — **§3 row 5**

We stroke at VexFlow's `Stem.WIDTH` = **1.5 px = 0.15 staff spaces**, while `engine/fonts/` has had
Bravura's `stemThickness` = **0.12** since P2 — and `fontMetrics` already spends the font's number
on the ink table's arithmetic. ⭐ The same shape as the ledger overhang (§3.1) and the flag's reach
(§3.3), for the third time: **the room we reserve and the ink we draw come from two different
sources.** ⛔ HIS call, one argument.

⚠️ It is also a **stroked path, ⛔ not a filled rect** — VexFlow strokes, and matching it is what
keeps the commit pixel-free. `paint/DrawContext`'s header calls `fillRect` *"the workhorse… every
stem in this engine"*, which was true of the fan's beams and is not true of a note's stem. When the
length becomes ours the shape can be revisited on its own merits.

---

## 1d. ✅ P3d — THE NOTEHEADS (2026-09-01), and the note's ink is complete

### 1d.1 Why it needed no research, when the stem's length does

⭐ **Because nothing is being decided.** The glyph is chosen by the duration (VexFlow's table,
unchanged), the x comes from our own column solve, the y from the staff line — all three were
already ours or already settled. That is the same test P3a, P3b and P3c passed and the stem's
LENGTH fails: *is there a rule here we would have to invent?* ⛔ For the length there is, and §6.1 is
explicit that inventing one is worse than depending on VexFlow.

### 1d.2 ⚠️ An override of `drawNoteHeads`, ⛔ not a `NoteHead` subclass

The stem got a subclass because `buildStem()` is a one-line factory. `buildNoteHeads()` is
overridable too — but its `new NoteHead(…)` sits at the bottom of **forty lines** of VexFlow's own
second-interval displacement walk, and §6.7's rule cuts both ways: *"port the ALGORITHM, not the
FILE"* — copying that loop to change one constructor would re-import the dependency under another
name. ⭐ So the head objects stay VexFlow's and only their **ink** moves. (⚠️ Since S12j-a the head
is ours, `rendering/engraved/EngravedHead`, and the displacement walk is `rendering/format/chordHeadLayout`'s.)

What the override transcribes, from `NoteHead.draw()` inside `Element.drawWithStyle()`:

1. 🚨 **`setX(getAbsoluteX())` is a WRITE-BACK, and it is load-bearing.** `FanPass` already carries
   the warning — *"`NoteHead.draw` writes its own absolute x back into `x`, so a displaced head asked
   twice displaces twice"*. Exactly once, here.
2. 🚨 **…and the value must be KEPT, ⛔ not read back with `getX()`.** A `NoteHead` is a `Tickable`,
   whose `getX()` throws `NoTickContext` — which is precisely why `NoteHead.draw` reads the raw `x`
   field. ⚠️ **It threw on the first run**, and the renderer's per-measure `try/catch` swallowed it
   into a half-drawn bar: the scene spec caught it as *two stems where four were expected*, which is
   a good argument for asserting counts rather than presence.
3. ⚠️ **`drawModifiers` stays INSIDE the head's group** — that is where a chord's accidentals, dots
   and articulations land, and the highlight recolours by walking that group.
4. ⚠️ **The style wrapper stays on the VexFlow context.** `drawWithStyle` is `save` → `applyStyle` →
   `draw` → `restore`, and `applyStyle` can reach for shadow primitives {@link DrawContext}
   deliberately does not declare. Nothing here styles a notehead (`setStyle` is unused in this
   editor — every recolour goes through the DOM afterwards), so this is fidelity, not need.
5. 🚨 **The group's id is the seam**, exactly as for the stem: `g.notehead` is read by the
   highlight *and* by a dozen browser specs (`glyphs('g.notehead text')`). That coverage is why
   this was a safe piece to take: **276 browser tests are watching where noteheads land.**

### 1d.3 ⭐ The stamp got a home, because it had a second owner

P3b wrote `setFont` + `fillText` inside `engrave/notes/flag.ts`. P3d needed the same two lines.
⇒ `engine/engrave/glyph.ts` — *"putting one music glyph down, in a face that is already resolved"* —
collected on the commit that produced the second owner rather than after a third. ⭐ It is
deliberately **not** `rendering/painter/glyphPainter`: that module owns font RESOLUTION (`new Element(tag)`
→ `Metrics.getFontInfo(tag)`), and here the face arrives as a value, which is what keeps `engrave/`
free of `vexflow`.

### 1d.5 ⭐ Where the ink went, and the SECOND OWNER that is waiting for it (2026-09-01)

P3d took the heads' ink but left it **inline in the override**, so the one piece of the note that is
pure glyph-stamping was also the only one with no module beside `ledgerLines` (P3a), `flag` (P3b) and
`stem` (P3c). ⭐ It now has one — **`engine/engrave/notes/noteheads.ts`** — and `drawNoteHeads` reads
as the adapter it is.

🚨 **The second owner is `FanPass`, and it is BLOCKED — ⛔ do not "just move it".** A fanned group's
MEMBERS are bare `NoteHead`s painted on `vexContext`, which looks like a ten-line job and is not: the
fan's per-member group is stored as a raw `SVGGElement` for the highlight and the incremental-redraw
capture, so it cannot open on a `DrawContext` without an 11th `svgNode()` escape past a ceiling that
may only fall. Attempted and reverted 2026-09-01 — the measurements are
`own-engraving-engine.md` §5's **U2**, and the real blocker is **U3, the highlight**.

### 1d.4 ⛔ What P3d did NOT take — **§3 row 7**

**Which glyph a duration gets.** `fonts/noteheadGlyph()` has answered that from Bravura since P2, so
it is a **fourth** *"the room reserved and the ink drawn come from two sources"* candidate — beside
the ledger overhang (§3.1), the stem's thickness (§1c.3) and the flag's reach (§3.3, measured). ⛔ Like
the other three, his call rather than a tidy-up.

---

## 1f. ✅ P3f — THE MODIFIERS: the accidental and the augmentation dot (2026-09-14)

### 1f.1 🚨 How they were found, and why nothing had noticed

⭐⭐ **By CENSUS, not by reading the plan.** A bar with a sharp and a dotted eighth was rendered
through `recordScene`, and the page's `<text>` elements were diffed against the scene's:

```
SCENE 10 glyphs · PAGE 12
IN THE PAGE, NOT IN THE SCENE:  U+E262 accidentalSharp · U+E1E7 augmentationDot
```

🚨🚨 **Neither had ever appeared in the gauge.** `npm run lint:paint` counts the identifier
`vexContext`, and a modifier never mentions it: `StaveNote.drawModifiers` hands each one
`this.checkContext()`, which came from `voice.draw(ctx)`. So through P3a–P3d, P4, P5 and U1 — every
step that drove the residue from 24 to 9 — every accidental and every dot on every page was VexFlow
ink, uncounted and unrecorded. ⇒ ⭐⭐ **a ceiling nobody re-measured reads as coverage**, and the
answer is to count the INK rather than the identifier.

⭐ That census is now a test (`ScoreRenderer.scene.test.ts`): *"every glyph the page draws is in
the scene, and in the same order"*, beside a second one that states the boundary — an ARTICULATION is
still VexFlow's, asserted as a passing fact so the day it moves, it fails and says so.

### 1f.2 What landed

| | where |
|---|---|
| the accidental's ink + **its one rule** (*it hangs LEFT: the ink's right edge meets the point the note offers*) | `engine/engrave/notes/accidental.ts` |
| the dot's ink + **its one rule** (*lifted out of a staff line by half a space, in STAFF SPACES so a small staff lifts less*) | `engine/engrave/notes/augmentationDot.ts` |
| the seams | `rendering/engraved/EngravedAccidental.ts`, `rendering/engraved/EngravedDot.ts` |

⭐ Both are `InkSurfaceAware` — the membership `EngravedStave`'s modifier walk already asked
(P5b, `rendering/painter/inkSurface.ts`). `drawNoteInkThrough` now walks `note.getModifiers()` and hands the
surface to anything that accepts one, so ⛔ **the third and fourth members were a ROW, not a third and
fourth `instanceof`** (`CLAUDE.md`'s rule: *a slice too thin to be logic is still a slice*).

⚠️ **`Dot.buildAndAttach` had to be replaced too** — it is a STATIC that says `new Dot()` inside
itself, so substituting the class means substituting the builder (`attachEngravedDots`).

### 1f.2b 🚨 The bug it surfaced, and it was NOT in the ink

⭐ Looking hard at accidentals is what found it. On the same day he built a five-note chord with a
natural on G4 and a sharp on C5, selected **C4**, and the **natural** lit up.

⛔ Nothing in P3f caused it: the DOM order, the groups and the glyphs are byte-identical (284 e2e).
The fault was in `ScoreRenderer`'s registration loop, which decided which pitch an accidental
belonged to with a three-clause `||` ending in a **guess** — *"the Nth accidental belongs to the Nth
pitch"* — so the natural was filed under C4. ⇒ 🚨 **an `||` fallback only runs when the true answer
said NO, which makes a guess an override, not a fallback.** Now it asks `Accidental.getIndex()`
(public API) and registers nothing when the answer is no. Written up in
`docs/plans/accidental-stamp-plan.md` §2; spec `ScoreRenderer.accidentalRegistry.test.ts`.

### 1f.3 ⛔ What P3f did NOT take

⛔ **`getModifierStartXY`** — where a note offers its modifiers a place to stand, and this repo's one
live monkeypatch (§2.4 of the parent calls it *"the shape of the whole problem"*). Both classes ask
the same question at the same moment and get the same answer. ✅ **Taken since by S5a (2026-09-15)**:
`engrave/notes/modifierStart`, answered by `EngravedNote`, and the monkeypatch is gone
(`docs/history/vexflow-removal-map.md` §9).

⛔ **`Accidental.format`** (which column of a chord's stack a sign takes) and **`Dot.format`** (which
way a dot dodges its line when a chord stacks them). Both are real engraving rules; ⭐ the survey that
would let us choose our own is **`docs/research/accidental-dot-research.md`** (the treatises) and
**`docs/research/accidental-dot-engines.md`** (LilyPond / MuseScore / Verovio / VexFlow), commissioned
2026-09-14 for exactly this reason. ⛔ Until they are read, the placement stays VexFlow's — the same
split the clef took in P5b. ⭐ **Both are OURS as transcriptions since S9c/S9d**
(`engrave/notes/dotStack`, `engrave/notes/accidentalStack`, run by `rendering/format/modifierColumns`) — VexFlow's
rules kept exactly, so choosing another from the surveys is now an edit to those modules.

⚠️ **Two VexFlow branches are deliberately not transcribed**, and both are guarded rather than
assumed away: a cautionary accidental's bracket `children` (nothing calls `setAsCautionary` in this
repo) and the `TabNote` case in `Dot.draw` (no tablature here). Each class hands those back to
`super.draw()`, so *"not transcribed"* can never become *"silently not drawn"*.

---

## 1g. ✅ P3g — THE ARTICULATION (2026-09-14), and it is a lesson about WHERE TO CUT

### 1g.1 ⭐⭐ The row that said "not ink alone" was wrong, and the correction is worth more than the step

§0.1's table used to refuse this piece:

> *"⛔ **not ink alone**: its `draw()` is a placement RULE (above/below, clear of the staff, between
> lines), so it is gated on research the way the stem's length is."*

⭐ The first half is TRUE — `Articulation.draw()` is forty lines of placement (`getTopY` /
`getBottomY` / `getInitialOffset`, a private `snapLineToStaff`, and `setOrigin`) and exactly ONE line
of ink. ⛔ **The conclusion drawn from it was not.** It assumed the cut has to be `draw()`, because
that is where P3a–P3f cut — and at `draw()` taking the ink does mean transcribing the rule.

⭐⭐ **`Articulation.draw()` ends with `this.renderText(ctx, 0, 0)`, and `renderText` is a public
method.** Override THAT and the placement is untouched: the rule keeps its one owner, the ink becomes
ours, and the seam is a point that VexFlow has just finished computing. ⇒ **the piece was never
gated on research; it was gated on a reading of the class.**

🚨 And the cost of the other choice was already MEASURED in this repo, which is what makes this
more than a preference: `rendering/beams/fanArticulations` hand-rolled a *"one staff space per mark"* rule
for a fan's members and landed a staccato **2 px** off the identical mark on the note beside it,
*"because a between-lines glyph gets snapped into a space and re-originned"*. ⭐ §3.1 of the parent
(*"the second owner is the tell"*), applied BEFORE writing the second owner instead of after.

⭐ That same file had already found this seam from the outside — it runs `draw()` against a context
that throws the ink away, then calls `renderText` itself. ⚠️ Nobody had read it as a statement about
where an articulation's ink separates.

### 1g.2 What landed

| | where |
|---|---|
| the ink, and the one thing it says (*an articulation STRADDLES its point — its siblings meet it or sit on it*) | `engine/engrave/notes/articulation.ts` |
| the seam | `rendering/engraved/EngravedArticulation.ts` — `InkSurfaceAware`, so joining `drawNoteInkThrough`'s walk was a ROW and nothing else |
| the builder | `NoteBuilder` builds ours; ⛔ `GhostRenderer`'s and `fanArticulations`' stay VexFlow's (P3/U2 territory, both allowlisted) — ⚠️ ours too since S11/S12 |

⭐ **The census is now COMPLETE for an ordinary bar** — the test that used to assert *"exactly ONE
glyph the page draws is missing from the scene"* now asserts the page and the scene hold the same
glyphs, in the same order, on a bar carrying a sharp, a dot AND a mark.

### 1g.3 ⚠️ `_ctx: unknown` — the one thing here that needed a decision

`renderText`'s first parameter is VexFlow's `RenderContext`, and ⛔ naming that type outside
`lint:paint`'s allowlist is the one thing that check refuses — it is why `EngravedBeam`
overrides the public `draw()` rather than the `protected drawBeamLines(ctx: RenderContext)` it would
rather have had.

⭐ Here the honest answer is that **the file does not use VexFlow's context at all**: the ink goes to
our surface, and the fallback (an unset ink surface) asks `checkContext()` — which every reachable
caller has just handed in as that very argument. ⇒ the parameter is genuinely unused, so it is typed
`unknown` and the allowlist did not grow. ⛔ Not a dodge and ⛔ not a precedent for naming-around the
check: if a file ever DRAWS on VexFlow's context, it belongs on the list.

### 1g.4 🚨 What the step found, and it is a P6 customer

**An articulation's CENTRING is a runtime `measureText`.** `setOrigin(0.5, …)` is `getBoundingBox()`
arithmetic and that box comes from `Element.measureText()` — so it answers **0 in jsdom**, exactly as
the flag's reach does (§3.3) and as every whole rest's centring did before `musicFontReady`. ⇒ ⭐ **an
articulation in a unit test is not centred**, and that is a fact about the instrument rather than
about the drawing. It is one more customer for **P6**'s own ruler, which can answer a glyph's box
without a page.

### 1g.5 ⛔ What P3g did NOT take

⛔ **`Articulation.draw` and `Articulation.format`** — the side, the distance out, the stacking, the
snap onto a line or into a space. The parent's §"Not on this list" keeps them on a **port-if-needed**
list for a reason, and no research of ours answers them yet. ⭐ **(2026-09-16) The STACKING —
`Articulation.format` — is ours as a transcription since S9e** (`engrave/notes/articulationStack`);
`Articulation.draw`'s placement from the text line is still VexFlow's. (⚠️ Ours as a transcription
since S12f — `engrave/notes/articulationPlacement`.)
⭐ One part of the placement was ALREADY ours and stays so: notehead-vs-stem alignment on the stem
side (`docs/how-it-works/articulation-stem-align.md`), which reaches the ink inside the x.

⛔ **The FAN's marks** (`rendering/beams/fanArticulations`) and ⛔ **the GHOST's**. Both draw inside groups
opened on VexFlow's context — U2's nesting argument, unchanged by this step. (⚠️ 2026-09-19: there
is no VexFlow context left — every group is opened on our `DrawContext`, `npm run lint:paint` at 0.)

### 1g.6 ⭐⭐ …and then he looked at `__bbox.ink()`, and the family grew a GROUP

Three reports, one gap (2026-09-14): *"i dont see the articulation on `__bbox.ink()`"* → *"the
`__bbox.ink()` of the notehead becomes bigger with articulation, is this correct?"* → *"i dont see
the bbox of the dot either"* → *"same with accidental"*.

⭐ **All four are one fact: VexFlow's modifiers open NO group.** An accidental's, a dot's and a mark's
`<text>` landed loose inside the notehead group its note had opened ⇒ the overlay, which draws one box
per GROUP, had nothing to draw for any of them — **and the head's box silently swallowed all three.**

🚨 **That second half is `noteInkBox`'s complaint, arriving from our own side of the ruler**:
*"`StaveNote.getBoundingBox()` unions every attached modifier"* was HIS report, and the scene had just
reproduced it. ⭐ `sceneInkBox` was built with the answer — *the CALLER chooses which children count* —
and `__bbox.ink()` now makes that choice: **a group's box is its OWN ink; a nested group is drawn on
its own.**

⭐ So each mark opens a group named for **the kind the REGISTRY files it under** (`accidental`,
`dot`, `articulation`) and carrying the drawn sign's own id — which is P6b's seam: a scene group that
can be matched to the hit box a click already resolves against.

✅ **And P6b took the first of the three the same day** (2026-09-14): the **ACCIDENTAL's hit box is
now computed from its own stamp** (`rendering/painter/drawnHitBox`), so the box the registry files and the
box `__bbox.ink()` draws are the same rectangle. ⚠️ The dot and the articulation still store
`Element.getBoundingBox()` — and the articulation should follow its own taste call rather than lead,
because its VexFlow box is the one that goes NaN in jsdom (§1g.4 above).

⚠️ **It is a DOM change, and the only one this family has made.** What makes it safe is that every
selector that reaches these glyphs is a DESCENDANT search — `group.querySelectorAll('text')` for the
accidental and the dots, and the articulation's `'text, path'` walk **whose index 0 is still the
head** — so document order and every index are unchanged. Asserted in
`ScoreRenderer.scene.test.ts` rather than assumed, and 291 e2e agree.
⚠️ The FACE is unaffected too, and that needed checking: `SVGContext.applyAttributes` omits an
attribute equal to the enclosing group's, so the worry was that a new group would swallow the font.
It does not — `fillText` writes the font onto the `<text>` whenever it differs from the group's.

⭐ **What this did NOT change: SELECTION.** A click resolves against `ElementRegistry`, which has
filed a separate box per accidental, dot and articulation all along (`__bbox.show()`, 208 boxes to
`ink()`'s 149) — his question, and the answer is that the scene was the only ruler missing them.

---


## 1e. ⏸️ THE POINTER RECT — audited, and DEFERRED to P1e (his call, 2026-09-01)

### 1e.1 What it is

The last thing `StaveNote.draw()` does, and ⛔ **it is not ink**:

```js
const bb = this.getBoundingBox()
ctx.pointerRect(bb.getX(), bb.getY(), bb.getW(), bb.getH())
```

…which in the SVG context is `rect(x, y, w, h, { opacity: '0', 'pointer-events': 'auto' })` — an
**invisible rectangle over the note's whole bounding box, whose only job is to be clicked.** It is
VexFlow's offer to applications that hit-test through the DOM. Only `StaveNote` and `Tuplet` emit
one.

⚠️ And that box is a fat one: `StaveNote.getBoundingBox()` **unions every modifier**, so it spans the
note plus its accidentals, dots and articulations (this codebase already met that — it is why
`noteInkBox` exists).

### 1e.2 ⭐ The audit — measured and grepped, 2026-09-01

**Emitted:** one per drawn `StaveNote`, rests included — counted **6 for 6** in a real render, each a
direct child of its own `g.stavenote`.

**Consumed by: NOTHING in this repo.**

| candidate | verdict |
|---|---|
| `elementFromPoint` / DOM hit-testing | ⛔ does not exist in `src/` — hit-testing is `ElementRegistry`, pixel → stored box |
| `event.target` on the score | the only three reads are `MouseController`'s, and all ask *"is the target the scroll CONTAINER (scrollbar/gutter)?"* — a click anywhere on the SVG targets the `<svg>`, so its contents are irrelevant to the guard |
| the note's selection highlight | sweeps `text, path` — ⛔ never `rect` |
| the stem's highlight | `querySelectorAll('path, line')` — ⛔ never `rect` |
| the one highlight that DOES sweep rects | scoped to `g.systemsign` (braces/brackets) — never reaches a note |
| the browser harness's rect readers | scoped: `g.stavebarline rect`, `rect.score-page-sheet` |
| CSS | no rule targets them |

⇒ **inert DOM: one extra element per note, per render**, plus a copy in every exported SVG/PDF
(where the export's own `pointer-events:none` makes them doubly inert).

⚠️ One detail for whoever measures them later: **in jsdom they are ZERO-WIDTH** — the sample rect has
no `width` attribute at all, because `getBoundingBox()` unions glyph widths and a glyph measures 0
without a font. In a browser they carry the note's real box.

### 1e.3 ⛔ HIS DECISION: not now — and it is the right layer, not just the safe one

> *"if at the end when we finish and we are safe to get rid of VexFlow we realize we don't really
> need it then we know we can really drop it"* (2026-09-01)

⭐ **And it is not merely deferral — it is the correct owner.** The pointer rect cannot be dropped
from where P3 stands anyway: `ctx.pointerRect(...)` is called by `StaveNote.draw()` itself, not by
any of the four methods P3a–P3d override, so removing it means overriding **`draw()`** — and that
method also opens the note's own `stavenote` group, which is **P1e's** territory (it is the last
thing keeping a whole note out of the scene).

⭐⭐ **So the question resolves itself at P1e rather than being answered twice**: a painter of ours
emits a hit surface only if something asks for one, and today nothing does. ⚠️ `paint/DrawContext`
keeps `pointerRect` as a declared primitive regardless — the scene records it as *"not ink"* on
purpose, because *"a hit surface silently going missing is a real bug"*.

⚠️ **What to re-check before dropping it, whenever that is:** that nothing has since started reading
`event.target` inside the score SVG, and that no browser behaviour depends on a note being a pointer
target (the audit above is a grep and a render — it is not proof about a browser's own hit testing).

---

## 2. ⭐ What the books say about a ledger line — Gould pp. 26–27

Located in `reference/gould-behind-bars-fulltext.txt`, read on the rendered pages (PDF page =
printed page + 20; printed 26 carries the general rules, printed 27 *Adjacent-note chords* and
*Double-stemmed adjacent notes and overlapping parts*).

| she says | we do |
|---|---|
| *"Ledger lines are an extension of the stave. They are spaced the same distance apart as stave-lines"* | ✅ `stave.getYForNote(line)` — the same spacing, asked of the staff rather than computed |
| *"…but they are **about twice as thick**"*, so a player *"can take in the number of ledger lines at a glance"* | ⚠️ **1.23×** — §3 |
| *"The ledger line extends slightly beyond either side of the notehead and is **just over two spaces long**"* | ⚠️ **1.78 spaces** — §3 |
| *"Ledger lines of adjacent notes should not join up… the lines may be slightly shortened in cramped conditions"* | ✅ horizontally, via the ink table (`INK.ledgerLeft/ledgerRight` + the `note↔ledger` padding row); ✅ the shortening, for the one case we shorten (`ledgerAccidentalClearance`) |
| *"When the displaced note is on a line, the ledger line extends the full width of both notes; when the displaced note is in a space, the last ledger line is shortened to single notehead width"* | ✅ and it is now ONE sentence: a run reaches from the leftmost head that reaches its level to the rightmost |
| *"Notes further from the stem end than the adjacent pair take single-width ledger lines"* | ✅ same sentence |
| *"The two parts may share ledger lines… ledger lines that are not shared by the part whose pitch is closest to the stave should not cut through its stem"* | ⛔ **not done** — §4 |
| Grace notes take ledger lines *"shorter and thinner"* | ⛔ not applicable — no grace notes yet |

---

## 3. ⏳⏳ WHAT AWAITS HIS EYE — every number P3 found and did not change

⛔ **None of these is a drift to fix, and ⛔ none is decided by finding a citation.** Each is a place
where a source disagrees with a number already on his screen, which makes it a **taste call with
evidence** — the shape `docs/plans/font-metrics-plan.md` §3.6 already batches six of, and this is P3's own
list beside it. ⭐ **Every one is a ONE-ARGUMENT change**; what they need is his eye, not work.

⭐⭐ **The recurring shape, and it is why they are collected rather than scattered: four times over,
THE ROOM WE RESERVE AND THE INK WE DRAW COME FROM TWO DIFFERENT SOURCES.** `engine/fonts/` has
answered each of these from Bravura since P2, while the drawing keeps VexFlow's number. That is not
a bug — nothing looks wrong — but it means the layout is spacing for one picture and the painter is
drawing another.

| # | what | we draw | the source says | argued in |
|---|---|---|---|---|
| 1 | ledger **overhang** | 0.30 sp | font **0.40**; Gould p. 26 *"just over two spaces long"* — ⚠️ and `INK.ledgerLeft/Right` **already reserve 0.40** | §3.1 |
| 2 | ledger **weight** | 1.23× a staff line (the font's ratio) | Gould p. 26 *"about **twice** as thick"* | §3.2 |
| 3 | flag **reach** | the canvas, 1 px | Bravura 0.36 px — ✅ **measured, they agree within a device pixel**, and the table is the finer instrument | §3.3 |
| 4 | stem **shortening ramp** | nothing (VexFlow never shortened, and the port kept that) | 🚨 five sources, **five different slopes** | §3.4 |
| 5 | stem **thickness** | **1.5× a staff line** | ⭐ three treatises: *thinner*; Bravura 0.12/0.13. **Nothing supports what we draw** | §1c.3 |
| 6 | `FAN_MIN_STEM_SPACES` | **2.0 sp**, marked *PROVISIONAL* in its own comment | the books' floor is **2.5** (a sixth) | §3.5 |
| 7 | which **notehead glyph** a duration gets | VexFlow's table (ported as is) | `fonts/noteheadGlyph()` since P2 | §1d.4 |

⚠️ **#5 is the sharpest**, because it is the only one where no source at all backs the current
number: three books say a stem is thinner than a staff line, Bravura encodes that, and the two
engines that disagree (LilyPond +30%, Verovio +33%) are still less extreme than ours at +50%.

### 3.1 The OVERHANG — 0.3 spaces drawn, 0.4 in the font, *"just over two spaces"* in Gould

- We draw VexFlow's `LEDGER_LINE_OFFSET`, **3 px = 0.3 spaces** each side. A notehead is 1.18, so a
  ledger line is **1.78 spaces** long.
- Bravura's own `legerLineExtension` is **0.4**, which makes it **1.98** — and Gould's *"just over
  two spaces"* is the sentence that number is trying to be.
- 🚨 **The ink table already believes the font**: `INK.ledgerLeft/ledgerRight` are held against
  `ledgerExtension()` in `layout/spacingPadding.font.test.ts`, where the difference is recorded as
  an override reading *"⏭️ HIS EYE (§3.6 #5)"*. So the spacing model reserves 0.4 and the drawing
  paints 0.3 — ⭐ **the two halves of this editor already disagree, and this is the same open
  question seen from the drawing side.**
- ⭐ Now a **one-line** flip: `EngravedNote.ledgerOverhang`. Before P3a it was VexFlow's constant.

### 3.2 The WEIGHT — 1.23× drawn, 2× in Gould

- `layoutConfig.LEDGER_LINE_STYLE` draws black at Bravura's `legerLineThickness /
  staffLineThickness` = **1.23×** the staff line, pinned by `rendering/ledgerLineStyle.test.ts`,
  which argues (correctly) that an *absolute* 0.16 spaces would be too heavy beside the 1 px staff
  line VexFlow actually draws.
- ⚠️ **Gould says about twice as thick, and gives the reason** — *counting* ledger lines at a
  glance, which is a legibility argument rather than a proportion one. Her number and the font's are
  a real disagreement, and the pinned decision cites the font without having heard her.
- ⛔ Not changed. ⭐ What P3a adds is that it *can* be: the ledger's weight and the staff line's are
  about to be the same layer's business (`layoutConfig`'s own comment: *"⏭️ when P3 draws staff
  lines itself, this becomes the plain `legerLineThickness`"*).

---

### 3.3 ✅ The FLAG's REACH — MEASURED 2026-09-01, and the answer is: they agree

⭐ Unlike §3.1 and §3.2 this was not a taste call but a question with a checkable answer, and P3b
left it open on purpose. `e2e/flag.e2e.ts` is the measurement.

| | canvas (`actualBoundingBox*`) | Bravura (`glyphBox`) | Δ |
|---|---|---|---|
| up-stem, `flag8thUp` U+E240 | 1 px | 0.36 px | 0.64 px |
| down-stem, `flag8thDown` U+E241 | 1 px | 0.56 px | 0.44 px |

🚨 **Chromium reports those metrics as WHOLE DEVICE PIXELS** — every probe came back an integer — so
the canvas *cannot* say 0.36, and both its answers are exactly the font's number rounded UP to the
next pixel (asserted, not merely tolerated). ⭐⭐ **So the table is not merely as good as the runtime
measurement, it is finer**, and the placement can stop depending on a canvas altogether — which
would also make the flag's y a jsdom unit test instead of a browser one.

⏳ **⛔ NOT SWAPPED. HIS CALL** — it moves every flag by ~0.6 px toward its stem tip. Sub-pixel, and
still ink that moved. One argument, `EngravedNote.drawFlag`'s `reach`.

#### ⚠️ Three things the measurement got wrong before it got it right — all worth keeping

1. **§3.3's own first draft named the wrong font number.** It said `flagDropFromTip`. ⛔ That one
   takes the OPPOSITE side of the glyph (`box.down` for an up-stem) because it answers *"how far
   does the flag hang back from the tip"* — an ink EXTENT, which is what `layout/measureColumns`
   reserves room with. The placement needs the reach on the side that MEETS the tip:
   `glyphBox(flag).up` for an up-stem. ⭐ A plausible one-line change, and a wrong one. **This is
   what "measure first, do not assume" was protecting.**
2. **Inferring the reach from the DRAWN PICTURE gave −0.2 sp both ways up.** `Stem.draw` ends its
   line at `stemY − height − renderHeightAdjustment × direction`, and `adjustHeightForFlag` writes
   that adjustment **from the flag's own height** — so the drawn stem tip and the tip the flag is
   placed against are ⛔ not the same y, and anything measured between them is two numbers added.
3. 🚨🚨 **Measuring the glyph in the WRONG FACE gave a confident 0.66 sp disagreement.** The spec read
   `font-family` off the `<text>`, which has none — VexFlow's SVG context puts the font on the
   **GROUP** and the text inherits it. `canvas.font = '30pt '` is invalid, so the canvas kept its
   default 10 px sans-serif and measured the **tofu box** of a glyph that face does not have.
   ⭐⭐ **That is §3's own bug — *beating the font bakes in a FALLBACK* — reproduced by accident
   inside the spec investigating it.** The spec now asserts `document.fonts.check(...)` before it
   believes a number.

### 3.4 🚨🚨 THE STEM'S LENGTH — MEASURED 2026-09-01, and VexFlow already does 2½ of the 3 rules

> ⚠️ 2026-09-19: VexFlow is removed — the middle-line override below is ours now, transcribed into
> `EngravedNote.getStemExtension` (the length itself is `engrave/notes/stemLength`). The measurement
> and the gap it found are unchanged.

📄 `docs/research/stem-length-research.md` is the literature. This is what the **running code** does, which is
a different question and had to be measured rather than read.

**Five unbeamed notes, treble, rendered and read off the SCENE (P3c put stems there):**

| note | stem | tip y |
|---|---|---|
| G4 — inside the staff | 3.50 sp | 55 |
| C4 — 1st ledger below | 3.50 sp | 75 |
| A3 — 2nd ledger below | **4.00 sp** | **80** |
| F3 — 3rd ledger below | **5.00 sp** | **80** |
| C3 — 5th ledger below | **6.50 sp** | **80** |

⭐ On this staff **y = 80 is B4, the middle line.** Every stem from the second ledger line out is
clamped to it, and C4 keeps 3½ because its tip already passes it. The source is
`StaveNote.getStemExtension()`:

```js
const MIDDLE_LINE = 3
midLineDistance = up ? MIDDLE_LINE - this.maxLine : this.minLine - MIDDLE_LINE
const linesOverOctaveFromMidLine = midLineDistance - 3.5
if (linesOverOctaveFromMidLine <= 0) return superStemExtension
return superStemExtension + linesOverOctaveFromMidLine * spacingBetweenLines
```

| the treatises' rule (§`stem-length-research.md` §1) | the running code |
|---|---|
| 3½ spaces from the notehead's centre | ✅ `Tables.STEM_HEIGHT = 35` |
| always reach or cross the middle line | ✅ the override above, biting in exactly the right place |
| forced-away stems shorten, floor 2½ (a sixth) | ⚠️ **HALF** — it *declines to lengthen* a forced stem (`if (stemDirection !== calculateOptimalStemDirection()) return superStemExtension`) but never shortens one |

⏳ **So the only gap is the SHORTENING RAMP — and it is the one thing five sources disagree about**
(§5.1 of the research: Gould draws ¼ sp per degree while writing three quantised values, LilyPond
and Verovio ramp at ⅙, Ross quantises, Stone gives a range, Gerou & Lusk call it contextual).
⛔ **HIS call. There is nothing here to implement without picking a slope**, and §6.1's rule is that
a re-implementation with no opinion is worse than the dependency.

#### 🚨🚨 The lesson, and it nearly cost a duplicated rule

I reported *"VexFlow does not implement the middle-line rule"* after reading
`StemmableNote.getStemExtension()` — and **missed that `StaveNote` overrides it**. ⭐ **His eye caught
it from the page** (*"why do I see in the UI that the stem reaches the middle?"*, with a B2 in treble
whose stem runs 7 spaces to B4), and a five-line probe through the scene settled it in seconds.

⭐⭐ **§6.1 says *"we have no opinion"* is a claim about the library shelf that must be re-checked per
feature. This is its MIRROR: *"VexFlow has no opinion"* is also a claim, and it has to be MEASURED,
not read.** A class chain is not a function. ⛔ Had it gone unchecked, P3 would have added a rule the
renderer already applies — and applied it twice.

### 3.5 ⏳ `FAN_MIN_STEM_SPACES` — 2 spaces, and the books say 2½

`rendering/beams/FannedBeam.ts` sets the shortest stem a fanned MEMBER may keep before the beam line is
pushed away to give it room:

```ts
export const FAN_MIN_STEM_SPACES = 2
```

…and its own comment ends **"PROVISIONAL"**. ⭐ It is not tidiness — without a floor a member whose
pitch sits past the line's reach gets a zero-length and then a NEGATIVE stem, drawing through its own
head. But the number was invented, honestly labelled as such, and the literature now answers it:
**the minimum stem is a sixth, 2½ spaces** — Gould p. 14, Stone p. 49 and Gerou & Lusk p. 137 all
name the interval and the number in the same breath (`docs/research/stem-length-research.md` §1).

⚠️ **Two honest qualifications, and they cut both ways:**

- ⛔ A fanned member is **contemporary notation, outside those treatises' scope**. They are describing
  ordinary stems; nobody wrote a rule for a feathered beam's inner members. So 2 is not *wrong*, it is
  *unsourced* — a different thing.
- ⭐ And Gould's own plate goes below her stated floor anyway: her p. 14 shortening figure draws
  **2.41 sp** at its shortest (§3.4). So even the book that states 2½ engraves less.

⛔ **Not changed. HIS.** One constant, and the case for moving it is "the only number in the family
with no source" rather than anything visible on the page.

---

## 4. ⏭️ WHAT IS NEXT — the candidates, ⛔ not a queue

⛔ Nothing here is scheduled. Listed with its price so the choice can be made on evidence.

- **Shared ledger lines between voices** (Gould p. 27). Every voice draws its own today, so two
  parts at the same level paint two identical lines and *"a ledger line not shared should not cut
  through the nearer part's stem"* is not expressed at all. ⭐ Cheap now — the rule is a function of
  a bar's heads across lanes, and the drawer already takes runs as values. ⚠️ Needs a real
  multi-voice example on his screen first: nobody has reported it.
- **The asymmetric accidental trim** (LilyPond: shorten the LEFT end only, keep the right).
  `ledgerAccidentalClearance` says in as many words that it *"needs the lines to be ours to draw"*.
  ⭐ They are now. ⛔ Still not taken — the symmetric trim is what is on his screen.
- ✅ ~~**The FLAG.**~~ — done, P3b. ⏭️ What it left behind is §3.3, and that is a browser
  measurement rather than a code change.
- **The DOTS.** `dotPlacement` is already ours and already moves them post-format; drawing them
  would let `reserveDotRoom` stop being a modifier-width trick. ⚠️ Dots are `Modifier`s, so this is
  the first piece that touches the modifier machinery.
- ✅ ~~**The STEM's ink.**~~ — done, P3c. ⏳ Its **LENGTH** is researched
  (`docs/research/stem-length-research.md`) and **measured against the running code** (§3.4): VexFlow already
  applies 2½ of the 3 unanimous rules, and the only gap — the shortening ramp — is the one thing
  five sources disagree about. ⛔ **Nothing to build without HIS slope.**
- ✅ ~~**The NOTEHEAD.**~~ — done, P3d. ⚠️ Note that `Stave.padding`, which the parent plan hangs on
  P3, is NOT unblocked by owning the head's ink: it is a LAYOUT number (where the note area starts),
  and that is a different piece of VexFlow. (⚠️ 2026-09-19: ours now too — the `NOTE_AREA_PADDING_PX`
  row of `engrave/inheritedDefaults`; the number is unchanged.)

---

## 5. ⚠️ The standing hazards, for whoever takes P3b

1. 🚨 **A `StaveNote` that stops painting must not stop answering.** Seven renderers, the registry
   and six highlight maps read its geometry (§0).
2. 🚨 **Ink drawn on `checkContext()` is invisible to the scene.** (⚠️ Moot since S13b: every
   context is our `SvgPainter` and the scene records it all.) `voice.draw` hands VexFlow the
   real `SVGContext`, so anything we take back has to be pointed at `RenderPass.context` —
   `drawNoteInkThrough` is that line, and forgetting it costs a scene entry silently while the page
   still looks right.
3. ⚠️ **Draw order is meaning.** `drawLedgerLines` runs before the stem and heads, so the heads paint
   over the line ends. Anything taken out of order changes what covers what.
4. ⚠️ **The ghost is a second population.** (⚠️ Since S11 the ghost is drawn by the score's own
   classes, no VexFlow.) `GhostRenderer` builds plain `StaveNote`s and keeps
   VexFlow's drawing for every part; a number changed on one side must be changed on both until the
   ghost becomes *"a scene with a style"* (§7.2).
5. ⛔ **jsdom measures every glyph 0 wide.** A scene assertion about a *level*, a *count* or a
   *relative* x is real; one about an ink EXTENT is measuring zeros and agreeing with itself.
