# P3 — THE NOTE, taken one piece of ink at a time

> 📄 The parent is `docs/own-engraving-engine.md`; this document is its **P3**, the item that plan
> calls *"⚠️ THE BIG ONE"*. ⛔ Read §0 of that document first — the goal order, the twelve standing
> rules, and the one-line test — because everything below is an application of it.
>
> **Status: P3a ✅ (2026-09-01, the LEDGER LINES). P3b next, and ⛔ not yet chosen — §4.**

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
| **P3b** | ⛔ **not chosen** — the candidates and their prices are §4 | | ⏭️ |
| … | the stem, the flag, the noteheads, the dots | each needs its own research committed first (§6.1 of the parent) | ⏭️ |
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
- **The FLAG.** Self-contained (one glyph on a stem tip), and `fonts/flagDropFromTip` already
  measures it. ⚠️ But it interacts with the beam (`shouldDrawFlag` reads `!this.beam`) and with the
  tremolo stem stretch.
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
  ⛔ Do not start it before the flag and the stem, whose geometry it decides.

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
