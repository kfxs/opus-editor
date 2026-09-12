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
> p. **74** (⚠️ **CORRECTED 2026-09-12 — this doc said p. 75; p. 75 carries the barline's "one space"
> and the machine-engraving "from the center" sentence**): *"plate engravers **measure from the left
> side of the characters** … from the left side of
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

🚨🚨 **CORRECTED 2026-09-12 — ALL THREE of the numbers above are BRACKET LENGTHS, ⛔ not ink gaps,
and on THIS figure the two are different things.** Re-measured at 450 dpi: the **ink** gaps under
those brackets are **1.63 · 1.83 · 2.47 sp**, i.e. every bracket floats ~**0.35 sp** inside its gap.
⭐ That is unlike her p. 42 **table**, where the brackets land on the ink to 1–2 px (re-verified on
two further cells). ⇒ ⚠️ **§3.1's ink-edge finding holds for the TABLE and ⛔ NOT for this figure**,
and this section inherits numbers that are neither the label nor the gap.

⚠️ Consequence for §4.3: its *"Gould measured 1.02 · 1.31"* row for clef→key **mixes one ink
measurement with one bracket measurement**. The **1.02** is sound (independently re-measured at 1.01
on the table's row 2); the 1.31 is a bracket.

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

### 3.7 ⭐⭐ THE ACCIDENTAL TABLE, MEASURED — all nine cells of her p. 42 figure (2026-09-02)

**Why it was measured:** row **E** was about to be built from her printed table, and the obvious
mental model — *"measure the gap to the NOTEHEAD and let the accidental live inside it"* — predicts
something her plate can falsify. It does.

Rendered at 450 dpi (PDF p. 62), staff space **20.0 px**, every figure ink to ink — the last ink of
the header to the **first ink of the note group**, which IS the accidental where there is one:

| | plain | with one accidental | with more |
|---|---|---|---|
| **with clef only** | **2.65** (label 2½) | **1.65** (1½) | **1.15** (1) |
| **with key signature** | **2.49** (2½) | **1.45** (1½) | **1.10** (1) |
| **with time signature** | **2.15** (2) | **1.15** (1) | **1.10** (1) |

⭐ **Every cell is her printed label plus a consistent 0.10–0.15 sp.** Nine for nine: the drawing and
the table are the same rule, unlike the p. 111 slurs where they came apart.

🚨🚨 **AND IT OVERTURNED THE OBVIOUS READING.** Measured from the same plate, her NOTEHEADS after a
clef stand at **2.65 · 3.05 · 3.75** — the head is *not* held at a constant distance. ⇒ **her numbers
are a ladder on the FRONT of the note group, and the head drifts right as accidentals are added.**
That is also what the brackets in her own figure span: clef to *the sharp*, ⛔ not clef to the note.

⚠️ So MuseScore's mechanism is **not** hers, though the two nearly coincide: it targets 2.5 to the
notehead and floors the clear white at 1.5, which reproduces her *"one accidental"* row and then
parts company from her *"more accidentals"* row (it stays at 1.5 where she goes to 1).

⭐ Method, for the next reader: locate the row's five staff lines by counting dark pixels across the
band, mask them out, then take a column-darkness profile over `[topLine − 30, bottomLine + 30]` and
read the ink groups off it. ⚠️ **The bracket marks sit just above the staff and WILL be read as music**
if the band is opened wider than that — they cost one wrong measurement here before the band was
tightened.

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
| **inside a time signature** | ⛔ **none** | ⭐ **the INK is ours as of 2026-09-12** (`engrave/header/meter`, P5b) — ⛔ **but not the GAP**: `topLine`/`bottomLine`/`lineShift` stay VexFlow's and arrive resolved, deliberately, because row **H** is UNKNOWN in every book. We still only price the box |

### 4.3 🚨 Ours against Gould's plate, gap by gap

Both columns are **ink to ink**, so they are directly comparable (§3.1).

| gap | **ours** | **Gould, stated** | **Gould, measured** | verdict |
|---|---|---|---|---|
| left edge → clef | ⛔ not ours | *"one stave-space or a little less"* (p. 6) | **0.67–0.74** | ⛔ unowned |
| clef → key signature | **0.82** | *"1–1½"* (p. 41); figure labels 1–1¼ | **1.02 · 1.31** | 🚨 **we are 20–37% tight** |
| key signature → time signature | **1.15** | *"1–1½"* (p. 41); figure labels 1–1½ | **1.57** | ⚠️ inside her range, at its floor |
| clef → time signature (no key) | ~~**1.0**~~ 🚨 **DRAWN 1.42 · RESERVED ≈1.6** — §4.4, §4.5 | *"1–1½"* | **1.00 · 1.06 · 1.10 · 1.10** (§4.5) | 🚨 **CORRECTED 2026-09-12, and the old ✅ WAS NOT SOUND: 1.0 was the BOX number compared against an INK one.** We are **~0.3–0.5 sp LOOSE** — ⚠️ the OPPOSITE sign to clef→key two rows up, where we are tight |
| header → first note | **2.0** | **2½** after a clef or key, **2** after a meter (p. 42) | **2.60 · 2.59 · 2.11** | 🚨 **right after a meter, ~0.5 sp tight after a clef or a key signature** |
| barline → first note (no header) | **1.2** | *"a stave-space… on either side of a barline"* (p. 42) | **1.05–1.08** | ⚠️ we are 0.15 sp loose |
| accidental → accidental | **1.25 / 1.15** origin-to-origin | *"keep the key signature evenly spaced… do not overlap"* (p. 92) | 1.12 (flat) / 1.25 (sharp) | ✅ agrees |

⭐⭐ **The one structural finding: we charge ONE number, 2.0, where Gould charges THREE — 2½ after a
clef, 2½ after a key signature, 2 after a time signature.** Her sentence is *"Notes can be placed
slightly closer to a time signature than to a clef or key signature"*, i.e. the gap is keyed on
**what the note follows**, and `HEADER_TO_NOTE` has no such key. We draw her *time-signature* row for
all three cases.

### 4.4 🚨🚨 THE CLEF → METER GAP IS THE ONE NOBODY CHOSE — measured 2026-09-12

> *"i see the placement of the meter after the clef seems to be because of the bbox, not the ink…
> what information do we have to know the x where to place it? i think we should have a kind of
> variable, so in the future the user can apply their house style, but we must start with a preset"*
> — HIS question. ⭐ **His instinct was right and his diagnosis was not**, and the difference is the
> whole of this section.

#### ⛔ It is NOT the bbox — for a CLEF, box and ink agree to 0.02 sp

Two independent confirmations, neither of them an opinion:

| evidence | says |
|---|---|
| Bravura's own table (`fonts/bravuraMetrics.GLYPH_BOXES`) | `gClef` ink `right` **2.684** = `advance` **2.684**; `fClef` 2.736/2.736; `cClef` 2.796/2.796 ⇒ ⭐ **a clef has NO right side bearing** |
| `headerInkRightX()`'s own comment, measured earlier | *"VexFlow sizes that box to the glyph it actually draws… at full size the two agree to **0.02 staff spaces**, measured"* |

⇒ ⛔ **Side bearings are worth 0.02 sp here and cannot explain anything.** The meter's own left bearing
is the only one that bites, and it is **−0.08 sp** (`timeSig4.left`), i.e. a digit's ink starts
*before* its origin.

#### 🚨 What it really is: VexFlow's `customPadding`, and NOBODY EVER CHOSE IT

`Stave.format()`'s begin walk is `x += padding; modifier.setX(x); x += width`, and
`StaveModifier.getPadding(i)` returns **0 for `i < 2`**. With no key signature the run is
`[Barline, Clef, TimeSignature]`, so the meter is index **2** and the ONLY thing between the clef and
the meter is `TimeSignature`'s **`customPadding`, default 15 px = 1.5 sp**. The meter's ink then starts
0.08 sp before its origin ⇒ **1.42 sp of white**.

✅ **Measured on our own render** (`inkSizes` on `g.vf-clef text` vs `.vf-timesignature text`, the
browser, default score):

| clef | drawn white gap |
|---|---|
| treble · bass · alto · tenor | **1.4 sp — identical for all four** |

⭐ The identity across all four clefs is itself the proof that the gap is a CONSTANT PADDING and not
anything derived from the glyph.

#### 🚨🚨 …and we RESERVE 1.0 while we DRAW 1.42 — the two-sets-of-numbers problem, still live

`headerInk.BETWEEN_PARTS = 1.0` is what the width model charges; 1.42 is what a reader sees. ⇒ §4.3's
*"✅ agrees"* verdict was comparing **the reserved number**, not the drawn one, and its row is now
corrected. ⭐ This is exactly the pair `own-engraving-engine.md` §P5 is named after — *"`headerInk`
already MEASURES what a clef and a meter cost; `Stave` still PLACES them"* — surviving in the one gap
of the run that was never converted.

#### ⭐⭐ THE ANSWER TO HIS QUESTION: every piece already exists, and the neighbouring gap already does it

`VexFlowRenderer.placeMeterAfterKeySignature()` (line ~5150) is the mechanism, built and shipping:

```ts
const inkLeft = keySignatureInkRight(stave, clef, key) + KEY_TO_METER_INK * space
const origin  = inkLeft + glyphBox('timeSig4').left * space   // the −0.08: ink → ORIGIN
modifier.setX(origin)
```

⭐ Its own comment states the principle: *"**PLACED, not shifted**"* and *"the number in the style
sheets is **white space**, not an origin distance."*

| piece | gives | state |
|---|---|---|
| `glyphBox(name)` | per-glyph ink `left`/`right`/`advance` in staff spaces, from Bravura | ✅ P2 |
| `headerInkRightX()` | where the header's ink actually ends | ✅ built |
| `CLEF_TO_KEY_INK` 0.82 · `KEY_TO_METER_INK` 1.15 | named, ink-to-ink, **house-style** constants | ✅ built |
| `modifier.setX(origin)` + `space = getSpacingBetweenLines()` | the placement seam, scale-correct | ✅ built |
| **`CLEF_TO_METER_INK`** + a `placeMeterAfterClef` twin | the same for clef→meter | ⛔ **MISSING — the whole of the job** |

🚨 **So the SAME GAP is engraved two different ways depending on whether a key signature is present**:
with one, WE place the meter from ink at a number we chose; without one, VexFlow places it from an
advance plus a padding nobody chose. ⭐ `BETWEEN_PARTS` is the only gap in the header run still
expressed **box to box**, which is the odd-one-out he spotted by eye.

#### ⏭️ What is owed

⛔ **Not built, and the PRESET is not chosen.** The candidates in hand — ⚠️ **none yet verified for
which convention it is stated in**, which is the question two agents were sent to settle on
2026-09-12 (the books, and the three clones):

| source | number | measured between |
|---|---|---|
| **Gould**, stated p. 41 | 1–1½ | ✅ **white gap, ink to ink** — §4.5 |
| **Gould**, her plate measured | **1.00 · 1.06 · 1.10 · 1.10** | ink to ink |
| **Ross** p. 145, the ONLY book to give this pair its own number | 3½ **origin to origin** ⇒ **0.98** of white on his own plate | ⭐ left INK edge to left INK edge — §4.5 |
| **Stone** p. 44, stated | *"one staff-space or a little less"* ⇒ **1.14** measured | white gap — §4.5 |
| LilyPond `Clef.space-alist` | **1.52** | ✅ **INK to INK** — §5.6 |
| MuseScore `clefTimesigDistance` | **1.00** | ✅ **INK to INK** — §5.6 |
| Verovio `rightMarginClef` + `leftMarginMeterSig` | **1.00** ⚠️ (1.0 + 1.0 **MEI units**, ½ sp each) | ✅ **INK to INK** — §5.6 |
| **what we draw today** | **1.42** | ⛔ clef ADVANCE end → meter ORIGIN |

⭐⭐ **BOTH HALVES ARE IN (2026-09-12), and the KIND of number is settled from both sides.** The
engines are **3 of 3 from INK** and the only advance-based one in the comparison is VexFlow, the
dependency we are removing (§5.6); the books are **3 of 4 measuring white ink gaps**, and their
plates land on **0.98–1.14, median 1.10** despite stating three different numbers in three different
conventions (§4.5). ⇒ ⭐ **only the VALUE is open**, and it clusters hard: **1.0** (Stone stated,
MuseScore, Verovio), **1.05** (the plates' median), **0.82** (Ross's own compass setting, which is
`CLEF_TO_KEY_INK` — the number HIS EYE already accepted), **1.52** (LilyPond, ≈ what we draw today).
⚠️ And we are **LOOSE**, ⛔ not tight — the opposite sign to the clef→key row.

⇒ ⭐ it becomes a **row table with a console knob**, the shape `__header.rule(…)`, `__beams.rule(…)`
and `__spacing.law(…)` already established, and **HIS EYE picks the armed row**
(`project_engraving_defaults_are_a_house_style`). ⚠️ It MOVES INK ⇒ its own commit, ⛔ never folded
into a P5 migration step.

### 4.5 ⭐⭐ THE BOOKS, RE-CHECKED ON THE SCANS — 2026-09-12

> Sent with §4.4's question and one instruction: ⛔ **a number without its *measured between* is
> worse than no number.** Every quotation below is read off a RENDERED page, ⛔ never the OCR layer.

#### ⭐ Q1 — only ROSS gives this pair its own number, and it is not special to the meter

| source | printed page | what it says | pair-specific? |
|---|---|---|---|
| **Ross** | **145** | *"the space between the left side of the clef, and the left side of the time signature, is **three and a half spaces**"* — with a figure bracketed and labelled `3½ Spaces` | ⭐⭐ **YES — the only stated number for this pair in the library** |
| **Stone** | **44** | *"between the clef and any subsequent symbol (key signature **or time signature**): **one staff-space or a little less**"* | ⭐ names the pair, but gives it the SAME value as clef→key |
| **Gould** | **41** | *"Separate the clef, key signature, time signature by 1–1½ stave-spaces."* | ⛔ generic; her p. 152 is vertical only |
| **Gerou & Lusk** | 51, 149 | *"The time signature is indicated after the clef and key signature."* | ⛔ **no number for ANY header gap**, and they never draw a clef followed by a meter |

⭐ **Ross's 3½ is one compass setting used four times** — he gives the same to clef→first sharp and
clef→first flat (p. 144), and 5½ to clef→first note and clef→repeat bar (p. 147). ⇒ in the one system
that states a number, **the time signature is spaced exactly like the first accidental.**

#### ⭐⭐ Q2 — ink or origins: §0's headline CONFIRMED, with one correction that matters

| source | convention | the evidence |
|---|---|---|
| **Ross** | ⭐⭐ **left INK edge → left INK edge** | p. 143: *"Metal-plate engravers… **measure their spacing from the left side of the character**. A quarter note with a down stem is measured from **its stem side**. A sharp is measured from **the vertical line on its left side**."* ⇒ ⭐ his measuring points are **ink features**, so there is no side bearing in his system. ✅ And his own p. 145 plate proves it: the bracket's left tick sits on the clef's leftmost ink (771 vs 772) and its right tick on the meter's (851–853 vs 851) |
| **Gould** | **white gap, ink to ink** | re-confirmed on a p. 42 cell §3.1 never used: bracket **1185→1226**, meter ink ends **1185**, notehead ink starts **1226** — exact at both ends |
| **Stone** | **white gap** | p. 44: *"**The gaps between them** can best be measured by **cutting a short strip of staff**… using its **cutting edge** as a measuring device"*, and p. 45's figures literally draw staff strips stood on end **inside the white gaps**, cut ends butted against the ink |
| **Gerou & Lusk** | ⛔ **UNKNOWN** | they state no distance, so there is no convention to classify |

🚨 **THE CORRECTION: Ross's "origin" is the glyph's LEFTMOST INK — ⛔ not a box origin and ⛔ not an
advance width.** ⇒ converting Ross to a white gap means subtracting the **ink width** of the left
glyph, ⛔ never its advance. (§7.1 got this wrong — see below.)

⚠️ **And he names a THIRD convention nobody here had noticed** — p. 75: *"Machine engraving and most
other process engravings are measured **from the center of the music character**."* His own
left↔centre conversion for a notehead is **½ space**.

#### ⭐⭐ THE PLATES, MEASURED — three books, three conventions, ONE answer

| plate | clef ink → meter ink |
|---|---|
| **Ross p. 145** (400 dpi, 1 sp = 22.5 px) — his own `3½ Spaces` figure | **0.98** |
| **Gould p. 42** (450 dpi, 1 sp = 20.0 px) — the *"with time signature"* row, all three cells | **1.00 · 1.10 · 1.10** |
| **Stone p. 45** (400 dpi, 1 sp = 19.25 px) | **1.14** |

⭐⭐ **Median 1.10, mean 1.06 — they agree to within 0.16 sp while stating three different numbers in
three different conventions.** (Stone's is the loosest and his reproduction the blurriest, which
biases *toward* a smaller gap, so 1.14 is if anything a floor for him.)

Also measured, because they bear on the conversions: Ross's `5½` clef→first note = **2.82 sp** of
white; his `3½` meter→first note = **1.70**; his key→meter `2½` comes out **2.21** and **2.79** on his
two figures — ⚠️ **his engraving runs ±12% against his own labels.**

#### 🚨🚨 …and it found the §4.1-vs-§4.3 contradiction to be REAL — the old "✅ agrees" was NOT sound

§4.1 calls `BETWEEN_PARTS` *"box to box"*; §4.3's header claimed both its columns were ink to ink and
scored the row ✅. ⭐ The arithmetic settles it: the key path subtracts the air explicitly
(`keyToMeterGap() = KEY_TO_METER_INK − METER_PART_LEFT_AIR`) and **the no-key path does not**, so the
reserved ink-to-ink gap is `BETWEEN_PARTS + METER_PART_LEFT_AIR` ≈ **1.6 sp**.

⚠️ **That is the RESERVED number and it does not match the DRAWN one** — §4.4 measured **1.42** in a
browser. ⭐ Both are "nobody chose it", by two different routes, and the disagreement between them is
itself a third instance of *reserve ≠ draw*. ⛔ The agent's 1.6 is DERIVED from the constants and is
in its own UNKNOWN list as unmeasured; §4.4's 1.42 is measured ink to ink. **What both agree on is
the SIGN**: against the books' ~1.05 we are **loose**, ⚠️ the opposite of clef→key where we are tight.

⭐ Now that the meter's ink is ours (`engrave/header/meter`, P5b) this is settleable as a **scene
assertion in jsdom** rather than by argument — that is the check to run before acting on it.

#### 🚨 Two further corrections to THIS document

1. **§7.1 mis-assigns Ross after a time signature.** It says *"his time signature is about 2 sp of
   ink, so 3½ from its left side ≈ 1½ of white — which is Stone's number, not Gould's."* ⛔ Measured
   on his own plates his meter ink is **1.56** (`3/4`) and **1.83** (`C`), **never 2.0** ⇒ the
   conversion gives **1.94** (numerals) or **1.70** (measured directly on his `C`) — ⭐ **Gould's 2,
   not Stone's 1½.** The sentence should read *"Ross agrees with Gould after a meter (1.7–1.95) and
   after a clef (2.82 measured)"*. His clef→note conversion in the same paragraph (≈2.8 vs a measured
   2.82) is correct.
