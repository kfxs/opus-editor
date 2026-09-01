# The BEAM'S SLOPE — what the books say, what the engines do, and what we draw

> 📄 Written for **P4b** of `docs/beam-engraving-plan.md`. ⛔ **This document builds nothing.** It is
> the research §6.1 of `docs/own-engraving-engine.md` requires *before* code — the same shape as
> `docs/stem-length-research.md`, and written after it deliberately, because that one taught the
> lesson this one is built on: **⭐ measure the running code before believing a claim about it, and
> ⭐ measure the PLATE before believing a book's own sentence.**
>
> **Status 2026-09-01: researched, measured, ⛔ nothing changed.** The decisions at the end are HIS.

---

## 0. The question

A beam group's notes have pitches; the beam is a straight line. **How steep is it?**

Three numbers hide in that: the **rise** (how far the beam climbs, end to end, in stave-spaces), the
**angle** (rise ÷ horizontal distance), and **where the two ends land** relative to the stave-lines.
⚠️ The sources do not all answer the same one of the three, and most of the apparent disagreement
between them dissolves once that is separated out — §6.

---

## 1. The sources, and how to reach each page again

⭐ All four treatises in `reference/README.md` answer this — the first question in this project where
that is true. Page offsets, calibrated:

| source | the beam-slope material | PDF page |
|---|---|---|
| **Gould**, *Behind Bars* | printed **pp. 19–22**, *Angled beams* | PDF = printed **+ 20** ⇒ 39–42 |
| **Ross**, *The Art of Music Engraving and Processing* | printed **pp. 97–103** (the rules), then the **charts from printed p. 104** | PDF = printed **+ 12** ⇒ 109–115, 116ff |
| **Stone**, *Music Notation in the Twentieth Century* | printed **pp. 10–12**, *Slanting beams* | ⚠️ the PDF is **2-UP** — printed 10–12 are PDF **8–9** |
| **Gerou & Lusk**, *Essential Dictionary* | printed **pp. 40–43**, *Beam slant & placement* | the `.txt` is clean; grep it first |

⭐ **Gould defers to Ross in as many words**, which is itself a finding: *"(For a detailed study of
beam angles, see Ted Ross, The Art of Music Engraving and Processing.)"* (p. 21). And **Stone defers
to the same book, with the same page number**: *"The engravers' rules for the proper slanting angles
of beams are too complex to permit inclusion in this list of general guidelines.† … †For detailed
information (including, for example, charts with close to 300 different two-note single beam slants
alone!) see The Art of Music Engraving and Processing by Ted Ross, pages 104 ff."* (p. 12).

⇒ **Ross pp. 104ff is the primary source, and both of the others say so.** It is on disk.

---

## 2. What each book says

### 2.1 Gould, pp. 19–21 — read from the SCAN, quoted verbatim

- *"Beam angles should not deviate far from the horizontal because the eye perceives duration on the
  horizontal plane. **Usually, they cross no more than one stave-line.** Thus the wider the interval,
  the more flattened the beam angle becomes in relation to the size of the interval"* (p. 19).
- *"Avoid steep angles through stave-lines, as these create an uncomfortable visual lattice effect"*
  and *"Slight angles through stave-spaces should be avoided"* (p. 20).
- *"A long group of notes may have a beam that crosses **one or possibly two** stave-spaces"* —
  the figure is labelled **2** and **1¼** (p. 20).
- *"To avoid creating a steep beam angle the beam of **shorter groups should not cross more than one
  stave-space**"* — labelled **1**, against a rejected **2** (p. 20).
- ⭐⭐ *"**Notes spaced very close together horizontally (closer than three spaces) take only a slight
  angle (¼ or ½ space) regardless of the interval**"* (p. 20).
- ⭐⭐ *"**Both ends of a slanted beam should be attached to a stave-line.** This is the engraving
  tradition: no beam starts or finishes in the middle of a stave-space, since the white space between
  stave-line and beam results a thin wedge that is likely to 'fill in' at a small stave size or with
  poor reproduction or print resolution"* (p. 20).
