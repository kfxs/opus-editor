# P3 — THE NOTE, taken one piece of ink at a time

> 📄 The parent is `docs/own-engraving-engine.md`; this document is its **P3**, the item that plan
> calls *"⚠️ THE BIG ONE"*. ⛔ Read §0 of that document first — the goal order, the twelve standing
> rules, and the one-line test — because everything below is an application of it.
>
> **Status: P3a ✅ ledger lines · P3b ✅ flag · P3c ✅ stem INK · P3d ✅ NOTEHEADS — all 2026-09-01.**
> ⭐⭐ **All five of `StaveNote.draw()`'s drawing calls are ours** (the pointer rect is the RULER, not
> ink). ⏳ **What is left is the stem's LENGTH**, gated on `docs/stem-length-research.md`.

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
**RULER** — `docs/own-engraving-engine.md` §2.3 measured it — and **seven of our own renderers read
it**: `SlurRenderer`, `TieRenderer`, `TrillRenderer`, `OttavaRenderer`, `PedalRenderer`,
`HairpinRenderer`, `FanPass`, plus `ElementRegistry`'s hit-testing and the six highlight maps. So a
`StaveNote` that stops *painting* must keep *answering* — `getStemX`, `getStemExtents`, `getYs`,
`getNoteHeadBeginX`, `getAbsoluteX` — and that is not a thing you can do halfway through a big-bang
replacement.

⭐ **So the shape of P3 is: keep the object, empty the drawing, one method at a time.**
`engine/rendering/EngravedNote.ts` is that seam — a `StaveNote` subclass whose override list is the
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
| **P3d** | **the noteheads** | ⭐ the last drawing call, and it needs **no engraving opinion**: the glyph is chosen by duration, the x by our own column solve, the y by the staff line | ✅ **2026-09-01** |
| **P3e** | ⏳ **the stem's LENGTH** | ⛔ **gated**: `docs/stem-length-research.md` must state the rule first (§6.1 of the parent) | ⏭️ |
| … | the dots, the accidentals | modifiers — they draw from inside a head's group, and both are selectable kinds with registered hit boxes | ⏭️ |
| **last** | the pointer rect + `getBoundingBox` | ⚠️ that one is the RULER, not the ink — it moves with the registry, not with the drawing | ⏭️ |

⛔ **`Stave.padding` is not unblocked until the noteheads move**, which is what the parent plan
promises for P3 as a whole and what makes it worth finishing.

---

## 1. ✅ P3a — THE LEDGER LINE (2026-09-01)

### 1.1 Why it was the right first piece — the measurement, not the taste

**It had three owners, and two of them said so in their own comments.**

