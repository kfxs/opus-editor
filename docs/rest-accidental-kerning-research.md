# May a REST and an ACCIDENTAL tuck into each other's horizontal space? — research

> **Status: RESEARCH, 2026-09-14.** Sourced options for one future house-style preset. ⛔ It does
> not recommend and it changes no code. ⛔ A research doc surveys the sources; it does not know what
> we DECIDED. The decision it feeds is `docs/font-metrics-plan.md` §3.6 item 6, still open.
>
> **In one paragraph.** None of the four books states a rule for this pair. Gould and Ross give only
> the general law: no collision, spend room on an accidental only where it is needed. The one
> engraving where a rest stands right before an accidental (Stone p. 47, three cases) never puts the
> two in clear vertical bands, so the drawings **do not test** the question. The engines do answer it,
> and in four different ways. **MuseScore** lets an accidental tuck whenever its box and the rest's box
> are more than 0.1 sp apart vertically. **LilyPond** does the same with per-grob boxes merged into
> skylines. **Verovio** does it with the accidental's cut-outs against the rest's plain box and zero
> vertical clearance, except for a beamed rest, which never lets it tuck. **VexFlow** never lets it
> tuck, and neither does this repo today.

---

## 0. The question

Two columns in a row must not overlap horizontally — unless their inks sit in different vertical
bands (`src/engine/layout/kerning.ts:1-8`). So for a house-style preset:

1. May an **accidental** on a note tuck **under or over a rest** in the column before it? And the
   other way round: may a **rest** come early after a note carrying an accidental or dot?
2. How do engines decide — do they use the rest's **real vertical extent** (a box, a skyline, cut-outs)
   or give it the **whole staff height**? Is there a **padding** between a rest and an accidental?
3. How does each engine **place and measure** rest glyphs for this purpose (a whole rest hangs, a
   half rest sits)?
4. **Multi-voice:** when a voice-2 rest is moved up or down, does that change what may tuck?

## 1. Sources and how to reach them again

⭐ `reference/README.md` is the manifest; every book below is on disk there (gitignored).

| source | file | page offset | how it was read |
|---|---|---|---|
| Gould, *Behind Bars* | `reference/Behind Bars … (2).pdf` + `gould-behind-bars-fulltext.txt` | **PDF = printed + 20** (re-verified: PDF 62 = p. 42) | located in the `.txt`, rendered `pdftoppm -r 150`, scans read: pp. 36, 37, 41, 42, 43, 53, 91, 164, 165 |
| Ross, *The Art of Music Engraving and Processing* | `reference/the art of music engraving … (ted ross) ….pdf` + `ross-…-fulltext.txt` | **PDF = printed + 12** (re-verified: PDF 91 = p. 79) | scans read: pp. 76, 78, 79, 175, 176 |
| Stone, *Music Notation in the Twentieth Century* | `reference/Music Notation in the Twentieth Century ….pdf` | **2-UP**: printed 46/47 = PDF 34 | PDF 34 rendered at **450 dpi** and MEASURED (§2.3) |
| Gerou & Lusk, *Essential Dictionary* | `reference/gerou-lusk-….pdf` / `.txt` | 2-UP, printed P = PDF P/2 + 2 | `.txt` grep only (Spacing, pp. 131 ff.) — nothing on this pair; ⛔ scan not rendered |
| MuseScore | `~/dev/engine-sources/MuseScore/src/engraving/` | — | source read |
| LilyPond | `~/dev/engine-sources/lilypond/` | — | source + `input/regression/*.ly` texidocs read (⛔ output not rendered) |
| Verovio | `~/dev/engine-sources/verovio/` | unit = `drawingUnit` = **half** a staff space (`doc.cpp:2027-2035`) | source read |
| VexFlow 5.0.0 | `node_modules/vexflow/build/esm/src/` | — | source read |

Scratch renders and crops: `/tmp/claude-1000/rest-kerning-research/` (not kept). No route was found dead.

### 1.1 What the repo's docs already answered — nothing on this pair

Checked before researching: `grep -il kern docs/*.md` (23 files), and in particular:

