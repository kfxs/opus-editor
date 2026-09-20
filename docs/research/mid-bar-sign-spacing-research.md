# How far after a barline does a MID-SYSTEM sign stand? — what the three engines do

> **Which repo question sent this:** P5b's remaining **placement** question in
> `docs/plans/own-engraving-engine.md`. A mid-bar clef change or meter change in this editor still sits at
> **0.5 staff spaces** after the boundary, and that number is not a decision — it is VexFlow's own
> opening-barline width (`widths[SINGLE] = 5` px) leaking into the modifier walk.
> (⚠️ 2026-09-19: VexFlow is removed — the walk is ours, `engrave/staff/signWalk`, and the 5 px is a
> transcribed row in `engrave/staff/barlineMetrics`; still not a decision.)

⛔ **This document surveys SOURCES. It is not a decision, not a recommendation and not a work list.**
Every number below is what an engine's own code says, with the file and line that says it. No number
here is proposed for this repo; the repo's owner arms the row.

**Sources read** (clones under `~/dev/engine-sources`, read-only, at the revisions below):

| engine | revision read |
|---|---|
| LilyPond | `beedbfa0752` — 2026-08-03 |
| MuseScore Studio | `929d1e99d72` — 2026-08-18 |
| Verovio | `efff0bc9924` — 2026-08-18 |

---

## 0. The question, and the two cases

At a barline **in the middle of a system** (⛔ not a system's left edge, which this repo already
settled at 0.7 sp for the clef):

1. a **CLEF CHANGE** that applies from the next bar;
2. a **TIME SIGNATURE CHANGE** that applies from the next bar.

🚨 **The first thing all three engines answer is a question that was not asked: WHICH SIDE.** None of
them treats "how far *after* the barline" as the clef's question at all, because two of the three do
not put the clef after the barline. That reframing is in §4.

---

## 1. Reading the numbers: units, and ⭐ what each engine measures BETWEEN

### 1.1 Units

| engine | native unit | → staff spaces |
|---|---|---|
| LilyPond | grob coordinates are staff spaces — *"All layout dimensions are displayed in staff spaces"*, `Documentation/en/notation/spacing.itely:3969`; `space-alist` values are grob-extent arithmetic (§1.2) so they carry the same unit | ×1 |
| MuseScore | `Spatium`, written `_sp` (`src/engraving/types/spatium.h:128`); one spatium = one staff space. `MStyle::styleAbsolute()` (`src/engraving/style/style.h:56`) returns it already multiplied by the score's spatium | ×1 |
| Verovio | **MEI unit** — `m_unit.SetInfo("Unit", "The MEI unit (1⁄2 of the distance between the staff lines)")`, `src/options.cpp:1202` | **×0.5** 🚨 |

🚨 The Verovio halving is the trap named in the brief and it is real: every `leftMargin*` /
`rightMargin*` default of `1.0` below is **0.5 staff spaces**, not 1.0.

### 1.2 ⭐⭐ What the distance is measured BETWEEN — all three are INK-EDGE TO INK-EDGE

This is the column that makes the numbers usable, and the three engines agree on the convention even
where they disagree on the value. **None of them is origin-to-origin and none of them is
advance-based.**

**LilyPond** — `lily/break-alignment-interface.cc:239-247`:

```cpp
if (scm_is_eq (type, ly_symbol2scm ("extra-space")))
  offsets[next_idx] = extents[idx][RIGHT] + distance - extents[next_idx][LEFT];
```

`extents` (line 140-142) are the grobs' `X_AXIS` extents, i.e. **stencil bounding boxes**. So an
`extra-space . d` entry places the next item's LEFT ink edge exactly `d` staff spaces right of the
previous item's RIGHT ink edge — a pure gap. The manual states the same in words:
*"`extra-space` measures the padding from the right of the first object to the left of the second
object while `minimum-space` counts from the left of the first object"*
(`Documentation/en/notation/spacing.itely:3390-3393`).

⚠️ Note `TimeSignature.extra-spacing-width = (0.0 . 0.8)` (`scm/define-grobs.scm:3939`) does **not**
enter this arithmetic: `extra-spacing-width` is read only in `lily/separation-item.cc:167`, i.e. by
the between-columns spacing engine, never by `break-alignment-interface.cc`.

