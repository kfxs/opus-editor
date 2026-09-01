# THE HEADER RUN — every gap from the system's left edge to the first note

> 📄 Research for **P5b** of `docs/own-engraving-engine.md` (*"the HEADER RUN — clef, key, meter, and
> the gaps between them"*), and the sibling of `docs/staff-line-research.md`, which takes the other
> half of P5. ⛔ **This document decides nothing and schedules nothing.** §8 is the decision list and
> it is HIS.
>
> **Done 2026-09-01.** Four treatises, three engines, VexFlow's source, and **five measured plates**.
>
> ⭐⭐ **The one thing to take away before any number: THE BOOKS USE TWO DIFFERENT CONVENTIONS, AND
> MIXING THEM IS A SILENT ~1 STAVE-SPACE BUG.** Gould's and Stone's distances are **white gaps, ink
> edge to ink edge** — measured on her own bracket-marked plate below, and stated outright by Stone
> (*"cutting edges of staff… to measure the gaps"*). Ross's are **origin to origin, left side of one
> character to left side of the next** — stated by him three times. Ross's *"3½ spaces, clef to first
> sharp"* and Gould's *"1–1¼"* are **the same distance**.

---

## 0. The question

At the head of a system there is a run of signs:

```
[system left edge / opening barline] → CLEF → KEY SIGNATURE → TIME SIGNATURE → FIRST NOTE
```

Every gap in that run is an engraving decision. Today they are VexFlow's `Stave` defaults on the
drawing side and `engine/layout/headerInk.ts`'s measurements on the reservation side — the
*two-sets-of-numbers* pair `own-engraving-engine.md` §P5 names as the problem's last hiding place.
Six gaps, plus two internal ones:

1. left edge → clef (the **indentation**)
2. clef → key signature
3. key signature → time signature
4. the last thing in the header → **first note**
5. …and the same run **mid-line**, after an ordinary barline
6. barline → first note where there is **no** header at all
7. ⭐ *internal:* between one accidental of a key signature and the next
8. ⭐ *internal:* between the two digits/rows of a time signature

## 1. The sources, and how to reach each page again

| source | where | the pages that answer |
|---|---|---|
| **Gould, *Behind Bars*** | `reference/…(Elaine Gould)….pdf`, PDF = printed **+20** | ⭐ *Clefs ▸ INDENTATION* **p. 6** (PDF 26) · ⭐⭐ *Spacing symbols ▸ Beginning of the system* **p. 41** (PDF 61) · ⭐⭐ *Recommended distances before first note* + *Mid-system* **p. 42** (PDF 62) · *cramped conditions / additional clefs* **p. 43** (PDF 63) · *Key signatures ▸ Spacing* **p. 92** (PDF 112) · courtesy **p. 93** (PDF 113) |
| **Ross, *The Art of Music Engraving*** | `reference/…(ted ross)….pdf`, PDF = printed **+12** | ⭐ *the barline's one space* **pp. 74–75** (PDF 86–87) · ⭐⭐ **SPACING FOR KEY SIGNATURES, ACCIDENTALS, TIME SIGNATURES, FIRST NOTES, AND REPEAT BARS**, **pp. 143–147** (PDF 155–159) · *clef indent* also **p. 168** (PDF 180) |
| **Stone, *Notation in the 20th Century*** | `reference/…(Kurt Stone)….pdf` — ⚠️ **2-UP**, `PDF n = printed 2n−22 / 2n−21` | ⭐⭐ *Spacings, Positions, and Sizes ▸ **A. Opening Measures*** **p. 44** (PDF 33, LEFT half); its figures **p. 45** (PDF 33, RIGHT half) · *clef & meter changes mid-line* **pp. 46–47** (PDF 34) |
| **Gerou & Lusk, *Essential Dictionary*** | `reference/gerou-lusk-….pdf` — ⚠️ **2-UP**, `PDF n = printed 2n−4 / 2n−3` | ⭐ *Clef signs ▸ POSITIONING* + *CLEF CHANGES* **pp. 50–51** (PDF 27) · *Key signatures* **pp. 78–81** (PDF 41–42) · *Barlines ▸ courtesy signs* **pp. 27–29** (PDF 15–16) |
| LilyPond | `~/dev/engine-sources/lilypond` | `scm/define-grobs.scm` — the `space-alist`s on `Clef`, `KeySignature`, `TimeSignature`, `BarLine` |
| MuseScore | `~/dev/engine-sources/MuseScore` | `src/engraving/style/styledef.cpp` |
| Verovio | `~/dev/engine-sources/verovio` | `src/options.cpp` |
| VexFlow 5.0.0 | `node_modules/vexflow/build/esm/src/stave.js` | `Stave.padding`, `formatBegModifiers` |
| **ours** | `src/engine/layout/headerInk.ts` + `src/engine/layout/keySignatureLayout.ts` | |

## 2. What each book says — verbatim

### 2.1 ⭐⭐ Gould, p. 41 — the whole rule for the head of a system, in one sentence

> *"The essence of good layout is evenly spaced symbols, as this is what the eye most easily
> assimilates… Where space is limited, **the distance between characters should not be less than
> ½ stave-space** and no characters should collide."*
>
> **Beginning of the system**
> *"**Separate the clef, key signature, time signature by 1–1½ stave-spaces.**"*

### 2.2 ⭐⭐ Gould, p. 42 — the first note, and the table

> *"**The greatest distance between symbols should precede the first note.** For a note without an
> accidental, allow **2–3 stave-spaces**"*

— with a figure of a treble clef, four flats and `6/8`, bracket-marked **1-1¼ · 1-1½ · 2**.

> *"Notes can be placed slightly closer to a time signature than to a clef or key signature. An
> accidental must be sufficiently far from a clef or a key signature for it not to be mistaken for
> one"*
>
> *"A first note or chord with an accidental may move closer to the preceding symbol(s). When further
> accidentals are added, these move closer to the clef. However, **an accidental should never be
> closer to a preceding symbol than one stave-space**"*

**Recommended distances before first note** (her table, p. 42):

| | plain note | with one accidental | with more accidentals |
|---|---|---|---|
| **with clef only** | **2½** | 1½ | 1 |
| **with key signature** | **2½** | 1½ | 1 |
| **with time signature** | **2** | 1 | 1 |

### 2.3 Gould, p. 42 — *Mid-system*

> *"**Allow a stave-space after a clef and on either side of a barline** before a notational symbol.
> It is good practice to allow **two spaces after a time signature or key signature**. Where a barline
> comes before the end of the stave, allow a stave-space at the end of the stave"*

and p. 43, the escape hatch:

> *"Where space is limited, an accidental or grace note may be closed up to within **½ space** of a
> barline. **Stems must never come closer to a barline than one space**, because the close parallel
> lines are difficult to read"* … *"reduce the space around clefs and accidentals to **½ space**, to
> minimize distortion"*

### 2.4 ⭐ Gould, p. 6 — the INDENTATION

> *"**A clef is indented into the stave by one stave-space (⌐) or a little less**"*

— with four clefs drawn, each carrying a 1-space bracket.

### 2.5 ⭐⭐ Ross, pp. 143–147 — the same run, in the OTHER convention

He opens by stating the convention, twice:

> p. 143: *"The basic unit of measurement is the **"space,"** the distance between two staff lines.
> The compass is set to one, two, three, or more spaces; all spacing of key signatures, accidentals,
> etc., is made with this compass setting."* … *"**Metal-plate engravers, as well as engravers that
> use the stamping process, measure their spacing from the left side of the character.** A quarter
> note with a down stem is measured from its stem side. A sharp is measured from the vertical line on
> its left side. A flat is also measured from its left side."*
>
> p. 75: *"plate engravers **measure from the left side of the characters** … from the left side of
> the first notehead (or character) to the left side of the next notehead (or character)."* And
> *"Machine engraving and most other process engravings are measured **from the center** of the music
> character."*

Then the numbers, all **origin to origin**:

> p. 144: *"**A clef is customarily indented from the open end of the staff (or from the systematic
> barline) by ½ to 1 space.**"*
>
> p. 144: *"if the key signature is one flat, the distance from the left side of the clef to the left
> side of the flat is **three and one-half spaces**."* … *"The distance between each flat added to a
> key signature is **one space**. If the key is four flats, the distance from the left side of the clef
> to the left side of the fourth flat is six and one-half spaces."*
>
> p. 144: *"The distance from the left side of the clef to the left side of the first sharp is **three
> and one-half spaces**."* … *"The distance between each sharp added to a signature is either **one,
> or one and a quarter spaces**, depending on the width of the horizontal bars of the sharps."*
>
> p. 144: *"The horizontal bars of sharp-dies are sometimes farther apart than one space. In this
> event, **expand the spacing between sharps so that the ends of these horizontal bars align
> vertically, rather than overlap**."* (with a drawn INCORRECT/CORRECT pair)
>
> p. 145: *"(1) the space between the left side of the clef, and the left side of the time signature,
> is **three and a half spaces**; (2) the space between the left side of the last sharp or flat in the
> key signature, and the left side of the time signature, is **two and a half spaces**."*
>
> p. 145, *First notes are spaced in the following manner*:
> *"1. The distance between the left side of the clef, and the left side of the first note, is **five
> and a half spaces**. 2. The distance between the left side of the last sharp or flat in the key
> signature, and the left side of the first note, is **three and one-half spaces**. 3. The space
> between the left side of the time signature, and the first note, is **three and a half spaces**."*
>
> p. 146: *"When an accidental precedes the first note of music, that note must be moved **half a
> space to the right**… The distance between the last sharp or flat in the key signature, and the
> accidental preceding the first note, amounts to **a little less than three spaces**. The distance
> between the last sharp or flat in the key signature, and the first note, is **four spaces**."*
> With no key signature: clef → first note **6 spaces** with one accidental, **7** with two.
>
> p. 75, of an ordinary bar: *"**Between the barline and the left side of the first note is one
> space.**"* … *"Machine engraving… would make the mark for the center of our first character after
> the barline **one and one-half** [spaces]"*. And p. 74: *"The traditional engraving practice gives
> **one space for the barline**… (This space is given **after** the barline prior to the first note of
> the measure.)"*