- `docs/spacing-model-research.md:305-316` describes MuseScore's mechanism: `Shape`, pair padding
  skipped when vertically clear, `KerningType`. It quotes **note↔rest 0.5** but says nothing about
  rest↔accidental.
- `docs/mid-bar-sign-spacing-research.md:81-83` covers the same mechanism, with padding scaled by
  the mean `mag()`.
- `docs/accidental-dot-engines.md:53-67, :486` covers accidental→**notehead** in all four engines
  (LilyPond skylines, MuseScore and Verovio cut-outs, VexFlow bbox). It does not cover a rest.
- `docs/multi-voice-rest-position.md` §4.2–4.3 covers the **vertical** placement of voice rests
  (Verovio's accidental-keyed table, MuseScore's `voiceOffset`). It does not cover horizontal
  kerning.
- `docs/font-metrics-plan.md` §3.4 / §3.4a / §3.6 item 6 (`:235-280`, `:358-361`) names this exact
  question and leaves it open.

⇒ This document is new ground on the pair itself. It reuses those findings rather than re-deriving them.

---

## 2. The books

### 2.1 Gould — the general law only; no sentence and no plate for the pair

⭐ **p. 41 (PDF 61), *Spacing symbols*:** *"Where space is limited, the distance between characters
should not be less than ½ stave-space and no characters should collide."*

**p. 42 (PDF 62):** *"An accidental closes up as far as possible to its following note or fellow
accidental without colliding."* The sentence is about the accidental's **right** side; it says
nothing about what stands to its left.

**p. 43 (PDF 63), *Additional clefs and accidentals*:** *"Where notes are spaced close together, the
addition of clef changes and accidentals can distort the rhythmic spacing. … Instead, reduce the space
around clefs and accidentals to ½ space, to minimize distortion"*, and *"Where possible, note-spacing
should remain unaffected by the addition of accidentals. One accidental can usually be accommodated
(a) unless notes are very close together (b)"*. The plates on that page show accidentals between
**notes** only; there is no rest beside an accidental.

**Multi-voice rests (question 4), p. 36 (PDF 56):** *"A rest moves further from the centre of the stave
or to outside the stave should parts otherwise collide."* and *"For clarity, upper-part rests are
usually placed above the centre stave-line, lower-part rests below the centre line"*. **p. 37 (PDF 57):**
*"When the position of a rest is displaced by a note of the other part, the rest moves further away
from the stave."* Every one of these is about the **vertical** axis. None says a displaced rest opens
or closes horizontal room.

**Rest extents (question 3), p. 34.** ⚠️ Located in the OCR only and ⛔ not re-rendered in this pass.
The repo already quotes it from an earlier reading (`src/engine/layout/restPlacement.ts:12, 70-72`):
the semibreve hangs from the second line down, the minim sits on the centre line, a crotchet spans the
top space to the bottom space, and a quaver sits above the middle line down to the second line from
the bottom.

⛔ **Plates searched, no rest→accidental adjacency found:** pp. 36, 37, 41, 42, 43, 53, 91 (the
*altered unisons* plate has half rests over tied notes, not beside an accidental), 164, 165 (rhythm on
single lines, no pitch). ⇒ What she **draws** for this pair is **UNKNOWN**. The rest of the book was
not searched.

### 2.2 Ross — spend room on an accidental only where it is needed; the pair itself is not stated

⭐ **p. 76 (PDF 88):** *"It should be pointed out that accidentals have no rhythmic value and therefore
extra space should not be allowed unless the spacing is too close for the accidentals to be placed
comfortably between the notes. Unfortunately most plate engravers allow extra space for accidentals,
whether needed or not — this unnecessarily upsets the even flow of beats and notes."*

**p. 78 (PDF 90):** *"When notes are too close to accommodate an accidental or leger lines, more space is
given only where needed."* **p. 79 (PDF 91)** prints a plate with the caption *"Notice that extra space
has been given for accidentals."* That plate has one crotchet rest (second line, bar 2), and the note
after it has no accidental.

This is the closest any book comes to the kerning principle: room is bought by **need**, meaning
collision, and not by the accidental's presence. But Ross never says whether a rest's ink counts as
blocking, or whether it counts over its whole height.