**MuseScore** — `src/engraving/rendering/score/horizontalspacing.cpp:1261`:

```cpp
dist = std::max(dist, r1.right() - r2.left() + padding);
```

`r1`/`r2` are `ShapeElement` rectangles, i.e. per-item bounding boxes inside a `Shape`. So the
padding is again right-ink-edge to left-ink-edge. ⭐ And it is **band-limited like our own
`layout/kerning`**: line 1243 `intersects(ay1, ay2, by1, by2, verticalClearance)` — the pair is only
forced apart where the two boxes share a vertical band, otherwise a `KerningType` rule at 1265+
allows tucking. Padding is scaled by the mean of the two items' `mag()`
(`horizontalspacing.cpp:1460, 1469`) and floored at `0.1 * spatium` (line 1224, 1249).

**Verovio** — `src/adjustxposfunctor.cpp:357`:

```cpp
int margin = (m_doc->GetRightMargin(bboxElement) + selfLeftMargin) * drawingUnit;
```

⭐ **Verovio's gap for a pair is the SUM of the left item's right margin and the right item's left
margin**, applied to *content* bounding boxes (`HorizontalContentOverlap`, line 366). There is no
pair table: the number for any pair is derived from two per-element numbers.

---

## 2. LilyPond

### 2.1 ⭐⭐ The ORDER decides the question, and it is a table

`scm/define-grobs.scm:633-684`, `BreakAlignment.break-align-orders` — a vector of three lists
(end-of-line / unbroken / begin-of-line). The **unbroken** list (`:652-667`) is the mid-system case:

```
staff-ellipsis · left-edge · optional-material-end-bracket · cue-end-clef · ambitus ·
breathing-sign · signum-repetitionis · CLEF · cue-clef · STAFF-BAR ·
key-cancellation · KEY-SIGNATURE · TIME-SIGNATURE · optional-material-start-bracket · custos
```