- *"With the addition of a **third beam, the beams must slant a whole stave-space** (a). Any other
  angle will result in one of the beams beginning or ending in the middle of a stave-space (b)…
  some editions have slightly **widened the distance between beams** to allow for an angle of less
  than a stave-space (c). This is a good compromise"* (p. 21).
- *"When all the notes of a beam fall **outside the first ledger line**, the beam takes only a slight
  slope, regardless of the pitches. Intervals of a second take a slope of **¼** stave-space; all wider
  intervals take a slope of **½** stave-space"* (p. 21).
- *"Some editions have steeper angles **outside the staves** since there is no need to take account of
  crossing stave-lines. However, **matching angles look better**"* (p. 21).

### 2.2 ⭐⭐ …and her PLATE, MEASURED — because her prose gives no table

The p. 19 figure is captioned *beam angle (measured in stave-spaces)* and carries exactly two
examples. Rendered at 1200 dpi and measured:

| her example | pitches | horizontal distance | labelled | measured rise |
|---|---|---|---|---|
| left | **B3 → D4**, a **3rd** | ≈ 4.4 spaces | **½** | 0.46 sp ✅ |
| right | **G3 → F4**, a **7th** | ≈ 4.8 spaces | **1** | 1.02 sp ✅ |

⭐ **Two data points, and they are the only interval→rise numbers Gould gives for notes inside the
stave.** ⚠️ Both are drawn at ~4½ spaces, i.e. *normal* spacing by Ross's criterion (§2.2 below), so
they are not the compressed case.

### 2.3 Ross — the rules (printed pp. 97–103) and the 300-case chart (104ff)

**The compromise rule, for the apprentice:** *"If the apprentice is ever in doubt as to the amount of
slant necessary, he would do well to use the compromise rule of **never exceeding a slant of one
space up or down**."*

**The three factors, named:** *"The slanting and positioning of the beam is controlled and influenced
by three factors: **its position within the staff**, the **horizontal spacing of notes** and the
**interval** between the first and last beamed notes."*

1. **Position within the staff** — the wedge argument, and the fix: *"plate engravers solved the
   problem by doing one of three things: they placed a beam either on the top or the bottom of a
   staff line; or, they made the beam **straddle** a staff line."* ⭐ A straddle costs an extra **¼
   space** of stem — *"Any beam that straddles a staff line requires an extra ¼ of a space (this
   appears in the charts in parentheses…)"*, which is what the `(¼)` under every chart entry means.
2. **Horizontal spacing** — ⭐⭐ *"the more closely beamed notes are spaced, the less their beam
   slants; the further apart beamed notes are spaced, the more their beam slants"*, and the
   threshold: *"**beamed notes should be between three or four spaces apart to use normal beam
   slanting**"*. ⚠️ Read with his own worked examples, this is a statement about the **rise**: his
   series holds the rise at 1¼ spaces and notes that *"as the notes grow further apart, the degree of
   beam slant lessens, although the beam in each case spans a distance of 1¼ spaces"* — i.e. the rise
   is what the interval buys, and the **angle falls out of the spacing**.
3. **The interval** — ⭐⭐ **his table**:

   | interval | slant |
   |---|---|
   | a **2nd** | **¼ space** |
   | a **3rd** | **½ – 1 space** |
   | a **4th** | **½ – 1¼ spaces** |
   | an **octave** | **up to 2 spaces** |
   | anything below the first ledger line **below** the stave, or above the first ledger line **above** | ⭐ **never more than ½ space** |

**The chart itself** (printed 104ff) is not a formula: it is an exhaustive lookup of two-note cases,
each entry giving both stems' lengths and which of **S**(it) / **H**(ang) / **St**(raddle) each end
takes, with `(¼)` for the straddle supplement. ⭐ **That is the same shape as LilyPond's quanting**
(§4.1) — an enumeration of legal attachments, not an angle.