**Rest extents (question 3), pp. 175–176 (PDF 187–188), in prose:**

- The quarter rest *"from its head to the tip of its bottom hook is three spaces long"*; *"the tip of the
  hook cuts through the second line, and extends slightly into the first space"*; *"the top, or 'head',
  of the rest extends well into the third space"*.
- The eighth rest *"is less than two spaces tall"*; *"The bottom of the slanted stem sits on the second
  staff line. The rest of the stem crosses the third, and almost touches the fourth staff line."*
- **Question 4, p. 176:** *"the position of the eighth rest should be altered when it conflicts with a
  beam, or when it interferes with two voices sharing a staff"*. It too is vertical only.

### 2.3 Stone — the one plate with a rest right before an accidental, MEASURED; it does not test tucking

**p. 45 (PDF 33), per `reference/README.md:784`:** *"The proper horizontal spacing of notes and
accidentals, etc., is too complex to be included in these rather general guidelines"*. The prose
therefore gives no rule.

**p. 47 (PDF 34, right half), the violin/cello example**, rendered at 450 dpi. Crop origin is (2850, 2180)
in the 5310 × 3875 render; the local staff space is **20.0–20.25 px**, measured from the stave lines
next to each case. Coordinates below are crop pixels read off a 10 px grid, **±2 px ≈ ±0.1 sp**:

| case | rest ink | accidental ink | horizontal gap | vertical bands |
|---|---|---|---|---|
| **Vn bar 1**: dotted 8th rest → ♯ on a sixteenth (G4) | glyph x 496–517, y 121–164; **its dot** x 527–537, y 131–145 | ♯ x 541–563, y 137–196 | glyph → ♯ **1.19 sp**; dot-box → ♯-box **0.20 sp**; in the dot's own band the ♯'s ink starts at x ≈ 550 ⇒ **≈0.64 sp** | ♯ box overlaps the dot box by 8 px (0.4 sp) and the glyph box by 27 px ⇒ **SHARED** |
| **Vn bar 2**: 16th rest → ♮ on D5 | right edge x ≈ 703, y 105–165 | ♮ x 732–748, y 80–137 | **≈1.45 sp** | **SHARED** |
| **Upper plate bar 3, lower voice**: 8th rest → ♮ quarter (crop origin 2850, 1050; space ≈ 21 px) | x ≈ 922–945, y 134–160 (lower stem not separable from Stone's annotation arrow) | ♮ x ≈ 960–990, y 130–175 | **≈0.7 sp** | **SHARED** |

⚠️ **What the plate does NOT show:** in none of the three is the accidental vertically clear of the rest,
so nothing here says whether a copyist *would* tuck an accidental beneath a rest. The closest ink is
bar 1's sharp against the rest's **dot**. There the boxes are 0.20 sp apart while overlapping
vertically, which is **tighter than any box-to-box padding** in §3. The shapes are 0.64 sp apart,
which fits a shape- or cut-out-based judgement. It is one instance on a 2-up scan, and a blurred scan
reads a white gap slightly small (`reference_the_browser_ink_reader_inflates_every_box`), so it is
corroboration, ⛔ not a number.

**Question 4, p. 46 (PDF 34, left):** *"All notes in multistaff music must be in proper vertical
(rhythmic) alignment. The same is true for rests"*. It is about alignment only.

### 2.4 Gerou & Lusk — UNKNOWN

A `.txt` grep of the *Spacing* chapter (printed pp. 131 ff.) finds rests only as page-turn advice.
⛔ The scans were not rendered, so the drawn plates are unread.

---

## 3. The engines

### 3.1 MuseScore 4 — rectangles, a table of kerning TYPES, tuck when more than 0.1 sp clear

**The loop** (`rendering/score/horizontalspacing.cpp:1221-1283`) takes every item pair `(r1 left, r2 right)`:

- `verticalClearance = computeVerticalClearance(item1, item2)`, **0.1 sp when item2 is an accidental**,
  otherwise 0.2 sp (`:1650-1659`).
- `intersection = intersects(ay1, ay2, by1, by2, verticalClearance)` (`:1243`; the definition is at
  `infrastructure/shape.h:198-204`).
- If the pair is `NON_KERNING` **or** the two intersect, then `dist = r1.right − r2.left + padding` (`:1257-1262`).
- Otherwise it is `KERNING`, and the pair contributes **nothing** (`:1265-1276`, the `default`).
- A floor `absoluteMinPadding = 0.1 sp` (`:1224, :1249`) applies only where padding applies.
- ⚠️ A zero-width shape is treated as colliding with everything (`:1259`).

**REST → ACCIDENTAL = KERNING, in every voice.**

- `computeKerning` (`:1628-1648`): the same-voice limit needs **both** items in the list
  `NOTE/NOTEDOT/REST/STEM/CHORDLINE/BREATH` (`:1636, :1662-1677`), and an accidental is not in it.
- Neither item is never-kernable (`:1679-1697`), so `doComputeKerningType(REST, …)` falls to
  `default: KERNING` (`:1737-1738`).
- The only rest exception is `ignoreItems`: a **full-measure** rest ignores notes on another staff
  (`:1704-1712`).

**Padding when they do intersect:** `table[REST][ACCIDENTAL] = 0.45 sp` (`rendering/paddingtable.cpp:109`),
× the mean `mag()` of the two (`horizontalspacing.cpp:1460-1469`). For comparison, the rows a **note-side**
ink uses before an accidental: note 0.35 (`paddingtable.cpp:57-58`, `max(accidentalNoteDistance 0.25, 0.35)`),
dot 0.35 (`:98`), flag (`HOOK`) 0.35 (`:86`), stem 0.35 (`:246`).

**The reverse — a rest after a note:**

- Same voice: NOTE→REST and NOTEDOT→REST are both "same-voice-limited", so the pair is **NON_KERNING**
  (`:1636-1640`).
- Another voice: NOTE→REST goes through `computeNoteKerningType`, gated by the chord's
  `allowKerningAbove/Below` (`:1742-1778`). ⛔ Where those flags are set was not found in
  `rendering/score/` (UNKNOWN).
- Padding note→rest is **0.5 sp** (`paddingtable.cpp:59`); dot→rest and flag→rest reuse their →note
  rows (`:99`, `:87`).

**The rest's ink = its glyph's bounding rectangle** plus one rectangle per augmentation dot
(`restlayout.cpp:654-675`, `item->symBbox(ldata->sym)` at `:660`). There are ⛔ no cut-outs and no
whole-staff band. ⚠️ The accidental side is, per `docs/accidental-dot-engines.md:486`, a shape with SMuFL
cut-outs in accidental layout. ⛔ Whether those cut-outs survive into the **segment** shape used here was
not traced (UNKNOWN).

**Voices (question 4):** a rest's `finalLine = naturalLine + voiceOffset + wholeRestOffset`
(`restlayout.cpp:129-131`).

- `computeVoiceOffset` is ±1 sp, or ±2 sp with `multiVoiceRestTwoSpaceOffset` (default false,
  `style/styledef.cpp:560`); the logic is at `restlayout.cpp:696-766`.
- `resolveRestVSChord` then moves the rest in whole-space steps until it clears the other voice's chord
  by 0.55 sp (whole/half) or 0.35 sp (`:215`).
- The shape is translated to the rest's **laid-out** position, so a displaced rest changes which pairs
  intersect. The gate itself (KERNING) does not depend on voice.
- ⛔ Whether vertical conflict resolution runs **before** the horizontal pass was not traced (UNKNOWN).

### 3.2 LilyPond — one box per grob, merged into skylines; the rest's box is its stencil extent

**What a column's ink is.** `Paper_column_engraver` adds every item to its column as a separation item,
except accidentals and arpeggios, which enter as **conditional** items (`lily/paper-column-engraver.cc:255-261`).
`Separation_item::boxes` (`lily/separation-item.cc:121-184`) then makes, **per grob**:

- a `Box(X-extent, pure Y-extent)`, widened by `extra-spacing-width` (default `(-0.1 . 0.1)`, `:166-167`)
  and heightened by `extra-spacing-height` (default `(0 . 0)`, `:168-169`);
- for accidentals, the relevant `Accidental` grobs themselves (`accidental-placement.cc:103-121`).

`calc_skylines` builds the skyline pair and pads it by the column's `skyline-vertical-padding`
(`separation-item.cc:92-110`).

**Tucking is the default.** `Note_spacing::get_spacing` takes the right-facing skyline of the left
column and the left-facing skyline of the right one, and computes their distance with the right column's
`skyline-vertical-padding` as horizon padding (`lily/note-spacing.cc:77-83`). `PaperColumn` sets that
padding to **0.08**, with the comment *"allows double flat of F to be nestled over dots of C"*
(`scm/define-grobs.scm:2749-2751`). The regression `input/regression/spacing-horizontal-skyline.ly:4` is
titled *"accidentals may be folded under preceding notes."*

**The rest has no special treatment.** `Rest` (`define-grobs.scm:2962-2983`) sets no
`extra-spacing-height`, so its box is its **stencil extent** (`lily/rest.cc:316-322`) at its real
height. Its horizontal padding is the default +0.1 sp on the right, against the accidental's
`extra-spacing-width (-0.2 . 0.0)` (`define-grobs.scm:40`).

⇒ **In a shared band a rest and an accidental keep ≈0.3 sp of air (0.1 + 0.2), as read.** When the boxes
are vertically clear, the accidental may slide under or over the rest.

⛔ The exact vertical clearance, from `padded(0.08)` at construction plus 0.08 horizon padding again at
distance time, was not worked through numerically (UNKNOWN).

**Voices (question 4):**

- The rest's `Y-offset` is `dir × voiced-position` (**4** half-spaces = ±2 sp, `define-grobs.scm:2970`;
  `rest.cc:76`). It is declared as an unpure-pure container with the same callback for both
  (`define-grobs.scm:2975`), so it **is** in the pure Y-extent the boxes use.
