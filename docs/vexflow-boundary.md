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
| ~~**The HEADER**~~ | ✅ **Taken 2026-07-30.** `engine/layout/headerInk.ts` measures what a clef and a meter actually cost, the layout reserves it and `applyLeadIn` sets `noteStartX` from the same number | ⭐ No — they agree by construction now |
| **Ordinary chord layout** — accidental stacking, head displacement | `Accidental.format`, `StaveNote` | ⚠️ Mostly fine; we *model* the extents and re-measure them in `e2e`, but the drawing is theirs |
| **Ordinary beams** — slope, thickness, and the stem lengths they imply | `new Beam(...)` | ⭐ No complaint yet. Their slope cap is a number we already borrow (`FAN_MAX_BEAM_SLOPE`) |
| **Stem length** | `Stem.getExtents` | ⭐ No complaint. We extend it in three special cases and accept it otherwise |
| **Flags** | `StaveNote` | ⚠️ Not in our ink model at all — a flag hangs right of the stem and buys no room |
| **Glyph metrics / the font** | Bravura through VexFlow | ⭐ Correct place for it. We measure what we need and pin it |
| Barline drawing; stave lines; the note→`StaveNote` build | | ⭐ Correct place for it |
| Articulation vertical placement | `Articulation` | ⭐ Ours for fan members only, theirs otherwise; no complaint |
| **`formatter.format()` itself** | still called before we overwrite the x's | ⭐ **Deliberately kept** — it builds the modifier contexts (accidental stacking, beam prep). We take its x's and keep its typesetting |

### 2.3 The three places we are simply blind

1. ✅ ~~**Any bar holding a FAN.**~~ **Closed 2026-07-30 (plan P5.)** A fanned bar is an ordinary bar
   now: its slot's tick context takes the first member's column, and each member's gap is the spacing
   rule applied to its own duration. `fanRoom.ts`, `FAN_MAX_SPAN_STRETCH`, `FAN_MIN_HEAD_GAP_RATIO`,
   `trailingGap`, `fanColumns` and `MIN_NOTE_SPACING` were all deleted with it.
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
  bar's note area may not begin outside the bar. ⚠️ Taking the header did NOT unblock this, as this
  document predicted it might: the 12 px is added to every note by `getAbsoluteX` and there is still
  no setter.
- ~~The gap after a clef or a meter~~ — ✅ closed 2026-07-30; ours reserves AND places.
- **Accidental-to-notehead distance inside a column.** `Accidental.format`'s, not ours.
- ~~Anything at all inside a fanned bar~~ — ✅ closed 2026-07-30.

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

### ✅ ~~P1 — The fan~~ — DONE 2026-07-30
All five constants and `fanRoom.ts` deleted, and `MIN_NOTE_SPACING` with them. The rule was already
written down and already true of every other bar — *a fan's members are ordinary columns* — so it
was finishing rather than design. ⚠️ It changed how every fan looks: the heads crowd by ×1.47 where
they crowded by ×2.5, which is the spacing rule rather than a proportional ramp. Worth an eye.

### ✅ ~~P1 — The header as columns~~ — DONE 2026-07-30
`engine/layout/headerInk.ts`. The disagreement went **both ways**, and the second direction was the
one that mattered: we over-reserved 0.9 staff spaces for a line-opening bar (its music came out 5%
wider than the same music two bars later) and **under-reserved 0.6 for a two-digit meter**, where the
bar got less room than its own header takes. One number cannot describe a glyph whose width depends
on how many digits are in it.

⭐ The header turned out to be **a row of ink with a padding between the parts** — the model's own
vocabulary, no new idea. Measured part by part, then *predicted before being believed*: a small bass
clef with a `3/4` was predicted at 7.2 spaces and drew 7.2; a line-opening alto with `12/8` was
predicted at 9.4 and drew 9.4. `CLEF_WIDTH`/`CLEF_CHANGE_WIDTH`/`TIME_SIG_WIDTH` kept only their
hit-box role and were renamed `*_HIT_WIDTH` to say so — the INK-vs-FINGER split `layoutConfig`
already documents.

⏭️ It did NOT get the lead-in below 1.2 spaces: that is still `Stave.padding`'s doing, and the
geometry invariant that a bar's note area may not begin outside the bar.

⭐⭐ **AND THE GAP AFTER THE HEADER IS LILYPOND'S NOW — `HEADER_TO_NOTE` = 2.0, 2026-07-30.** His ask:
*"it is better to have air also in the beginning in comparison to what we have now"*, followed by
*"do the LilyPond version"*. Two rows of LilyPond's `space-alist` decide the front of a bar and they
agree on one number for us: `TimeSignature (first-note fixed-space . 2.0)`, and
`Clef (first-note minimum-fixed-space . 5.0)` measured from the clef's LEFT edge, which lands 2.1 past
our clef's ink. Drawn: the first note of a bar with clef + `4/4` moved **7.80 → 8.60** spaces past the
barline, a two-digit meter 4.80 → 5.60, and a bar with no header is unchanged.