| who drew it | for what | what its comment said |
|---|---|---|
| `StaveNote.drawLedgerLines` | every real note | (VexFlow's) |
| `FanPass.drawFanLedgerLines` | a fanned member's hand-drawn head | *"🚨 LEDGER LINES BY HAND. `drawLedgerLines` belongs to `StaveNote`; a bare `NoteHead` only swaps to the ledger glyph"* |
| `VexFlowRenderer.drawRestLedgerLines` | a rest a manual shift pushed off the staff | *"VexFlow's `StaveNote.drawLedgerLines()` hard-returns for rests… so we draw it ourselves"* |

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
   `vf-stavenote` *before* calling `drawLedgerLines()` — so the selection highlight keeps working
   for free, with no new seam.

### 1.2 What landed

- ⭐ **`engine/engrave/notes/ledgerLines.ts` — the ONE owner**, of both the rule
  ({@link ledgerLineRuns}) and the ink ({@link drawLedgerLines}). Pure, no DOM, no `vexflow`, and
  fenced as such: `.eslintrc.boundary.json` gained an `src/engine/engrave/**` block (§8.2 rule 11,
  arriving with the directory it governs, exactly as `paint/` and `scene/` did).
- ⭐ **`engine/engrave/` exists**, and its first inhabitant is `notes/`. §8.3's rule held: *"a file
  migrates into its `engrave/` folder on the commit that touches it anyway"* — ⛔ no rename move.
- ⭐ `engine/rendering/EngravedNote.ts` — the subclass seam (§0), plus `drawNoteInkThrough` (points a
  bar's notes at the render's own surface, so the ink we have taken back reaches the SCENE) and
  `trimLedgers`.
- ⭐ **One `renderOptions` poke retired.** `clearLedgersForAccidentals` used to write
  `note.renderOptions.strokePx` — one of §2.4's *"`renderOptions` written as a field, not an API"*
  repairs. It calls `trimLedgers` now.
- ⭐⭐ **The first note ink in the scene.** `VexFlowRenderer.scene.test.ts` gained a chapter that
  renders four real bars in jsdom and asserts *one ledger line per bar, all at the same y, marching
  left to right, black, at the pinned weight, overhanging its head at both ends*. ⚠️ Every one of
  those needed a browser the day before.

**⛔ NO PIXEL MOVED.** The generic rule reproduces VexFlow's `doubleWidth` special case to the pixel
— that equivalence is asserted in the spec rather than assumed — and every number
(overhang 3 px, the ink style) is the one that was already on his screen. 6060 unit tests green.

### 1.3 🚨 The one thing this cost, and it is worth naming

`VexFlowRenderer.scene.test.ts`'s break-test read `primitives.every(p => 'x' in p …)`. That was true
only while nothing in that fixture drew a **path** — a path keeps its coordinates in `ops`. The
first note ink to arrive broke it, which is the correct signal and not a flake: ⭐ **an assertion
over "every primitive" is an assertion about what the renderer currently draws**, and P3 changes
that by design. It is generalised now, not weakened.

---

## 1b. ✅ P3b — THE FLAG (2026-09-01)

### 1b.1 Why it was the second piece

**Because it has no owner at all, and because of what it exposes.**

- ⭐ **Eight lines, one glyph, one placement.** Grepped: `vf-flag` is read by nothing in `src/`, the
  flag is not a kind in the `selectedElement` union, and no anchor or highlight map holds one. It
  draws inside the note's own `vf-stavenote` group, so the selection recolour keeps working
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

### 1b.4 ⚠️ The one rule it bends, and the sentence that keeps it honest

`rendering/glyphPainter` is *"the one place VexFlow still paints a glyph"*, and `flag.ts` stamps its
own. ⭐ **That is not a second copy**: what `glyphPainter` owns is **font RESOLUTION** — `new
Element(tag)` turning a tag into a `FontInfo`, its own header's *"the tag is not a comment, it
selects the font"*. The flag's face is already resolved, so `Element.renderText` is exactly the two
primitives we own. ⭐ And it has to be that way round: a layer that needed an `Element` to put a
glyph down could never be painted to PDF or recorded as a scene. Both files now say so.

---

## 1c. ✅ P3c — THE STEM'S INK (2026-09-01), ⛔ and NOT its length

### 1c.1 The split, and it is the whole point of the commit

⛔ **P3c did not take the stem's LENGTH.** `own-engraving-engine.md` §6.1 lists stem length among
the places *"where we currently have no opinion"*, and its own rule is that a re-implementation
without an opinion is **strictly worse than a dependency**. ⭐ The opinion turns out to exist — Gould
prints it on pp. 16–19 — so `docs/stem-length-research.md` is being written before a line of it is
coded. ⛔ Taking the length now would be inventing a rule, which is the failure mode this project
catches hardest.

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

### 1c.3 ⏳ …and a third two-sources number, ⛔ not settled

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
name. ⭐ So the head objects stay VexFlow's and only their **ink** moves.

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
5. 🚨 **The group's id is the seam**, exactly as for the stem: `g.vf-notehead` is read by the
   highlight *and* by a dozen browser specs (`glyphs('g.vf-notehead text')`). That coverage is why
   this was a safe piece to take: **276 browser tests are watching where noteheads land.**

### 1d.3 ⭐ The stamp got a home, because it had a second owner

P3b wrote `setFont` + `fillText` inside `engrave/notes/flag.ts`. P3d needed the same two lines.
⇒ `engine/engrave/glyph.ts` — *"putting one music glyph down, in a face that is already resolved"* —
collected on the commit that produced the second owner rather than after a third. ⭐ It is
deliberately **not** `rendering/glyphPainter`: that module owns font RESOLUTION (`new Element(tag)`
→ `Metrics.getFontInfo(tag)`), and here the face arrives as a value, which is what keeps `engrave/`
free of `vexflow`.

### 1d.4 ⛔ What P3d did NOT take

**Which glyph a duration gets.** `fonts/noteheadGlyph()` has answered that from Bravura since P2, so
it is a **fourth** *"the room reserved and the ink drawn come from two sources"* candidate — beside
the ledger overhang (§3.1), the stem's thickness (§1c.3) and the flag's reach (§3.3, measured). ⛔ Like
the other three, his call rather than a tidy-up.

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

## 3. ⏳ TWO NUMBERS THAT ARE HIS, AND P3A DID NOT TOUCH EITHER

⛔ **Neither is a drift to fix, and ⛔ neither is decided by finding a citation.** Both are places
where a source disagrees with a number already on his screen, which makes them taste calls with
evidence — the shape `docs/font-metrics-plan.md` §3.6 already batches six of.

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
- **The STEM.** ⚠️ Needs research committed first, and it exists: Gould's stem-length rules are on
  printed pp. 16–19 — *"a stem length of 2½ spaces can accommodate a tail"*, *"when notes are on a
  line, the stem is shortened to 3¼ spaces"*, *"stems for notes on more than one ledger line extend
  to the middle stave-line"*. ⭐ §6.1 of the parent says *"stem lengths… are places where we
  currently have no opinion"* — **that is now out of date, and this paragraph is the correction:
  the opinion is on the shelf, unread.**
- **The NOTEHEAD.** The big one inside the big one, and the one that unblocks `Stave.padding`.
  ⛔ Do not start it before the stem, whose geometry it decides.

---

## 5. ⚠️ The standing hazards, for whoever takes P3b

1. 🚨 **A `StaveNote` that stops painting must not stop answering.** Seven renderers, the registry
   and six highlight maps read its geometry (§0).
2. 🚨 **Ink drawn on `checkContext()` is invisible to the scene.** `voice.draw` hands VexFlow the
   real `SVGContext`, so anything we take back has to be pointed at `RenderPass.context` —
   `drawNoteInkThrough` is that line, and forgetting it costs a scene entry silently while the page
   still looks right.
3. ⚠️ **Draw order is meaning.** `drawLedgerLines` runs before the stem and heads, so the heads paint
   over the line ends. Anything taken out of order changes what covers what.
4. ⚠️ **The ghost is a second population.** `GhostRenderer` builds plain `StaveNote`s and keeps
   VexFlow's drawing for every part; a number changed on one side must be changed on both until the
   ghost becomes *"a scene with a style"* (§7.2).
5. ⛔ **jsdom measures every glyph 0 wide.** A scene assertion about a *level*, a *count* or a
   *relative* x is real; one about an ink EXTENT is measuring zeros and agreeing with itself.