- The regression `input/regression/spacing-accidental-rest.ly:4-7` — *"Accidentals don't collide with
  shifted-down rests."* on `<< g'4 \\ {r8 aeses} >>` — is exactly the voice-2 case.
- ⚠️ The further shift `RestCollision` applies is chained with `pure-chain-offset-callback`
  (`rest-collision.cc:79-83`). That callback *"will simply pass the previous calculated offset value"*
  (`scm/output-lib.scm:1299-1304`), so as read **a collision shift is not seen by horizontal spacing**;
  only the voiced position is.
- ⛔ The regression's output was not rendered.

### 3.3 Verovio — the accidental's cut-outs against the rest's plain box, zero vertical clearance; a beamed rest never tucks

**The special case exists by name** (`src/adjustxposfunctor.cpp:391-401`, current = `ACCID`, previous = `REST`):

- **Rest in a beam with no explicit `@loc`** → `overlap = rest.selfRight − accid.selfLeft + margin`, i.e.
  **always** full separation (`:394-396`).
- **Otherwise** → `HorizontalRightOverlap(layerElement, doc, margin)` with vertical margin **0** (`:398-399`).
  That compares rectangle against rectangle, and `RectRightOverlap` returns 0 as soon as the two
  rectangles do not overlap vertically (`src/boundingbox.cpp:250-265, :1171-1175`).

**Ink model:**

- `GetRectangles` uses SMuFL cut-out anchors where the glyph has them and falls back to the self bounding
  box (`boundingbox.cpp:326-360`).
- Bravura's rests carry **no anchors** (`data/Bravura.xml:525-529`), so a rest is **one plain box**.
- A sharp carries all four cut-outs (`:339-344`); a flat has only NE/SE (`:331-334`), so on its left it
  too is a box.

**Padding:** `margin = (rightMarginRest 0.0 + leftMarginAccid 1.0) × drawingUnit`
(`adjustxposfunctor.cpp:357`; `src/options.cpp:1697, :1823`) = **0.5 sp**. It is a horizontal margin only.

