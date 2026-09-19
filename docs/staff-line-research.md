# THE STAFF ITSELF — how THICK its lines are, and what else in this repo rides that number

> 📄 Research for **P5c** of `docs/own-engraving-engine.md` (*"the staff line's THICKNESS — ⛔ gated,
> and it is a taste call"*), and the sibling of `docs/header-spacing-research.md`, which takes the
> other half of P5. ⛔ **This document decides nothing and schedules nothing.** §8 is the decision
> list and it is HIS.
>
> **Done 2026-09-01.** Four treatises, three engines, VexFlow's source, Bravura's own metadata, and
> **eight measured plates**.
>
> 🚨 **Two headlines, and neither is what the code comments predict.**
>
> **(1) SMuFL PUBLISHES NO DEFAULT FOR `staffLineThickness`.** The specification says only *"expressed
> in staff spaces"*; **0.13 is Bravura's** own value (§5.1). So every comment in this repo reading
> *"SMuFL says 0.13 and we draw 1"* is naming a font as a standard.
>
> **(2) 0.13 IS THE TOP OF THE FIELD, NOT ITS CENTRE.** Measured on Gould's own engraving — including
> her Rastral-sizes table, printed at actual size across **eight staff sizes** — her staff lines run
> **0.110–0.127 sp**. The implementations run **0.072 → 0.13**. ⭐ Our 0.10 is **LilyPond's exact
> value**; Gould's measured 0.110 is **MuseScore's exact value**. Nobody but Bravura is at 0.13.
>
> 🚨🚨 **And the second finding is bigger than the first.** The repo has ALREADY adopted 0.13 for
> everything that is defined *by reference to* a staff line — the hairpin, the bracket serif, the
> ledger line's ratio — while the staff line itself still draws 0.10. **So the staff line is the one
> member of its own family that does not use the family's number.**

---

## 0. The question

Three questions, one object:

1. **How thick is a staff line**, as a fraction of a staff space?
2. **Does that fraction change with the staff's SIZE** — does a small/cue/ossia staff get a
   proportionally thinner line, or the same absolute one?
3. **What else moves if the number moves?** The staff line is not a leaf: this repo pins a hairpin,
   a bracket serif, a sub-bracket arm and a ledger line to it, and pins the ledger line by a *ratio*
   read from the font. So it is a shared rule, and the project's standing warning applies —
   *a shared rule changed is five families changed*.

⚠️ The term of art is **stave-line** (Gould), **staff line** (Ross, Stone, Gerou & Lusk),
`staffLineThickness` (SMuFL), `line-thickness` / `StaffSymbol.thickness` (LilyPond),
`Sid::staffLineWidth` (MuseScore), `staffLineWidth` (Verovio). Six names, one object.

## 1. The sources, and how to reach each page again

| source | where | the pages that answer |
|---|---|---|
| **Gould, *Behind Bars*** | `reference/…(Elaine Gould)….pdf`, PDF = printed **+20** | *The stave* **p. 5** (PDF 25) · *Clefs: Indentation* **p. 6** (PDF 26) · *Stems* **p. 13** (PDF 33) · *Beams: Design* **p. 17** (PDF 37) · *Ledger lines* **p. 26** (PDF 46) · *Barlines* **p. 38** (PDF 58) · *Hairpins* **p. 103** (PDF 123) · *Tenuto* **p. 116** (PDF 136) · *Extenders* **p. 447** (PDF 467) · ⭐ *Stave sizes* + **Table 2 Rastral sizes** **pp. 482–483** (PDF 502–503) |
| **Ross, *The Art of Music Engraving*** | `reference/…(ted ross)….pdf`, PDF = printed **+12** | ⭐ *staff-size chart* **p. 57** (PDF 69) · *Ruling lines* **pp. 70–72** (PDF 82–84) · ⭐ *quality of the lines* **p. 82** (PDF 94) · *beam thickness* **p. 88** (PDF 100) · *tenuto* **p. 128** (PDF 140) · *bracket* **p. 161** (PDF 173) · ⭐ *LEGER LINES* **p. 182** (PDF 194) |
| **Stone, *Notation in the 20th Century*** | `reference/…(Kurt Stone)….pdf` — ⚠️ **2-UP**, `PDF n = printed 2n−22 / 2n−21` | *Beam thickness* **p. 9** (PDF 15) · *Horizontal Lines ▸ Staff-lines* **p. 23** (PDF 22) · *leger lines* **p. 31** (PDF 26) · *extra lines* **p. 191** (PDF 106) |
| **Gerou & Lusk, *Essential Dictionary*** | `reference/gerou-lusk-….pdf` — ⚠️ **2-UP**, `PDF n = printed 2n−4 / 2n−3` | *Barlines* **p. 25** (PDF 14) · *grace leger* **p. 75** (PDF 39) · *Leger lines* **p. 83** (PDF 43) · *extenders* **p. 85** (PDF 44) · ⭐ ***Staff*** **p. 135** (PDF 69) |
| Bravura metadata | `scripts/vendor/Bravura.json` → `engravingDefaults`; our transcription `src/engine/fonts/bravuraMetrics.ts` | |
| LilyPond | `~/dev/engine-sources/lilypond` | `scm/define-grobs.scm` (`StaffSymbol`), `scm/paper.scm` (`calc-line-thickness`) |
| MuseScore | `~/dev/engine-sources/MuseScore` | `src/engraving/style/styledef.cpp` (`Sid::staffLineWidth`) |
| Verovio | `~/dev/engine-sources/verovio` | `src/options.cpp` (`staffLineWidth`) |
| VexFlow 5.0.0 | `node_modules/vexflow/build/esm/src/stave.js` (⚠️ 2026-09-19: the package is removed — the same build is kept at `~/dev/engine-sources/vexflow-5.0.0-npm/package/build/esm/src/stave.js`) | `Stave.draw()` |
| **ours** | `src/engine/engrave/staff/staffLines.ts` (⭐ **moved there by P5a, 2026-09-01**) | `STAVE_LINE_WIDTH_PX` |

## 2. What each book says — ⛔ and NOT ONE OF THEM GIVES A NUMBER

This is the first thing to record, because it is the shape of the whole topic:

> ⛔ **No treatise in this library states a staff-line thickness in stave-spaces, points,
> millimetres or anything else.** Every one of them defines the staff line as the *reference* against
> which other lines are described, and then never measures the reference. Checked page by page in all
> four; this is a searched negative, ⛔ not "the books are silent" by omission.

What they do say is **relational**, and on that they are unanimous:

### 2.1 Gould

> p. 5, *The five-line stave*: *"The size of every notational symbol is measured in proportion to the
> stave size. **A stave-space is the distance between two stave-lines** and is used as a measurement
> for notational symbols and spacing in this book."*

⭐ That first sentence is the answer to question 2 above, in her own words: **everything is a
proportion of the stave**, and a stave-line is a notational symbol like any other.

> p. 13, *Stems*: *"Stems should be **thinner than the stave-line**, but not so thin as to reproduce
> too faintly."*
>
> p. 26, *Ledger lines*: *"Ledger lines are an extension of the stave. They are spaced the same
> distance apart as stave-lines, but they are **about twice as thick**. It is important that ledger
> lines are **visibly thicker** than stave-lines so that a player reading a passage of ledger-line
> notes can take in the number of ledger lines at a glance."*
>
> p. 38, *Barlines*: *"The barline is **thicker than a stave-line**, and therefore conspicuously
> thicker than a stem."*
>
> p. 103, *Crescendo/diminuendo signs*: *"**Hairpins are the thickness of a stave-line.**"*
>
> p. 116: *"The tenuto line: this is **thicker than a stave-line** so as to be conspicuous."*
>
> p. 447, *Extenders*: *"An extender, **a line of stave-line thickness**, follows a final syllable…"*

⭐⭐ So Gould's staff line is the unit of a whole family, exactly as this repo's `thinLineWeight.ts`
already argues — and she puts the **hairpin equal to it** and the **ledger line at twice it**.

### 2.2 Ross

> p. 82, *General notation ▸ Stems*: *"One very important factor in correctly engraved music is the
> quality of the lines. **Each type of line has its own physique in relation to its staff.** Careful
> consideration must be paid to keeping a line uniformly thick or thin for its entire length. To the
> experienced eye, the narrow bar-line and the thick stem are glaring errors."* … *"The stem, which is
> **somewhat thinner than the staff line**, should never be flabby and distorted."*
>
> p. 182, *LEGER LINES*: *"Leger lines, whether above or below the staff, are vertically one space
> apart. **A leger line is somewhat thicker than the staff line**; it extends less than a half space
> to each side of the notehead."*
>
> p. 161: *"A bracket line is **as thick as a bar line** (somewhat thicker than a staff-line)."*
>
> p. 128, of the tenuto: *"It is **slightly thicker than the staff lines** and its length corresponds
> to the width of the note head."*
>
> p. 88: *"The thickness of the beam is determined by the size of the staff, and should be one-half
> the width of the staff."*\*

\* ⚠️ *"one-half the width of the staff"* reads as a slip for *one-half of a **space*** — every other
source, Ross's own beam charts and his p. 147 repeat-bar footnote (*"the heavy line in the repeat bar
is as thick as a beam (one-half space)"*) all say ½ **space**.

⭐ Note the **direction of Ross's ledger sentence**: *"somewhat"*, where Gould says *"about twice"*.

Ross also supplies the only account in the library of *how* the thickness was produced:

> p. 72, of the Staff-o-graph: *"**The thickness of the staff lines is controlled by the pressure
> exerted on the tilting arbor plate** — the more pressure, the thicker the line."*

⇒ 🚨 In hand engraving the staff-line weight was an **operator variable**, not a specification. That
is the most likely reason no treatise states a number.

### 2.3 Stone

> p. 9, *Beams ▸ Beam Thickness*: *"The thickness of a beam should be equal to **half a staff-space**.
> This is important because a musician's eye is so accustomed to this thickness (due to more than 100
> years of standardized engravers' tools) that the slightest variation can inhibit perception."*
>
> p. 23, *Horizontal Lines ▸ Staff-lines*: *"Staff-lines may take the form of either five-line staves
> or single staff-lines. For alternations of five-line staves and single lines, **the middle line of
> the staff should become the single line**."*
>
> p. 31: *"Leger lines must maintain the same vertical spacing as staff-lines, since they represent
> vertical extensions of the staff. If intervals of a second are on leger lines, the line(s) between
> the second(s) and the staff **must be twice as wide as ordinary leger lines**."* ⚠️ *wide*, i.e.
> long — a length rule, not a weight rule.
>
> p. 191: *"The extra lines should always be **farther apart** than the normal staff-lines."*

❌ **STONE GIVES NO THICKNESS FOR A STAFF LINE, AND NO LEDGER-LINE WEIGHT AT ALL.** The whole book
was searched for `thick`/`thickness`/`staff-line` on 2026-09-01; every hit is a beam, a bracket or a
spacing. ⛔ Do not check him again for this.

### 2.4 Gerou & Lusk — ⭐ the only book with a *Staff* entry

> p. 135, *Staff*: *"The staff commonly consists of five lines. **The staff line weight should be
> thick enough to be clearly legible but thin enough for the notes of the staff to be easily read.**"*
> … *"**A staff line will be thicker than stem lines and equal to (or thinner than) barlines.**"* …
> *"If a note is on the line, the line will always run through the center of the notehead, regardless
> of the note value."* … *"A notehead in a space is always clearly positioned between the two staff
> lines."* … *"A one-line staff is used for non-pitched percussion."*
>
> p. 25, *Barlines*: *"The thickness of a barline is equal to, or greater than, the staff line
> thickness (staff lines being thicker than stems)."*
>
> p. 83, *Leger lines*: *"Leger lines are **the same line weight as staff lines, or slightly
> heavier**. The vertical spacing of leger lines must be identical to the vertical spacing between the
> staff lines."*
>
> p. 75: *"The grace-note leger lines can be **the same thickness as staff lines**, but shorter."*
>
> p. 85: *"The thickness of extender lines should be **less than that of the staff lines**."*

🚨 Two disagreements are already visible: **G&L put the extender BELOW a staff line where Gould puts
it EQUAL** (p. 447), and **G&L put a ledger line at *"same … or slightly heavier"* where Gould says
*"about twice"***.

### 2.5 ⭐ The relational picture, assembled

| line | Gould | Ross | Stone | Gerou & Lusk |
|---|---|---|---|---|
| stem | thinner | *"somewhat thinner"* | — | thinner |
| **staff line** | **the unit** | **the unit** | — | **the unit** |
| hairpin | **= staff line** (p. 103) | *"no thicker than a staff line"* (p. 187) | — | — |
| extender | **= staff line** (p. 447) | — | — | **< staff line** (p. 85) |
| barline | thicker | thicker | — | *"equal to, or greater than"* |
| tenuto | thicker | *"slightly thicker"* | — | *"thicker than the staff lines"* (pp. 14–15) |
| ledger line | **≈ 2× staff line** | *"somewhat thicker"* | — | *"same … or slightly heavier"* |
| bracket | ½ space (= beam) | *"as thick as a bar line"* | — | — |
| beam | **½ space** | **½ space** | **½ space** | ½ space |

⭐ Only ONE absolute number appears anywhere in the family, and it is the beam's **½ stave-space**,
stated identically by all four. Everything else, the staff line included, is a comparison.

## 3. ⭐⭐ THE PLATES, MEASURED — ⛔ not read off the prose

**Method.** Page rendered with `pdftoppm -r 600`; at 600 dpi one stave-space is ≈26.5 px on Gould's
trim. Staff lines located by a row ink-profile over a wide x-window; then, for each line, the **ink
integral** — the sum over rows of `(paper − grey)/(paper − black)` averaged across an x-window
containing ONLY the five lines and no glyph. That integral is the line's thickness in whole black
pixels, independent of how the scan smeared it.

⭐ **The method is calibrated on the same plates**, against the one number all four books agree on: a
**beam is ½ stave-space**. Gould p. 17's *"incorrect"* figure, measured the same way, gives a beam of
**13.9 px against sp = 26.5 ⇒ 0.524 sp**. So the method reads **+5% high**, and every staff-line
number below is therefore an upper bound.

### 3.1 The staff line, on four Gould pages of ordinary music

| page | what is on it | sp (px) | windows | staff line | in sp |
|---|---|---|---|---|---|
| **p. 14** (PDF 34) *Stem length* | 2 staves | 26.6 / 26.9 | 81 / 129 | 2.96 px | **0.111 / 0.110** |
| **p. 26** (PDF 46) *Ledger lines* | 2 staves | 26.75 | 39 | 2.94 px | **0.110** |
| **p. 43** (PDF 63) *Spacing symbols* | 4 staves | 26.5–26.75 | 9–70 | 2.93–2.98 px | **0.110–0.111** |
| **p. 490** (PDF 510) real engraved score | 2 staves | 26.9 | 6 | 2.99 px | **0.111** |

⭐ **Nine staves on four pages, spread over 480 printed pages, all within 0.110–0.111 sp.** That is
not a measurement with error bars; it is the same setting, and it is the book's engraver's house
value. (Corroboration: an independent pass on 2026-09-01 measured Gould p. 14 at 450 dpi and got
**0.107–0.116 sp** — `reference/README.md`, the STEM Q&A.)

### 3.2 ⭐⭐ …and the decisive plate: her RASTRAL TABLE, printed at ACTUAL SIZE

**Gould p. 483, Table 2: Rastral sizes** draws eight five-line staves, one per rastral number, with
the stave height in millimetres beside each. Two things fall out of measuring it.

**(a) The table is printed at true size, and its column is the WHOLE STAVE, not one space.**
Rastral 0's drawn staff measures **109.0 px at 300 dpi = 9.23 mm**, against the printed *"9.2mm"*.
Every ratio agrees to 2%:

| rastral | her mm | drawn (px, 300 dpi) | ratio to R0, drawn | ratio to R0, stated |
|---|---|---|---|---|
| 0 | 9.2 | 109.0 | 1.000 | 1.000 |
| 1 | 7.9 | 94.0 | 1.160 | 1.165 |
| 2 | 7.4 | 88.0 | 1.239 | 1.243 |
| 3 | 7 | 82.0 | 1.329 | 1.314 |
| 4 | 6.5 | 77.0 | 1.416 | 1.415 |
| 5 | 6 | 70.5 | 1.546 | 1.533 |
| 6 | 5.5 | 65.0 | 1.677 | 1.673 |
| 7 | 4.8 | 56.0 | 1.946 | 1.917 |

🚨 ⇒ **the numbers are the TOP-LINE-to-BOTTOM-LINE height (four spaces), so one stave-space is a
quarter of them** — rastral 0 ⇒ **2.30 mm**, rastral 3 (*"single-stave parts"*) ⇒ **1.75 mm**,
rastral 8 (*"full score"*) ⇒ **0.93 mm**. ⚠️ **Her own p. 482 prose says the opposite** — *"the
Rastral height being the measurement of one stave-space"* — and her table and her drawing both
contradict it. **The plate beats the sentence, again.**

**(b) ⭐⭐ THE LINE WEIGHT SCALES WITH THE STAVE.** Same plate, 600 dpi, ink integral per line:

| rastral | sp (px) | mean ink (px) | **thickness in sp** |
|---|---|---|---|
| 0 | 54.6 | 6.75 | **0.124** |
| 1 | 46.8 | 5.44 | **0.116** |
| 2 | 44.0 | 5.44 | **0.124** |
| 3 | 41.2 | 4.88 | **0.118** |
| 4 | 38.5 | 4.89 | **0.127** |
| 5 | 35.5 | 4.21 | **0.119** |
| 6 | 32.5 | 3.56 | **0.110** |
| 7 | 28.5 | 3.54 | **0.124** |

⭐ The **absolute** ink halves (6.75 → 3.54 px) as the stave shrinks, while the **fraction** stays
flat at **0.110–0.127 sp, mean 0.120, no trend**. ⇒ **A staff line is a constant fraction of the
staff space. A small staff gets a proportionally thinner line.** That is question 2 answered from a
drawing, and it agrees with her p. 5 sentence — *"the size of every notational symbol is measured in
proportion to the stave size"*.

⚠️ Note this table reads ≈0.12 where her *music* pages read ≈0.110. The table is a schematic drawn
with a rule; the music is set from the engraver's font. Both are hers; the 0.11 pages are the
larger sample and the ones with music on them.

### 3.3 🚨 THE LEDGER LINE, ON THE SAME PAGE AS ITS STAFF — and it is 2×, not 1.23×

Gould **p. 26** (PDF 46), the *Ledger lines* figure. Five ledger lines measured in the stubs that
project past the notehead, against the same page's staff lines:

| | ink (px) | in sp |
|---|---|---|
| staff line (39 clean windows) | 2.94 | **0.110** |
| ledger, ex. A left stub | 6.99 | 0.259 |
| ledger, ex. A right stub | 6.77 | 0.251 |
| ledger, ex. B | 6.57 | 0.243 |
| ledger, ex. C | 7.02 | 0.260 |
| ledger, ex. D | 7.55 | 0.280 |
| **ratio** | | **2.2 – 2.5 ×** |

⭐ Her drawing says exactly what her sentence says — *"about twice as thick"*. And the ledger lines
measure **54–55 px = 2.05 sp long**, which is her *"just over two spaces"* to the pixel.

🚨🚨 **Bravura's ratio is `legerLineThickness / staffLineThickness` = 0.16 / 0.13 = 1.23×, and that
is the number this repo draws** (`rendering/layoutConfig.ts`, `LEDGER_LINE_STYLE`). **Gould's plate
is nearly double it.** ⚠️ Ross (*"somewhat thicker"*) and Gerou & Lusk (*"same … or slightly
heavier"*) are on the font's side of the argument in words; only Gould gives a factor, and only
Gould's plate has been measured. ⛔ Ross's own plates were not measured for this — see §9.

### 3.4 ⚠️ Ross's and Gerou & Lusk's plates — thinner, and less trustworthy

| plate | sp (px @600 dpi) | staff line | in sp |
|---|---|---|---|
| **Ross p. 79** (PDF 91), the *"Engraved In England"* specimen | 37.5 | 3.05 px | **0.081** |
| **Gerou & Lusk p. 81** (PDF 42), key-signature figures | 40–41 | 3.1 / 5.1 px | **0.077 / 0.124** |

⚠️ **Treat both as weak.** Ross's book is a 1970 photo-offset reproduction of engraved plates whose
paper is grey (`paper=186, black=45` on that page) and whose thin lines have visibly thinned in
reproduction; G&L's staves gave only two clean windows and disagree with each other by 60%. ⛔ Do not
quote either as a house value. What they do establish is a **direction**: nothing measured anywhere
in this library is *above* 0.13 sp.

**Ross p. 57's rastral chart** was measured too (nine staves, sp 53.75 → 32.25 px) and the absolute
line ink barely moves — 6.2–7.9 px throughout — which would say the opposite of Gould's table.
⛔ **Reported, not believed**: at that reproduction quality a 3-px line and a 7-px line are not
separable, and the chart is a demonstration of *spacings*, drawn with a scorer, not a specimen of
engraved music. **⛔ UNKNOWN whether Ross's line weight scaled with his staff sizes.**

## 4. 🚨 WHAT WE DRAW TODAY — read off the source, ⛔ not intentions

### 4.1 The staff line itself

```ts
// src/engine/engrave/staff/staffLines.ts:133   (⭐ moved here from ScoreRenderer by P5a, 2026-09-01)
export const STAVE_LINE_WIDTH_PX = 1
// src/engine/models/staffSize.ts:37
export const STAFF_SPACE_PX = 10
```

⇒ **we draw 0.100 staff spaces**, as a *pixel constant*, and there are two consumers:
`EngravedStave` (the five lines themselves, `rendering/EngravedStave.ts:102`) and
`KeySignaturePass.drawOpenStaffTail` (the bare staff after a cautionary signature,
`rendering/KeySignaturePass.ts:300`). ⭐ Since P5a both go through
`staffLines.staffLineStrokeY(y, thickness)`, which derives the stroke offset from the thickness — so
the number can move without the two owners coming apart.

✅ **It DOES scale with staff size, by construction.** A small staff is painted inside an SVG
`<g transform="scale(k)">` (`rendering/staffScaleGroup.ts`, `ScoreRenderer.ts:359, 4627`), and the
constant lives in that group's own coordinates where a space is always 10 units. So a 0.7-size staff
renders its lines at 0.7 px, and the ratio stays **0.10 sp at every staff size** — which is the
behaviour §3.2 measured on Gould's rastral table. ⚠️ The *value* is a pixel literal against
`STAFF_SPACE_PX`, so if the staff space ever stops being 10 the number must be restated as
`0.10 × space`; the same is already true of `KeySignaturePass`'s tail.

### 4.2 ⭐⭐ …and the family that is ALREADY pinned to the staff line — at 0.13, not at 0.10

`src/engine/fonts/bravuraMetrics.ts:263` carries `staffLineThickness: 0.13`, transcribed from
`scripts/vendor/Bravura.json`. Five places already read it:

| what | where | expression | drawn |
|---|---|---|---|
| **HAIRPIN stroke** | `rendering/thinLineWeight.ts:124` | `engravingDefault('staffLineThickness')` | **0.13 sp** |
| **LEDGER line** | `rendering/layoutConfig.ts:265–267` | `1 px × (legerLineThickness / staffLineThickness)` = `1 × 1.23` | **0.123 sp** |
| **BRACKET rod projection** | `layout/systemStartColumn.ts:146–147` | `staffLineThickness + BRACKET_DEPTH/2` | includes 0.13 |
| **BRACKET serif inset** | `layout/systemStartColumn.ts:153` | `staffLineThickness / 2` | 0.065 sp |
| **SUB-BRACKET arm** | `layout/systemStartColumn.ts:248`, `rendering/systemStart.ts:287` | `staffLineThickness` (arm thickness), `/2` (reach) | **0.13 sp** |

🚨 **So the repo has already adopted 0.13 as "the thickness of a staff line" everywhere the phrase is
used to define something else — and the staff line is the one member of the family that does not use
it.** A hairpin today is drawn **1.3 px** beside a staff line drawn **1.0 px**: a ratio of **1.30**,
where Gould's plate is **1.00** and every book says the two are the same line.

⭐ **Answering the question directly: moving the staff line to 0.13 sp is NOT a new opinion.** It is
making the staff line agree with a choice this repo shipped, sourced, and pinned with tests
everywhere else. The new opinion would be the opposite move — deciding that "the thickness of a staff
line" means 0.10 and re-pointing the hairpin, the bracket and the ledger ratio at that.

⚠️ `thinLineWeight.ts` already says so in its own words, dated 2026-08-18 and quoting HIM:
*"we should somehow at some point in the future take control of the staff line width, so everything
looks neat"* … *"THE REAL FIX IS TO RAISE THE STAFF LINE, NOT TO LOWER THE HAIRPIN."* ⛔ That is a
recorded direction, not a decision taken — §8 keeps it open because the number is his eye's.

### 4.3 ⭐ THE BLAST RADIUS — what moves if `STAVE_LINE_WIDTH_PX` changes

**Moves directly** (the ink itself changes weight):

1. Every **staff line** of every stave, in every view (`EngravedStave`).
2. The **open staff tail** after a cautionary key signature (`KeySignaturePass.drawOpenStaffTail`) —
   it reads the same constant, deliberately, so the tail cannot end up a different weight.

**Moves by ratio** (defined as a multiple of the line VexFlow/we actually draw):

3. The **LEDGER LINE** — `LEDGER_LINE_STYLE.lineWidth = VEXFLOW_STAFF_LINE_PX × 1.23`
   (`rendering/layoutConfig.ts:265`). ⚠️ It is pinned to a *private* `VEXFLOW_STAFF_LINE_PX = 1`
   (`layoutConfig.ts:233`), **a second copy of the same 1** — so a change to `STAVE_LINE_WIDTH_PX`
   alone would NOT move the ledger line, and the ratio the file exists to preserve would silently
   break. 🚨 That is the trap in this change, and it is a two-line one.

**Does not move, but its RELATION to the staff line does** — i.e. the page's look changes even though
these constants do not:

4. The **hairpin** (0.13 sp): ratio to the staff line goes 1.30 → 1.00.
5. The **sub-bracket** arms and the **bracket** serif inset / rod projection (0.13-derived).
6. The **thin-line family** — thin barline, octave line, tuplet bracket, pedal line, lyric extender —
   all `THIN_LINE_SPACES = engravingDefault('thinBarlineThickness')` = **0.16 sp**
   (`rendering/thinLineWeight.ts:60`, `rendering/barlineInk.ts:29`). Their ratio to the staff line
   goes 1.60 → 1.23.
7. **Stems** — VexFlow's, not ours (⚠️ 2026-09-19: ours now — `EngravedNote` draws the stem and its
   width is the inherited row `STEM_THICKNESS_PX`, same 1.5 px); a stem is 1.5 px by VexFlow default = 0.15 sp, which is already
   *thicker* than our staff line where all four books say it must be **thinner**. 🚨 Raising the staff
   line to 0.13 narrows that inversion; it does not fix it. ⛔ Not researched here — that belongs to
   the stem, `docs/stem-length-research.md` §5.
8. **Pixel hinting.** At 1 px a staff line lands on the device grid and stays crisp; at 1.3 px it does
   not (`rendering/barlineInk.ts`'s hinting pass exists for exactly this, and
   `staffLines.ts`'s header spells out that VexFlow's `lineWidth % 2 ? 0.5 : 0` correction is only
   valid for **odd integers**). ⚠️ The screen and the printed page want different answers here.

⭐ Tests that would move: `rendering/ledgerLineStyle.test.ts` pins the ledger ratio;
`engrave/staff/staffLines.test.ts` pins the stroke geometry; the browser suite measures staves.

## 5. What the font and the three engines do

### 5.1 🚨 SMuFL PUBLISHES NO DEFAULT — 0.13 IS BRAVURA'S NUMBER, NOT THE SPECIFICATION'S

Fetched 2026-09-01 from `http://smufl.formats.music/latest/specification/engravingdefaults.html`
(the only live host — the two older ones are dead, `reference/README.md`). The page's entire preamble
is:

> *"The 'engravingDefaults' structure contains key/value pairs defining recommended defaults for line
> widths etc., as follows, with all measurements expressed in staff spaces:"*

and `staffLineThickness` is glossed only as *"The thickness of each staff line"*. **No number.** The
dummy JSON at the foot of the page shows `"staffLineThickness": 0.1`, presented as an illustration.

⇒ 🚨 **Every comment in this repo that says *"SMuFL says 0.13"* is inexact.** SMuFL says *"express it
in staff spaces"*; **Bravura** says 0.13 (`scripts/vendor/Bravura.json:22`). ⭐ That matters because it
changes what 0.13 is: not a standard to conform to, but **one font's house value** — and a different
SMuFL font may state a different one, which is exactly what MuseScore and Verovio then honour
(§5.3, §5.4).

### 5.2 The four implementations

| | value in sp | where | how it is drawn |
|---|---|---|---|
| **LilyPond** | **0.100** at the default 20 pt staff | `scm/paper.scm:52–66`, assigned `:84`; `lily/staff-symbol.cc:51–52` (`t = line-thickness × StaffSymbol.thickness`, and `thickness` is absent from the grob ⇒ C++ fallback 1.0, `staff-symbol.cc:334`) | a filled box with a `blot-diameter` round cap, ends inset by `t/2` (`staff-symbol.cc:84`) |
| **MuseScore** | **0.11** | `Sid::staffLineWidth = 0.11_sp`, `src/engraving/style/styledef.cpp:277`; drawn `rendering/score/tlayout.cpp:5210`, pen at `tdraw.cpp:2761` | ⚠️ **a loaded SMuFL font OVERRIDES it** — `internal/engravingfont.cpp:778` maps the font's `staffLineThickness` onto this style id |
| **Verovio** | **0.075** stated (0.15 MEI units) — ⚠️ **0.0722 actually drawn** | `src/options.cpp:1528–1530`; `src/doc.cpp:2057–2060`. `GetDrawingUnit` returns an `int`, so `0.15 × 90 = 13.5` truncates to **13** ⇒ 13/180 | stroked centreline, `src/view_graph.cpp:40–50` |
| **VexFlow 5** | **0.10** (1 px) | `stave.js:461–462` — `lineWidth = this.getStyle().lineWidth ?? 1`, and there is **no** `Stave.lineWidth` in `metrics.js:129–136`, so the line inherits the SVG context default `stroke-width: 1` (`svgcontext.js:56`) | ⚠️ `Tables.STAVE_LINE_THICKNESS = 1` (`tables.js:597`) is a **different** constant, used only by `stavebarline.js` and `staveconnector.js` |
| **Bravura** | 0.13 | `scripts/vendor/Bravura.json:22` | — |
| **ours** | **0.10** | `engrave/staff/staffLines.ts:133` | a stroke centred by `staffLineStrokeY(y, t) = y + t/2` |

⭐⭐ **Read that column again.** Our 0.10 is **LilyPond's exact value**, and Gould's measured plate
(0.110) is **MuseScore's exact value**. The field runs **0.072 → 0.13**, and 0.13 is its top.

### 5.3 ⭐⭐ Does it scale with the staff? — and LilyPond deliberately says NO

| | behaviour |
|---|---|
| **LilyPond** | ⛔ **Neither a constant fraction nor a constant absolute** — an *affine function of the staff space in points*: `thickness_pt ≈ 0.3286 + 0.0343 × staff_space_pt` (`scm/paper.scm:52–66`). So the **relative** weight GROWS as the staff shrinks: 30 pt ⇒ 0.078 sp · **20 pt ⇒ 0.100 sp** · 16.5 pt ⇒ 0.114 sp · 10 pt ⇒ 0.166 sp. The intent is stated in the source: *"stafflinethickness is largely independent on staff size, and generally about 0.5 pt"* (`mf/feta-params.mf:31–32`). ⚠️ And `\magnifyStaff` puts `StaffSymbol.thickness` in the **unshrinkable** list — it thickens above 1× and never thins below (`ly/music-functions-init.ly:1136–1138`) |
| **MuseScore** | ✅ **a constant fraction** — `0.11 × spatium()`, and `spatium()` carries `staffMag` (`dom/staff.cpp:784–796`). `Sid::smallStaffMag = 0.7`. ⭐ **Contrast: barlines do NOT scale** — `Sid::scaleBarlines` defaults to `false` (`styledef.cpp:792`), so on a small staff MuseScore's staff lines thin and its barlines do not |
| **Verovio** | ✅ **a constant fraction** — everything goes through `GetDrawingUnit(staffSize)`; `ossiaStaffSize = 0.75` |
| **VexFlow** | ⛔ **fixed absolute** — `spacingBetweenLinesPx` changes the staff space and the stroke stays 1 px, so a smaller VexFlow stave has relatively *thicker* lines |
| **ours** | ✅ **a constant fraction**, but by accident of the transform rather than by arithmetic — the `<g transform="scale(k)">` scales `stroke-width` with everything else (§4.1) |

🚨 So on the question *"does the line scale?"* **Gould's plate agrees with MuseScore, Verovio and us,
and disagrees with LilyPond** — whose own source says the non-scaling is on purpose, because it is an
*ink* property of the printing process rather than a *design* property of the music.

### 5.4 Ledger lines, in the engines

| | ledger line | as a multiple of that engine's staff line |
|---|---|---|
| **LilyPond** | `ledger-line-thickness '(1.0 . 0.1)` = `1× line-thickness + 0.1 sp` (`scm/define-grobs.scm:3399`; applied `lily/staff-symbol.cc:338–344`) | at 20 pt: 0.10 + 0.10 = **0.20 sp ⇒ 2.0×** ⭐⭐ **which is Gould's *"about twice"* exactly** |
| **MuseScore** | `Sid::ledgerLineWidth` | not read in this pass — ⛔ UNKNOWN |
| **Verovio** | reads the font's `legerLineThickness` | Bravura ⇒ 0.16 against its own 0.075 line ⇒ **2.2×** |
| **Bravura** | `legerLineThickness 0.16` vs `staffLineThickness 0.13` | **1.23×** |
| **ours** | `1 px × (0.16 / 0.13)` | **1.23×** |

⭐⭐ **LilyPond's construction is the interesting one**: it is not a ratio at all but *"the staff line,
plus a tenth of a space"*. At its own 20 pt staff that lands on **exactly 2×**, Gould's number — and it
stays visibly heavier at every staff size, which is precisely the reason she gives (*"so that a player
… can take in the number of ledger lines at a glance"*).

### 5.5 Non-five-line staves

**All four support an arbitrary line count, and NOT ONE of them changes the line's thickness or its
spacing because of it** — LilyPond `line-count` + arbitrary `line-positions`
(`scm/define-grobs.scm:3400–3401`; thickness computed once, before the loop,
`lily/staff-symbol.cc:51–52`); MuseScore `StaffType::m_lines` (`dom/stafftype.h:349`; `setLw()` never
reads it, `tlayout.cpp:5210`); Verovio `@lines` (`src/view_page.cpp:1361`, outside the loop);
VexFlow `numLines` (`stave.js:51, 67–74`).

⭐ LilyPond alone ships *presets* that change both together — Mensural `line-count 4` **+**
`thickness 0.5`, Petrucci `thickness 0.6`, Kievan `thickness 1.3` (`ly/engraver-init.ly:1399–1400`,
`:1525`, `:1610`) — but the thickness is authored per style, ⛔ never derived from the line count.

## 6. ⭐ Where they all agree

1. **A staff line is the unit of measurement, not a measured thing.** Four books define other lines
   against it; none states its own width. Ross explains why: on a plate it was *"controlled by the
   pressure exerted on the tilting arbor plate"* (p. 72) — an operator's variable.
2. **A stem is thinner than a staff line.** Gould p. 13, Ross p. 82, Gerou & Lusk p. 25/135. ⭐ Three
   for three, no dissent. 🚨 We draw the reverse — VexFlow's `Tables.STEM_WIDTH = 1.5`
   (`tables.js:595`) is **0.15 sp** against our staff line's 0.10.
3. **A barline is thicker than (or at least equal to) a staff line.** Gould p. 38, Ross p. 82,
   G&L p. 25. ✅ We agree — 0.16 vs 0.10.
4. **A ledger line is thicker than a staff line**, and spaced at exactly the staff's own interval.
   All three that mention it. ✅ We agree in direction; the FACTOR is the disagreement (§7).
5. **A hairpin is a staff line.** Gould p. 103, Ross p. 187. ⭐ We already draw the *font's* staff-line
   weight for it and a *different* weight for the staff line, so we honour the sentence's number and
   break its relation.
6. **Everything on the page is proportional to the stave size** (Gould p. 5) — and her own
   Rastral-sizes plate holds the line weight at a constant fraction across eight staff sizes (§3.2).
   ✅ We agree, via the `scale(k)` group.
7. **A beam is ½ stave-space**, in all four books. (Used here only to calibrate the measuring method.)

## 7. ⚠️ Where they diverge

| question | positions |
|---|---|
| **how much thicker is a LEDGER line?** | Gould *"about twice"* (p. 26) **and draws 2.2–2.5×** · Ross *"somewhat thicker"* (p. 182) · Gerou & Lusk *"the same line weight as staff lines, or slightly heavier"* (p. 83) · Bravura **1.23×** · **ours 1.23×**. 🚨 A genuine three-way spread with the only measured plate at the far end |
| **an EXTENDER line** | Gould *"a line of stave-line thickness"* (p. 447) vs Gerou & Lusk *"less than that of the staff lines"* (p. 85) |
| **the ABSOLUTE weight** | Gould's plates **0.110–0.111** (music) / **0.110–0.127** (her rastral table) · Ross's specimen **0.081** ⚠️ low-confidence · Bravura **0.13** · LilyPond **0.100** · MuseScore **0.11** · Verovio **0.072 drawn** · ours **0.10**. ⛔ No book states a number, so this row is entirely measured-vs-implemented |
| **does it scale with staff size?** | Gould's plate: **yes, flat at ≈0.12 sp across 8 sizes** — and MuseScore, Verovio and we agree. 🚨 **LilyPond deliberately does not** (*"stafflinethickness is largely independent on staff size, and generally about 0.5 pt"*, `mf/feta-params.mf:31–32`) — its relative weight runs 0.078 sp at a 30 pt staff to 0.166 sp at 10 pt. ⚠️ Ross's rastral chart measures the LilyPond way, ⛔ but at that reproduction quality it is not trustworthy (§3.4) |

## 8. THE DECISIONS

### ✅ WHAT HE DECIDED, 2026-09-01 — ⛔ read this before the table below it

> **A — the staff line's thickness: *"lets do gould"*** ⇒ **0.11 staff spaces**, her own engraved
> staves as measured in §3.1, and MuseScore's `Sid::staffLineWidth` exactly. ⛔ Deliberately **not**
> Bravura's 0.13: no treatise states a thickness at all, so the printed evidence beats the font.
> ✅ Built the same day — `STAVE_LINE_WIDTH_PX = 0.11 * STAFF_SPACE_PX`.

⭐⭐ **AND THE STANDING INSTRUCTION THAT CAME WITH IT, which outranks the number:**

> *"remember in the future the user will be able to change this, we will be able to apply in general
> other engraving rules… but for the moment the default is gould."*

⇒ ⛔ **Every number in this document is ONE HOUSE STYLE'S ANSWER, not a constant.** Nothing may be
written that assumes it cannot move — the eventual shape is a swappable set of engraving defaults,
the direction `__beams.rule(…)` and `__spacing.law(…)` already point in.

**✅ E — the double `1`: RESOLVED, and it was FORCED by A rather than chosen.**
`layoutConfig.VEXFLOW_STAFF_LINE_PX` was a second copy of the thickness and the one the ledger ratio
multiplied; a stale copy would have pinned the ledger to the OLD line. ⭐ It is **deleted**, on his
catch — *"do we need a const with vexflow name where we will get rid of vexflow soon?"* — and the
ratio now multiplies `STAVE_LINE_WIDTH_PX` directly. ⚠️ The name had also become false: since P5a the
engine draws its own staff lines and sets the width itself.

**⚠️ B — partly foreclosed by A, and one half of it is now HIS directive rather than a question.**
The *"read it from the font"* option dies with A (0.11 is not Bravura's 0.13). What shipped is the
FRACTION spelled out — `0.11 * STAFF_SPACE_PX` — rather than a bare `1.1`, so the intent is legible
and it scales with the staff size. ⏳ What is genuinely left of B is **where the 0.11 lives** once
house styles are swappable, which is the instruction above, not a taste call.

**✅ C — the ledger's factor over the staff line: *"lets do i"* ⇒ KEEP the font's 1.23×.**
⛔ No code change: that is what `LEDGER_LINE_STYLE` already computes. ⭐ It is the reading the
treatises give **in words** — Ross's *"somewhat thicker"*, Gerou & Lusk's *"or slightly heavier"* —
against Gould's stated *double* (p. 26), LilyPond's construction landing on exactly 2.0×, and her own
plates measuring 2.2–2.5×. ⚠️ **So this is the one decision where he did NOT follow her ink**, and
that is his call to have made, ⛔ not an oversight to be corrected later by somebody who reads §3.3
and assumes nobody saw it.

⭐ Note the ledger still got heavier in absolute terms — **1.23 → 1.354 px** — because the ratio held
while the staff line rose. That is the relationship working, ⛔ not a second decision.

**✅ D — the hairpin ↔ staff-line relation: *"ii"* ⇒ KEEP the hairpin at 0.13 sp.**
⛔ No code change, and ⭐ **the 1.18× difference is now DELIBERATE.** He was shown that Gould p. 103
and Ross p. 187 both state a hairpin's weight *as a staff line's*, and that her own wedges measure
0.97–1.03 against her staff lines — and kept the difference anyway. ⭐⭐ The reason is a fact about
OUR OUTPUT, not about her page: **his eye rejected 0.10 and 0.12 as "too thin"**, because a
horizontal staff line hints onto the device pixel grid and stays solid while a DIAGONAL hairpin
cannot and smears into grey (`rendering/thinLineWeight.ts` carries the measurements).
🚨 ⛔ **Do not re-open this by citing the treatises** — both were quoted and weighed at the time. ⏳ The
question actually underneath it is **F**, and if F is ever settled with separate weights for screen
and paper, D is worth revisiting then.

**⏸️ F — screen vs paper: *"lets do iii cause is safer"* ⇒ DEFERRED, ⛔ not answered.**
One number keeps serving both, and he has not yet looked at a 1.1 px staff line on screen. ⭐ Revisit
only if his eye reports the softening; a concrete symptom beats a theoretical one, and ⛔ nothing in
the literature addresses screens at all.

⭐⭐ **…but he stated the DIRECTION, and it decides the tie-break in advance:**

> *"I think in the end the PDF will win"*

⇒ ⛔ **Never trade PDF correctness for screen crispness.** Rounding the staff line to a whole pixel to
make the screen crisp is exactly the move that is now ruled out. ⚠️ Note this cuts against **D**,
which kept the hairpin heavy for a SCREEN reason (a diagonal cannot hint) — ⭐ so if F is ever taken
up properly and paper wins outright, **D is the row to revisit with it**, and the two should be
settled together rather than one at a time.

✅ **The staff-line document is now fully answered: A ✅ · B ✅ (partly foreclosed by A) · C ✅ · D ✅ ·
E ✅ · F ⏸️ deferred with a stated direction.**
⚠️ D moved without being decided: the staff line rising to 0.11 narrowed the hairpin's gap from
**1.30× to 1.18×**, ⛔ but did not close it.

### The table

⛔ **Nothing below is a defect list.** Presented the way P4b's and P4c's were: rules on a shelf, with
the one we draw today named honestly.

| # | question | the options, with provenance | what we do now |
|---|---|---|---|
| **A** | **the STAFF LINE's thickness** | (i) **0.13 sp** — **Bravura's** `staffLineThickness` (⚠️ **not SMuFL's**, §5.1), and **the value this repo already uses everywhere the phrase "staff line" defines something else** (§4.2) · (ii) **0.11 sp** — Gould's engraved music, four pages, nine staves (§3.1), **and MuseScore's `Sid::staffLineWidth` exactly** · (iii) **0.12 sp** — Gould's own rastral table across eight staff sizes (§3.2) · (iv) keep **0.10 sp** — one device pixel, and **LilyPond's `line-thickness` at a 20 pt staff exactly** | **0.10 sp** (`STAVE_LINE_WIDTH_PX = 1`). ⭐ Inside the field, at its lower end; ⛔ the odd one out inside this repo |
| **B** | **is the number a FRACTION or a pixel?** | (i) `engravingDefault('staffLineThickness') × space` — the direction `staffLines.ts` and `own-engraving-engine.md` already state · (ii) keep the pixel literal | a **pixel literal** that happens to equal 0.10 sp because `STAFF_SPACE_PX` is 10. ✅ It already scales with staff size via the `scale(k)` group (§4.1) |
| **C** | **the LEDGER line's factor over the staff line** | (i) **1.23×** — Bravura's `legerLineThickness / staffLineThickness`, and Ross's *"somewhat thicker"* / G&L's *"or slightly heavier"* in words · (ii) **2×** — Gould p. 26 in words, **2.2–2.5× in her own ink** (§3.3), **and LilyPond's `staff line + 0.1 sp` construction, which lands on exactly 2.0× at its default staff** (§5.4) · (iii) the font's absolute **0.16 sp**, which is Verovio's 2.2× | **1.23×** (`LEDGER_LINE_STYLE`). 🚨 The measured plate and LilyPond both say double it |
| **D** | **the hairpin ↔ staff-line RELATION** | (i) make them **equal**, which is what Gould p. 103 and Ross p. 187 both say and what her plate draws at ratio 0.97–1.03 (measured in `thinLineWeight.ts`) · (ii) keep the current split | **1.30×** — hairpin 0.13, staff line 0.10. ⚠️ Falls out of **A**: choosing 0.13 closes it with no second edit |
| **E** | **the double `1`** | `layoutConfig.VEXFLOW_STAFF_LINE_PX = 1` is a **second copy** of the staff line's thickness, and it is the one the ledger ratio multiplies. Any change to **A** that does not move it silently breaks the ratio the file exists to keep (§4.3) | two constants, one value |
| **F** | **screen vs paper** | a 1 px line hints onto the device grid; 1.3 px does not (`barlineInk.ts`'s hinting pass, `staffLines.ts`'s header). ⛔ No source addresses it | one number for both |

⚠️ **On A, the honest framing:** raising the staff line to 0.13 is **not** a new opinion — it is
making the staff line agree with a value this repo already shipped, sourced and tested for the
hairpin, the bracket and the ledger ratio. Lowering the family to 0.10 would be the new opinion.
⭐ And on the plate evidence, **0.11 is the best-supported number of the four** and is not currently
anybody's constant.

## 9. What this document does NOT answer — ⛔ UNKNOWN, not "silent"

- **An absolute staff-line thickness from any treatise.** There is none (§2). Every number in §3 is a
  measurement of a printed page, and every number in §5 is an implementation's.
- **Whether Ross's or Stone's line weight scales with staff size.** Ross's rastral chart measures
  flat in absolute terms and that reading is not trustworthy (§3.4); Stone prints no such chart.
- **Ross's ledger lines and hairpins, measured.** ⛔ Not attempted — his reproduction thins every hair
  line (his staff line reads 0.081 sp against Gould's 0.110), so a ratio taken off it would be
  measuring the photo-offset, not the engraving. His prose (*"somewhat thicker"*) is all we have.
- **The stem's thickness**, which is the other half of the *"thinner than a staff line"* relation.
  It has its own research: `docs/stem-length-research.md` — three books say *thinner*, none gives a
  number, and Gould's own plate measures the stem and the staff line **the same** (0.106–0.120 vs
  0.107–0.116 sp). ⇒ 🚨 even her drawing does not obey her sentence there.
- **What thickness looks right ON A SCREEN.** Every number here is ink on paper. The pixel-hinting
  question (a 1.3 px line straddling two device rows) is real, is recorded in `barlineInk.ts` and
  `staffLines.ts`, and ⛔ no book can answer it.
- **Non-five-line staves.** Gould p. 5–6 and Stone p. 23 cover *when* to use one, and Stone gives the
  one placement rule (*"the middle line of the staff should become the single line"*); ⛔ neither says
  anything about the line's weight on such a staff, and no source discusses 4-line or 6-line staves'
  geometry at all.
- **Gardner Read** and **Chlapik** — still not on disk (`reference/README.md`, *Still missing*), and
  not consulted.