### 2.4 Stone, pp. 10–12

- The wedge rule again, and a stronger form of it: *"Beams should never be centered between two
  staff-lines"*, and beams should not run *"from one line to another"*.
- ⭐ He distinguishes **"manuscript slants"** from **"engravers' slants"** in a figure whose labels
  are `¼-space slant · no slant · ½-space slant · whole-space slant`.
- *"When the notes move along an irregular path, the beam should slant according to the general trend
  of the notes (**but at a shallower angle**) or not slant at all."*
- ⭐⭐ The compromise: *"**use horizontal beams most of the time**, and to slant the beams only for
  wide skips, broken chords, and similar extreme cases. Even in these latter situations, however, the
  beams should slant as little as possible — **not more than one staff-space** — and they should
  **slant around a staff-line**."*
- 🚨 **A rule about the beam GAP, which P4a did not know:** *"Unlike the situation for horizontal
  beams, the spaces between **three or more slanting beams** are generally **widened to half a
  staff-space** to avoid wedges"*, and *"If such slanting beams occur outside the staff, normal
  spacing (i.e., one quarter of a staff-space between beams) is used."* ⭐ This is Gould's option (c)
  on p. 21, stated as the norm rather than as a compromise. See §7, decision 5.

### 2.5 Gerou & Lusk, pp. 40–43 — ⚠️ deliberately MODIFIED, and they say so

⛔ **Do not read them as a fifth witness to tradition.** Their own preamble: *"The following are
approximate guidelines, **modified from the strict traditional rules** for beaming of intervals.
There are two main reasons for this modification: 1. The consistency of the computer and the quality
of modern printing make it **no longer necessary to avoid the small 'wedges'** of white space that in
the past often filled in with ink. 2. Adjusting many beams individually on the computer is very
time-consuming."*

⭐ That is the whole reason their numbers are the largest in this document: **they dropped the
constraint the other three are shaped by.**

| interval | their slant |
|---|---|
| 2nd | ½ space |
| 3rd | 1 space |
| 4th | 1 – 1½ |
| 5th, 6th, 7th | ≈ 1 – 1½ |
| octave and greater | 1½ – 2 |
| notes with ledger lines | ½ |
| overall | *"If a beam slants, it is usually from ½ to 2 staff spaces — very seldom more."* |

Their horizontal cases are worth keeping regardless of the numbers: **flat** when the first and last
note are at the same pitch, **flat** for repeated intervals, and **flat is available** when the inner
notes do not follow the outer direction.

---

## 3. ⭐⭐ WHAT OUR CODE DRAWS TODAY — measured, ⛔ not read

Measured through the SCENE (`recordScene`, jsdom), one bar, two beamed quavers, first note E4,
second note the interval above, at this editor's own spacing — **2.5 stave-spaces apart**:

| interval | drawn rise | drawn slope |
|---|---|---|
| unison | 0 | 0 |
| 2nd | **0.24 sp** | 0.096 |
| 3rd | **0.48 sp** | 0.192 |
| 4th | **0.60 sp** | 0.240 |
| 5th | 0.60 sp | 0.240 |
| 6th | 0.60 sp | 0.240 |
| 7th | 0.60 sp | 0.240 |
| octave | 0.60 sp | 0.240 |

⭐ **P4a paid for this measurement**: beam quads are in the scene since 2026-09-01, so the whole table
is a jsdom probe. It needed a browser the day before.

**VexFlow's rule, read from `beam.js` and confirmed by the table above:**

1. `initialSlope` = the slope of the line joining the two outer stem TIPS; **the ideal is half of it**
   (`idealSlope = initialSlope / 2`). ⭐ A damping rule, and the same idea as LilyPond's.