**Scope:** per staff across all layers (`adjustxposfunctor.cpp:212-233`), against the previous alignment's
boxes (`:91-92`). For contrast, note→note is forced apart **regardless** of vertical position (`:370-373`).

**The reverse (a rest after a note):** the generic branch `HorizontalRightOverlap(…, margin)` (`:402-404`)
is vertically gated in the same way. The margin is `rightMarginNote 0.0 + leftMarginRest 1.0` = 0.5 sp
(`options.cpp:1749-1754, :1819-1820`).

- Edge case (`:406-417`): a note following a **tuplet-final rest** longer than an eighth gets
  `1.5 × (dur − 8) × unit` even with no overlap.
- ⛔ The margin for a note's dots before a rest was not traced.

**Voices (question 4):** a rest's `@loc` is decided **before** spacing by `Rest::GetOptimalLayerLocation`
(`src/rest.cpp:387-422`), the outermost of four candidates. ⭐ Its table `g_defaultRests` is keyed on the
**other layer's accidental** (`rest.cpp:36-153`, `RestAccidental`), and that accidental is ignored when
the other note is not at the rest's x (`GetLocationRelativeToOtherLayers`, `rest.cpp:424-458`).

So Verovio is the only engine here that lets an accidental **move a rest vertically**. That in turn
changes the boxes the horizontal pass compares. It covers two layers only
(`docs/multi-voice-rest-position.md` §4.2).

### 3.4 VexFlow 5 — never; widths only

`TickContext.preFormat` merges each tickable's metrics with `Math.max` over `notePx`, `modLeftPx`,
`modRightPx`, `leftDisplacedHeadPx` and so on, and sets `width = notePx + totalLeftPx + totalRightPx`
(`tickcontext.js:143-162`). No vertical coordinate is consulted, so a rest and the next column's
accidental can **never** share horizontal space.

Rest placement is a key line (`stavenote.js:508-517`, `getLineForRest`), optionally moved by
`Formatter.AlignRestsToNotes`, which is vertical only (`formatter.js:137-170`). ⚠️ The editor no longer
takes x from VexFlow's formatter (`src/engine/rendering/spacingPass.ts:6-9`), so this row describes the
library, not the app.

### 3.5 Rest glyph extents, cross-checked (question 3)

Bravura, in staff spaces around the glyph origin. The repo's table (`src/engine/layout/spacingPadding.ts:206-213`)
**agrees with Verovio's copy of Bravura** (`data/Bravura.xml:525-530`, 250 units = 1 sp) to three
decimals on all six rows:

| glyph | up | down | origin placed at (single voice) |
|---|---|---|---|
| `restWhole` | 0.036 | 0.540 | **4th line** — LilyPond `staff-position +2`, MuseScore `line 1`, Verovio `loc 6` (`restPlacement.ts:47-51`) |
| `restHalf` | 0.568 | 0.008 | middle line |
| `restQuarter` | 1.492 | 1.500 | middle line |
| `rest8th` | 0.696 | 1.004 | middle line |
| `rest16th` | 0.716 | 2.000 | middle line |
| `rest32nd` | 1.704 | 2.000 | middle line |

How each engine **measures** a rest for spacing:

- **MuseScore:** glyph bounding rectangle plus dots (§3.1).
- **LilyPond:** the stencil's extent box, at its pure (voiced) offset (§3.2).
- **Verovio:** the self bounding box, with no cut-outs (§3.3).
- **VexFlow:** width only (§3.4).

⛔ **No engine gives a rest a whole-staff band.** This repo still does in one place (§4).

---

## 4. What this repo does today

- **Nothing kerns against a rest.** `MAY_KERN` has five rows, all `… → accidental` from note, dot,
  ledger, stem and flag; none has a `rest` (`src/engine/layout/kerning.ts:102-111`). `inkFloor` skips a
  pair only when it may kern **and** is clear (`:147`), so every rest pair pays its full padding.
- **The padding a rest pays** is 0.5 sp for any `rest ↔ x`, and 1.65 sp before a barline
  (`src/engine/layout/spacingPadding.ts:413-414`). Against MuseScore's rows that is between its
  rest→accidental 0.45 and its note→rest 0.5.
