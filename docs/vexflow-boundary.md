# What VexFlow still decides — the boundary, and which bits of it to take

> ⭐⭐ **The question this answers** (his, 2026-07-30): *"how much of the spacing control do we have
> now and how much has VexFlow — in terms of fine adjustment we can do without taking into account
> some constants on the other side?"* and *"we should be working on fixing those constraints little
> by little… is that a good idea?"*
>
> Short answer to the second: **yes, but not as a programme.** The test that has worked every time so
> far is at the bottom (§5), and it is not "do we control this?" — it is *"is there a rule we want to
> state and can't?"* Every module we already took over passes that test. Nothing we left behind does.

---

## 1. How to read this

The editor draws through VexFlow, so every decision about the picture is made by one of us. This is
the inventory of who makes which. It is written after the spacing model (P0–P4), which moved the
largest single item — where every note sits horizontally — from their side to ours.

Two things worth saying before the list, because they change how it reads:

- **We have been doing this for a long time already, one module at a time.** `chordHeadLayout`,
  `chordAccidentalColumns`, `dotPlacement`, `ledgerAccidentalClearance`, `FannedBeam`, `curveArc`,
  `beamInk`, `CenteredTremolo`, `CrossBarBeams`, `SlurRenderer` and now `spacingPass` all exist
  because a VexFlow decision was wrong for us. The boundary has never been fixed; it has been moving
  in one direction for months.
- **Every one of them was taken for a reason we could state in a sentence**, and the sentence was
  always about the music rather than about control. That is the pattern §5 argues we should keep.

---

## 2. The scoreboard

### 2.1 Ours, outright