2. It then **searches 21 candidate slopes** from `minSlope −0.25` to `maxSlope +0.25` and scores
   `cost = 100 × |ideal − slope| + |total stem extension|`, keeping the cheapest.
3. `getBeamYToDraw` puts the beam at the first stem's tip, shifted by whatever the search decided.

🚨🚨 **TWO STRUCTURAL FACTS, and they are the finding of this section:**

- ⛔ **`Beam` never consults the stave.** The only two mentions of `Stave` in the whole file are a
  typeguard import and an auto-stem check. ⇒ **sit / hang / straddle — the one rule all four books
  state, and the only one they all agree on — is not implemented at all**, and cannot be without
  reaching through the notes to their stave. The measured ends land wherever the arithmetic puts
  them, mid-space included.
- ⛔ **The cap is on the ANGLE, not the RISE.** `maxSlope 0.25` is 2.5 spaces of rise per 10 spaces of
  width. Every book caps the **rise** (in stave-spaces) and lets the angle fall as the notes spread.
  ⇒ our beams get *steeper in rise* the wider the bar, where the tradition gets *flatter in angle*.
- ⚠️ And there is **no horizontal-distance rule**: at 2.5 spaces apart — inside every source's
  "compressed" threshold of three — we draw a 4th at 0.6 spaces where Gould says *"¼ or ½ … regardless
  of the interval"*.

⭐ **What VexFlow gets RIGHT, and it is not nothing:** a 2nd at **0.24 sp** is Ross's ¼ to within a
pixel, and a 3rd at **0.48 sp** is both Ross's low end and Gould's own drawn ½. The small intervals —
which is most music — already agree with the books.

### 3.1 ⭐⭐ THE AUDIT — how far from the books are we, actually? (2026-09-01, his ask)

⛔ *"We do not implement six rules"* is not a measurement. This is: **240 two-note beams** — every
start pitch on a G3…A5 diatonic ladder × every interval — rendered and read out of the scene.

**(a) The line-attachment rule bites far less often than it sounds.**

| | count | share |
|---|---|---|
| beam ends lying **inside the staff** at all | 126 of 480 | **26%** |
| …of those, already **attached** (an edge on a line, or straddling) | 79 | **63%** |
| …leaving a **thin wedge** (an edge < 0.2 sp from a line) | 39 | **31%** |
| …**floating** clear of every line | 8 | **6%** |

⭐ Three quarters of all beam ends are **above or below the staff**, where Gould says the rule does
not apply — *"Some editions have steeper angles outside the staves since there is no need to take
account of crossing stave-lines"* (p. 21). ⇒ **rule 1 would change ~37% of 26% ≈ one beam end in
ten**, ⛔ not "every beam".

**(b) And the wedges have a mechanism — the rise, not the attachment.**

| | attached | wedge | floating |
|---|---|---|---|
| beams whose **rise is a half-space multiple** | 29 | 8 | **0** |
| beams whose rise is **not** | 50 | 31 | 8 |

⭐⭐ **The stem-length convention already delivers most of the attachment for free**: a 3½-space stem
from a notehead on the half-space grid lands the beam's edges on lines, and it is the *odd rises*
(0.24, 0.48 sp) that break it. ⇒ **quantising the RISE buys most of rule 1 without implementing rule
1.** ⚠️ Not all of it — 8 of 37 half-space cases still wedge — and Ross's system is coherent the
other way round: quarter-space rises are legal *because* straddling is, and straddling is what the
`(¼)` stem supplement pays for.

**(c) The rise is over the books' cap almost always.**

**204 of 240 beams (85%)** are steeper than `min(byWidth, byInterval)`, by a mean of **0.276 spaces**
— more than a quarter of a stave-space. The worst case measured, `G3→E4` (a 6th): we draw **0.60**
where the tables give **0.25**.