- **A rest's band is real now, and the brief's quotation is stale.** The comment *"A rest's own band is
  not modelled … a band covering the staff"* (quoted at `docs/font-metrics-plan.md:244` as
  `measureColumns.ts:126`) has been replaced. `slotInk` now gives a rest `restBand(slot.duration)`
  (`src/engine/layout/measureColumns.ts:127-133`), built from `restStaffLine` + `REST_HEIGHT`
  (`spacingPadding.ts:206-228`, `restPlacement.ts:94-111`), with `left: 0` (no ink to its left).
  ⚠️ **The one whole-staff band left** is the untouched bar's measure rest, `MEASURE_REST_INK`, with
  `top: 0, bottom: 4` (`measureColumns.ts:403-408`).
- **The vertical clearance** a rest row would use is `KERN_CLEARANCE = 0.35 sp` (`kerning.ts:88`,
  `sameBand` at `:131-134`). That is 3.5× MuseScore's 0.1 for an accidental and larger than LilyPond's
  0.08.
- **Voices:** a moved voice rest exists (`src/engine/layout/restVoicePlacement.ts:222`,
  `restLineForVoice`), but `restBand` prices every rest at its **neutral** line (`measureColumns.ts:132`).
  `docs/multi-voice-rest-position-plan.md:503-508` records this as a latent disagreement that *"becomes
  one the day a rest row is added"*.
- **The open decision:** `docs/font-metrics-plan.md:358-361` (§3.6 item 6) — *"Should a REST kern against
  an accidental at all?"*. It can only narrow bars, never widen them (§3.4a, `:267-270`).

---

## 5. ⭐ PRESET ROWS

One row per source. *"Tuck"* = the accidental after a rest may share the rest's horizontal space when
their inks are vertically clear.

| # | source | the rule, in one line | model of the rest's ink | model of the accidental's ink | vertical clearance | padding when NOT clear | voice-2 rest | citation |
|---|---|---|---|---|---|---|---|---|
| R0 | **this repo today** | **never** | own band at the neutral line (whole staff for an untouched bar) — but never consulted | box per sign | (0.35 if a row existed) | 0.5 sp | band ignores displacement | `kerning.ts:102-111`, `spacingPadding.ts:414`, `measureColumns.ts:132, :403-408` |
| R1 | **VexFlow 5** | **never** | width only | width only | — | modifier widths, max-merged | — | `tickcontext.js:143-162` |
| R2 | **MuseScore 4** | **tuck whenever the rectangles are more than 0.1 sp apart vertically, any voice** | glyph bounding **rectangle** (+ dots) | its segment shape (cut-outs: UNKNOWN here) | **0.1 sp** | **0.45 sp** × mean mag, floor 0.1 | shape at the laid-out (moved) position; gate voice-independent. Reverse (note→rest) **never** in the same voice | `horizontalspacing.cpp:1221-1283, :1650-1659, :1737`; `paddingtable.cpp:109`; `restlayout.cpp:654-675` |
| R3 | **LilyPond** | **tuck whenever the skylines allow** | stencil-extent **box**, merged into the column **skyline** | one **box** per `Accidental`, in the same skyline | 0.08 sp column padding (combined figure UNKNOWN) | ≈**0.3 sp** (rest +0.1, accidental −0.2 extra-spacing-width) | voiced position (±2 sp) **is** seen; a `RestCollision` shift is **not** (pure passthrough) | `separation-item.cc:122-184`; `note-spacing.cc:77-83`; `define-grobs.scm:40, :2749-2751, :2962-2983`; `rest-collision.cc:79-83` |
| R4 | **Verovio** | **tuck when the rest's box and the accidental's cut-out rectangles do not overlap vertically — except a beamed rest without `@loc`, which never lets it tuck** | self **bounding box**, no cut-outs | SMuFL **cut-out rectangles** (sharp 4, flat NE/SE only → box on the left) | **0** | **0.5 sp** (margins 0.0 + 1.0 unit) | `@loc` chosen first, from a table keyed on the other layer's **accidental** | `adjustxposfunctor.cpp:357, :391-401`; `boundingbox.cpp:1171-1175`; `Bravura.xml:525-529`; `rest.cpp:36-153, :387-422` |
| R5 | **Gould** | **UNKNOWN for the pair.** General law: no collision; not less than ½ sp between characters where space is limited; accidentals close up and take ½ sp in tight spacing | ink (collision) — unstated beyond that | — | — | ½ sp minimum between characters | rests move **vertically** to avoid the other part; nothing horizontal | pp. 41, 42, 43 (PDF 61–63); pp. 36–37 (PDF 56–57) |
| R6 | **Ross** | **UNKNOWN for the pair.** General law: no extra room for an accidental unless it would otherwise not fit, *"only where needed"* | need = ink; unstated whether a rest blocks at its real height | — | — | — | the 8th rest is *"altered"* vertically for two voices | pp. 76, 78, 79 (PDF 88, 90, 91); pp. 175–176 (PDF 187–188) |
| R7 | **Stone (measured plate)** | **no tuck observed — and none tested**: all three rest→accidental cases share a band; glyph-to-accidental gaps **1.19 / 1.45 / 0.7 sp**; the closest ink (rest dot → ♯) is **0.20 sp box-to-box** while overlapping, 0.64 sp by shape | as drawn | as drawn | — | as drawn above | one of the three (upper plate bar 3) is a lower-voice rest; still shared | p. 47 (PDF 34), §2.3 |
| R8 | **Gerou & Lusk** | **UNKNOWN** | — | — | — | — | — | not read (§2.4) |