2. **§3.3 and the p. 74/75 citation** — both corrected in place above.

✅ **Confirmed unchanged**: §2.1–§2.4, §2.6, §2.7 verbatim against the scans; §3.1's ink-edge finding
on two further cells; §3.2's 1.06; §4.2's *"Ross p. 143's 3½ re-expressed as ink = 0.82"* (his plate
measures 0.84).

#### ⛔ Q3 — the meter's left side bearing has NO PRINTED BASIS

Every source measures **to the sign's ink**, and one of them says so glyph by glyph. ⛔ Nobody
reserves air in front of a sign, and nobody discusses a time signature's width at all. Searched:
Gould pp. 41–43, 92–93, 152–153; Ross pp. 143–147, 74–75; Stone pp. 44–47; Gerou & Lusk pp. 50–52,
148–150. ⇒ ⭐ `METER_PART_LEFT_AIR = 0.6` is exactly what its own comment says it is — and §5.6 found
that **no engine needs such a constant either**.

⚠️⚠️ **A measured fact that prices the same box, and is a finding of its own**: a stacked two-digit
meter's **ink** is **1.43–1.60 sp** on Gould's, Ross's and Stone's plates (Ross's `C` is 1.83).
`keySignatureLayout.ts` records ours at **1.88 sp of ink** inside a **2.40 sp** box. ⇒ 🚨 **our
numerals are ~20% wider than any plate in the library**, independently of the gap question.

#### ⛔ Q4 — a cramped minimum: only GOULD, and only as a general floor

> *"Where space is limited, **the distance between characters should not be less than ½ stave-space**
> and no characters should collide."* — p. 41

p. 43 adds *"reduce the space around clefs and accidentals to ½ space, to minimize distortion"*
(⚠️ about **mid-music** clef changes, ⛔ not the system head) and *"stems must never come closer to a
barline than one space"*. ⛔ **Ross: none** — he acknowledges only the variable (*"attributed to
crowded or uncrowded music"*, p. 143) and his numbers are compass settings. ⛔ **Stone: none.**
⛔ **Gerou & Lusk: none.** ⇒ with §5.6's engine finding, row **G** has no per-pair rule to adopt from
either side.

#### ⛔ UNKNOWN — looked for, not found

- A clef→meter number from **Gerou & Lusk** — pp. 50–52 and 148–150 read as scans, whole text
  grepped. ⛔ Not "silent on the pair": silent on the whole run.
- Any statement, in any of the four books, about **air built into a time signature before its
  digits**.
- A **second Gould plate** of the pair — p. 43's mid-system figure puts a barline between the bass
  clef and the `3/8` (so it measures barline→meter), and her p. 41 meters have no clef. **The p. 42
  table row is the only Gould evidence, and it is three cells of one engraving.**
- **Whether our drawn gap really is 1.6** — derived from the constants, ⛔ not measured in a browser
  (and §4.4's measurement says 1.42).
- **Gardner Read** and **Chlapik** — still not on disk. ⚠️ Read is LilyPond's own cited authority for
  a neighbouring rule and has **never** been consulted here.

#### ⭐ The rows it recommends — unit **INK TO INK**

⛔ **Do not express this one origin-to-origin**: Ross's 3½ minus *our* clef's ~2.9 sp of ink is
**0.6 sp** of white against **0.98** on his own narrower clef — a ~0.4 sp trap, and it bites because
the conversion is a function of **the clef's font**, ⛔ not of the rule.

| row | value | provenance |
|---|---|---|
| ⭐ **`books`** | **1.05** | the median of every plate in the library that draws the pair: Ross **0.98**, Gould **1.00 / 1.10 / 1.10**, Stone **1.14** |
| **`stone` / `musescore`** | **1.0** | Stone p. 44 stated — the only source naming this pair in gap units — **and** MuseScore's `clefTimesigDistance`, **and** Verovio. ⭐ The most defensible if a round number is wanted |
| **`rossCompass`** | **= `CLEF_TO_KEY_INK` (0.82)** | ⭐ Ross uses the **same compass setting** for clef→first accidental and clef→meter, so in the one system that states a number the meter is spaced *exactly like the first sharp*. Also LilyPond's `Clef.space-alist (key-signature . 0.82)` — ⭐ the number HIS EYE has already accepted. Tightest row |
| **`lilypond`** | **1.52** | `Clef.space-alist (time-signature . 1.52)`. ⚠️ Keep it because it is **within ~0.1 sp of what we draw today**, so it is the **"no visible change"** row — and the citation if his eye prefers the current picture |

⭐⭐ **Its one-line recommendation: if only one thing is acted on, fix the UNIT, not the value.**
Whatever row is armed, the no-key path has to subtract `METER_PART_LEFT_AIR` the way `keyToMeterGap()`
already does, or the constant keeps meaning something 0.6 sp different from the constant beside it.

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
| **CLEF → METER** (no key) | **1.52** `define-grobs.scm:921` | **1.00** `clefTimesigDistance` `styledef.cpp:222` | **1.00** = `rightMarginClef` **1.0** + `leftMarginMeterSig` **1.0**, ⚠️ **in MEI units = ½ sp each** — `options.cpp:1783`, `:1729` | 🚨 **1.5**, ⛔ not 1.0 — `TimeSignature`'s own `customPadding = 15` px overrides the base 10 (`timesignature.js:17`) | ⚠️ we RESERVE **1.0** and DRAW **1.42** — §4.4 |
| **header end → FIRST NOTE** | ⭐ **keyed on what precedes**: after a meter **`semi-shrink-space 2.0`** (⚠️ **CORRECTED 2026-09-12 — this doc used to say `fixed-space`; same number, ⛔ different mechanics: half the distance is fixed and half shrinkable-but-not-stretchable, `staff-spacing.cc:193–198`**); after a key signature `shrink-space 2.5`; after a clef `minimum-fixed-space 5.0` (⚠️ **from the clef's LEFT edge**) — `define-grobs.scm:3955`, `:1997`, `:924` | ⭐⭐ **keyed too**: **2.00** `systemHeaderTimeSigDistance` when the header ends in a meter, **2.50** `systemHeaderDistance` otherwise — `styledef.cpp:225–226`, `horizontalspacing.cpp:1360–1365`. Floor **1.5** (`:1357`) | **1.00 + 1.00** through the left barline `options.cpp:1799,1721,1791,1749` | **1.2** — `Stave.padding = 12` added to every note `note.js:343`, `metrics.js:132` | **2.0**, one number |
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

### 5.6 ⭐⭐ RE-CHECK, 2026-09-12 — **ALL THREE ENGINES SPACE THE CLEF→METER GAP FROM INK**

> Sent to answer HIS question of §4.4 (*"is it the bbox, not the ink?"*), with one instruction: ⛔ **a
> number without its *measured between* is worse than no number.** Clone commits verified —
> lilypond `beedbfa0752a`, MuseScore `929d1e99d729`, verovio `efff0bc99241`.

| engine | value | ⭐ measured between | the function that applies it |
|---|---|---|---|
| **LilyPond** | **1.52 sp** | ⭐ **INK to INK** | `extra-space` is edge-to-edge: `offsets[next] = extents[idx].RIGHT + distance − extents[next].LEFT` (`break-alignment-interface.cc:242–243`). The extents are the grobs' own, and `Clef` sets no `X-extent`, so it falls back to the **stencil** — `Clef::print` → `find_by_name` → `get_indexed_char_dimensions` → `freetype.cc:57–64`, `horiBearingX … + width`, ⛔ **never `horiAdvance`** |
| **MuseScore** | **1.0 sp** | ⭐ **INK to INK** | `dist = max(dist, r1.right() − r2.left() + padding)` over `Shape` rects (`horizontalspacing.cpp:1261`, table at `paddingtable.cpp:125`). The clef's rect is `symBbox` → `engravingfont.cpp:919 sym(id).bbox`, and `:853–854` fills **`bbox` from `boundingRect` and `advance` from `horizontalAdvance` as two separate fields** — the spacing reads the former |
| **Verovio** | **1.0 sp** ⚠️ = 1.0 + 1.0 **MEI units**, and a unit is ½ sp | ⭐ **INK to INK** | `selfRight + rightMargin ≤ selfLeft − leftMargin` (`adjustxposfunctor.cpp:157`, `:342–343`), `m_selfBB` filled from `glyph->GetBoundingBox`, while `horizAdvX` only moves the pen (`bboxdevicecontext.cpp:371–384`) |
| *(VexFlow 5)* | *1.5 sp* | ⛔ **ADVANCE edge → next ORIGIN** | `Element.getWidth()` is a `measureText` (`element.js:347–350`) |

🚨🚨 **THE HEADLINE: the ONLY engine in the comparison that spaces this gap from an ADVANCE is
VexFlow — the dependency we are removing.** ⇒ ⭐ HIS instinct in §4.4 was right about the *design*
even though the *mechanism* here is a padding rather than a side bearing: an ink-based rule is what
every real engraver uses, and `BETWEEN_PARTS` is the wrong KIND of number regardless of its value.

#### ⭐⭐ …and the one engine that touches side bearings CANCELS them rather than budgeting for them

```cpp
// MuseScore, src/engraving/rendering/score/tlayout.cpp:6392
ldata->setPosX(-shape.bbox().left());
```

It normalises the **time signature's origin onto its own ink-left edge**, so `pos().x` and *"where
the ink starts"* become the same number and ⛔ no downstream consumer can price the bearing by
accident. ⭐ And it gives the **clef the opposite treatment** (`x = 0`, `tlayout.cpp:1851–1852`) —
i.e. the normalisation is applied exactly where it matters.

⇒ 🚨 **`METER_PART_LEFT_AIR = 0.6` is confirmed as an artefact of pricing a BOX, exactly as its own
comment suspected.** ⛔ **No engine needs such a constant, because no engine prices a box.** An
ink-based placement does not reproduce it — it deletes it.

#### ⭐ *Measured between* is SETTLED; *how much* is NOT

**MuseScore 1.0 · Verovio 1.0 · LilyPond 1.52** — a **50% spread on a number all three measure the
same way**. ⇒ ⭐ that is precisely the shape a house-style table with a preset exists for: the
majority preset is **1.0 sp of clear ink**, with LilyPond's **1.52** as a named alternative row.

#### ⛔ There is NO precedent for a "cramped clef→meter" second number

| engine | compressible? |
|---|---|
| **LilyPond** | ⛔ **No** — break-alignment offsets are computed once and applied by `translate_axis` (`break-alignment-interface.cc:279–282`); no spring, no floor for this pair. `minimum-space` exists as a floor-flavoured type and is ⛔ **not used on this row** |
| **MuseScore** | ⚠️ **Only globally** — `squeezeSystemToFit` walks a `squeezeFactor` 0.8 → 0.0 (`horizontalspacing.cpp:146–156`) and `:1248 padding *= squeezeFactor` scales **every** padding, the nominal floor included. ⛔ Not a per-pair constant |
| **Verovio** | ⛔ **No** — nothing before the left barline is justified (`justifyfunctor.cpp:40–42`), and `AdjustXPos` only ever pushes apart. 1.0 is simultaneously the value and the floor |

⇒ ⭐ if a cramped mode is ever wanted, the engines' precedent is **a factor over the whole padding
table**, ⛔ never a second row for this pair. (Relevant to row **G**, which is still open.)

#### 🚨 Three corrections this re-check made to THIS DOCUMENT

1. **Verovio's "1.00" was right only after a unit conversion the doc never stated.** The source says
   `1.0` **twice**, in **MEI units = ½ staff space**, and the gap is their SUM. ⚠️ A reader checking
   `options.cpp` would find `1.0`, believe the doc confirmed, and be **off by 2×**. Fixed in §5.2.
2. **The doc contradicted itself on VexFlow**: §5.2 said 1.0 for CLEF→METER while §4.4 derives **1.5**
   (`customPadding = 15` overrides `StaveModifier`'s base 10). Fixed in §5.2.
3. **LilyPond's `first-note` after a meter is `semi-shrink-space`, ⛔ not `fixed-space`** — same 2.0,
   different mechanics. Row **D**'s number survives; the claim that LilyPond makes it *rigid* does
   not. Fixed in §5.2.

⚠️ **Two stale-citation traps recorded for the next reader of Verovio**: `adjustxposfunctor.cpp:99`
excludes only literal `<scoreDef>` descendants, ⛔ not the header copies; and `:132` skips
`ALIGNMENT_CLEF`, which is the **mid-measure** clef, ⛔ not `ALIGNMENT_SCOREDEF_CLEF`. Both look like
they exclude the header and do not.

⛔ **UNKNOWN, and it does not change the answer**: MuseScore's concrete `IFontProvider::boundingRect`
lives in the `muse_framework` submodule, which is **not checked out in this clone** (only stubs), so
whether it is FreeType's outline bbox or Qt's tight rect is unknown from this tree. ⭐ The interface
separates it from `horizontalAdvance`, which is what the ink-vs-advance question needed.

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

### ✅ A — DECIDED AND BUILT, 2026-09-01

> **"i"** ⇒ **the clef's ink begins 0.7 staff spaces inside the staff's left edge.** Gould p. 6
> (*"one stave-space or a little less"*, drawn 0.67–0.74), Ross p. 144 (*"½ to 1 space"*), Gerou &
> Lusk (0.62–0.70); LilyPond 0.80 and MuseScore 0.75 just above.

⭐ **This was the one gap in the run nobody had ever chosen** — 0.50 was VexFlow's opening barline
width leaking through an unpadded first modifier slot. It is now `CLEF_INDENT` in `layout/headerInk`
and `rendering/clefIndentPass`.

🚨🚨 **THE BROWSER SUITE CAUGHT THREE WAYS OF GETTING IT WRONG, and every one of them was invisible in
jsdom and in the unit suite (6200 tests, all green through all three).** Recorded because each is a
trap of its own:

| what was wrong | how it showed | the lesson |
|---|---|---|
| shifted the clef in TIER 2, after layout | the clef moved INTO the key signature: the 0.82 sp gap the engines' number bought became 0.62 | the header is assembled in tier 1; anything positioned *from* the clef must see the final clef |
| used **`setXShift`** rather than `setX` | ⭐ two staves' clefs stopped lining up by `0.2 × (1 − k)` on a **small staff** — `spreadHeaderToSystem` converts `setX` and never looks at the shift | ⛔ a shift is not a placement |
| moved the **clef only** | the clef→meter gap grew by 0.2 **only when a key signature was present**, because `placeMeterAfterKeySignature` re-places the meter from the signature and a bare meter kept VexFlow's x | the indent moves the whole header run — ⛔ except the barline, which it is measured FROM |

⭐⭐ **And it exposed a latent bug that had nothing to do with A**: `firstSignX` measured the clef with
`clefModifier.getX()`, the **unshifted** origin. So a user's hand nudge on a beat-0 clef
(`clefOffsetPass`) moved the glyph and left the key signature behind — nobody had put a signature on
such a bar and looked. Fixed in the same commit; it is the
`reference_vexflow_clefnote_xshift_is_inert` family — ⛔ **never measure from `getX()` alone.**

### ✅ E — DECIDED AND BUILT, 2026-09-02, and it took THREE of his messages

> **"lets do what gould say"** ⇒ the gap closes up when the first note carries an accidental.
> Then, minutes later, on the running app: **"i have the feeling that with the accidental is a little
> too close"** … **"i the case of the clef is not problem but when there is a time signature, is a
> little too close to the time signature"**. Then, after comparing the rows:
> **"lets make musescore default"**.

⭐⭐ **That sequence is the whole argument for building this as a TABLE rather than a constant.** Her
printed ladder was right about the *shape* and, to his eye, wrong about one *cell* — and the books do
not settle that cell: Gould's label is **1**, her own drawing of it is **1.15**, MuseScore refuses to
go below **1.5**, LilyPond goes as low as **0.30**. ⇒ five sourced rows in
`engine/layout/headerAccidentalLadder`, armed by `__header.rule(…)` (`dev/headerGapConsole`), and his
eye picked one the same day.

**Armed: `musescore`** — 2½ / 2 plain (decision D, untouched), and **1.5 of clear white** before the
first ink whenever an accidental is there. ⭐ Also the most defensible row on the page: 1.5 is
`absoluteMinHeaderDist`, not a number anyone here chose.

| row | after a clef or key | after a meter | source |
|---|---|---|---|
| ✅ **`musescore`** | 2.5 · **1.5** · **1.5** | 2.0 · **1.5** · **1.5** | `horizontalspacing.cpp:1358` — its rule at our accidental widths |
| `gouldDrawn` | 2.5 · 1.65 · 1.15 | 2.0 · 1.15 · 1.10 | her own plate, §3.7 |
| `gould` | 2.5 · 1.5 · 1.0 | 2.0 · 1.0 · 1.0 | her printed table, p. 42 |
| `lilypond` | 2.5 · 1.10 · 0.30 | 2.0 · 0.60 · 0.30 | `staff-spacing.cc:211` — ⚠️ **below her floor**, deliberately |
| `none` | 2.5 · 2.5 · 2.5 | 2.0 · 2.0 · 2.0 | Verovio / VexFlow — what we drew until today |

⚠️ **Keyed on a COUNT, ⛔ not on the ink's width**, because that is what she wrote — `LeadIn.accidentals`
(`layout/measureColumns`), which asks `displayedSigns` and so ⛔ never counts a sign the running-accidental
rule suppresses. It is summed across every slot at the bar's first beat, so it stays ONE answer for the
system exactly as the header extent does.

🚨 **Wired through both paths, and into both render keys.** The width path (`MeasureLayout`'s
`sharedOverhead`) and the drawing path (`VexFlowRenderer`'s `system.headerToNote`) read the same pair
of arguments — D's lesson, applied. And because closing this gap makes a bar NARROWER,
`headerGapGeneration()` is in `laneFingerprint` **and** `layoutStateKey`, like `spacingGeneration`:
leave it out of either and arming a row hands back memoised widths while the console reports success.

⭐ **One test failed when the rule changed, and it was the right one.**
`MeasureLayout.clefWidthIndependence` asserted that an accidental on the first note widens a bar by
**11 px**. It now grows by 2.5: +11 px of accidental ink, −8.5 px of gap. That test now reads the
armed rule rather than a literal, so it survives him arming another row.

### The table

⛔ **Nothing below is a defect list.** Every gap in the run, with the options and their provenance,
and the one we draw today named honestly.

| # | gap | the options, with provenance | what we do now |
|---|---|---|---|
| **A** | **left edge → CLEF** (the indent) | (i) **0.6–0.8 sp** — Gould p. 6 drawn 0.67–0.74, G&L p. 51 drawn 0.62–0.70, Ross p. 144 *"½ to 1 space"*; **LilyPond 0.80 and MuseScore 0.75 land inside it** · (ii) **0.50** — Verovio, and VexFlow's 0.5 by accident (its opening barline's own width) | ⛔ **we have never chosen it.** It is whatever VexFlow's `Stave` does, absorbed inside `CLEF_FULL` |
| **B** | **CLEF → KEY SIGNATURE** | (i) **0.82** — LilyPond `Clef.space-alist`, Ross converted, MuseScore 0.75 · (ii) **1.0–1.3** — Gould stated *"1–1½"*, drawn 1.02–1.31 · (iii) **~1.0** — Stone *"one staff-space or a little less"* | ⛔⛔ **NOT OPEN — ALREADY DECIDED, and (i) is the ANSWER, not the default.** It was **1.5 for one commit and HIS EYE rejected it** (*"isn't the first accidental too far from the clef?"*). ⛔ Do not re-open it by re-quoting Gould's drawing: that is the source that LOST. `keySignatureLayout.CLEF_TO_KEY_INK` carries the ruling |
| **C** | **KEY SIGNATURE → TIME SIGNATURE** | (i) **1.15** — LilyPond · (ii) **1.0** — Stone, MuseScore · (iii) **~1.5** — Ross converted, and Gould's own drawing at 1.57 | ⛔ **NOT OPEN — ALREADY DECIDED**, and decided in answer to HIS OWN REPORT (*"isn't the last accidental too far from the time signature?"* — it was, by half a space, and nobody had chosen the number). `keySignatureLayout.KEY_TO_METER_INK` carries the ruling |
| **D** | **HEADER → FIRST NOTE** ⭐⭐ the big one | (i) **one number for all three cases** — ours, and LilyPond's `TimeSignature` row read alone · (ii) ⭐⭐ **keyed on what precedes**: **2½** after a clef or key signature, **2** after a time signature — **Gould p. 42 (drawn 2.60/2.59/2.11) AND MuseScore's `systemHeaderDistance 2.5` / `systemHeaderTimeSigDistance 2.0`, the same pair**, and LilyPond's three different `space-alist` tags (§5.3) · (iii) **1½ flat** — Stone p. 44, Ross converted after a meter, and MuseScore's own `absoluteMinHeaderDist` floor | **2.0 for all three.** ✅ right after a meter, 🚨 ~0.5 sp tight after a clef or key signature |
| **E** | **does an ACCIDENTAL on the first note close the gap?** | (i) yes, by a stated ladder — Gould 2½ → **1½** → **1**, floor *"never closer to a preceding symbol than one stave-space"* · (ii) Ross: the NOTE moves right half a space and the accidental takes the room (p. 146) · (iii) no rule — Verovio, VexFlow | ✅✅ **DECIDED AND BUILT 2026-09-02 — see §8 E.** Yes, and by a TABLE of five sourced rows; **`musescore` is armed** (his choice): 1.5 sp of clear white before the first ink. ⛔ The row is not frozen — `__header.rule(…)` |
| **F** | **BARLINE → first note, no header** | (i) **1.0** — Gould *"a stave-space on either side of a barline"* (drawn 1.05–1.08), Ross *"one space"*, Verovio · (ii) **0.9** mid-line / **1.3** at a line start — LilyPond's `BarLine.space-alist` · (iii) **1.25** — MuseScore `barNoteDistance`, with **0.65** when the note carries an accidental | ⛔⛔ **NOT A CHOICE — BLOCKED, and the number every source prefers is BELOW the floor.** 1.2 is `Stave.padding` (12 px), which VexFlow adds to every note in `getAbsoluteX` and does **not** expose a setter for (`Metrics` is not exported from the package root). ⇒ drawing Gould's 1.0 would mean pushing the note-start LEFT OF THE BARLINE, so a bar's clickable area would begin outside the bar. ⭐ 1.2 is also defensible on its own: it sits between our trailing 1.0 and MuseScore's `barline↔barline` 1.35, and a leading gap earns more air than a trailing one. ⏳ **Unblocks with P5b/P1e**, when the note-start is ours |
| **G** | **a CRAMPED minimum** | (i) Gould's **½ sp** floor between any two characters (p. 41), with *"reduce the space around clefs and accidentals to ½ space"* and *"stems must never come closer to a barline than one space"* (p. 43) · (ii) none | ⛔ **none** — the spacing solve has no header-specific floor |
| **H** | **inside a TIME SIGNATURE** | ⛔ **UNKNOWN in every book** (§2.8); the only rule is vertical — *"numerals should exactly fill the height of the stave"* (Gould p. 152). The engines split: **2.0 sp between the rows** (LilyPond `time-signature-settings.scm:902`, Verovio `view_element.cpp:2139`, VexFlow lines 1↔3) vs **a 0.0 clear gap, bboxes touching** (MuseScore `timeSigNormalNumDist`) | VexFlow's — 2.0 sp, or **3.0** when the measured glyph exceeds 30 px (`timesignature.js:82`) |
| **I** | **between a signature's ACCIDENTALS** | (i) **one gap + the glyph's advance** — ours · (ii) **0.0 added, side bearings only** — LilyPond · (iii) a **per-kind constant** — MuseScore, Verovio | ⛔⛔ **THE MODEL IS NOT OPEN — decided 2026-08-27**, `key-signature-plan.md` **§4.0b**: *"ONE constant, `KEY_ACCIDENTAL_GAP = 0.25`, **not a per-glyph table**"*. (ii) and (iii) were weighed and rejected there. ⏳ What is outstanding is **only his EYE on the value** (flats come out 1.15 against Gould's 1.12 / Ross's 1.00) — ⭐ **a LOOK, ⛔ not a decision between models** |

🚨🚨🚨 **READ THIS BEFORE PUTTING ANY ROW OF THIS TABLE TO HIM.**

⚠️ **This document is a fresh survey of the LITERATURE. It is ⛔ NOT an audit of what this repo has
already decided**, and on 2026-09-01 that difference cost two rounds: **B** and **I** were both put to
him as open choices when both were settled — B by his own rejection of 1.5, I by
`key-signature-plan.md` §4.0b eight days earlier, which had already weighed and rejected two of the
three options this table lists. He caught both (*"wasn't it already decided?"*, *"didnt we made the
keysignature plan already with research included?"*).

⇒ ⭐⭐ **A row here means "the literature has something to say", ⛔ never "we have not chosen".**
Before asking: read the *what we do now* column, the constant's own comment, **and any older plan
that owns the feature**. Where any of them names a decision, a rejection or one of his reports, the
row is CLOSED.

🚨🚨 **AUDIT, 2026-09-01 — TWO OF THESE ROWS WERE NEVER OPEN, and listing them as options nearly
re-opened a decision he had already made with his own eyes.**

⭐ **B and C are SETTLED**, and both were settled *by his report*: 1.5 was tried on B and rejected
(*"isn't the first accidental too far from the clef?"*), and C's 1.15 exists because he said the last
accidental sat too far from the meter. ⇒ ⛔ **a row in this table is not evidence that a question is
open** — the "what we do now" column has to be read, and where it names a rejection the row is closed.

⚠️ A research document lists the alternatives *for the house-style menu*
(`project_engraving_defaults_are_a_house_style`) — that is why the losing options stay. ⛔ It does not
follow that every row is still a question.

⭐ **Genuinely open after A, D and E: G alone.** ⛔ **F is BLOCKED by VexFlow** (see its row) — it is
not a question his eye can settle, and it becomes one only when the note-start is ours. ⏳ **I is a
LOOK, not a decision** — its model was settled on 2026-08-27. **H** is ⛔ **UNKNOWN in every book**, so
there is no rule to adopt: the engines split 2.0 against 0.0 and we already draw the majority answer.

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