| interval | our mean rise | the books' cap here |
|---|---|---|
| 2nd | 0.208 | 0.25 |
| 3rd | 0.429 | 0.25 |
| 4th | 0.563 | 0.25 |
| 5th | 0.590 | 0.25 |
| 6th | 0.600 | 0.25 |
| 7th | 0.600 | 0.25 |
| octave+ | 0.600 | 0.25 |

**(d) 🚨🚨 …and the reason the cap is ¼ for every row is the finding that settles the argument.**

Measured widths: two beamed **quavers stand 2.50 stave-spaces apart**; a four-note **semiquaver group
spans 5.50** (≈1.83 between neighbours). Every two-note beam in this editor is therefore inside the
*"closer than three spaces"* bucket — so **the width rule, not the interval rule, decides almost
everything**.

⭐⭐ **That is not an accident of our spacing: it IS Gould's spacing.** `engine/layout/spacing.ts`
implements her law — `GOULD_SPACING = { quarterSpace: 3.5, ratio: √2 }` — and its own table gives a
quaver **2.47 spaces**, which is the 2.50 measured above. So:

> **Gould's spacing rule puts adjacent quavers at 2.47 spaces, and Gould's beam rule says that below
> three spaces a beam takes only ¼ or ½ regardless of the interval.**

⇒ ⭐ The two rules are from the same book and they **compose**: tight spacing ⇒ flat beams. Adopting
the width rule is not importing a foreign opinion — it is finishing the one we already took.
⚠️ And it explains her p. 19 plate, where the examples are drawn at ~4½ spaces: those are isolated
figures with room, not a bar of quavers.

> 🚨🚨 **CORRECTED 2026-09-01, by HIM: *"if i dont remember bad spacing we are using lilypond
> algorithm"*. He is right and the paragraph above is WRONG.** The active rule is
> **`LILYPOND_SPACING`** — a LOG law, `(2 + log₂(t/♪)) × 1.2`, giving a quaver **2.40** spaces — his
> own call (*"in general we should approximate to LilyPond as much as possible"*). `GOULD_SPACING`
> exists in the same file and is **not** the default; `docs/ARCHITECTURE.md` §"Which house?" already
> said so and I misread the module.
>
> ⭐ **What survives:** the NUMBER (2.4–2.5 spaces between beamed quavers, still well under Gould's
> three) and therefore the whole audit. ⛔ **What dies is the pretty argument** — *"two rules from one
> book compose"*. They are two rules from two houses, and that is a weaker claim, not a stronger one.
>
> ⭐⭐ **And the correction is more interesting than the mistake.** We are in **LilyPond's spacing
> house**, so the beam rule from the same house is the `lilypond` row — ⛔ not Ross's tables, whose
> width thresholds were written for pages spaced by somebody else entirely. ⇒ **the coherent pairing
> to test is lilypond spacing + lilypond beam slope**, and nobody has looked at it.


---

## 4. What the three engines do

### 4.1 LilyPond — least squares, then TANH damping, then quanting with demerits
`lily/beam-quanting.cc`: `least_squares_positions()` fits the ideal stem tips, then

```c++
slope = 0.6 * tanh (slope) / (damping + concaveness);   // damping defaults to 1
```

⭐ Two rules in one line: **a flat damping to 60%** for small slopes (`tanh s ≈ s`), and a **saturation**
that flattens steep ones hard. Then the beam's two ends are quantised onto legal staff attachments and
scored with demerits — `score_slope_ideal` (`ideal-slope-factor 10`), `score_slope_musical`,
`score_slope_direction` (`damping-direction-penalty 800`, `round-to-zero-slope 0.02`). ⭐ **The quanting
IS Ross's chart**, generated rather than tabulated.

⭐⭐ **And the three attachments are written down as numbers, in `set_minimum_dy`** — a nonzero rise is
pushed up to the smallest legal quant:

```c++
Real sit  = (beam_thickness - slt) / 2;          // the beam SITS on the line
Real inter = 0.5;                                 // it STRADDLES  (half a space)
Real hang = 1.0 - (beam_thickness - slt) / 2;     // it HANGS from the line
*dy = sign (*dy) * std::max (fabs (*dy), std::min (std::min (sit, inter), hang));
```

⛔ Note what that implies: **LilyPond will not draw a rise smaller than one quant step.** A beam is
either flat or it moves by at least a legal attachment's worth.

### 4.2 MuseScore — ⭐⭐ the treatises, as two integer tables in QUARTER-SPACES
`rendering/score/beamtremololayout.cpp`:

```c++
constexpr std::array _maxSlopes = { 0, 1, 2, 3, 4, 5, 6, 7 };   // quarter-spaces
slant = min( maxSlopeByWidth, _maxSlopes[interval] ) * dir;
```

- **by interval** (index = diatonic steps, capped at 7): 2nd **¼**, 3rd **½**, 4th **¾**, 5th **1**,
  6th **1¼**, 7th **1½**, octave+ **1¾** spaces.
- **by horizontal width**, in stave-spaces: `< 3 →` **¼** · `< 5 →` **½** · `< 7.5 →` **¾** ·
  `< 10 →` **1** · `< 15 →` **1¼** · `< 20 →` **1½** · else **1¾**.
- plus `getSlopeConstraint` → `FLAT` / `SMALL_SLOPE` (a forced ±¼) for the horizontal cases, and
  `addMiddleLineSlant` / `add8thSpaceSlant` for the attachment.

⭐⭐ **`getSlopeConstraint` is the CONCAVE rule, spelled out as cases**, and it is the one place any
engine states G&L's *"horizontal beams may be used if inner notes do not follow the interval
direction of the outer notes"* as code: for an up-beam, **if any inner note sits higher in the staff
than the higher end, the beam is FLAT**. The single exception is written in its own comment —
*"there is a single note next to the highest one with equivalent height and they are neighbors. this
is our exception, so the slope may be a max of 0.25"* — i.e. `SMALL_SLOPE`, one quarter-space.
⚠️ It applies only to groups of **more than two** notes, and tremolos are exempt.

⭐⭐ **Every number in the first table is Ross's low end, and the second table's first breakpoint is
Gould's *"closer than three spaces"*.** This is the closest thing to a machine-readable version of
the tradition that exists in the three engines.

### 4.3 Verovio — a step table in half-spaces
`src/beam.cpp::CalcBeamSlopeStep` (its `unit` is **half** a stave-space):

- default maximum step **4 units = 2 spaces**;
- **2 notes** → 1 space, and if the two are **≤ 3 spaces apart** → **¼ space**;
- **3 notes** → 1 space when within 6 spaces, or when the interval is a 5th or less;
- **more** → **¼ space** for a 4th or smaller, 1 space for a 5th;
- ⭐ and a duration guard: a ¼-space step is forbidden when anything in the group is a **32nd or
  shorter** — which is Gould's *"with the addition of a third beam, the beams must slant a whole
  stave-space"*, arrived at from the other side.

⭐ **Verovio also nudges for the wedge, but only partially** — `CalcAdjustPosition` takes the beam's
start position **modulo one stave-space** (`(staffTop - start) % (unit * 2)`) and shifts the whole
beam by **½ unit = ¼ space** in two specific residues, and only while the start is inside the staff.
⚠️ So it is a correction, not a quant grid: nothing enumerates sit/straddle/hang the way LilyPond and
Ross do.

### 4.4 ⭐ The scoreboard on the ONE unanimous rule

| engine | does a beam end attach to a stave-line? |
|---|---|
| **LilyPond** | ✅ fully — quantised to `sit` / `inter` / `hang` and scored with demerits |
| **MuseScore** | ✅ snapped — `addMiddleLineSlant`, `add8thSpaceSlant`, quarter-space arithmetic throughout |
| **Verovio** | ⚠️ partially — a ¼-space nudge in two residues, inside the staff only |
| **VexFlow (us)** | ⛔ **not at all** — `Beam` never looks at the stave |