### 2.6 ⭐⭐ Stone, p. 44 — *A. Opening Measures*, and he says they are GAPS

> *"At the beginning of a composition or movement, always indent the first line."*
>
> *"Clefs, key signatures, time signatures, and notes with or without accidentals should be neither
> too far apart nor too close together. **The gaps between them can best be measured by cutting a
> short strip of staff from the music paper and using its cutting edge as a measuring device** (see
> examples below). The spacing should be as follows:*
>
> - *between the clef and any subsequent symbol (key signature or time signature): **one staff-space
>   or a little less**;*
> - *between the key signature and the time signature: **one staff-space**;*
> - *between any of the above and the first note or accidental or rest (with the exception of whole
>   rests and measure-filling whole notes): **1½ staff-spaces**.*"

His p. 45 figures are captioned *"(With cutting edges of staff to show how to measure the gaps)"* —
⭐ so the convention is stated twice, in prose and in the figure.

And mid-line, pp. 46–47:

> *"At changes of clefs between measures, the new clef is placed about **one staff-line space before
> the barline**"* · *"Changes of time signatures must be placed **one staff-line space after the
> barline**, whether within a line or at the end of it"*

### 2.7 Gerou & Lusk, pp. 50–51 — ⭐ the figure IS the specification

> p. 51, *POSITIONING*: *"**Clefs are slightly indented on the staff**, to the right of a systemic
> barline or the open single staff. Be sure to leave the single staff open — do not put a barline
> before the clef!"*
>
> *"The clef is always **placed before the key signature and time signature**."*
>
> *"**Notice the distance from the end of the staff to the clef, from the clef to the key signature,
> and from the key signature to the time signature.**"*

⛔ **And that is the whole of it — there is no number.** The sentence points at a drawing, so the
drawing is measured in §3.4. Their only other quantity here is
> *"When the clef changes within a staff, a cue-size clef is used (usually **75% of the original clef
> size**). Courtesy clefs are also cue size."*

and, on the ORDER, p. 79: *"**Key signatures appear after the clef but before the time signature.**"*

### 2.8 ⛔ THE TWO INTERNAL GAPS