🚨 **The clef precedes `staff-bar`; the key signature and the time signature follow it.** The manual
says the same in prose at `Documentation/en/notation/spacing.itely:3355-3361`
(*"the default order places the breathing sign first, then the clef, then the bar line, the key
cancellation and key signature, and finally the time signature"*), and the escape hatch is named for
exactly this: `ly/property-init.ly:230-233` documents `\breakAlignInsert` as being *"for tasks like
putting a clef change after the bar line, which would be accomplished by
`\breakAlignInsert clef after staff-bar`"*. A regression test does the same for the cue clef
(`input/regression/cue-clef-after-barline.ly:15`).

⚠️ **The order is the same in all three lists** — end-of-line (`:634-649`) and begin-of-line
(`:670-684`) both keep clef before `staff-bar` and key/time after it. LilyPond therefore has **no
separate cautionary number**; see §5.1.

### 2.2 Which alist is consulted

`lily/break-alignment-interface.cc:164-210`: the alist is taken from the **LEFT** grob of the pair
(lines 169-186) and looked up by the **RIGHT** grob's `break-align-symbol` (lines 195-210). So each
number below lives on the item that stands *first*.

### 2.3 The numbers

| pair (left → right) | entry | file:line | value | unit | in staff spaces | measured between |
|---|---|---|---|---|---|---|
| **Clef → barline** (⭐ the mid-system clef change) | `Clef.space-alist (staff-bar . (extra-space . 0.7))` | `scm/define-grobs.scm:917` | 0.7 | staff space | **0.70 sp** | clef ink right → barline ink left |
| **Barline → time signature** (⭐ the mid-system meter change) | `BarLine.space-alist (time-signature . (extra-space . 0.75))` | `scm/define-grobs.scm:294` | 0.75 | staff space | **0.75 sp** | barline ink right → meter ink left |
| Barline → key signature | `BarLine.space-alist (key-signature . (extra-space . 1.0))` | `scm/define-grobs.scm:297` | 1.0 | staff space | **1.00 sp** | ink → ink |
| Barline → key cancellation | `BarLine.space-alist (key-cancellation . (extra-space . 1.0))` | `scm/define-grobs.scm:298` | 1.0 | staff space | **1.00 sp** | ink → ink |
| key cancellation → key signature | `KeyCancellation.space-alist (key-signature . (extra-space . 0.5))` | `scm/define-grobs.scm:1945` | 0.5 | staff space | **0.50 sp** | ink → ink |
| key signature → time signature | `KeySignature.space-alist (time-signature . (extra-space . 1.15))` | `scm/define-grobs.scm:1990` | 1.15 | staff space | **1.15 sp** | ink → ink |
| Clef → key signature | `Clef.space-alist (key-signature . (extra-space . 0.82))` | `scm/define-grobs.scm:920` | 0.82 | staff space | **0.82 sp** | ink → ink |
| Clef → time signature | `Clef.space-alist (time-signature . (extra-space . 1.52))` | `scm/define-grobs.scm:921` | 1.52 | staff space | **1.52 sp** | ink → ink |
| Barline → next note (mid-system) | `BarLine.space-alist (next-note . (semi-fixed-space . 0.9))` | `scm/define-grobs.scm:302` | 0.9 | staff space | **0.90 sp**, half fixed / half springy | ink → ink |
| Barline → first note of a line | `BarLine.space-alist (first-note . (semi-shrink-space . 1.3))` | `scm/define-grobs.scm:301` | 1.3 | staff space | **1.30 sp** | ink → ink |
| Time signature → next note | `TimeSignature.space-alist (first-note . (semi-shrink-space . 2.0))` | `scm/define-grobs.scm:3955` | 2.0 | staff space | **2.00 sp** | ink → ink |

⚠️ **`BarLine.space-alist (clef . (extra-space . 1.0))` exists** (`scm/define-grobs.scm:296`) **but is
unreachable in the default order** — nothing in any of the three lists puts `staff-bar` immediately
before `clef` (§2.1), and `ordered_elements` (`break-alignment-interface.cc:56-87`) rebuilds the list
strictly from the order vector. It is there for users who have reordered. ⛔ Do not read `1.0` as
LilyPond's barline→clef answer; LilyPond's answer is that the clef is on the other side.

For contrast, the **system-start** numbers (this repo's already-settled case) live on `LeftEdge`:
clef `0.8` (`:2092`), key signature `0.8` (`:2098`), time signature `1.0` (`:2099`), `staff-bar`
`0.0` (`:2095`) — all `extra-space`, all ink-to-ink, `scm/define-grobs.scm:2088-2105`.

Spacing-style semantics are documented at `scm/define-grob-properties.scm:1170-1210`
(`extra-space`, `minimum-space`, `fixed-space`, `minimum-fixed-space`, `semi-fixed-space`,
`shrink-space`, `semi-shrink-space`), and the special keys `first-note` / `next-note` / `right-edge`
at `:1152-1162`.

---

## 3. MuseScore

### 3.1 ⭐⭐ Which side — a segment-type ORDER plus a per-clef PROPERTY

`src/engraving/dom/segment.h:41-66` — the `SegmentType` enum is explicitly *"Type values determine
the order of segments for a given tick"* (`:38`). At one tick:

```
BeginBarLine 0x1 · HeaderClef 0x2 · KeySig 0x4 · Ambitus 0x8 · Breath 0x10 · TimeSig 0x20 ·
StartRepeatBarLine 0x40 · …RepeatAnnounce… · CLEF 0x400 · BarLine 0x800 · TimeTick · ChordRest ·
…RepeatAnnounce… · ENDBARLINE 0x20000 · KeySigAnnounce 0x40000 · TimeSigAnnounce 0x80000
```

`Clef = 0x400` sorts **before** `EndBarLine = 0x20000`; a clef change at the head of bar *m* is
stored in the **previous** measure at its final tick — `src/engraving/dom/range.cpp:714-716`:

```cpp
if (remains == m->ticks() && m->tick() > Fraction(0, 1)) {
    Measure* pm = m->prevMeasure();
    seg = pm->getSegmentR(SegmentType::Clef, pm->ticks());
}
```

`src/engraving/rendering/score/modifydom.cpp:296-318` then decides whether to move it across the
barline. For a **normal (non-repeat) barline** with the clef's own position left at `AUTO`, lines
306-309 are the whole answer:

```cpp
// AUTO on normal barline
if (!measure->repeatEnd()) {
    continue;                       // ← stays in this measure ⇒ BEFORE the barline
}
```

whereas key signatures and time signatures at the same tick are moved on
(`modifydom.cpp:320-328`, *"Move key sigs and time sigs at the end of this measure into the next
measure"*) ⇒ **AFTER** the barline. `Segment::goesBefore` confirms the same ordering at run time
(`src/engraving/dom/segment.cpp:3000-3020`).

⭐ MuseScore also exposes the side as a **per-clef property**: `Pid::CLEF_TO_BARLINE_POS`
(`src/engraving/dom/clef.cpp:287`), an enum `AUTO / BEFORE / AFTER`
(`src/engraving/api/v1/apitypes.h:1122-1127`), defaulting to `AUTO`
(`src/engraving/dom/clef.cpp:102`, and `:410` for the property default). Setting `AFTER` moves the
segment into the next measure (`modifydom.cpp:301-303`) and switches which padding row applies.

### 3.2 The numbers

Every pair below is a row of the pair-keyed table in
`src/engraving/rendering/score/paddingtable.cpp`, resolved through
`src/engraving/style/styledef.cpp`.

| pair (left → right) | table row | style id + default | in staff spaces | measured between |
|---|---|---|---|---|
| **Clef → barline** (⭐ the mid-system clef change, AUTO) | `paddingtable.cpp:123` `table[CLEF][BAR_LINE]` | `Sid::clefBarlineDistance` = `0.5_sp`, `styledef.cpp:230` | **0.50 sp** | clef bbox right → barline bbox left, band-limited |
| **Barline → time signature** (⭐ the mid-system meter change) | `paddingtable.cpp:136` `table[BAR_LINE][TIMESIG]` | `Sid::timesigLeftMargin` = `0.63_sp`, `styledef.cpp:218` | **0.63 sp** | barline bbox right → meter bbox left |
| Barline → key signature | `paddingtable.cpp:135` `table[BAR_LINE][KEYSIG]` | `Sid::keysigLeftMargin` = `0.5_sp`, `styledef.cpp:215` | **0.50 sp** | bbox → bbox |
| Barline → clef (only when the user forces `AFTER`) | `paddingtable.cpp:132` `table[BAR_LINE][CLEF]` | `Sid::clefLeftMargin` = `0.75_sp`, `styledef.cpp:214` | **0.75 sp** | bbox → bbox |
| Time signature → barline | `paddingtable.cpp:156` `table[TIMESIG][BAR_LINE]` | `Sid::timesigBarlineDistance` = `0.5_sp`, `styledef.cpp:231` | **0.50 sp** | bbox → bbox |
| Key signature → barline | `paddingtable.cpp:145` `table[KEYSIG][BAR_LINE]` | `Sid::keyBarlineDistance` = `1.0_sp`, `styledef.cpp:224` | **1.00 sp** | bbox → bbox |
| Clef → key signature | `paddingtable.cpp:124` | `Sid::clefKeyDistance` = `0.75_sp`, `styledef.cpp:221` | **0.75 sp** | bbox → bbox |
| Clef → time signature | `paddingtable.cpp:125` | `Sid::clefTimesigDistance` = `1.0_sp`, `styledef.cpp:222` | **1.00 sp** | bbox → bbox |
| Key signature → time signature | `paddingtable.cpp:147` | `Sid::keyTimesigDistance` = `1.0_sp`, `styledef.cpp:223` | **1.00 sp** | bbox → bbox |
| Note → clef (the note before a mid-system clef change) | `paddingtable.cpp:60` | literal `0.8 * spatium` | **0.80 sp** | bbox → bbox |
| Barline → note | `paddingtable.cpp:127` | `Sid::barNoteDistance` = `1.25_sp`, `styledef.cpp:265` | **1.25 sp** | bbox → bbox |
| Note → barline | `paddingtable.cpp:62` | `Sid::noteBarDistance` = `1.5_sp`, `styledef.cpp:268` | **1.50 sp** | bbox → bbox |

⭐ **The same three `*LeftMargin` constants also serve the SYSTEM START** —
`src/engraving/rendering/score/horizontalspacing.cpp:1188-1219`, `getFirstSegmentXPos`, returns
`clefLeftMargin` (0.75) for a `Clef`/`HeaderClef` segment, `keysigLeftMargin` (0.5) for `KeySig` and
`timesigLeftMargin` (0.63) for `TimeSig`. MuseScore therefore does **not** distinguish "after a
mid-system barline" from "at the start of a system" for these three — one constant covers both.

### 3.3 🚨 One trap checked and cleared: `timeSigCenterOnBarline`

`styledef.cpp:235` sets `timeSigCenterOnBarline = true` by default, which reads like it would
overturn the meter answer. It does not, in the default style: the only layout code that reads it,
`SystemLayout::updateTimeSigAboveStavesXPos`
(`src/engraving/rendering/score/systemlayout.cpp:824-831`), returns immediately unless
`Sid::timeSigPlacement == TimeSigPlacement::ABOVE_STAVES`, and the default is
`TimeSigPlacement::NORMAL` (`styledef.cpp:233`). The centring applies only to the large
above-the-staff meter style. (Same gate at `src/engraving/dom/segment.cpp:2809-2821`.)

### 3.4 Repeat barlines are governed separately

`styledef.cpp:2177-2180`: `changesBeforeBarlineRepeats = true`, `changesBeforeBarlineOtherJumps =
true`, `placeClefsBeforeRepeats = **false**`, `changesBetweenEndStartRepeat = true`. These only fire
on repeat ends / jumps (`modifydom.cpp:285-286, 313-317`), so they do not touch a plain mid-system
barline.

---

## 4. Verovio

### 4.1 ⭐⭐ Which side — one enum, and a meter that is forced

`include/vrv/horizontalaligner.h:31-65`, `enum AlignmentType`, in order within a measure:

```
MEASURE_START · SCOREDEF_CLEF · SCOREDEF_KEYSIG · SCOREDEF_MENSUR · SCOREDEF_METERSIG ·
MEASURE_LEFT_BARLINE · … music (incl. ALIGNMENT_CLEF, ALIGNMENT_KEYSIG) … ·
MEASURE_RIGHT_BARLINE · SCOREDEF_CAUTION_CLEF · SCOREDEF_CAUTION_KEYSIG ·
SCOREDEF_CAUTION_MENSUR · SCOREDEF_CAUTION_METERSIG · MEASURE_END
```

The visible barline between bars *m−1* and *m* is measure *m−1*'s **right** barline; measure *m*'s
left barline is normally invisible. So a `SCOREDEF_*` sign belonging to bar *m* stands **after** the
visible barline.

`src/alignfunctor.cpp:227-238` gives a clef `ALIGNMENT_SCOREDEF_CLEF` when its role is
`SCOREDEF_SYSTEM` or `SCOREDEF_INTERMEDIATE`, and `:74` shows `SCOREDEF_INTERMEDIATE` is precisely
"a staffDef change on a measure that is not the first" — i.e. a mid-score clef change encoded
between bars. A clef encoded *inside* a layer mid-measure instead gets plain `ALIGNMENT_CLEF`
(`:236`) and is handled by a different functor (§4.3).

🚨 A **meter signature is forced to the head of the bar unconditionally** —
`src/alignfunctor.cpp:272-280`:

```cpp
else {
    // replace the current meter signature
    m_currentParams.meterSig = vrv_cast<MeterSig *>(layerElement);
    // type = ALIGNMENT_METERSIG
    // We force this because they should appear only at the beginning of a measure and should be non-justifiable
    type = ALIGNMENT_SCOREDEF_METERSIG;
}
```

`ALIGNMENT_METERSIG` exists in the enum (`horizontalaligner.h:49`) and is never assigned.

### 4.2 The numbers, and how they combine

All defaults from `src/options.cpp`, all in MEI units (**halve for staff spaces**), dispatched by
`Doc::GetLeftMargin` / `Doc::GetRightMargin` (`src/doc.cpp:2147-2219`). Note the barline dispatch is
by **position** — `None` / `Left` / `Right` — at `doc.cpp:2172-2180` and `:2209-2217`.

| identifier | file:line | value | unit | in staff spaces |
|---|---|---|---|---|
| `leftMarginClef` | `src/options.cpp:1712-1714` | 1.0 | MEI unit | **0.50 sp** |
| `rightMarginClef` | `src/options.cpp:1782-1784` | 1.0 | MEI unit | **0.50 sp** |
| `leftMarginMeterSig` | `src/options.cpp:1728-1730` | 1.0 | MEI unit | **0.50 sp** |
| `rightMarginMeterSig` | `src/options.cpp:1798-1800` | 1.0 | MEI unit | **0.50 sp** |
| `leftMarginKeySig` | `src/options.cpp:1716-1718` | 1.0 | MEI unit | **0.50 sp** |
| `rightMarginKeySig` | `src/options.cpp:1786-1788` | 1.0 | MEI unit | **0.50 sp** |
| `leftMarginRightBarLine` | `src/options.cpp:1756-1758` | 1.0 | MEI unit | **0.50 sp** |
| `rightMarginRightBarLine` | `src/options.cpp:1826-1828` | **0.0** | MEI unit | **0.00 sp** |
| `leftMarginLeftBarLine` | `src/options.cpp:1720-1722` | 1.0 | MEI unit | **0.50 sp** |
| `rightMarginLeftBarLine` | `src/options.cpp:1790-1792` | 1.0 | MEI unit | **0.50 sp** |
| `leftMarginBarLine` / `rightMarginBarLine` (position `None`) | `src/options.cpp:1700-1702`, `:1770-1772` | 0.0 | MEI unit | **0.00 sp** |
| `leftMarginNote` | `src/options.cpp:1748-1750` | 1.0 | MEI unit | **0.50 sp** |
| `defaultLeftMargin` / `defaultRightMargin` | `src/options.cpp:1664-1670` | 0.0 | MEI unit | **0.00 sp** |

**How the barline-to-sign gap comes out**, since the two items are in *different* measures and so
never meet in the pairwise rule of §1.2:

1. Measures are butted end to end — `AlignMeasuresFunctor::VisitMeasure`,
   `src/alignfunctor.cpp:541-543`: `measure->SetDrawingXRel(m_shift); m_shift += measure->GetWidth();`
2. `Measure::GetWidth()` is the XRel of the `ALIGNMENT_MEASURE_END` alignment
   (`src/measure.cpp:357-363`), and that alignment is pushed to `m_minPos`
   (`src/adjustxposfunctor.cpp:44-46`), which the right barline set to
   `selfRight = GetSelfRight() + rightMargin * unit` (`adjustxposfunctor.cpp:157`, `:188`) — with
   `rightMarginRightBarLine = 0.0`. **So the next measure's origin sits on the barline's right ink
   edge.**
3. In the new measure `m_minPos` restarts at 0 (`adjustxposfunctor.cpp:214, 229`), and the scoreDef
   clef / meter is shifted right until `selfLeft − leftMargin·unit ≥ 0`
   (`adjustxposfunctor.cpp:341-344` and `:141-147`).

⇒ **barline ink right → clef ink left = 1.0 MEI unit = 0.50 sp**, and the same for the meter
signature and the key signature. Verovio gives all three the same number, and it is the sum
`rightMarginRightBarLine (0.0) + leftMargin<sign> (1.0)`.

⚠️ These `SCOREDEF_*` signs *are* handled by `AdjustXPosFunctor`: the skip at
`adjustxposfunctor.cpp:99` (`IsScoreDefElement()`) tests for an element whose ancestor is a literal
`<scoreDef>` (`include/vrv/clef.h:67`), whereas the drawn copy is parented to the Layer
(`src/layer.cpp:583-584`). And `CalcAlignmentXPosFunctor` deliberately leaves them alone —
*"Do not set an x pos for anything before the barline (including it)"*,
`src/calcalignmentxposfunctor.cpp:36`.

### 4.3 ⭐ The other clef case: Verovio's mid-MEASURE clef hugs the NOTE, not the barline

A clef with plain `ALIGNMENT_CLEF` is skipped by `AdjustXPosFunctor`
(`src/adjustxposfunctor.cpp:132-134`) and positioned by `AdjustClefChangesFunctor`
(`src/adjustclefchangesfunctor.cpp`):

```cpp
clef->GetAlignment()->SetXRel(nextAlignment->GetXRel());                        // :93
const int selfRight = clef->GetContentRight() + m_doc->GetRightMargin(clef) * unit;   // :112
if (selfRight > nextLeft) clef->SetDrawingXRel(clef->GetDrawingXRel() - selfRight + nextLeft);  // :114-116
const int selfLeft = clef->GetContentLeft() - m_doc->GetLeftMargin(clef) * unit;      // :118
if (selfLeft < previousRight) { /* AdjustProportionally to make room */ }             // :119-123
```

⭐ This is a **different model from a fixed offset**: the clef is right-anchored to the following
event at `rightMarginClef` = 0.5 sp, and the distance back to whatever precedes it (a barline, a
note) is only a **minimum** of `leftMarginClef` = 0.5 sp, enforced by opening space if violated.

---

## 5. Comparison

### 5.1 Case 1 — a CLEF CHANGE at the head of a mid-system bar

| engine | side of the barline | value | unit as written | in staff spaces | measured between | citation |
|---|---|---|---|---|---|---|
| **LilyPond** | **BEFORE** the barline | 0.7 | staff space | **0.70 sp** (clef right ink → barline left ink) | ink edge → ink edge | `scm/define-grobs.scm:917`; order `:652-667` |
| **MuseScore** | **BEFORE** the barline (`AUTO`) | 0.5 | `_sp` = spatium | **0.50 sp** (clef right bbox → barline left bbox) | bbox edge → bbox edge, band-limited | `paddingtable.cpp:123` + `styledef.cpp:230`; side at `modifydom.cpp:306-309` |
| MuseScore, user forces `AFTER` | AFTER | 0.75 | `_sp` | **0.75 sp** | bbox → bbox | `paddingtable.cpp:132` + `styledef.cpp:214` |
| **Verovio** (scoreDef / intermediate clef change) | **AFTER** the barline | 1.0 | MEI unit | **0.50 sp** | content bbox → content bbox | `options.cpp:1712-1714`, `+ rightMarginRightBarLine 0.0` at `options.cpp:1826-1828` |
| Verovio (clef inside a layer, mid-measure) | after, but **note-anchored** | 1.0 left / 1.0 right | MEI unit | **0.50 sp minimum** left, 0.50 sp to the next note | content bbox → content bbox | `adjustclefchangesfunctor.cpp:93, 112-123` |

### 5.2 Case 2 — a TIME SIGNATURE CHANGE at the head of a mid-system bar

| engine | side of the barline | value | unit as written | in staff spaces | measured between | citation |
|---|---|---|---|---|---|---|
| **LilyPond** | AFTER | 0.75 | staff space | **0.75 sp** | ink edge → ink edge | `scm/define-grobs.scm:294`; order `:652-667` |
| **MuseScore** | AFTER | 0.63 | `_sp` = spatium | **0.63 sp** | bbox edge → bbox edge, band-limited | `paddingtable.cpp:136` + `styledef.cpp:218` |
| **Verovio** | AFTER (forced) | 1.0 | MEI unit | **0.50 sp** | content bbox → content bbox | `options.cpp:1728-1730`; forcing at `alignfunctor.cpp:272-280` |

### 5.3 Secondary — clef vs meter: SAME distance or different?

**All three give them different treatment, and two of the three differ in KIND, not just in value.**

| engine | same number? | how they differ |
|---|---|---|
| LilyPond | no | different **side** (clef 0.70 sp before; meter 0.75 sp after) |
| MuseScore | no | different **side** (clef 0.50 sp before; meter 0.63 sp after), and different constants |
| Verovio | **yes, numerically** — both 1.0 MEI unit = 0.50 sp | same side, same value; but they are two independent options (`leftMarginClef`, `leftMarginMeterSig`) that merely share a default |

### 5.4 Secondary — a mid-bar KEY SIGNATURE change: its own number?

Yes in two of three, and it is never merged with the meter's.

| engine | barline → key signature | citation |
|---|---|---|
| LilyPond | **1.00 sp** (`extra-space`), and a key *cancellation* also 1.00 sp with 0.50 sp between cancellation and signature | `scm/define-grobs.scm:297, 298, 1945` |
| MuseScore | **0.50 sp** — `Sid::keysigLeftMargin`, a constant of its own | `paddingtable.cpp:135` + `styledef.cpp:215` |
| Verovio | **0.50 sp** — `leftMarginKeySig`, its own option, same default as clef and meter | `options.cpp:1716-1718` |

### 5.5 Secondary — is the CAUTIONARY at the end of a system distinguished?

**Only structurally, never by a different distance. No engine read here has a separate
"cautionary" spacing constant.**

- **LilyPond** — the end-of-line order (`scm/define-grobs.scm:634-649`) keeps the identical relative
  sequence as the unbroken one, so the *same* `space-alist` entries apply: a cautionary clef stands
  0.70 sp before the barline, a cautionary key/meter 1.00 / 0.75 sp after it. The only extra numbers
  are the `right-edge` entries — `Clef` 0.5 (`:926`), `KeySignature` 0.5 (`:1996`), `TimeSignature`
  0.5 (`:3957`), `BarLine` 0.0 (`:303`) — which are the distance from the last item to the end of
  the line, not a barline distance.
- **MuseScore** — `KeySigAnnounce = 0x40000` and `TimeSigAnnounce = 0x80000` sort **after**
  `EndBarLine = 0x20000` (`src/engraving/dom/segment.h:64-66`), so the courtesy key/meter is after
  the closing barline and reuses `keysigLeftMargin` / `timesigLeftMargin`. `Clef = 0x400` sorts
  before `EndBarLine`, so a courtesy clef is before it and reuses `clefBarlineDistance`. The one
  extra number is `Sid::systemTrailerRightMargin = 0.5_sp` (`styledef.cpp:228`), applied at
  `horizontalspacing.cpp:1172-1177` — a trailer's right margin, not a barline gap.
- **Verovio** — the cautionary group has its **own alignment slots**, `SCOREDEF_CAUTION_CLEF /
  _KEYSIG / _MENSUR / _METERSIG`, positioned **after** `ALIGNMENT_MEASURE_RIGHT_BARLINE`
  (`include/vrv/horizontalaligner.h:59-63`), assigned at `src/alignfunctor.cpp:130-141` and
  `:231, 243, 255, 268`. 🚨 So Verovio puts even the cautionary **clef** after the closing barline —
  the opposite of LilyPond and MuseScore. The distances are still the same
  `leftMargin*` options; there is no cautionary-specific constant.

---

## 6. UNKNOWN — what these sources do not state

⛔ Nothing below is guessed or averaged.

1. **Why any of these values is what it is.** None of the three carries a comment, a citation or a
   derivation for `0.7` / `0.75` / `0.5` / `0.63` / `1.0`. LilyPond's `BarLine` block cites Ross
   p. 151 — but only for `kern`, `segno-kern` and `hair-thickness`, and only to say *"we opt for a
   leaner look"* (`scm/define-grobs.scm:263-266`). The `space-alist` numbers themselves are
   unsourced in all three engines.
2. **MuseScore `Sid::midClefKeyRightMargin = 1.0_sp`** (`styledef.cpp:219`) — declared in
   `styledef.h:227` and **read nowhere** in the revision above (a full `src/` grep finds only the two
   declarations). Whether it is dead, or reached through a data-driven path not found here, is
   UNKNOWN.
3. **The exact residual between Verovio's `ALIGNMENT_MEASURE_END` and the right barline's ink edge.**
   The derivation in §4.2 follows the code path and `rightMarginRightBarLine = 0.0`, but it was not
   confirmed by running Verovio and measuring output. The 0.50 sp is read from the source, not
   measured from a rendering.
4. **MuseScore's `Shape` composition for a `BarLine` and a `Clef`** — whether either shape is the
   plain glyph bbox or is padded/split into several rects was not traced to `BarLine::shape()` /
   `Clef::shape()`. The *convention* (bbox right → bbox left, §1.2) is certain; the exact box for
   these two items is not.
5. **What LilyPond's `Clef` grob's X-extent includes for a mid-line (small) clef** — i.e. whether the
   0.70 sp is measured from the reduced-size glyph's ink or from something padded. Not traced.
6. **Whether any engine's number was chosen to be measured against a printed plate.** No engine
   states it.
7. **Finale / Dorico / Sibelius.** Not in the brief and not on disk (`~/dev/engine-sources` holds
   lilypond, MuseScore, verovio, belle, musxdom, inkscape, enigmaxml-documentation). `musxdom` and
   `belle` were **not** consulted for this question. UNKNOWN, not silent.
8. **Whether a repeat barline changes the mid-system numbers.** MuseScore's repeat-specific switches
   are listed in §3.4 and LilyPond has a separate `signum-repetitionis` break-align symbol with its
   own entries (e.g. `Clef.space-alist (signum-repetitionis . 0.7)`, `scm/define-grobs.scm:916`), but
   the repeat case was not surveyed here.

---

## THE BOOKS

The treatises' side of this question — Gould, Ross, Gerou & Lusk, Stone — is being recorded
separately, in `reference/README.md`'s Q&A tables, by another agent. ⛔ Nothing from the books is
reported here.