---

## 5. ⭐ WHERE THEY ALL AGREE — the part that is not a taste call

1. ⭐⭐ **A beam end attaches to a stave-line: sit, hang, or straddle. Never mid-space.**
   Gould, Ross and Stone all state it, and Ross's whole 300-case chart exists to enumerate it;
   LilyPond quantises to it and MuseScore snaps to it. ⛔ **We do none of it.**
2. **The beam is flatter than the notes.** Gould *"more flattened … in relation to the size of the
   interval"*; Stone *"but at a shallower angle"*; LilyPond damps to 60%; VexFlow halves. ✅ We do
   this already.
3. **The rise is bounded, in stave-spaces, and the bound is small.** Ross *"never exceeding one
   space"* as the apprentice's rule and 2 spaces at the octave; Gould one space for short groups, two
   for long ones; Stone *"not more than one staff-space"*; G&L *"seldom more than 2"*. ⛔ We bound an
   **angle** instead, so our bound is not comparable — §3.
4. **Close notes flatten.** Gould *"closer than three spaces … ¼ or ½ regardless of the interval"*;
   Ross *"three or four spaces apart to use normal beam slanting"*; MuseScore `< 3.0 → ¼`; Verovio
   `≤ 3 spaces → ¼`. ⛔ **We have no such rule.**
5. **Flat cases exist and are the norm, not an exception.** Same first and last pitch; repeated
   intervals; inner notes that contradict the outer direction; Stone's *"horizontal beams most of the
   time"*. ⚠️ Ours is flat only when the outer stem tips happen to be level.
6. **Notes on ledger lines take almost no slope** — Gould ¼ / ½, Ross *"never more than ½"*, G&L ½.
   ⛔ Not implemented.

---

## 6. ⚠️ WHERE THEY DIVERGE — and it is smaller than it looks

| interval | Ross | Gould (drawn) | MuseScore | G&L | us (at 2.5 sp) |
|---|---|---|---|---|---|
| 2nd | ¼ | — | ¼ | ½ | **0.24** ✅ |
| 3rd | ½ – 1 | **½** | ½ | 1 | **0.48** ✅ |
| 4th | ½ – 1¼ | — | ¾ | 1 – 1½ | 0.60 |
| 5th | — | — | 1 | 1 – 1½ | 0.60 |
| 7th | — | **1** | 1½ | 1 – 1½ | 0.60 |
| octave+ | up to 2 | — | 1¾ | 1½ – 2 | 0.60 |

⭐ **Ross, Gould and MuseScore form one family**; G&L are consistently one step steeper and have
explained why (§2.5). ⚠️ **Gould's own plate is the flattest reading of all at the wide end** — a 7th
at **1 space** where MuseScore gives 1½ — which is the *"her drawing disagrees with the formula"*
pattern this library has now produced for the sixth time, except that here her drawing disagrees with
nobody's prose but everyone's *numbers*.

---

## 7. ⏳ THE DECISIONS, AND THEY ARE HIS

### 7.0 ⏳⏳ …and the FIRST of them is already made: **the algorithm stays OPEN** (2026-09-01)

> *"lets not fix the rule, but leave it open, i would like to test the three engine solutions… but we
> dont have to do it now… in a way we dont close the door to change the algorithm so we can in the
> future test the posibilities and try an optimal solution"*

⛔ **This document therefore does NOT conclude that MuseScore's tables are the right answer.** They
are the row that got built first, because they are Ross's chart in code and because the audit (§3.1)
says they are the ones that bite here. ⭐ LilyPond's and Verovio's remain to be tried, and §4 has both
measured and ready to become rows in `engine/engrave/beams/beamSlope.ts`.
⚠️ The decisions below stand as written — but read every one of them as *"which rule do we try next"*,
⛔ never as *"what is the rule"*.

