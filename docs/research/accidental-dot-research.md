# The ACCIDENTAL and the AUGMENTATION DOT — what the books say

> 📄 A survey of the engraving literature on two note MODIFIERS: where an accidental stands
> (horizontally, vertically, and stacked into a chord's columns) and where an augmentation dot
> stands. ⛔ **This document proposes nothing, names no file to edit, and contains no work list.**
> It ends with open questions whose owner is the user.
>
> **Sources**: the four treatises on disk (`reference/README.md`), all read on **rendered pages** at
> 450–600 dpi, never from an OCR layer, and measured where a page prints an example.
>
> | book | page offset used here |
> |---|---|
> | Gould, *Behind Bars* | **PDF page = printed page + 20** (the standing calibration) |
> | Ross, *The Art of Music Engraving and Processing* | **PDF page = printed page + 12** |
> | Stone, *Music Notation in the Twentieth Century* | ⚠️ **2-UP.** Printed pp. 2k and 2k+1 are PDF page **k + 11** (verified: printed 56–57 = PDF 39; printed 44–45 = PDF 33) |
> | Gerou & Lusk, *Essential Dictionary of Music Notation* | 🚨 **ALSO 2-UP, and this was not recorded before.** PDF page *n* holds printed pages **2n − 4** and **2n − 3** (verified: PDF 5 = printed 6–7, header read off the scan; PDF 70 = printed 136–137, the *Stems* entry `docs/research/stem-length-research.md` cites). ⛔ `docs/research/stem-length-research.md` says "Gerou & Lusk's PDF is 1-up with its own printed numbers" — **that is wrong** |
>
> **How the measurements were made.** `pdftoppm -r 600 -png`, then a per-row ink profile to find the
> five stave-lines (which fixes 1 sp in pixels for that plate), then per-space column profiles to
> read ink runs. Threshold 128/255. ⚠️ **Anti-aliasing inflates every ink run by roughly 1 px a
> side**, so a measured WHITE gap reads ~2 px (≈0.07 sp at 600 dpi) *smaller* than it is and a
> measured glyph ~2 px larger — the same bias `reference/README.md` records for the browser ink
> reader. Raw figures are reported below; where the bias matters it is said so.
>
> 🚨 **CORRECTED 2026-09-25** (`docs/research/multiple-dots-research.md` §0.6): re-measured threshold-free (darkness-weighted
> centroids for the pitch, the darkness integral for the diameter), the bias does **not** reproduce —
> Gould's RAW gaps (0.37 head→dot, 0.26 dot→dot) ARE the gaps, and her dot is **0.49 sp**, not ≈0.41.
> ⛔ Do not add the ≈0.07 sp to any figure below.

---

## 1. The question, and why it is being asked now

On **2026-09-14** the accidental's and the augmentation dot's **INK** became ours
(`engine/engrave/notes/accidental.ts`, `engine/engrave/notes/augmentationDot.ts`,
`engine/rendering/engraved/EngravedAccidental.ts` — `docs/plans/own-engraving-engine.md` P3). They were the last
two glyphs VexFlow still painted on an ordinary score, and they were invisible to `lint:paint`
because a modifier never touches `vexContext`; a scene census found them.

Taking the ink did **not** take the placement. Both modules say so in their own headers:

- the accidental *"hangs to the LEFT… its ink's right edge meets the point the note offers"* — and
  that point is `StaveNote.getModifierStartXY`, VexFlow's, this repo's one live monkeypatch;
- which COLUMN a chord's accidental stands in is `Accidental.format`, VexFlow's;
- the dot's half-space LIFT arrives *"already decided, as `dotShiftY`"* from `Dot.format`,
  VexFlow's.

⭐ **(2026-09-16) Both rules are now ours as TRANSCRIPTIONS** — `engrave/notes/accidentalStack` (S9d)
and `engrave/notes/dotStack` (S9c), VexFlow's behaviour kept exactly. Nothing below was acted on; it is
now the menu for editing those two modules rather than for replacing VexFlow. (⚠️ 2026-09-19: VexFlow
is removed altogether — the point the note offers is ours too, `engrave/notes/modifierStart` (S5a),
and the inherited numbers below are rows in `engrave/inheritedDefaults`.)

So there are three numbers on the page that nobody in this repo has chosen: the accidental's
standoff, the gap between two accidental columns, and the dot's standoff. One of them —
the dot's — **was** chosen, by `engine/rendering/format/dotPlacement.ts`, in answer to his report *"the dot
is too close to the notehead"*; that module cites Gould for the figure it uses, and §4 below checks
the citation against the book.

This is the survey that would let the rest be chosen. ⛔ It does not choose them.

---

## 2. THE BOOKS

### 2.1 ⭐⭐ GOULD, *Behind Bars*

Accidentals: **printed pp. 77–78** (*Design*, *Placing*) and **pp. 87–90** (*Arranging accidentals
for chords*). Dots: **pp. 54–56** (*Dotted notes*), plus **p. 38** (*Dotted rests*) and **p. 26**
(*Ledger lines*). Read on PDF pages 46, 58, 74–76, 97–110.

#### A. THE ACCIDENTAL

| question | Gould |
|---|---|
| **A1 gap to the notehead** | ⛔ **No number.** p. 78, *Placing ▸ Proximity to notes*: *"An accidental should be as close as possible to the note it precedes. Allow sufficient space to ensure that an accidental does not collide with a symbol that precedes it, or it will become illegible."* The only quantity anywhere near it is her ½-space floor for cramped music (p. 43, *"an accidental or grace note may be closed up to within ½ space of a barline"*, and *"reduce the space around clefs and accidentals to ½ space, to minimize distortion"*) |
| **A1, MEASURED** | ⭐ Her p. 88 plates, 600 dpi, 1 sp = 26.5–26.6 px. Ink right edge of the sign → ink left edge of the notehead, over eleven engraved pairs: **flat 0.19 / 0.23 / 0.23 / 0.23 sp · natural 0.30 / 0.34 / 0.38 sp · sharp 0.34 / 0.34 / 0.38 sp**. ⭐ She draws the FLAT closer than the sharp or natural — the flat's rightmost ink is its bowl, at the notehead's own level. Add the ~0.07 sp anti-alias bias and the true white gaps are ≈**0.26–0.45 sp** |
| **A2 vertical placement** | ⭐⭐ p. 78, *Placing ▸ On the stave*: *"**The central portion of an accidental symbol must precisely fill a stave-space, or be centred on a line.** Take great care when assigning accidentals to notes on ledger lines — without the guidance of the stave it is easy to place an accidental ambiguously"*, with an `and`/`not` pair. The anchor is the **note's own line or space**, and p. 77's design paragraph says what "central portion" means per glyph: the sharp's crossbars *"when the sharp is placed in a stave-space, the top left of each crossbar hangs from the line, the bottom right sits on the line"*; the flat's bowl *"in depth should fill a stave-space when positioned in one"*; the natural's crossbars *"intersect the stave-lines in the same way as the crossbars of a sharp"* |
| **A3 chord columns — the ORDER** | ⭐⭐ p. 87: *"There is no hierarchical necessity to arrange accidentals in groups of sharps, naturals and flats. Rather, their order is determined by their position on the stave."* p. 89, *Close-position chords*: *"Alternate the highest and lowest accidentals so as to allow a group of accidentals to be as compact as possible. **Place the highest accidental closest to the chord, followed by the lowest, moving left from the chord and alternating the highest and lowest of the remainder**"* — and the descending-order alternative is drawn and labelled *"not recommended"*, because *"each accidental needs fractionally more space to be clear of its neighbour"* |
| …and the exceptions to the order | p. 89, *Chords spanning a seventh or more*: *"**Align the accidentals for the outer notes closest to the chord.** Offset further accidentals to the left, starting with the remaining highest, and alternating"*. p. 89, *Widely spaced chords of four or more notes*: *"When there are two overlapping sevenths, or wider intervals, align pairs of accidentals, as this takes up the least space"*. p. 90, *Octave accidentals*: *"These are easiest to read when they align. Other accidentals may be offset to the left to allow for this."* p. 90, *Chords with adjacent notes*: *"It is visually helpful to place accidentals for adjacent notes in descending order, right to left, away from the chord, to reflect the arrangement of notes"* — ⚠️ and *"When there are several accidentals for a close-position chord, it is better to use the conventional arrangement, as the descending order of accidentals requires more space."* p. 90, *Down-stems*: *"Move an accidental closer to the stem than a displaced note wherever there is room"* |
| **A3 — when may two SHARE a column** | ⭐⭐ p. 88, *Two-note chords*: *"**Pairs of accidentals an octave or more apart vertically align. Depending upon the exact length of the accidental symbol, accidentals a seventh and sixth apart can align as long as they do not collide or join up.**"* Then case by case: a **seventh** — *"Most combinations of accidentals a seventh apart can align without touching: Otherwise slightly offset the lower accidental to the left"*; a **sixth** — *"When the upper note is a flat, accidentals can usually align. Otherwise the lower accidental is offset"*, and *"When the upper note is a sharp or natural, slightly offset the lower accidental so that the vertical strokes do not join up"*; a **fifth or less** — *"The higher accidental goes closest to the chord, the lower one is offset to the left. Flat and natural signs a fourth or fifth apart may overlap as long as they do not join up"* |
| **A4 gap between two columns** | ⛔ **No number in prose.** p. 87: *"Place all accidentals as close as possible to the notes they precede, **evenly spaced, but not too far apart**"* — with the same four-accidental chord engraved three times, once recommended and twice rejected as too wide. ⭐ **But she states the MINIMUM geometrically**, p. 88: *"**The closest that two sharps may be placed together is so that the edges of their crossbars align vertically. The sharps cannot overlap, as the vertical strokes would join up**"* |
| **A4, MEASURED — the minimum** | ⭐⭐ p. 88's three-way plate (600 dpi, 1 sp = 26.5 px). Recommended: lower sharp spans x 1218–1244, upper sharp 1244–1270 — **they abut exactly**, offset **0.98 sp**, zero ink between them and zero overlap. *"but not"* draws the two sharps at the SAME x (aligned). *"nor"* draws them overlapped by **0.53 sp**. ⭐ So her minimum column pitch is **one sharp's width, ≈1.0 sp, with no air** |
| **A4, MEASURED — the recommended vs rejected spread** | p. 87's three-way plate, same four accidentals + chord each time. Leftmost accidental ink → leftmost notehead ink: **recommended 5.98 sp · "but not" 7.59 sp · "nor" 9.21 sp** — i.e. each rejected step costs ≈1.1 sp more for the same four signs |
| **A5 accidental vs LEDGER LINE** | ⛔ **She does not discuss it.** p. 78 raises ledger lines only for the sign's VERTICAL ambiguity (above). What she does sanction is shortening in general, p. 26, *Ledger lines*: *"The ledger line extends slightly beyond either side of the notehead and is **just over two spaces long** (a). Ledger lines of adjacent notes should not join up (c); **the lines may be slightly shortened in cramped conditions** (b)"* — ⛔ no amount, and the case named is neighbouring ledger lines, not an accidental |

#### B. THE AUGMENTATION DOT

| question | Gould |
|---|---|
| **B1 gap to the notehead** | ⭐⭐ p. 54, *Dotted notes ▸ Placing dots relative to noteheads*: *"**Place the dot close to its notehead so that it can be spotted immediately — usually a half stave-space's distance.**"* |
| **B1, MEASURED** | ⭐ p. 54's two plates, 600 dpi, 1 sp = 27.0 / 27.1 px. Notehead ink → dot ink over six engraved dotted notes (minim on a line, semibreve in a space, three beamed crotchets, a double-dotted chord): **0.37 · 0.37 · 0.37 · 0.37 · 0.41 · 0.44 sp**, mean **0.39 sp**. With the anti-alias bias the true gaps are ≈**0.46 sp**. ⭐⭐ **Her plate engraves her sentence, and it confirms the half space is measured EDGE TO EDGE** — centre to centre it would be ≈1.3 sp |
| **B2 the dot on a LINE** | ⭐ p. 54: *"**When notes are in a space, place the dot in the middle of that space. When notes are on a line, place the dot in the space above**"* |
| **B2, MEASURED** | Every dot's vertical centre lands on its space's centre to within **0.04 sp** (offsets −0.009, 0.000, −0.037, +0.018 sp). For the head on a line, the dot's centre is **+0.50 sp** above the line |
| **B2 ledger lines** | p. 55: *"Dotted notes on ledger lines follow the same principle. The dot moves above the ledger line when the note is on a line"* |
| **B2 in a CHORD** | p. 55: *"Every notehead in a chord must take a duration dot. **Vertically align the dots after the chord**"* (one column, past the whole chord, displaced heads included) · *"**Each dot should always have a stave-space to itself.** This same spacing applies to chords on ledger lines as well, where dots should not be bunched up just because there are no stave lines to separate them into individual spaces"* · *"A dot may need to move a stave-space away from its notehead. **Do not align the dots horizontally, as this gives double-dotted value to the notes**"* · p. 56: *"**Centre the dots on the chord**, rather than placing them in one direction, away from the chord"*, and *"When a dot is forced to be two or more stave-spaces from the chord, its function becomes less relevant. In such cases, use only as many dots as cover the number of stave-spaces taken up by the chord"* |
| **B2 the SECONDS case** | ⭐⭐ p. 55, *Adjacent-note chords*: *"**When the upper note is on a line, the dot moves up into the next stave-space, as usual. When the lower note is on a line, the dot drops to the lower space**"* |
| **B2 double stems** | p. 56: *"LOWER PART ON A LINE — Drop the dot into the space below the lower part… When the voices are close together, this avoids ambiguity as to which part the dot belongs"*; for adjacent notes with both parts dotted, *"the upper dot is usually aligned with the lower dot after both parts (this layout is most compact), although it is acceptable to place each dot closer to each notehead"*; one part dotted, *"each dot is placed next to its notehead… a dot should not be separated from its notehead by the adjacent note"* |
| **B2 a flag in the way** | p. 55: *"**Upstemmed notes with tails**: should the end of a tail coincide with the position of the dot and thereby obscure it, it is acceptable to move the dot to the right of the tail… It is equally acceptable to lengthen the stem"* |
| **B3 DOUBLE dots — the gap** | ⛔ **No number.** p. 54: *"Double and triple dots should be placed **close together and evenly spaced**"* |
| **B3, MEASURED** | ⭐⭐ p. 54's plate, 1 sp = 27.0 px. **Double-dotted chord**: head 1679–1715, dots 1726–1738 and 1746–1758 → head→dot **0.37 sp**, dot→dot **0.26 sp**, dot pitch **0.74 sp**. **Triple-dotted crotchet**: head 2066–2102, dots at 2113, 2133, 2153 → head→dot **0.37 sp**, dot→dot **0.26 / 0.26 sp**, pitch **0.74 sp** uniform. ⭐⭐ **Her two gaps are NOT equal**: the dots crowd closer to each other (0.26) than the first dot does to the head (0.37) |
| **B4 a dot on a REST** | ⭐⭐ p. 38, *Dotted rests*: *"**The dot remains in the same position relative to the rest, regardless of the rest's position on the stave**"* — drawn with crotchet and quaver rests at five different stave positions, the dot's offset identical in all. ⇒ a rest's dot does **not** take the note's lift-into-the-space rule. ⛔ No horizontal number. (Her pp. 57–60 material on dotted rests is about which ones may be *used*, not where the dot goes) |
| **B5 the dot's SIZE** | ⛔ **No absolute number.** p. 54: *"Most traditional engraving uses a duration dot that is **larger than a staccato dot — often twice the size**"* |
| **B5, MEASURED** | Her duration dot is **0.48 sp wide × 0.44–0.48 sp tall** raw at 600 dpi; less the anti-alias bias, ≈**0.41 sp** · 🚨 **2026-09-25: 0.49 sp** threshold-free — the bias does not reproduce (`docs/research/multiple-dots-research.md` §0.6) |

### 2.2 ⭐⭐ ROSS, *The Art of Music Engraving and Processing*

Accidentals: **printed pp. 130–135** (PDF 142–147). Dots: **printed pp. 169–172** (PDF 181–184),
plus dotted rests **p. 179** (PDF 191). ⭐ Ross is the only book in this library that gives a NUMBER
for both subjects, and the only one whose plates carry dimension captions.

#### A. THE ACCIDENTAL

| question | Ross |
|---|---|
| **A1 gap to the notehead** | ⭐⭐ p. 131: *"The spacing of accidentals may vary according to crowded conditions, whether the accidentals are single or multiple, alike or unlike. **If a single accidental precedes a single note it should be spaced approximately one space and a half before the note**"* — with a figure captioned **"1½ spaces"** twice, over a dotted measuring bracket. And: *"**If the accidental is a double flat, the measurement is made with the flat nearest the notehead**"* |
| **A1, MEASURED — ⭐⭐ he drew his own ruler** | 600 dpi, 1 sp = 33.4 px. The dotted bracket's two verticals stand at x 1177.5 and 1228 — **50.5 px = 1.51 sp apart, exactly his number**. The left vertical sits on the **flat's left ink edge** (bowl 1172–1204); the right on the **notehead's left ink edge** (1223–1272). ⇒ ⭐ **his 1½ spaces is LEFT EDGE to LEFT EDGE**, his stated convention throughout the book. The implied INK gap is **0.54 sp** (flat 1204 → head 1223). The double-flat example measures **1.47 sp** from the *second* flat, and **0.97 sp** flat-to-flat inside the sign — exactly as he writes |
| **A2 vertical placement** | ⛔ **UNKNOWN.** Nothing in pp. 130–135 states where an accidental sits vertically relative to its notehead. Checked the whole chapter |
| **A3 chord columns — the ORDER** | p. 131: *"It should be observed that accidentals are arranged in such an order that will permit them to **conserve the most space possible and be interwoven rather than stretched out**"*, with an INCORRECT/CORRECT pair. p. 132: *"**Two-note combinations with intervals less than a seventh will place the higher accidental nearest the note combination with the lower accidental to its left.**"* p. 133 gives six numbered rules for three-note combinations; the two that are not about suspended (displaced) notes are: *"1. If the top and bottom notes are the interval of a seventh or more apart, **their accidentals are vertically aligned near their noteheads**; the remaining accidental goes to the left of the other two"* and *"2. If the top and bottom notes are less than the interval of a seventh apart, then the **highest accidental is nearest to a notehead; the lowest accidental is further left; and the remaining accidental is furthest left**"*. pp. 133–135 extend the pattern to four and five accidentals |
| **A3 — when may two SHARE a column** | ⭐⭐ p. 131: *"**Any interval of a seventh or more, whether in a two, three, or four note combination, has all accidentals perpendicularly aligned.**"* ⇒ Ross's threshold is a flat **SEVENTH**, with no glyph-dependent relaxation |
| **A3 — displaced (he says "suspended") notes** | p. 132: *"Where there are two accidentals in a three-note combination, and when one of those notes is suspended on the right side of the stem… then the accidental for that suspended note is the nearer of the two accidentals"*, and *"The accidental of a suspended note on the left side of the stem is farther away than the accidental of the non-suspended note."* ⚠️ Also p. 134's footnote: *"Whenever possible avoid having a stem separate an accidental from its notehead"* |
| **A4 gap between two columns** | ⭐ p. 131: *"**If accidentals are multiple and alike, the spacing can be the same as in key signatures.**"* — which is his p. 144 table: **flat → flat 1 space, sharp → sharp 1 or 1¼**, origin to origin (already recorded in `reference/README.md`). And: *"**Multiple, unlike accidentals may be drawn closer together than normal, but preferably without touching.**"* |
| **A4, MEASURED** | His p. 131 "multiple and alike" plate, 1 sp = 33.25 px: two adjacent sharp columns measure **1.22 sp** centre to centre — his key-signature number, engraved |
| **A5 accidental vs LEGER LINE** | ⛔ **UNKNOWN.** Searched pp. 130–135 and every "leger line" hit in the book: nothing about shortening a leger line for an accidental, and no leger-line length figure |
| **the double flat as one unit** | p. 135: *"In using the double flat it should be made clear that this character is one unit, that is the two flats are connected and slightly overlap. In plate engraving this is usually one die and not a flat stamped twice… Although the double flat is wider and takes more space, it is added in sequence just as a single flat"* |

#### B. THE AUGMENTATION DOT

| question | Ross |
|---|---|
| **B5 the dot's SIZE — ⭐ the only absolute in any book** | p. 169: *"Mention should be made of the dot's size in relation to the characters for a particular staff size. In former years of engraving, at least two and sometimes three dot sizes were used. The dot for augmenting a note was the normal size. A dot somewhat smaller was used for staccato notes, and a dot somewhat larger for signs and symbols such as a fermata or bass clef. Generally this practice has been discontinued with most plate engravers and the dot has evolved to one size for most purposes. **If it is possible to give a size for a normal dot it would be about one third of a space.** Many dies are cut, however, that give a larger dot to the signs and symbols"* |
| **B5, MEASURED** | His own plates draw the dot **0.41–0.53 sp** wide raw at 600 dpi (≈0.35–0.46 less the bias). ⚠️ His 1970 photo-offset is visibly inky; treat as corroboration that the dot is nearer ⅓–½ than ¼ |
| **B1 gap to the notehead** | ⚠️ p. 169: *"When the dot is used for augmentation it is placed **approximately a space to the right of the note head** unless the note has a flag, in which case it would be placed beyond the tail of the flag."* ⛔ He does not say between which edges |
| **B1, MEASURED — ⚠️ and it does not settle the ambiguity** | p. 169's plate, 1 sp = 33.75 px. Notehead ink → dot ink: **0.39 · 0.33 · 0.53 · 0.53 sp**, and a flagged note **0.83 sp** (his flag exception, drawn). p. 171's plate, 1 sp = 34 px: **0.38 · 0.38 sp**. ⭐ **So his own drawing is ≈0.33–0.53 sp of ink — Gould's half space, not a whole one.** The readings of "a space" his figure could support: head right edge → dot right edge **0.65–0.92 sp**; head centre → dot left edge **1.16–1.19 sp**. The reading his key-signature convention would imply (left edge to left edge) is **1.7–1.9 sp**, which his figure does **not** draw. ⛔ Which he meant is UNKNOWN |
| **B2 the dot on a LINE** | p. 169: *"**The dot is always placed in a space and never on a line. If the note is on the line, the dot is placed in the space above** — this procedure also includes dotted notes on the leger lines."* And among the *DON'TS FOR DOTS*, p. 170–171: *"Don't separate a dot from its note head"* · *"**Don't let a dot touch a staff line**"* · *"Don't place a dot between a notehead and a flag"* · *"Don't place a dot below a flag's tail — if the stem is of normal length"* · *"**DO place the dot after the flag!**"* |
| **B2 the SECONDS case** | p. 169, exception (a): *"**When the interval of a second occurs, it will sometimes be necessary to alter the positions of the dots**"*, with a drawn example. And p. 170: *"**Never place two dots for separate notes in the same space.** Observe the arrangements of the dots in the following clusters"*, INCORRECT/CORRECT, plus *"Notice the vertical alignment of the dots in the cluster to the right"* |
| **B2 two voices on one staff** | ⭐ p. 169, exception (b): *"The following, though not strictly adhered to, is traditionally accepted as correct. **When two voices share the same staff with stems in opposite directions, the dots for the upper voices go in spaces above the note heads, and the dots for the lower voices go in the spaces below the note heads**"* |
| **an obsolete rule, named as obsolete** | p. 170: *"**A practice no longer in use** places the dot after a note on a line in the next space above the line when the following note is on a higher degree of the staff, and below the line when the following note is on a lower degree of the staff"* |
| **B3 DOUBLE dots — the gap** | ⭐⭐ p. 171, read from the scan because the OCR garbles it: *"**Double and triple augmentation dots are placed horizontally as the single dot — vertically ½ space beyond the single dot.**"* ⚠️ The sentence's "horizontally"/"vertically" are the reverse of what the geometry is (the dots run across the page); the **plate is the authority** |
| **B3, MEASURED** | p. 171's plate, 1 sp = 34 px. Double-dotted: head→dot1 **0.38 sp**, dot1→dot2 **0.35 sp**, dot pitch 0.82 sp. Triple-dotted: head→dot1 **0.38 sp**, then **0.44 / 0.53 sp**. ⭐ **His two gaps ARE about equal, and both are about a half space** — which is the reading that makes his sentence mean "each further dot stands ½ space beyond the last" |
| **B4 a dot on a REST** | p. 179, *Dotted rests*: *"**All rests may be dotted exactly as notes are dotted** to increase their temporal length; however, in simple time the half and quarter rest are never dotted… **The dot for the quarter-rest is placed in the same space with the 'breast' of the rest. The dot for the eighth-, sixteenth-, thirty-second-rest, etc. is placed in the same space with the top hook of the rest**"* ⇒ a rest's dot is placed relative to the REST GLYPH, like Gould's p. 38. ⛔ No horizontal number, and no statement that it differs from a note's |

### 2.3 STONE, *Music Notation in the Twentieth Century*

⚠️ **He removes himself from both questions, explicitly.** Printed p. 45, *Spacings, Positions, and
Sizes (Miscellaneous)*: *"**The proper horizontal spacing of notes and accidentals, etc., is too
complex to be included in these rather general guidelines**"* — with the footnote *"For details, see
engravers' manuals such as **The Art of Music Engraving and Processing by Ted Ross**."* ⭐ Stone
hands this whole subject to Ross.

| question | Stone |
|---|---|
| **A1 / A4** | ⛔ **UNKNOWN — and deliberately so** (the sentence above). His only nearby number is a header distance, p. 45: *"between any of the above and the first note or **accidental** or rest… 1½ staff-spaces"* — clef/key/meter to the first element, ⛔ not an accidental-to-notehead gap |
| **A2 vertical** | ⛔ **UNKNOWN.** *Accidentals ▸ A. Size*, printed p. 53, is his only placement remark and it is about size: *"Care should be taken to adapt the size of the accidentals to that of the staff. Disproportionately large or small accidentals seriously impair quick perception (see Spacings, Positions, and Sizes, page 44 ff)."* pp. 53–57 are otherwise entirely about WHICH accidental (cancellation, doubles, clef changes, ties, cautionaries, scores) |
| **A3 chord columns** | ⛔ **UNKNOWN as a column rule.** His one relevant sentence is p. 165, on two voices: *"If accidentals are involved, they are placed in front of the stems, **except in intervals of a second where the position is normal**"* |
| **A5 leger lines** | ⛔ Nothing about shortening for an accidental. p. 30: *"Leger lines must maintain the same vertical spacing as staff-lines"*, and *"If intervals of a second are on leger lines, the line(s) between the second(s) and the staff must be **twice as wide** as ordinary leger lines"* |
| **B1 / B3 / B5** | ⛔ **UNKNOWN.** No gap, no double-dot spacing, no dot size anywhere in the book |
| **B2 the dot on a LINE** | ⭐ **His one contribution, and it is the two-voice rule.** *Dotted Notes*, printed pp. 125–126: *"**A. Dot Positions in Double-Stemmed Two-Part Notation — 1. If an upstemmed note is on a line, the dot should be placed in the space above the line. 2. If a downstemmed note is on a line, the dot should be placed into the space below the line.**"* With the reason, drawn: *"In the first notation, the low dot clearly shows that the lower note is dotted. In the second notation, where the dot appears above the line, it is not clear whether the dot refers to the upper or the lower note"* |
| **B2 dotted unisons** | p. 125: *"**B. Dot Positions in Dotted Unisons** — If the note-values of the two parts are the same, the rule for single-stemmed notes should be followed, namely to use only one dot for both… The rule is not ideal, since obviously it would be clearer if one were to use two dots — one below the line and one above. But since this would only be possible for unisons on a line and not for those in a space, it is not done in either case."* And *C.*: a unison of a dotted and an undotted note takes two noteheads, *"with the undotted note preceding the dotted one"* (p. 30) |
| **B4 dotted rests** | p. 141ff is about which dotted rests may be used in which meter; ⛔ nothing on the dot's position |

### 2.4 GEROU & LUSK, *Essential Dictionary of Music Notation*

Accidentals: **printed pp. 3–9** (PDF 3–6). Augmentation dot: **printed pp. 21–24** (PDF 12–14).
Leger lines: **printed pp. 83–84** (PDF 43). ⚠️ Page offset established for the first time in this
investigation — see the header table.

#### A. THE ACCIDENTAL

| question | Gerou & Lusk |
|---|---|
| **A1 gap / A2 vertical** | ⛔ **UNKNOWN.** Their Accidentals entry (pp. 3–9) is about which accidental, courtesies, octaves, grace notes, chromatic spelling and chord ALIGNMENT. No horizontal distance and no vertical anchor |
| **A3 — when may two SHARE a column** | ⭐⭐ p. 7, *Alignment for intervals (2 notes)*: *"**For intervals of a 2nd through a 6th, place the upper accidental closest to the note, the lower accidental to the left.**"* · *"**When intervals are greater than a 6th, accidentals align vertically.**"* · *"**For the interval of a 6th, if the two accidentals don't collide they may be aligned vertically.**"* ⇒ their threshold is **greater than a sixth**, with the sixth itself conditional |
| **A3 — three notes** | p. 7, *Alignment for chords (3 notes)*: *"**When outer notes are a 6th or less, the upper accidental is closest to the note, the lower accidental is placed left, and the middle accidental is placed farthest left**"* (numbered 1-highest, 2-lowest, 3-middle in the figure) · *"**When outer notes are greater than a 6th, upper and lower accidentals are aligned closest to the notes — the middle accidental is placed to the left.**"* |
| **A3 — more than three** | ⚠️ p. 9, *Alignment for chords (More than 3 Notes)*: *"When dealing with accidentals for complex chords, rules are treated more as guidelines or suggestions. Keep the arrangement of the accidentals as compact as possible."* Then: *"**Align the highest and lowest accidentals whenever possible.** The center accidentals are usually arranged **diagonally from highest to lowest**. Align accidentals for octaves whenever possible. **Accidentals for the 2nd should usually be shaped like the 2nd** (if the outer notes are greater than a 6th). The upper accidental is placed closest to the note, the lower accidental to the left."* ⚠️ *"arranged diagonally from highest to lowest"* is the **descending** order Gould p. 89 draws and labels *"not recommended"* |
| **A3 — a general prohibition** | p. 9: *"**Accidentals are always placed before the entire note structure.** (Do not place an accidental between notes that are played together, even if they are stemmed in opposite direction.)"*, drawn and labelled *wrong* |
| **A4 gap between columns** | ⛔ **UNKNOWN.** No number |
| **A5 leger lines** | ⭐ p. 83–84, *Leger lines*: *"Leger lines are the same line weight as staff lines, or slightly heavier"* · *"**Leger lines extend slightly past the notehead. They will need to extend sufficiently enough to be seen.**"* · *OVERCROWDING*: *"**To avoid leger lines that touch, adjustments must be made either in the horizontal spacing of the music or by shortening the leger line length. The first is preferred, but is not always possible.**"* ⇒ a second book sanctions shortening — but again for neighbouring leger lines, not for an accidental, and with no amount |

#### B. THE AUGMENTATION DOT

| question | Gerou & Lusk |
|---|---|
| **B1 gap to the notehead** | ⛔ **UNKNOWN.** p. 21 says only *"place to the right of the notehead"* |
| **B2 the dot on a LINE** | p. 21, *Placement*: *"**Always place one dot per space and only in a space — never on a staff line or on the same level as a leger line.**"* · *"For a line note — place to the right of the notehead, **in the space above**."* · *"For a space note — place to the right of the notehead **in the same space as the note**."* |
| **B2 a flag in the way** | p. 22: *"For notes with a flag — the dot is placed further right, altogether avoiding the flag. **Never place a dot between the notehead and its flag.**"* |
| **B2 chords** | p. 23: *"For two or more notes in a chord with the same stem direction, **always align the dots vertically**."* · *"**Two dots never share the same space.**"* · p. 22: *"**Never separate a dot from its notehead.** Stem direction and creative positioning of a dotted note must be considered."* · *"Ties always avoid the dot — place the tie clearly to the right of the dot."* |
| **B2 the SECONDS case** | ⭐ p. 23, *For intervals of a second*: *"**The dot for the space note is always placed in the space to the right of the notehead. If the line note is above, place the dot in the space above. If the line note is below, place the dot in the space below.**"* |
| **B2 two or more parts** | p. 23: *"**For stems up, place dots for line notes in the space above. For stems down, place in the space below.**"* (Ross p. 169 and Stone p. 125, third witness) |
| **B3 DOUBLE dots — the gap** | ⭐⭐ p. 22: *"**Double and triple dots are placed directly to the right of the first dot. Horizontal spacing is equal to that of the first dot.** Multiple dots should be used only in situations where they will be easily understood."* ⇒ **the notehead→dot gap and the dot→dot gap are ONE number** — the principle `dotPlacement.ts` calls "standing"; this is the book that states it |
| **B4 a dot on a REST** | p. 23, *Dotted rests*: *"**Rests are dotted in the same way notes are dotted**, but with some restrictions on their use."* Then pp. 23–24 are entirely about which dotted rests may be used |
| **B5 the dot's SIZE** | ⛔ **UNKNOWN** |

### 2.5 ⚠️ The one sentence this repo already cites — and it is not a treatise

`src/engine/rendering/format/ledgerAccidentalClearance.ts` quotes *"An expert engraver will shorten a
ledger line to allow closer spacing with accidentals"* and attributes it to *"LilyPond's engraving
essay"*. **The attribution is exact.** It is `Documentation/en/essay/engraving.itely`, node *Ledger
lines*, lines 368–375 at `~/dev/engine-sources/lilypond` HEAD `beedbfa`:

> *"Ledger lines present a typographical challenge: they make it more difficult to space musical
> symbols close together and they must be clear enough to identify the pitch at a glance. In the
> example below, we see that ledger lines should be thicker than normal staff lines and that **an
> expert engraver will shorten a ledger line to allow closer spacing with accidentals**. We have
> included this feature in LilyPond's engraving."*

⚠️ Its evidence is a side-by-side image pair — `baer-ledger` (a **Bärenreiter** plate) against
`lily-ledger` — and it **cites no book and gives no amount**. ⛔ It is an engine's essay, and the
only source in this investigation that names the accidental case at all.

---

## 3. Unanimity and disagreement

| row | Gould | Ross | Stone | Gerou & Lusk | verdict |
|---|---|---|---|---|---|
| **A1** accidental → notehead gap | no number; *"as close as possible"*; **drawn 0.19–0.38 sp ink** | **1½ sp, left edge to left edge** (drawn 1.51); **0.54 sp ink** | ⛔ defers to Ross | ⛔ silent | ⚠️ **one number only, and it is Ross's.** The two drawings disagree by ≈2× in ink |
| **A2** vertical anchor | ⭐ *"central portion… must precisely fill a stave-space, or be centred on a line"* | ⛔ silent | ⛔ silent | ⛔ silent | **one source, uncontradicted** |
| **A3** order, close-position chord | highest, lowest, alternating inwards | highest, lowest, remaining | ⛔ silent | highest, lowest, middle (3 notes) | ✅ **UNANIMOUS** among the three that speak |
| **A3** outer notes far apart | *"align the accidentals for the outer notes closest to the chord"* (7th+) | *"top and bottom… seventh or more… vertically aligned near their noteheads"* | ⛔ silent | *"upper and lower accidentals are aligned closest to the notes"* (>6th) | ✅ **UNANIMOUS** |
| **A3** order, 4+ notes, centres | keep alternating; descending order *"not recommended"* | extends the alternation | ⛔ silent | ⚠️ *"the center accidentals are usually arranged **diagonally** from highest to lowest"* | 🚨 **REAL DISAGREEMENT.** G&L recommend what Gould rejects |
| **A3** threshold to share a column | **octave**, with 7th and 6th conditional on the glyph (*"when the upper note is a flat"*) | **a seventh**, flat | ⛔ silent | **greater than a 6th**, the 6th conditional | 🚨 **THREE DIFFERENT THRESHOLDS** — octave / 7th / 6th |
| **A4** gap between columns | no number; minimum is *"the edges of their crossbars align vertically"* — **drawn abutting, 0.98 sp pitch, no air** | *"the same as in key signatures"* ⇒ **1 sp (flats) / 1–1¼ (sharps)** origin to origin; drawn **1.22** | ⛔ silent | ⛔ silent | ✅ **COMPATIBLE**: both land on ≈1 sp of pitch for a normal case, i.e. ≈0 of ink between neighbouring signs |
| **A5** shorten a ledger line for an accidental | ⛔ not discussed; shortening allowed *"in cramped conditions"*, no amount | ⛔ nothing | ⛔ nothing | ⛔ shortening allowed, but for touching leger lines, and only as second choice | ⛔ **NOBODY.** Only LilyPond's essay (§2.5), and it gives no amount |
| **B1** notehead → dot gap | ⭐ **half a stave-space**; drawn **0.37–0.44** | *"approximately a space"*; drawn **0.33–0.53** | ⛔ silent | ⛔ silent | ⚠️ **THE WORDS DISAGREE (½ vs 1), THE DRAWINGS AGREE (≈0.4 sp).** ⭐ Ross's plate engraves Gould's sentence |
| **B2** head on a line → dot in the space above | ✅ | ✅ | ✅ (as the stems-up case) | ✅ | ✅ **UNANIMOUS** |
| **B2** head in a space → dot in that space | ✅ *"in the middle of that space"* | ✅ (implied by *"always in a space"*) | — | ✅ | ✅ **UNANIMOUS** |
| **B2** two dots may not share a space | ✅ *"Each dot should always have a stave-space to itself"* | ✅ *"Never place two dots for separate notes in the same space"* | — | ✅ *"Two dots never share the same space"* | ✅ **UNANIMOUS** |
| **B2** the SECONDS case | upper on a line → up; lower on a line → **down** | *"it will sometimes be necessary to alter the positions"* + a drawing | — | space note keeps its space; line note goes **away** from it | ✅ **UNANIMOUS in substance** (G&L and Gould state the same rule; Ross draws it) |
| **B2** two voices: stems-up above, stems-down below | ⭐ p. 56, for the lower part on a line: *"drop the dot into the space below"* | ✅ explicitly | ✅ explicitly | ✅ explicitly | ✅ **UNANIMOUS** — and it is a STEM rule, not a position rule |
| **B2** a flag in the way | move the dot right of the tail, *or* lengthen the stem | *"DO place the dot after the flag!"* | ⛔ silent | *"placed further right, altogether avoiding the flag"* | ✅ **UNANIMOUS** |
| **B3** double-dot gap | no number; *"close together and evenly spaced"*; **drawn 0.26 sp, i.e. TIGHTER than its own head→dot 0.37** | **½ space beyond the single dot**; drawn 0.35–0.53, **equal to its head→dot 0.38** | ⛔ silent | ⭐ **equal to the first dot's spacing** | 🚨 **DISAGREEMENT, and it is Gould's own PLATE against the other two.** Ross + G&L: the two gaps are equal. Gould draws them unequal |
| **B4** a rest's dot | ⭐ *"remains in the same position relative to the rest"* | placed against the rest's breast/top hook; *"dotted exactly as notes are dotted"* | ⛔ silent | *"dotted in the same way notes are"* | ✅ **COMPATIBLE**: the dot is glyph-relative, so a rest never takes the note's lift. ⛔ **No book gives a rest a different horizontal gap** |
| **B5** dot diameter | no absolute; *"often twice"* a staccato dot; **drawn 0.48 raw ≈0.41** | **about one third of a space**; drawn 0.41–0.53 raw | ⛔ silent | ⛔ silent | ⚠️ **Ross's stated ⅓ is smaller than either book's drawing** |

---

## 4. What WE draw today, against the books

Read from `src/engine/rendering/format/dotPlacement.ts`, `src/engine/engrave/notes/augmentationDot.ts`,
`src/engine/engrave/notes/accidental.ts`, `src/engine/rendering/format/ledgerAccidentalClearance.ts`,
`src/engine/rendering/format/chordAccidentalColumns.ts`, and the VexFlow that still owns the placement
(`Accidental.format`, `Accidental.checkCollision`, `Dot.format`, `Tables.accidentalColumns`).
⚠️ Since ported exactly — `engrave/notes/accidentalStack` + `dotStack` (§1) — and VexFlow is removed
(2026-09-19): where the table says *VexFlow*, read *VexFlow's rule, transcribed into ours*.
One staff space is **10 px** (`STAFF_SPACE_PX`).

| row | what we draw | where it comes from | the books | verdict |
|---|---|---|---|---|
| **A1** accidental → notehead | **0.3 sp** of ink (`VEXFLOW_ACCIDENTAL_STANDOFF` — renamed `ACCIDENTAL_STANDOFF_PX` at S1b, 2026-09-14 — = `Accidental.noteheadAccidentalPadding` 1 px + `getModifierStartXY`'s literal 2 px) | VexFlow; we only re-read it | Gould's plate **0.19–0.38 sp**; Ross's stated 1½ sp ⇒ **0.54 sp** of ink | ⚖️ **MATCHES Gould's drawing; ≈0.24 sp tighter than Ross** |
| **A2** vertical anchor | the note's own line/space — `accidental.y` = the notehead's y, unchanged | `EngravedAccidental`, from `getModifierStartXY` | Gould p. 78 | ✅ **MATCHES** (the one source) |
| **A3** column ORDER, close position | highest → col 1, lowest → col 2, then alternating (`accidentalColumns[4].a = [1,3,4,2]`) | VexFlow's table | Gould p. 89, Ross p. 133, G&L p. 7 | ✅ **MATCHES, unanimously** |
| **A3** outer notes ≥ a 7th | both outer signs in col 1 (`[1,2,1]`, `[1,2,3,1]`) | VexFlow's table, via `checkCollision` | Gould p. 89, Ross rule 1, G&L p. 7 | ✅ **MATCHES, unanimously** |
| **A3** threshold to share a column | **3.0 lines (a 7th)**, relaxed to **2.5 (a 6th)** when the upper sign is a **flat** or a double sharp (`Accidental.checkCollision`) | VexFlow | Gould p. 88 says exactly this (octave/7th align; a 6th aligns *"when the upper note is a flat"*); Ross says a flat 7th; G&L say >6th | ✅ **MATCHES Gould almost verbatim** — VexFlow is engraving *Behind Bars* p. 88 |
| **A3** …but our OWN packer | `chordAccidentalColumns.MIN_SHARED_COLUMN_LINES = 2.5` for **every** glyph | ours (fanned-beam members only — a `StaveNote` never reaches it) | Gould p. 88 allows 2.5 **only** when the upper sign is a flat; with an upper sharp or natural she draws the lower sign offset by a full 0.98 sp | ❌ **DIFFERS** at the sixth, for sharps and naturals |
| **A4** gap between columns | **0.3 sp** of ink (`Accidental.accidentalSpacing` = 3 px) ⇒ a pitch of ≈1.3 sp for 1-sp glyphs | VexFlow | Gould's drawn **minimum** is a pitch of 0.98 sp with **no** ink between; Ross's key-signature spacing is a pitch of 1–1¼ sp | ⚠️ **WIDER than either book's number**, though Gould gives no normal-case figure — only *"evenly spaced, but not too far apart"* |
| **A5** ledger vs accidental | ledger overhang trimmed **3 px → 2 px** on a note that has a sign beside a ledger; the signs then move out by `overhang + 2 px − standoff` = **1 px**, opening `LEDGER_ACCIDENTAL_GAP` = **0.2 sp** of air. `ACCIDENTAL_REACH_LINES` = 1.4 decides "beside" | ours | ⛔ **No book names the case.** LilyPond's essay does, with no amount (§2.5). Gould p. 26 sanctions shortening *"in cramped conditions"*; G&L p. 84 sanctions it as the second choice after respacing | ⛔ **UNKNOWN** — the direction is sourced, every number is ours |
| **A5** our ledger overhang | 3 px = **0.3 sp** per side (`StaveNote.LEDGER_LINE_OFFSET`) | VexFlow | Gould p. 26: the ledger is *"just over two spaces long"* and *"extends slightly beyond either side of the notehead"* — ⛔ she gives no per-side overhang | ⛔ **UNKNOWN** (a 2-sp line around a ≈1.3 sp head implies ≈0.35 sp a side, but that is arithmetic, not her sentence) |
| **B1** notehead → dot | **0.5 sp**, edge to edge (`DOT_GAP_SPACES`) | ours — `dotPlacement`, in answer to his report | Gould p. 54 states **half a stave-space**, drawn 0.37–0.44; Ross's plate 0.33–0.53 | ✅ **MATCHES Gould's sentence**; ≈0.1 sp wider than either plate |
| **B1** a stem-up flagged note | left at VexFlow's flag-clearing shift (≈0.7 sp) — `dotShift` only ever opens a gap | ours, deliberately | *"DO place the dot after the flag"* (Ross p. 171), G&L p. 22, Gould p. 55 | ✅ **MATCHES** |
| **B2** head on a line | lifted **+0.5 sp** into the space above; flipped **down** when the note above is a second away or the space above is taken (`Dot.format`'s `halfShiftY` / `prevDottedSpace`) | VexFlow, applied by `dotBaselineY` | Gould pp. 54–55, Ross p. 169, G&L pp. 21/23 | ✅ **MATCHES, unanimously — including the SECONDS case** |
| **B2** two dots in one space | impossible (`prevDottedSpace` forces the second down) | VexFlow | unanimous prohibition | ✅ **MATCHES** |
| **B2** two voices, stems up/down | ❌ **not implemented.** `Dot.format` decides from the note's LINE and its neighbours only; the stem direction is never read | VexFlow | ⭐ unanimous in three books (Ross p. 169 exception b, Stone p. 125 A, G&L p. 23) that the rule is a STEM rule | ❌ **DIFFERS from all three** |
| **B2** chord dots aligned past the whole chord | yes — `maxShiftMap[noteId]` takes the note's widest first-dot x | VexFlow | Gould p. 55 *"Vertically align the dots after the chord"*, G&L p. 23 | ✅ **MATCHES** |
| **B3** dot → dot | **0.5 sp**, the same number as B1 (`DOT_RESERVATION_PX` widens `Dot.format`'s 1 px step) | ours | ⭐ Ross p. 171 (*"½ space beyond the single dot"*, drawn 0.35–0.53) and G&L p. 22 (*"spacing is equal to that of the first dot"*) both support it. 🚨 Gould draws **0.26 sp** | ⚖️ **MATCHES Ross + G&L; differs from Gould's plate by ≈2×** |
| **B3** 🚨 **the CITATION in `dotPlacement.ts`** | the header says *"**Gould** gives half a space between the dots of a double-dotted note (measured from the dot's EDGE, not its centre), and the standing engraving principle is that the notehead-to-first-dot distance equals the dot-to-dot distance"* | — | ⛔ **Gould gives no dot-to-dot number at all** — her half space is the **notehead→dot** distance (p. 54), and her own plate draws the dot→dot gap at **0.26 sp**, i.e. *not* half a space and *not* equal to the first gap. ⭐ The ½-space-between-dots figure is **ROSS p. 171**; the equal-gaps principle is **GEROU & LUSK p. 22** | ❌ **MISATTRIBUTED.** The number is right and it has two sources — neither of them the one named |
| **B4** a rest's dot | left entirely to VexFlow: `placeDots` skips rests, `reserveDotRoom` does not, and `Dot.format` excludes rests from the space-lift so a rest's dot keeps the offset it was given | ours, deliberately | Gould p. 38 (*"the dot remains in the same position relative to the rest"*) and Ross p. 179 (breast / top hook) agree the position is glyph-relative | ✅ **MATCHES on the vertical.** ⛔ On the horizontal the module's stated reason — *"the convention gives it a smaller distance than a note's (MuseScore keeps `dotRestDistance` below `dotNoteDistance`)"* — cites an **engine**, and ⛔ **no book says a rest's dot stands closer** (see §6) |
| **B5** the dot's size | the font's `augmentationDot` glyph, unscaled — **0.40 × 0.40 sp** in Bravura | SMuFL | Gould's plate ≈**0.41 sp**; Ross states **⅓ sp**, draws 0.41–0.53 raw | ✅ **MATCHES Gould's drawing**; ⚠️ larger than Ross's stated ⅓ |

---

## 5. ⏳ THE DECISION TABLE — every row still open, as a question

⛔ No recommendation is attached to any of these, and none of them is a task.

> ✅ **2026-09-14 — D1 and D8 ARE NOW KNOBS** (his call: *"put the dot gap and the accidental gap on
> console knobs… and settle them by eye"*). The rows of this survey are live tables:
> **`engine/layout/accidentalGap`** (`__accidentals.gap(…)` — house 0.30 · musescore 0.25 ·
> lilypond 0.35 · ross 0.54) and **`engine/layout/dotGap`** (`__dots.gap(…)` — eight rows, both
> columns). ⛔ **Neither changed what is drawn**: the armed row in each is the number already on the
> page, so the tables moved no ink and no width. ⭐ What they changed is that the ROOM and the INK now
> read one number in each case, so no row can move one without the other.
>
> ⏭️ **D2 is the open one his eye asked about** — *"is the default position of accidental we are
> doing now following gould?"*, same day. The honest answer is **half**: our 0.30 sits inside her
> drawn range for sharps and naturals and is ≈0.1 sp too loose for FLATS, which she draws at
> 0.19–0.23. A per-SIGN column is the shape that would answer it; nobody has asked for one yet.
>
> ⚠️ **And one claim in §4 was misread on the way to the knob**: the row noting `INK.accidentalToHead`
> = 0.10 against a drawn 0.30 was taken as a two-sources mismatch. ⛔ It is not — the 0.30 of white is
> already inside the measured `ACCIDENTAL_WIDTH` (a sharp's column is 1.30 against ≈0.99 of glyph)
> and the 0.10 is a separate residue of the same measurement. ⭐ Eight spacing specs said so within a
> minute of "closing" it.

| # | the question | what makes it a question |
|---|---|---|
| **D1** | **Should the accidental's standoff from its notehead become ours, and at what number?** | Today it is VexFlow's 0.3 sp of ink, arrived at as 1 px of metric plus a 2 px literal (⚠️ 2026-09-19: the CODE is ours since the removal — the number is not yet chosen). Gould's plate draws 0.19–0.38 sp; Ross states 1½ sp left-to-left, which is 0.54 sp of ink. Nobody has chosen between them |
| **D2** | **Does a FLAT stand closer than a sharp or a natural?** | Gould draws it that way consistently (0.19–0.23 vs 0.30–0.38 sp across eleven pairs) and says nothing about it. We draw one number for every glyph |
| **D3** | **What is the gap between two accidental COLUMNS?** | Ours is 0.3 sp of ink. Gould's *drawn minimum* is zero ink (crossbar edges abutting, 0.98 sp of pitch) and Ross's key-signature figure is 1–1¼ sp of pitch. Both are tighter than what we draw, and neither states a normal-case value |
| **D4** | **Which threshold should let two accidentals share a column — the octave, the seventh, or the sixth?** | Gould, Ross and Gerou & Lusk each name a different one. VexFlow already does Gould's (7th, relaxed to a 6th under a flat). ⭐ Our own `chordAccidentalColumns` does a flat 6th for every glyph and is the one place where we, not VexFlow, decided |
| **D5** | **For chords of four or more, do the middle accidentals keep alternating (Gould, Ross) or run diagonally (Gerou & Lusk)?** | Gould draws the diagonal and labels it *"not recommended"*; G&L recommend it. We follow Gould today, by way of VexFlow's table |
| **D6** | **Is the ledger-line trim beside an accidental ours to keep, and how much?** | The direction has one source and it is an engine's essay with no number. Every number in `ledgerAccidentalClearance` (trim 3 px → 2 px, 0.2 sp of air, a 1.4-line reach) is ours and unsourced. ⭐ P3a made the ledger lines ours to draw, so the asymmetric trim LilyPond does — shorten the left, keep the right — is now possible and is not taken |
| **D7** | **Is the notehead → dot gap half a stave-space, or the ≈0.4 sp both books actually draw?** | We draw Gould's sentence. Both plates draw about 0.1 sp less |
| **D8** | **Is the dot → dot gap the SAME number as the notehead → dot gap?** | Ross and Gerou & Lusk say yes; Gould's plate draws the second gap at 0.26 sp against 0.37 for the first, and says only *"close together and evenly spaced"*. We draw one number for both |
| **D9** | **Should `dotPlacement.ts`'s Gould citation be corrected to Ross p. 171 + Gerou & Lusk p. 22?** | The number survives; the name on it does not (§4, row B3). ⛔ Not a code question — a question about what the file claims |
| **D10** | **Should a dotted note in double-stemmed writing take the STEM rule?** | Three books state it (up-stem → the space above, down-stem → the space below) and one of them, Stone, draws the ambiguity it exists to remove. `Dot.format` decides from line position alone and never reads the stem |
| **D11** | **Does a rest's dot get its own horizontal distance?** | No treatise gives one. The claim that it is smaller comes from an engine's style default, and `dotPlacement.ts` says so |
| **D12** | **Is the augmentation dot's diameter ours, or the font's?** | We take Bravura's 0.40 sp. Gould's plate agrees; Ross states ⅓ sp; Gould's only *rule* is relative — *"often twice"* the staccato dot — which is a claim about the pair, not the dot |
| **D13** | **Does the accidental's vertical anchor need saying at all?** | Gould p. 78 is the only source, and what we draw already agrees with it. The question is whether a rule with one witness and no disagreement should be written down as ours |

---

## 6. The engines

✅ **Written, and it is its own document: `docs/research/accidental-dot-engines.md`** (LilyPond `beedbfa075`,
MuseScore `929d1e99d7`, Verovio `efff0bc992`, VexFlow 5.0.0 — file:line throughout).

⭐ The three findings that bear hardest on §4 and §5 of this one:

- **The notehead→dot / dot→dot pair splits four ways**: LilyPond 0.45/0.45 · MuseScore 0.50/0.25 ·
  Verovio 0.30/0.35 · VexFlow 0.20/0.10. ⇒ our 0.50/0.50 matches MuseScore's first gap and no one's
  second, and *"the two gaps are equal"* is **LilyPond's practice alone** — which is also what
  Gould's own plate denies (§2: she draws 0.37 then 0.26).
- **An accidental's gap is a number PLUS an ink model**: MuseScore's and Verovio's 0.25 are measured
  on SMuFL cut-out sub-rectangles, LilyPond's 0.35 on skylines in a shared vertical band, VexFlow's
  0.3 on plain bounding boxes. ⛔ Lifting 0.25 into a bbox renderer does not give MuseScore's gap.
- **Ledger shortening is 1-vs-3**: only LilyPond does it, gated on a per-glyph vertical band stored
  in the font — and **MuseScore wrote the same feature and commented it out**. ⇒ the ⛔ UNKNOWN this
  document reports for the books is matched by near-silence in the engines.