⛔ What we did NOT take, with the reason: LilyPond's `BarLine` gap for a headerless bar is **0.9**
mid-line (1.3 at a system start) against our 1.2 — it is TIGHTER than the drawing can go, because 1.2
is `Stave.padding` showing through. ✅ And the trailing side is now settled too, the other
way: LilyPond has **no** constant before a barline — `NoteSpacing.space-to-barline` measures the last note's
own duration space *to the line*, which is what our barline-as-a-column already does — so there was nothing
to adopt. Our 1.0 ink floor binds only on dense bars (the last 16th sits 2.13 spaces off the line against
MuseScore's 2.63) and was judged on screen: *"i think is ok now"*. `docs/spacing-model-research.md` §6d has all five engines contrasted,
including the finding that a REST gets a note's gap after a barline in every one of them.

### ✅ ~~P1 — Vertical clearance / kerning~~ — DONE 2026-07-30
`engine/layout/kerning.ts`. A column's ink stopped being one merged reach either side and became a list
of **located boxes** — each with the vertical band it occupies — and a gap's floor became a max over box
PAIRS, skipping any pair that may kern and is vertically clear. MuseScore's `Shape::minHorizontalDistance`
+ `computeVerticalClearance`, LilyPond's skylines.

⭐ **The vertical half of the ink table is measurable after all, and not the way we tried first.** An SVG
`<text>`'s box is the FONT's line box — 16 staff spaces tall for every glyph in Bravura, so a height read
that way is not a height. Canvas `TextMetrics.actualBoundingBox*` is the glyph's real ink, and is what
VexFlow's own `Element.getBoundingBox` uses. Measured: a notehead ±0.5, a dot ±0.2, a sharp ±1.4, and a
**flat 1.8 up against 0.8 down** — one number for "an accidental is this tall" would have been wrong for
both signs.

⭐⭐ **Where it wins, measured — and it is NOT where the complaint that named this priority was.**

| case | before | after |
|---|---|---|
| dense right hand over a sharpened left hand | 4 of 16 gaps a space wider than their neighbours | **every gap identical** |
| dense voice 1 over a sharpened voice 2 | the same | **every gap identical** |
| beamed leaps, every other note sharpened | 2.88 / 1.78 alternating | **unchanged, deliberately** |

The last row is the honest part. Inside a beamed group the previous note's **stem** runs to a beam whose
height is not a width-time fact, and in a leap it really does hang through the space the accidental would
tuck into — so the model declines. A stepwise chromatic run declines too, because a sign a step below the
previous notehead genuinely overlaps it. So this does not narrow a dense chromatic passage; what it
removes is ink being paid for **across staves and across voices**, which a piano score pays on every beat.

⭐ Three decisions the writing forced, all in `MAY_KERN` or beside it:
- ⛔ **Two noteheads never kern, however far apart they are** — successive heads that overlap
  horizontally read as *simultaneous*. A rule about meaning, not about ink (MuseScore's `NON_KERNING`).
  ⭐ And that holds ACROSS STAVES too: in a grand staff an x is a time.
- ⭐ **The STEM joined `InkKind`** and buys no width of its own — it stands at its notehead's right edge.
  What it does is block, which is the piece a horizontal-only model had no reason to name.
- ⛔ **A barline's band is the whole staff**, so nothing can ever be tucked through one.

⏭️ **A latent bug it made visible, left alone on purpose:** a rest reaches right and not left, so the old
merged edge silently answered `note` there — which means `barline↔rest` (1.65 against a note's 1.2) has
never applied to a bar that OPENS with a rest. Delivering it widens every such bar by 0.45 spaces and
moves the measure rest a quarter space off centre, so it is a by-eye decision of its own. See
`edgeKind`'s doc.

### ✅ ~~P2 — Flags and beams as ink~~ — DONE 2026-07-30
`INK.flagReach` + `INK_HEIGHT.flagFromTip`, and a `flag` box in `measureColumns`.

⭐⭐ **The flag was a real collision, measured.** An eighth's up-flag runs from 1.05 to **2.15** staff
spaces past the notehead's anchor (the head's own width is 1.13), and the column claimed 1.13. So a bar
of unbeamed 32nds — gap 1.50 by the rule — drew every flag **0.65 spaces THROUGH** the next notehead:
seven collisions in one bar. The gap is now the flag's own ink (2.43 = notehead + flag + `note↔note`)
and the flags clear by 0.28.

⚠️ **And the opposite error is the one the OLD ink path made**, which is why this had to be gated
properly: VexFlow's `preCalculateMinTotalWidth` counted a flag on every eighth *including beamed ones*,
where none is drawn — the single biggest reason an eighth once measured wider than a quarter
(docs/spacing-model-research.md §6). So the box is added exactly where a flag is DRAWN, asked of
`beamRoleAt` (`'single'` = nothing beams it) rather than guessed from the duration. A beamed 32nd's gap
is unchanged at the rule's 1.50.

⭐ Two more findings worth keeping:

- **A DOWN flag buys nothing.** Its stem stands at the notehead's LEFT edge, so its 1.2 spaces of ink
  land inside the head's own width (measured: box right 1.3 against the head's 1.2). Only the up-flag
  reaches past anything.
- ⛔ **BEAMS need no width at all, and that is a conclusion rather than a punt.** A beam's ink lies
  BETWEEN two columns, at the stem-tip end — three-plus staff spaces above the noteheads — and so does a
  partial beam (a hook): measured on a dotted-eighth + sixteenth pair, the hook is ~1.0 space inside a
  gap that is already 1.8 and is vertically clear of everything at head level. What a beam really costs
  the model is **stem LENGTH**, which is a kerning input and not a width — and that is now taken from
  the same `beamRoleAt` answer instead of a guess from the duration.

⏭️ Still not modelled, with its number: a hook on a note whose gap is at the ink floor. It cannot
collide today (the vertical clearance is three spaces), so it is a completeness item, not a defect.

### P3 — **The preview ghost runs the spacing pass**
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