⛔ **None of these is a bug.** Nothing on his screen is wrong; the beams look right and always have.
Each is a place where the tradition says something we do not currently say.

1. ⭐ **Do beams attach to stave-lines (sit/hang/straddle)?** Unanimous in the books, implemented by
   all three other engines, absent here. ⚠️ **The audit demoted it**: three quarters of beam ends are
   outside the staff where the rule does not apply, 63% of the rest are already attached by accident,
   and the failures are *caused by the odd rises* — so it is ~one end in ten, and **half of that would
   fix itself if the rise were quantised** (§3.1b). ⛔ It also moves stem LENGTHS (Ross's `(¼)`
   straddle supplement), so it belongs with **P3e**, not before it.
2. ⭐ **Cap the RISE instead of the angle?** One table, seven rows (MuseScore's, which is Ross's).
   Changes wide intervals in wide bars; leaves 2nds and 3rds where they are.
3. ⭐⭐ **Add the horizontal-distance rule?** *"Closer than three spaces ⇒ ¼ or ½ regardless of
   interval."* ⭐ **The audit promoted this to first place**: our quavers stand **2.50 spaces** apart
   because our quavers stand that close (⚠️ under **LilyPond's** log law, ⛔ not Gould's — see §3.1d's
   correction), so **her beam rule applies to almost every beam we draw** — and 85% of them are currently steeper than it allows, by a mean of 0.276
   spaces. ⚠️ It is the highest-impact line in this document, and the change is *visible*.
4. **Add the flat cases** (same outer pitch, repeated intervals, contradicting inner notes)?
5. 🚨 **The BEAM GAP when slanted** — Stone: three or more slanting beams widen to **½ space**
   between beams (Gould's option (c)); we draw a constant **¼ space** of air (P4a's
   `BEAM_LEVEL_STRIDE`, which agrees with Bravura's `beamSpacing` for the *horizontal* case).
   ⚠️ This one was found *after* P4a shipped and is a genuine gap in it.
6. **Ledger-line groups take ¼ / ½ regardless of pitch?**

### ✅ WHAT ACTUALLY HAPPENED, 2026-09-01 — ⛔ read this before the recommendation below it

The recommendation was taken, built, and **put in front of his eye the same hour. He rejected it.**

> *"(to my eyes the angle looks too flat now)"* … *"i prefer vexflow angle for the moment… interval
> is really angled so is not nice"*

⇒ ⭐⭐ **The ACTIVE rule is `vexflow` and P4b moved no pixel.** What shipped instead of a new rule is
**five rules and an instrument** (`engine/engrave/beams/beamSlope.ts`, `__beams.rule(…)`), so the
comparison is his to run whenever he wants it.

⭐ **The evidence below is not wrong and is not withdrawn** — 85% of our beams *are* steeper than any
source allows, and that is still true. ⚠️ What his eye adds is the other half of the argument: **at
2.4-space quaver spacing the tradition's own numbers look wrong on this page**, which points at the
two UNKNOWNs in §7.0 rather than at his taste. ⛔ Do not re-propose the tables as a default without
settling those first.

---

⭐⭐ **THE RECOMMENDATION AS IT WAS WRITTEN (superseded above): take #3 + #2 together and nothing else yet.** They are
MuseScore's two integer tables (which are Ross's numbers), about twenty lines in a pure module, no
stem lengths touched, and the whole result assertable in the scene. They are also the only rows the
measurement says are *load-bearing* here: 85% of our beams are steeper than any source allows, and
the reason is a rule from the same book whose spacing law we already run.

⚠️ **And this is the first pixel-moving step of the whole migration.** P3a–P4a all landed under *"no
pixel moved"*; this one changes beams he has been looking at for months, by a quarter of a stave-space
on most of them. ⇒ one rule, one commit, his eye between.

⛔ #1 waits for P3e — it is where the ruler, the stem lengths and the ink all meet.