**Between a key signature's accidentals** — answered, and only by Ross: **flat→flat 1 space,
sharp→sharp 1 or 1¼ spaces, origin to origin**, with the *reason* for the sharp's extra
(p. 144, *"expand the spacing between sharps so that the ends of these horizontal bars align
vertically"*). Gould p. 92 gives the rule as a prohibition rather than a number — *"keep the key
signature evenly spaced… **Do not overlap the flats**"* — and Stone and Gerou & Lusk say nothing.

**Between the two digits (or the two rows) of a time signature** — ⛔ **UNKNOWN as a spacing, and
the nearest thing to a rule is VERTICAL.** All four books were searched for
`numerator`/`denominator`/`upper figure`/`numeral` on 2026-09-01. The only geometry anyone gives is
Gould **p. 152**, *Time signatures ▸ Size and placing*:

> *"**Time-signature numerals should exactly fill the height of the stave.** Smaller numerals are not
> sufficiently conspicuous"* … *"Time-signature numerals use a **unique heavy font** so that they
> stand out as clearly as possible against the stave. The font distinguishes them from other numerals
> so that the eye identifies them instantly."* … *"At the beginning of a piece, the time signature
> goes **after a clef and any key signature**."*

⇒ the PAIR occupies four stave-spaces, so each figure is ≈2 sp tall and the two meet at the middle
line — which fixes the vertical arrangement and says nothing about a gap. ⛔ **No source states a
horizontal gap between the two figures, a digit-to-digit gap inside a two-digit numerator, or how a
`12` is centred over an `8`.** Ross pp. 143–147 measure the time signature only from *"the left side
of the time signature"*, i.e. as one object.

## 3. ⭐⭐ THE PLATES, MEASURED

**Method.** `pdftoppm -r 600`; staff lines found by a row ink-profile, then a **column** ink-profile
with the staff-line rows masked, so every run is a glyph's ink and every gap between runs is white
space. On Gould's trim 1 stave-space = **26.5–26.75 px** at 600 dpi.

### 3.1 ⭐⭐ FIRST: what her numbers are measured BETWEEN — settled from her own brackets

Gould's *Recommended distances before first note* table (p. 42) draws a bracket over each labelled
distance. Measuring **the bracket itself** against **the ink either side of it** answers the
convention question outright:

| her label | bracket (px) | in sp | preceding ink ends | following ink starts |
|---|---|---|---|---|
| clef only, **2½** | 1510 → 1579 | **2.60** | clef at **1508** | notehead at **1578** |
| clef only, **1½** | 2062 → 2104 | **1.58** | clef at **2061** | accidental at **2105** |
| clef only, **1** | 2560 → 2588 | **1.06** | clef at **2559** | accidental at **2590** |
| key sig, **2½** | 1649 → 1718 | **2.59** | last flat at **1650** | notehead at **1716** |
| key sig, **1½** | 2142 → 2184 | **1.58** | last flat at **2144** | accidental at **2183** |
| key sig, **1** | 2646 → 2674 | **1.05** | last flat at **2647** | accidental at **2675** |

⭐⭐ **Every bracket begins where the left glyph's ink ends and finishes where the right glyph's ink
begins, to within 1–2 px.** ⇒ **Gould's distances are WHITE GAPS, ink edge to ink edge.** Not
origins, not advance widths, not bounding boxes with side bearings.

⚠️ And note the brackets measure **2.60 / 1.58 / 1.06** against labels of **2½ / 1½ / 1** — the
drawing is 3–6% loose against its own labels, which is the printer's, not a rule.

### 3.2 The same table's third row, and the two header gaps

| gap | measured | her label |
|---|---|---|
| time signature ink → notehead ink | 1579 → 1635 = **2.11 sp** | **2** |
| time signature ink → accidental ink (one accidental) | 2132 → 2162 = **1.13 sp** | **1** |
| **clef ink → time signature ink** | 1510 → 1538 = **1.06 sp** | *"1–1½"* (p. 41) |
| **clef ink → first flat ink** | 1508 → 1535 = **1.02 sp** | *"1–1½"* (p. 41) |

### 3.3 Her p. 42 top figure (clef · 4 flats · `6/8` · note), bracket-labelled `1-1¼ 1-1½ 2`

| bracket | measured | label |
|---|---|---|
| clef → key signature | **1.31 sp** | 1–1¼ |
| key signature → time signature | **1.57 sp** | 1–1½ |
| time signature → first note | **2.06 sp** (bracket) / **2.54 sp** (ink to ink) | 2 |

⚠️ On this figure the last bracket stops 12 px short of the notehead's ink, unlike every bracket in
the table above. ⛔ Not explained; both numbers are given rather than one being chosen.

### 3.4 ⭐ THE INDENTATION — three sources, one answer

**Gould p. 6**, four clefs each under a bracket she labels *"one stave-space"*:

| clef | staff's left edge | clef ink starts | **indent** | her bracket |
|---|---|---|---|---|
| treble | 1162 | 1181 | **0.70 sp** | 0.74 |
| bass | 1530 | 1550 | **0.74 sp** | 0.78 |
| alto | 1901 | 1919 | **0.67 sp** | 0.81 |
| percussion | 2269 | 2288 | **0.70 sp** | 0.81 |

⭐ She draws *"a little less"* than the one space she names — consistently, 0.67–0.74.

**Gerou & Lusk pp. 50–51**, the figures their prose points at (600 dpi, sp = 45.5 / 51.5 px):

| figure | staff's left edge | clef ink starts | **indent** |
|---|---|---|---|
| *"indent on single staff — no left barline"* (alto) | 3349 | 3381 | **0.70 sp** |
| the clef/key/meter figure (treble) | 3419 | 3451 | **0.62 sp** |

**Ross p. 144** states it: *"½ to 1 space"* (and p. 25, of marking the plate: *"a guideline down the
plate **one space** from the end of the staff"*).

⇒ ⭐⭐ **Three sources, no dissent: the clef's ink begins about 0.6–0.8 stave-spaces inside the
staff's left edge.**

### 3.5 Gerou & Lusk's header figure, measured (p. 51, treble + 2 sharps + `3/4`)

| gap | measured |
|---|---|
| clef ink → first sharp ink | **0.41 sp** |
| sharp → sharp, **origin to origin** | **1.09 sp** |
| sharp → sharp, ink to ink | 0.33 sp |
| last sharp ink → time signature ink | **0.76 sp** |

⚠️ **Tighter than Gould everywhere**, and it is a small schematic rather than engraved music — but
its sharp-to-sharp **1.09 origin-to-origin** lands squarely on Ross's stated *"one, or one and a
quarter spaces"*, which is the one number of theirs that can be cross-checked. ⭐ It is also the third
independent confirmation of that pitch (`layout/keySignatureLayout.ts` records Gould 1.12 and Ross
1.24 for sharps, 1.00–1.12 for flats).

### 3.6 Mid-system, from Gould p. 43's own bracket-marked figure

| gap | measured | her rule (p. 42) |
|---|---|---|
| note ink → barline | **1.08 sp** | *"a stave-space… on either side of a barline"* |
| barline → clef ink (a mid-line clef change) | **1.05 sp** | *"Allow a stave-space after a clef and on either side of a barline"* |
| clef ink → start-repeat sign | **1.01 sp** | as above |

⭐ Three gaps drawn at 1.0–1.1 sp against a stated 1 — her mid-system rule is engraved as written.

## 4. 🚨 WHAT WE RESERVE AND DRAW TODAY — read off the source, ⛔ not intentions

Two files own the header. **`src/engine/layout/headerInk.ts`** prices it for the spacing model;
**`src/engine/layout/keySignatureLayout.ts`** owns the three gaps around a key signature. ⚠️ Every
number in `headerInk.ts` is a **measurement of VexFlow's drawing written down** — its own header says
so — so it describes the picture rather than choosing it. `e2e/spacing.e2e.ts` re-measures them.

### 4.1 The constants, in staff spaces

| what | constant | value | what it is measured between |
|---|---|---|---|
| a full clef at a line start | `CLEF_FULL` | treble **3.2** · bass **3.5** · alto/tenor **3.6** | the stave's own x → past the clef, **less the lead-in** — i.e. the indent is INSIDE this number |
| the small mid-line clef | `CLEF_SMALL` | treble/bass **2.6** · alto/tenor **2.7** | same |
| a time signature | `meterExtent` | `1.2 × digits + 1.2` ⇒ `3/4` = **2.4**, `12/8` = **3.6** | box width incl. its own left air |
| …of which is air before the digits | `METER_PART_LEFT_AIR` | **0.6** | ⚠️ labelled *"NOT an engraving number — a MODEL correction"* |
| clef → meter (no key) | `BETWEEN_PARTS` | **1.0** | box to box |
| **clef ink → first accidental ink** | `CLEF_TO_KEY_INK` | **0.82** | ink to ink |
| **last accidental ink → meter ink** | `KEY_TO_METER_INK` | **1.15** | ink to ink |
| barline → first accidental ink (mid-line key change) | `BARLINE_TO_KEY_INK` | **1.0** | ink to ink |
| accidental → accidental **inside** a signature | `KEY_ACCIDENTAL_GAP` | **0.25**, added to the glyph's advance ⇒ sharp **1.25**, flat **1.15** pitch | origin to origin |
| **header → FIRST NOTE** | `HEADER_TO_NOTE` | **2.0** | the header's last ink → the note |
| barline → first note, **no header** | `pairPadding('barline', …)` | **1.2** | `layout/spacingPadding.ts:378`; it is VexFlow's `Stave.padding`, ⛔ not a chosen number |
| a **cautionary** clef / key / meter at a line end | `cautionaryExtent` | the same glyph extents + `BETWEEN_PARTS` | — |
| the extra a bar pays on becoming line-opening | `lineOpeningClefPremium` | `CLEF_FULL − CLEF_SMALL` ⇒ **0.6 / 0.9 / 0.9** | — |

### 4.2 Where each of ours came from — and the two that came from nowhere

| gap | our number | its stated source in the code |
|---|---|---|
| clef → key | **0.82** | LilyPond `Clef.space-alist (key-signature . (extra-space . 0.82))`; MuseScore `clefKeyDistance 0.75`; **Ross p. 143's 3½ origin-to-origin re-expressed as ink** = 0.82. ⭐ Three sources land on it |
| key → meter | **1.15** | LilyPond `KeySignature.space-alist (time-signature . 1.15)`; MuseScore `keyTimesigDistance 1.0`; Gould p. 41's *"1–1½"* |
| barline → key | **1.0** | Gould's drawing (measured 1.00) + MuseScore `keyBarlineDistance 1.0` |
| accidental → accidental | **0.25** gap ⇒ 1.25 / 1.15 pitch | derived so that one gap reproduces Ross's sharp 1¼ and Gould's measured flat; ⚠️ its own comment calls it *"a PREDICTION, and it is owed his eye"* |
| header → first note | **2.0** | LilyPond `TimeSignature.space-alist (first-note fixed-space . 2.0)` and, cross-checked, `Clef.space-alist (first-note minimum-fixed-space . 5.0)` |
| **clef → meter, no key** | **1.0** (`BETWEEN_PARTS`) | ⚠️ a MEASUREMENT of VexFlow's drawing, reconciled after the fact to LilyPond's `Clef.space-alist (time-signature . 1.52)` |
| **the clef's INDENT** | ⛔ **none — we have no constant for it** | it is whatever VexFlow's `Stave` does, absorbed inside `CLEF_FULL`. 🚨 The one gap in the run that nobody here has ever chosen |
| **inside a time signature** | ⛔ **none** | the glyph pair is VexFlow's `TimeSignature`; we only price its box |

### 4.3 🚨 Ours against Gould's plate, gap by gap

Both columns are **ink to ink**, so they are directly comparable (§3.1).

| gap | **ours** | **Gould, stated** | **Gould, measured** | verdict |
|---|---|---|---|---|
| left edge → clef | ⛔ not ours | *"one stave-space or a little less"* (p. 6) | **0.67–0.74** | ⛔ unowned |
| clef → key signature | **0.82** | *"1–1½"* (p. 41); figure labels 1–1¼ | **1.02 · 1.31** | 🚨 **we are 20–37% tight** |
| key signature → time signature | **1.15** | *"1–1½"* (p. 41); figure labels 1–1½ | **1.57** | ⚠️ inside her range, at its floor |
| clef → time signature (no key) | **1.0** | *"1–1½"* | **1.06** | ✅ agrees |
| header → first note | **2.0** | **2½** after a clef or key, **2** after a meter (p. 42) | **2.60 · 2.59 · 2.11** | 🚨 **right after a meter, ~0.5 sp tight after a clef or a key signature** |
| barline → first note (no header) | **1.2** | *"a stave-space… on either side of a barline"* (p. 42) | **1.05–1.08** | ⚠️ we are 0.15 sp loose |
| accidental → accidental | **1.25 / 1.15** origin-to-origin | *"keep the key signature evenly spaced… do not overlap"* (p. 92) | 1.12 (flat) / 1.25 (sharp) | ✅ agrees |

⭐⭐ **The one structural finding: we charge ONE number, 2.0, where Gould charges THREE — 2½ after a
clef, 2½ after a key signature, 2 after a time signature.** Her sentence is *"Notes can be placed
slightly closer to a time signature than to a clef or key signature"*, i.e. the gap is keyed on
**what the note follows**, and `HEADER_TO_NOTE` has no such key. We draw her *time-signature* row for
all three cases.

## 5. What the three engines do

### 5.1 ⚠️ First — what each engine's number is measured BETWEEN

⛔ These are not interchangeable, and neither are the books' (§3.1).

| engine | the gap is measured | source |
|---|---|---|
| **LilyPond**, breakable↔breakable | **bounding box to bounding box** for `extra-space` (`offset[next] = ext[cur].RIGHT + d − ext[next].LEFT`); ⚠️ but `minimum-space` is an **origin-to-origin floor, not a gap** | `lily/break-alignment-interface.cc:241–246` |
| **LilyPond**, breakable→note | from the non-musical column's **origin**, with a universal floor `fixed += max(0, 0.3 + min_dist − fixed)` | `lily/staff-spacing.cc:166–215` |
| **MuseScore** | **`Shape` rectangle to `Shape` rectangle** — `dist = max(dist, r1.right() − r2.left() + padding)`, then scaled by the two items' `mag()` and floored at `0.1 × spatium` | `rendering/score/horizontalspacing.cpp:1261`, `:1223`, `:1459–1470` |
| **MuseScore**, at a system start only | an **absolute offset from the system's left margin to the segment's origin** (`clefLeftMargin` &c.), with the element's own shape-left added on top | `horizontalspacing.cpp:1188–1218`, `:285–289` |
| **Verovio** | **ink-box edge to ink-box edge** — `m_selfBB` is filled only from glyph ink | `src/adjustxposfunctor.cpp:341–344`, `:157`; `src/bboxdevicecontext.cpp:367–385` |
| **VexFlow 5** | **advance-width right edge → next modifier's origin** (`Element.getWidth()` is `measureText`, ⛔ not ink) | `stave.js:374–404` |

⭐ So **Gould, Stone, MuseScore and Verovio are all measuring the same thing we do (ink to ink); Ross
and LilyPond's `minimum-space` are origin-based; VexFlow is advance-based.**

### 5.2 The whole run, side by side (staff spaces)

| gap | LilyPond | MuseScore | Verovio | VexFlow 5 | **ours** |
|---|---|---|---|---|---|
| system left edge → **CLEF** | **0.80** (`LeftEdge` has a zero-width X-extent, so this is the clef's bbox-left) `define-grobs.scm:2092` | **0.75** `clefLeftMargin` `styledef.cpp:214` | **0.50** (`leftMarginClef` 1.0 vu) `options.cpp:1713`; **0.65** with a system-start line | **0.5** = the opening barline's own 5 px, padding 0 at index 0 `stave.js:393–400`, `stavemodifier.js:42–43` | ⛔ none |
| barline → **CLEF** (mid-line) | **1.00** `define-grobs.scm:296` | **0.75** `paddingtable.cpp:132` | 0.50 | 0.5 | `inlineClefExtent` |
| **CLEF → KEY** | **0.82** `define-grobs.scm:920` | **0.75** `clefKeyDistance` `styledef.cpp:221` | **1.00** `options.cpp:1783,1717` | **1.0** (10 px at index 2) `stavemodifier.js:22` | **0.82** |
| **KEY → METER** | **1.15** `define-grobs.scm:1990` (⭐ a key *cancellation* → meter is **1.25**, `:1942`) | **1.00** `keyTimesigDistance` `styledef.cpp:223` | **1.00** `options.cpp:1787,1729` | **1.5** (15 px) `timesignature.js:17` | **1.15** |
| **CLEF → METER** (no key) | **1.52** `define-grobs.scm:921` | **1.00** `clefTimesigDistance` `styledef.cpp:222` | 1.00 | 1.0 | **1.0** |
| **header end → FIRST NOTE** | ⭐ **keyed on what precedes**: after a meter `semi-shrink-space 2.0`; after a key signature `shrink-space 2.5`; after a clef `minimum-fixed-space 5.0` (⚠️ **from the clef's LEFT edge**) — `define-grobs.scm:3955`, `:1997`, `:924` | ⭐⭐ **keyed too**: **2.00** `systemHeaderTimeSigDistance` when the header ends in a meter, **2.50** `systemHeaderDistance` otherwise — `styledef.cpp:225–226`, `horizontalspacing.cpp:1360–1365`. Floor **1.5** (`:1357`) | **1.00 + 1.00** through the left barline `options.cpp:1799,1721,1791,1749` | **1.2** — `Stave.padding = 12` added to every note `note.js:343`, `metrics.js:132` | **2.0**, one number |
| barline → first note, **no header** | **0.9** mid-line (`next-note semi-fixed-space`, `define-grobs.scm:302`); **1.3** at a line start (`first-note`, `:301`) | **1.25** `barNoteDistance` `styledef.cpp:265`; **0.65** if the note carries an accidental (`barAccidentalDistance`) | **1.00** | **1.7** = 5 px barline + 12 px `Stave.padding` | **1.2** |
| **accidental → accidental** in a signature | ⭐ **0.0 added** — `KeySignature.padding` is unset ⇒ the C++ fallback 0.0 (`key-signature-interface.cc:106`); all the white is the font's side bearings. **Naturals**: +0.30 when the slices overlap, +0.15 when corners touch (`:113–115`) | **0.30** `keysigAccidentalDistance`, **doubled to 0.60 when the symbol changes**, **0.40** natural-after-natural — `styledef.cpp:293–294`, `tlayout.cpp:3474–3478`; then **reduced by the SMuFL cut-out** where the glyphs interlock (`:3481–3489`) | **0.20** (`TEMP_KEYSIG_STEP`, marked `// HARDCODED`), naturals **0.30**, added on top of each glyph's **advance** — `include/vrv/options.h:51–54`, `src/view_element.cpp:1060–1062` | **0.10** (1 px); **0.20** when either glyph is a natural and the two are within 10 px vertically — `keysignature.js:24–36` | **0.25** on top of the advance |
| between the two **TIME-SIG rows** | **2.0 sp**, by translating the denominator `staff-space × −2` inside a `\combine` — `scm/time-signature-settings.scm:889–903` | **0.0** clear gap by default (`timeSigNormalNumDist`, `styledef.cpp:243`) — the two bboxes touch | **2.0 sp** centre-to-centre, ±1 sp about the staff middle, hardcoded — `src/view_element.cpp:2139–2140` | **2.0 sp** (top digits on line 1, bottom on line 3); **3.0 sp** when the measured glyph exceeds 30 px — `timesignature.js:29–30, 82, 136` | VexFlow's |

### 5.3 ⭐⭐ THE FINDING: TWO ENGINES KEY THE FIRST-NOTE GAP THE WAY GOULD DOES, AND ONE OF THEM USES HER NUMBERS

> **MuseScore**: `systemHeaderDistance = 2.5` when the header ends in anything but a time signature,
> `systemHeaderTimeSigDistance = 2.0` when it ends in one (`style/styledef.cpp:225–226`).
>
> **Gould p. 42**: **2½** after a clef, **2½** after a key signature, **2** after a time signature.

**Those are the same two numbers, keyed on the same distinction.** LilyPond keys it too, with three
different *tags* rather than three values (`shrink-space 2.5` after a key signature vs
`semi-shrink-space 2.0` after a meter), which is her pair again with a stretch policy attached.

⇒ 🚨 **Our single `HEADER_TO_NOTE = 2.0` is LilyPond's *time-signature* row promoted to the only
row** — and its own comment says exactly that, citing
`TimeSignature.space-alist (first-note fixed-space . 2.0)`. The clef and key-signature rows of the
same `space-alist` were read at the time and reconciled to the same answer; the two engines that
implement Gould's distinction were not consulted for it.

### 5.4 ⚠️ Two provenance flags from this reading

1. **A line-number drift.** `docs/clef-spacing-research.md:663–664` cites
   `scm/define-grobs.scm:2093` for `LeftEdge → clef 0.8` and `:918` for `Clef → key-signature 0.82`.
   In the current checkout those are **`:2092`** and **`:920`** (`:2093` is now `cue-clef`, `:918` is
   `ambitus`). The **values agree exactly**; only the lines moved.
2. **A SMuFL font silently rewrites two of these engines.** MuseScore maps a loaded font's
   `staffLineThickness` onto `Sid::staffLineWidth` (`internal/engravingfont.cpp:778`) and Verovio
   converts 24 `engravingDefaults` into options with a ×2 staff-space→vu factor unless the option was
   set explicitly (`src/options.cpp:2089–2155`). So *"MuseScore = 0.11"* and *"Verovio = 0.075"* are
   **style defaults**, not necessarily what a Bravura-loaded run draws.

### 5.5 ⭐ VexFlow's header run, in one place — because it is what we draw

At the default 10 px staff space, a stave with barline + clef + key signature + time signature:

| step | px | sp | citation |
|---|---|---|---|
| `x = stave.x`; Barline at index 0, padding **0**, width **5** | +5 | +0.5 | `stave.js:393–400`; `stavemodifier.js:42–43`; `stavebarline.js:36` |
| Clef at index 1, padding **0**, width = `measureText(glyph)` at 30 pt | +clef | +0 | `clef.js:97–103` |
| KeySignature at index 2, padding **10** | +10 | +1.0 | `stavemodifier.js:22`; `keysignature.js:144–147` |
| TimeSignature at index 3, padding **15** | +15 | +1.5 | `timesignature.js:17, 28, 33` |
| `startX = x`, flush against the last modifier | 0 | 0 | `stave.js:404` |
| **every note adds `Stave.padding` on top** | +12 | **+1.2** | `note.js:343`; `metrics.js:132` |

⇒ a headerless bar puts its first note **17 px = 1.7 sp** from the stave's left edge, which is the
number `layout/measureColumns.ts:312` and `rendering/VexFlowRenderer.ts:5019` already record.

⚠️ **We no longer use VexFlow's key signature** — signatures are ours
(`rendering/EngravedStave.ts:23`, `rendering/KeySignaturePass.ts`) — so the 1.0 sp clef→key row above
is VexFlow's and not what we draw. The **barline (5 px), the clef, the time signature's 15 px and the
12 px `Stave.padding` still are.**

## 6. ⭐ Where they all agree

1. **The order is clef → key signature → time signature → note.** Gould p. 152, Ross p. 145,
   Gerou & Lusk pp. 51 and 79, Stone p. 44. No dissent anywhere. ✅ We agree
   (`headerInk.headerExtent`'s `parts` array).
2. **The clef is INDENTED, and by less than a whole space.** Gould *"one stave-space or a little
   less"* (p. 6, drawn 0.67–0.74), Ross *"½ to 1 space"* (p. 144), Gerou & Lusk *"slightly indented"*
   (p. 51, drawn 0.62–0.70). ⇒ **0.6–0.8 sp**, three sources.
3. **The biggest gap in the run is the one before the first note.** Gould says it in so many words
   (*"The greatest distance between symbols should precede the first note"*, p. 42); Ross's numbers
   have it (3½ from a meter or a key signature, against 2½ between them); Stone's 1½ is his largest;
   and it is the largest constant in all four engines. ✅ We agree — `HEADER_TO_NOTE` 2.0 is our
   largest header gap.
4. **A first note with an accidental moves LEFT, closer to the header.** Gould's table (2½ → 1½ → 1),
   Ross p. 146 (*"moved half a space to the right"* for the accidental, i.e. the note keeps its place
   and the accidental takes the room), Stone (*"the first note **or accidental**"*). 🚨 **We have no
   such rule** — `HEADER_TO_NOTE` is charged to the column, whatever is in front of it.
5. **A minimum exists and it is ½ space.** Gould p. 41 (*"not less than ½ stave-space"*) and p. 43
   (*"an accidental or grace note may be closed up to within ½ space of a barline"*, *"reduce the
   space around clefs and accidentals to ½ space"*). ⛔ We have no floor of this kind.
6. **Signatures are evenly spaced; sharps may take slightly more than flats.** Ross p. 144 gives the
   reason (the horizontal bars must not overlap); Gould p. 92 forbids the alternative
   (*"Do not overlap the flats"*). ✅ We agree, and by a rule rather than two constants
   (`KEY_ACCIDENTAL_GAP` + the glyph's own advance).

## 7. ⚠️ Where they diverge — and one of them is not a real disagreement

### 7.1 🚨 The FIRST-NOTE gap: Gould 2–2½ · Stone 1½ · Ross 3½ origin-to-origin

This is the disagreement the manifest already flagged, and it survives conversion.

| source | after a clef | after a key signature | after a time signature | measured between |
|---|---|---|---|---|
| **Gould** p. 42 | **2½** | **2½** | **2** | ink → ink (**measured on her plate**, §3.1) |
| **Stone** p. 44 | **1½** | **1½** | **1½** | *"the gaps"*, cutting-edge measured |
| **Ross** p. 145 | 5½ | 3½ | 3½ | **origin → origin** |
| **MuseScore** | **2.5** | **2.5** | **2.0** | shape → shape (`styledef.cpp:225–226`) |
| **LilyPond** | *(5.0 from the clef's left edge)* | **2.5** | **2.0** | `space-alist`, per tag (§5.2) |
| **Verovio** | 2.0 | 2.0 | 2.0 | ink → ink, via the left barline |
| **ours** | 2.0 | 2.0 | 2.0 | ink → ink |

⭐⭐ **MuseScore's two constants ARE Gould's two numbers**, keyed on the same distinction (§5.3), and
LilyPond keys it too. ⇒ the *"one number"* position is held by Verovio and by us alone.

⭐ **Ross converts.** Subtract the preceding glyph's own ink width and Ross's numbers become gaps:
his time signature is about 2 sp of ink, so *"3½ from the left side of the time signature"* ≈ **1½ sp
of white** — **which is Stone's number, not Gould's**. His clef→first-note 5½ against a treble clef's
≈2.7 sp of ink is ≈2.8 sp of white, closer to Gould's 2½. ⇒ 🚨 **Ross agrees with Stone after a
meter and with Gould after a clef, and neither of them keys the gap the way she does.**

⛔ **No source adjudicates.** Gould is the only one who makes the gap depend on *what precedes it*.

### 7.2 Clef → key and key → meter: a narrower spread

| source | clef → key | key → meter | convention |
|---|---|---|---|
| **Gould** p. 41 / figure | *"1–1½"* / 1–1¼; **drawn 1.02–1.31** | *"1–1½"*; **drawn 1.57** | gap |
| **Stone** p. 44 | *"one staff-space **or a little less**"* | *"one staff-space"* | gap |
| **Ross** pp. 144–145 | 3½ origin-to-origin ⇒ **≈0.8 gap** | 2½ origin-to-origin ⇒ **≈1.5 gap** | origin |
| **Gerou & Lusk** p. 51 | drawn **0.41** | drawn **0.76** | gap (measured) |
| **ours** | **0.82** | **1.15** | gap |

🚨 **Our clef→key 0.82 is Ross's converted number and Gerou & Lusk's neighbourhood; it is below
Gould's stated range and 20–37% below her drawing.** The code records that this constant was **1.5
for one commit and HIS EYE rejected it** — *"isn't the first accidental too far from the clef?"* — so
the low end already survived one test by the only judge that matters
(`layout/keySignatureLayout.ts:69`).

### 7.3 ⚠️ Mid-line, after an ordinary barline

| source | barline → first note | barline → a clef / meter change |
|---|---|---|
| **Gould** p. 42 | *"a stave-space… on either side of a barline"*; **drawn 1.05–1.08** | 1 space; clef change also 1 |
| **Ross** pp. 74–75 | **1 space** to the note's LEFT EDGE (**1½ to its centre**) | — |
| **Stone** pp. 46–47 | — | meter change **1 space after** the barline; clef change **1 space before** it |
| **ours** | **1.2** (`pairPadding('barline', …)`, VexFlow's `Stave.padding`) | `inlineClefExtent` = `CLEF_SMALL + 1.0` |

⭐ Three sources say **1**; we draw **1.2**, and `headerInk.ts:59–61` says outright that this is
VexFlow's floor rather than a choice — *"LilyPond would go TIGHTER than we can draw: `BarLine.space-alist`
asks `next-note` **0.9** mid-line… against our floor of 1.2, which is VexFlow's `Stave.padding` and
not a choice"*.

## 8. THE DECISIONS

### ✅ D — DECIDED AND BUILT, 2026-09-01

> **"ii"** ⇒ **the gap is keyed on what ENDS the header: 2½ after a clef or key signature, 2 after a
> time signature.** Gould p. 42, MuseScore's `systemHeaderDistance` / `systemHeaderTimeSigDistance`
> pair, and LilyPond's three `space-alist` tags.

⭐ Built as `headerToNoteGap()` in `engine/layout/headerInk.ts`, wired into **both** paths — the width
path (`MeasureLayout`'s `sharedOverhead`) and the drawing path (`VexFlowRenderer.applyLeadIn`) — so
the room reserved and the room taken agree by construction.

🚨 **And a third caller had to follow, which is the finding worth keeping.** `systemEdges.lineLeftCurveX`
DERIVES the header's ink edge by *subtracting* this gap from `noteStartX`. With one constant it could
assume the number; with two it would have put an open-ended slur's start **0.5 sp off on every system
after the first**. ⇒ the bar now REPORTS the gap it used (`MeasureBounds.headerToNote`) instead of the
reader re-deriving it — the same lesson as `VEXFLOW_STAFF_LINE_PX` in the staff document: ⛔ **a second
copy of a number goes stale the moment the number moves.**

⚠️ **Measured after the change**: system 1 (clef + meter) lead-in **8.6 sp**, later systems (clef
only) **5.7 sp** = clef 3.2 + 2.5. Before D the latter was 5.2.

🚨 **NOTHING FAILED when the rule changed** — not one of 6187 tests. Both the pure gap and the wired
result now have specs (`headerInk.test.ts`, `MeasureLayout.headerGap.test.ts`), and both were
break-tested by forcing the single constant back.

### The table

⛔ **Nothing below is a defect list.** Every gap in the run, with the options and their provenance,
and the one we draw today named honestly.

| # | gap | the options, with provenance | what we do now |
|---|---|---|---|
| **A** | **left edge → CLEF** (the indent) | (i) **0.6–0.8 sp** — Gould p. 6 drawn 0.67–0.74, G&L p. 51 drawn 0.62–0.70, Ross p. 144 *"½ to 1 space"*; **LilyPond 0.80 and MuseScore 0.75 land inside it** · (ii) **0.50** — Verovio, and VexFlow's 0.5 by accident (its opening barline's own width) | ⛔ **we have never chosen it.** It is whatever VexFlow's `Stave` does, absorbed inside `CLEF_FULL` |
| **B** | **CLEF → KEY SIGNATURE** | (i) **0.82** — LilyPond `Clef.space-alist`, Ross converted, MuseScore 0.75 · (ii) **1.0–1.3** — Gould stated *"1–1½"*, drawn 1.02–1.31 · (iii) **~1.0** — Stone *"one staff-space or a little less"* | **0.82.** 🚨 The tight end, and 20–37% under her drawing — ⭐ but 1.5 was tried and **HIS EYE rejected it** |
| **C** | **KEY SIGNATURE → TIME SIGNATURE** | (i) **1.15** — LilyPond · (ii) **1.0** — Stone, MuseScore · (iii) **~1.5** — Ross converted, and Gould's own drawing at 1.57 | **1.15** — inside Gould's stated 1–1½, at its floor |
| **D** | **HEADER → FIRST NOTE** ⭐⭐ the big one | (i) **one number for all three cases** — ours, and LilyPond's `TimeSignature` row read alone · (ii) ⭐⭐ **keyed on what precedes**: **2½** after a clef or key signature, **2** after a time signature — **Gould p. 42 (drawn 2.60/2.59/2.11) AND MuseScore's `systemHeaderDistance 2.5` / `systemHeaderTimeSigDistance 2.0`, the same pair**, and LilyPond's three different `space-alist` tags (§5.3) · (iii) **1½ flat** — Stone p. 44, Ross converted after a meter, and MuseScore's own `absoluteMinHeaderDist` floor | **2.0 for all three.** ✅ right after a meter, 🚨 ~0.5 sp tight after a clef or key signature |
| **E** | **does an ACCIDENTAL on the first note close the gap?** | (i) yes, and by a stated ladder — Gould 2½ → **1½** with one accidental → **1** with more, *"an accidental should never be closer to a preceding symbol than one stave-space"* · (ii) Ross's version: the NOTE moves right half a space and the accidental takes the room (p. 146) · (iii) no rule | ⛔ **no rule.** The column pays `HEADER_TO_NOTE` whatever is in front of it |
| **F** | **BARLINE → first note, no header** | (i) **1.0** — Gould *"a stave-space on either side of a barline"* (drawn 1.05–1.08), Ross *"one space"*, Verovio · (ii) **0.9** mid-line / **1.3** at a line start — LilyPond's `BarLine.space-alist` · (iii) **1.25** — MuseScore `barNoteDistance`, with **0.65** when the note carries an accidental | **1.2**, and `headerInk.ts:59–61` records that it is **VexFlow's `Stave.padding` floor, not a choice**. ⚠️ VexFlow's own drawn answer is **1.7 sp** (5 px barline + 12 px padding) |
| **G** | **a CRAMPED minimum** | (i) Gould's **½ sp** floor between any two characters (p. 41), with *"reduce the space around clefs and accidentals to ½ space"* and *"stems must never come closer to a barline than one space"* (p. 43) · (ii) none | ⛔ **none** — the spacing solve has no header-specific floor |
| **H** | **inside a TIME SIGNATURE** | ⛔ **UNKNOWN in every book** (§2.8); the only rule is vertical — *"numerals should exactly fill the height of the stave"* (Gould p. 152). The engines split: **2.0 sp between the rows** (LilyPond `time-signature-settings.scm:902`, Verovio `view_element.cpp:2139`, VexFlow lines 1↔3) vs **a 0.0 clear gap, bboxes touching** (MuseScore `timeSigNormalNumDist`) | VexFlow's — 2.0 sp, or **3.0** when the measured glyph exceeds 30 px (`timesignature.js:82`) |
| **I** | **between a signature's ACCIDENTALS** | (i) **one gap + the glyph's advance** — ours, which reproduces Ross's sharp 1¼ and Gould's flat · (ii) **0.0 added, let the font's side bearings do it** — LilyPond, which adds padding only for naturals · (iii) a per-kind constant — MuseScore **0.30**, doubled to **0.60** on a change of symbol, **0.40** natural-after-natural, then *reduced* by the SMuFL cut-out where glyphs interlock 🚨 (Gould p. 92 forbids exactly that tucking); Verovio **0.20** hardcoded, naturals 0.30 | **0.25 sp gap** ⇒ 1.25 sharp / 1.15 flat pitch. ⚠️ its own comment calls it *"a PREDICTION… owed his eye"* |

⭐ **If only one row is ever acted on, D is the one**: it is the only place where a book states a rule
we do not implement *in kind* — Gould keys the first-note gap on what precedes it, and we key it on
nothing.

## 9. What this document does NOT answer — ⛔ UNKNOWN, not "silent"

- **The gap between the two figures of a time signature**, and how a `12` centres over an `8`.
  Searched in all four books (§2.8); only Gould's vertical rule exists.
- **A clef indent measured from an opening BARLINE rather than the staff's end.** Ross alone mentions
  the case (*"or from the systematic barline"*, p. 144) and gives it the same ½–1 space; ⛔ nobody
  draws the pair side by side, so whether the two are equal is untested.
- **A header at a system break vs at the start of a piece.** Stone says *"At the beginning of a
  composition or movement, always indent the first line"* (p. 44) — an indent of the whole system, not
  of the clef — and no source says whether the internal gaps differ between the two. Gould pp. 486–489
  cover casting-off, not this.
- **Whether the first-note gap should shrink in a cramped system.** Gould gives a floor (½ sp) and a
  target (2–3 sp) but no interpolation; Ross's numbers are compass settings, i.e. fixed.
- **Ross's own plates, measured for these gaps.** His numbers were converted arithmetically from
  origin-to-origin using Bravura's ink widths, ⛔ not measured on his engraving. His book's
  reproduction quality (§3.4 of `docs/staff-line-research.md`) is why.
- **Gardner Read**, *Music Notation*, and **Chlapik** — still not on disk (`reference/README.md`,
  *Still missing*). Read is the obvious fifth opinion on prefatory spacing and has **not** been
  consulted.