| what | where | since |
|---|---|---|
| **A bar's width** | `MeasureLayout.noteSpaceForMeasure` → `engine/layout/spacing.ts` | P2 — no VexFlow in the width path at all |
| **Where every column lands inside a bar** | `rendering/spacingPass.ts` (`TickContext.setX` after `format()`) | P4 |
| The duration curve | `spacing.ts` — one field, two published laws | P1 / the LilyPond change |
| Every ink extent and pair padding | `spacingPadding.ts` | P3 |
| The bar's **lead-in** (headerless bars) | `applyLeadIn` → `stave.setNoteStartX` | P3.2 |
| Which bars go on which line; how a line's surplus is shared | `MeasureLayout`, `distributeLineWidths` | long before |
| Which page a system lands on | `layout/pageCastOff.ts` | the layout plan |
| **Slur geometry** — endpoints, angle, belly, multi-system segments | `SlurRenderer` + `curveArc` (`renderCurve` with our own coordinates) | the slur plans |
| **Fanned beams entirely** — heads, stems, ramp lines | `FannedBeam` + `FanPass` | the fan plans |
| Cross-barline beams; two-note tremolo strokes | `CrossBarBeams`, `TwoNoteTremolo`, `beamInk` | |
| Chord head displacement and accidental columns **for hand-drawn heads** | `chordHeadLayout`, `chordAccidentalColumns` | fan members |
| Augmentation dot distance | `dotPlacement` (overrides VexFlow's 2px) | reported by eye |
| Accidental ↔ ledger-line clearance | `ledgerAccidentalClearance` | reported by eye |
| Stem direction; multi-voice rest lines; measure-rest centring | `VexFlowRenderer`, re-asserted after `format()` | the voice plans |
| Colour, selection, hidden-element treatment | `utils/*Colors`, `hiddenElements` | ⛔ never `setStyle` |

### 2.2 VexFlow's, still

| what | the constraint | does it cost us anything today? |
|---|---|---|
| **`Stave.padding` = 12px** | added to every note by `getAbsoluteX`, **no public setter**; `getNoteStartX` does not carry it | ⚠️ **Yes, visibly.** It is why `barline↔note` is **1.2** staff spaces and not 1.0 |
| **The HEADER** — clef, key, meter | VexFlow places the glyphs and derives `noteStartX`; we reserve `CLEF_WIDTH` / `CLEF_CHANGE_WIDTH` / `TIME_SIG_WIDTH` separately for the layout | ⚠️ **Yes.** Two sets of numbers that must agree **by hand**, and no rule connects them |
| **Ordinary chord layout** — accidental stacking, head displacement | `Accidental.format`, `StaveNote` | ⚠️ Mostly fine; we *model* the extents and re-measure them in `e2e`, but the drawing is theirs |
| **Ordinary beams** — slope, thickness, and the stem lengths they imply | `new Beam(...)` | ⭐ No complaint yet. Their slope cap is a number we already borrow (`FAN_MAX_BEAM_SLOPE`) |
| **Stem length** | `Stem.getExtents` | ⭐ No complaint. We extend it in three special cases and accept it otherwise |
| **Flags** | `StaveNote` | ⚠️ Not in our ink model at all — a flag hangs right of the stem and buys no room |
| **Glyph metrics / the font** | Bravura through VexFlow | ⭐ Correct place for it. We measure what we need and pin it |
| Barline drawing; stave lines; the note→`StaveNote` build | | ⭐ Correct place for it |
| Articulation vertical placement | `Articulation` | ⭐ Ours for fan members only, theirs otherwise; no complaint |
| **`formatter.format()` itself** | still called before we overwrite the x's | ⭐ **Deliberately kept** — it builds the modifier contexts (accidental stacking, beam prep). We take its x's and keep its typesetting |

### 2.3 The three places we are simply blind

1. **Any bar holding a FAN.** `spacingPass` skips it: a fan's members are drawn across a span
   `fanRoom` buys from the formatter, and moving the group's tick context out from under that span
   would break the drawing. So inside a fanned bar the spacing is still VexFlow's softmax plus five
   hand-tuned constants. **This is the largest blind spot left.**
2. **The preview GHOST.** It formats its own temporary stave and does not run the spacing pass, so a
   ghost can sit where the note will not.
3. **Flags and beams as INK.** Neither is in `spacingPadding.ts`, so neither buys horizontal room.
   (⚠️ Note the irony: the old width path measured *unbeamed* notes and over-reserved for flags that
   were never drawn — the defect P0 found. We removed the over-reservation and have not added the
   real one.)

---

## 3. What "fine adjustment without the other side" actually means today

**You can change any of these by editing one number, and nothing on VexFlow's side argues:**

- the duration curve, or the whole law (`DEFAULT_SPACING`);
- any pair padding — note↔note, note↔accidental, rest↔barline… (`pairPadding`);
- any glyph extent — notehead, accidental, dot, ledger (`INK`), with an `e2e` test that re-measures
  the drawing and fails if the table stops describing it;
- how the ink and the rule combine (the `max`, automatic — no site to edit);
- the bar's lead-in, the run-out to the barline, the floors every drag gesture stops at.

**These still need arithmetic on both sides:**

- **A lead-in tighter than 1.2 staff spaces.** Blocked by `Stave.padding` + the invariant that a
  bar's note area may not begin outside the bar.
- **The gap after a clef or a meter.** Ours reserves, theirs places.
- **Accidental-to-notehead distance inside a column.** `Accidental.format`'s, not ours.
- **Anything at all inside a fanned bar.**

---

## 4. ⭐ My opinion

**Yes, keep taking it — but never because it is VexFlow's.** The reason to take a decision is always
that *there is a rule we want to state and cannot*. That test has three virtues:

1. **It has been right every time so far.** Every module in §2.1 was taken because of a rule with a
   name: Gould's chord-cluster rule (`chordHeadLayout`), her accidental-column zig-zag
   (`chordAccidentalColumns`), a reported collision (`ledgerAccidentalClearance`, `dotPlacement`),
   a gesture the tick-proportional formatter could not express (`spacingPass`).
2. **It stops the obvious failure mode**, which is re-implementing an engraving library. VexFlow is
   years of accumulated correctness about glyphs, stems, beams and fonts. Taking a decision we have
   no opinion about buys nothing and costs us that correctness — and it costs it *silently*, which is
   the worst kind.
3. **It keeps the boundary explainable.** "We decide the music's geometry; VexFlow draws the glyphs
   and their local typesetting" is a sentence a person can hold. "We decide whatever we got round to"
   is not.

⚠️ **Two things the spacing model taught that apply to every future item:**

- **Predicting is fine; predicting silently is not.** `spacingPadding.ts` is a table of measurements
  taken in a browser and then written down — a prediction from the moment it is saved. What makes
  that safe is the `e2e` test that re-measures it. **Any decision we take from VexFlow while it goes
  on drawing needs that pairing**, or the two drift and nothing says so.
- **A number we own is worth more than a better number we don't.** `barline↔note` is 1.2 rather than
  the 1.0 the model wanted, because 1.2 is what the *drawing* and the *model* can both say. An
  aspirational 1.0 that comes out at 1.2 is exactly the silent disagreement the whole table exists
  to end.

⛔ **And one thing not to do:** do not take VexFlow's *glyph* decisions. Font metrics, notehead
shapes, flag shapes, the stave itself — that is what a notation library is for, and there is no rule
of ours it blocks.

---

## 5. ⏭️ Priorities

Ordered by *how much of a stated rule is currently unsayable*, which is the test above — not by
effort and not by how much control each buys.

### P1 — **The fan** (plan §P5)
The one place where a whole bar is outside the model, and where five hand-tuned constants still
negotiate one boundary (`fanColumns`, `FAN_MAX_SPAN_STRETCH`, `FAN_MIN_HEAD_GAP_RATIO`,
`trailingGap`, `MIN_NOTE_SPACING`). The rule we want to state is already written down and already
true of every other bar — *a fan's members are ordinary columns* — so this is not new design, it is
finishing. It also deletes a module and the last reader of `MIN_NOTE_SPACING`.

### P2 — **The header as columns** (plan §4)
Kills the two-sets-of-numbers problem outright: `CLEF_WIDTH`, `CLEF_CHANGE_WIDTH` and
`TIME_SIG_WIDTH` become real extents on real columns, and the gap after a clef becomes a row in the
pair table like every other gap. ⭐ It is also what would let the lead-in go below 1.2 spaces, since
we would then own `noteStartX` for every bar rather than only the headerless ones.

### P3 — **Vertical clearance / kerning**
The mechanism every other engine has and we do not: skip or reduce the pair padding when the two
things do not overlap **vertically**. MuseScore's `computeVerticalClearance` + `KerningType`,
LilyPond's skylines. This is the honest answer to *"accidentals in dense passages push the notes
apart"* — an accidental low on the staff should tuck under a preceding high note. ⚠️ It needs
`EventExtent` to gain a vertical range, which is a real change to the model's shape.

### P4 — **Flags and beams as ink**
A flag hangs right of its stem and buys no room today. Small, and it removes a known blind spot in a
table that is otherwise complete.

### P5 — **The preview ghost runs the spacing pass**
Correctness, not engraving: a ghost should stand where the note will.

### ⏭️ Not on this list, deliberately
- **Stem lengths, beam slopes, articulation placement, glyph choice.** No rule of ours is blocked.
  Revisit only if he reports something specific, which is how every other item here started.
- **`Stave.padding` itself.** Nothing to take — there is no setter. P2 routes around it.

---

## 6. ✅ Also owed, and not a VexFlow question at all — FIXED 2026-07-30

**The line's surplus was shared in proportion to each bar's TOTAL width, while only its MUSIC can
stretch.** Measured on his own fragment, one line: a quarter came out **4.28** staff spaces in the
system-opening bar and **3.96** two bars later — 8% apart, for the same note. The mechanism was one
expression in `distributeLineWidths`: every bar's whole width scaled by one factor `k`, and since
overhead cannot stretch, a bar's music actually stretched by `k + (k−1) × overhead / music`. It hit
every system-opening bar, always in the same direction, hardest when that bar had the least music.

Sharing by `naturalWidth − overhead` instead makes every bar's music stretch by the same factor.
Measured after: five bars of identical music on one line draw the quarter at **4.130, 4.130, 4.130,
4.130** — identical to three decimals.

⚠️ **What is left of it belongs to §5's priority 2.** The opening bar still draws **4.350**, 5%
wider, and the cause is now exactly known: we reserve `CLEF_WIDTH + TIME_SIG_WIDTH` for the header
while VexFlow places the glyphs and needs about **0.9 staff spaces less**, so the difference lands in
that bar's music. It is the two-sets-of-numbers problem, and the header-as-columns work is what ends
it. `e2e/spacing.e2e.ts` pins it at 6% so it cannot quietly grow.

⭐ One field was added to make this sayable: `MeasureWidthInfo.overhead` — *the part of a bar that
cannot move in either direction*. It is not `floorWidth`, which is that plus the per-column ink floor
(how far the music may be FORCED, a different question).