**The axes a preset would actually expose**, distilled from R0–R4 and ⛔ not a recommendation:

1. **Gate:** *never* (R0, R1) or *when clear* (R2, R3, R4).
2. **Ink model of the rest:** *whole staff* (R0's untouched bar), *glyph box* (R2, R4), or *box inside a
   skyline* (R3).
3. **Ink model of the accidental:** *box* (R3; R4 for a flat's left) or *cut-outs* (R4 sharp/natural;
   R2 per the earlier doc).
4. **Vertical clearance:** 0 (R4) · 0.08 (R3) · 0.1 (R2) · 0.35 (our `KERN_CLEARANCE`).
5. **Padding in a shared band:** ≈0.3 (R3) · 0.45 (R2) · 0.5 (R0, R4).
6. **Exceptions:** a beamed rest never lets anything tuck (R4). A same-voice **note→rest** never kerns (R2).
7. **Which rest height:** neutral line (R0) · voiced offset only (R3) · fully resolved position (R2, R4).

---

## 6. UNKNOWN

1. **Gould's drawn practice** for an accidental beside a rest. Only pp. 34–37, 41–43, 53, 91 and
   164–165 were examined; no such adjacency was found. The p. 34 rest-shape wording was read in the OCR
   only, never re-rendered here.
2. **Ross's** drawn practice. His plates on pp. 79 and 175–176 have no rest→accidental adjacency.
3. **Stone:** no case in **clear** bands was found, so his plate cannot say whether he would tuck. Only
   p. 47 was measured.
4. **Gerou & Lusk:** scans not rendered; the prose grep found nothing.
5. **MuseScore:**
   - whether the accidental's cut-outs survive into the segment shape;
   - where `Chord::allowKerningAbove/Below` are set;
   - whether `resolveVerticalRestConflicts` runs before the horizontal spacing pass.
6. **LilyPond:**
   - the exact combined vertical clearance (skyline `padded(0.08)` plus horizon padding 0.08);
   - whether the regression `spacing-accidental-rest.ly` renders as its texidoc claims (output not
     produced);
   - whether anything other than the pure passthrough carries a `RestCollision` shift into spacing.
7. **Verovio:** the margin between a note's **dots** and a following rest; how a flat's missing NW/SW
   cut-outs play against a rest in practice.
8. **Dorico, Sibelius, Finale:** not examined for this pair.
9. **A whole-bar rest:** only MuseScore's `ignoreItems` (it ignores cross-staff notes) was found.
   Whether any source lets an accidental tuck against a centred whole-bar rest is unexamined.
