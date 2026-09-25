# Double and triple dots — and the single dot, re-checked: the research

> **2026-09-25.** Three agents (and a fourth for Part D, the collision algorithms), for `docs/plans/multiple-dots-plan.md`: **Part A** the DURATION rule (a web
> check) · **Part B** the LITERATURE (Gould, Ross, Stone, Gerou & Lusk on disk — read on 450-dpi scans, the
> plates MEASURED; SMuFL and the fonts' metadata) · **Part C** the ENGINES (Verovio, MuseScore, LilyPond —
> source READ, not rendered: none is installed). §0 is the synthesis. The parts are the agents' reports,
> kept as written.
>
> ⛔ Unreached, so **UNKNOWN** rather than silent: Gardner Read (borrow-only on archive.org, search-inside
> refused), Powell, Vinci, Heussenstamm, Chlapik, MOLA.
>
> Earlier research this re-checks: `docs/research/accidental-dot-research.md` (the books, 2026-09-14),
> `docs/research/accidental-dot-engines.md` (the engines), `docs/research/dot-placement.md` (the first note).
> The rows it feeds: `src/engine/layout/dotGap.ts`.

---

## 0. Synthesis

All numbers in staff spaces, ink edge to ink edge.

### 0.1 What is settled

- **The value:** n dots = d × (2 − 1/2ⁿ) — every source, every engine (exact rationals in all three). No
  modern standard differs. MusicXML: one `<dot/>` per dot, no cap; MEI `@dots` 0–4; MuseScore caps 4;
  LilyPond none.
- **The 3rd dot steps exactly like the 2nd**, and **every dot of a note sits at the first dot's height** —
  every plate, every engine.
- **A chord's dots stand in ONE column**, a grid for 2–3 dots (Gould p. 54's plate: three rows of two).
- **Line note → the space above**, ledger lines too (Gould pp. 54–55, Ross p. 169, G&L p. 21); a second puts
  the lower line note's dot in the space below (Gould p. 55, G&L p. 23).
- **Two voices: the space follows the stem** — down-stem → below. Four books and all three engines.

### 0.2 The numbers

| | head → dot | dot → dot | reach, 3 dots |
|---|---|---|---|
| ours (`house`) | 0.5 | 0.5 | 2.70 |
| Gould, stated (p. 54) | 0.5 | *"close together and evenly spaced"* | — |
| Gould, drawn (p. 54) | **0.37** | **0.26** | ≈2.1 |
| Ross, stated (p. 171) | *"approximately a space"* (edges unknown) | *"½ space beyond the single dot"* | — |
| Ross, drawn (p. 171) | 0.39 | 0.35 (double); 0.43 / 0.51 (triple, uneven) | — |
| Gerou & Lusk, stated (p. 22) | — | *"equal to that of the first dot"* | — |
| Gerou & Lusk, drawn (p. 22) | 0.39 / 0.42 | 0.39 (double); 0.34 / 0.34 (triple) | — |
| LilyPond | 0.45 | 0.45 | 2.70 |
| MuseScore | 0.5 | 0.25 | 2.20 |
| Verovio | 0.3 | 0.35 | 2.20 |

⇒ **No treatise states a number for the dot→dot gap.** Every PLATE draws both gaps below our 0.5, and our
dot→dot is the widest of every source. Only LilyPond's shape (equal gaps) matches ours; ours is a touch wider.

### 0.3 Where OUR drawing departs (each a decision in the plan, ⛔ not a silent change)

1. **The two gaps** — see 0.2.
2. **Two voices** — no voice rule in `engrave/notes/dotStack` (VexFlow's `Dot.format`): a down-stem line
   note's dot still goes up; two voices' dots are not forced to one x. Four books + three engines disagree
   with us. (From the code, not a browser.)
3. **Dotted RESTS** — `NoteBuilder` never reserves rest dot room and `rendering/format/dotPlacement` skips rests,
   so a rest keeps VexFlow's **0.2 / 0.1**. Gould's plates (pp. 38, 162, measured) give a rest the NOTE's
   spacing (≈0.4 / 0.25), all three engines do too, and the MuseScore setting that justified the exclusion
   (`dotRestDistance`) is read nowhere in MuseScore 4. With a double dot the 0.1 would show.
4. **The flag** — ours pushes every stem-up flagged note's dots past the flag (`layout/noteDotXs`,
   VexFlow's); the engines push only when the dot is LEVEL with the flag. The books: move the dot past the
   flag *"should the end of a tail coincide with the position of the dot"* (Gould p. 55) — or lengthen the stem.
5. **A chord's far dots** — Gould p. 56: centre the dots on the chord, drop any ≥ 2 spaces away. Probably not
   done.
6. **The dot's size** — Bravura 0.40; Gould draws 0.49 and asks *"often twice"* a staccato (Bravura: 1.2×);
   Ross states ⅓; G&L draws ≈0.3. The books disagree — a font question.
7. **Dot and tie** — the books split: Gould p. 63 the dot INSIDE the tie; G&L p. 22 the tie after the dot;
   Ross p. 139 either. ✅ Checked 2026-09-25 (P3, P4g): ours IS Gould's — the tie springs inside the head and
   clears the dot (a stem-down D5 by ≈0.31 sp). ⚠️ G&L's white after the dot is UNKNOWN: both their figures
   (pp. 22 and 144, *"Begin the tie to the right of an augmentation dot"*) draw NO dot — only two tied whole
   notes and an arrow; the tie starts ≈0.9 head-heights past the head.

### 0.4 Rests with two or three dots (Gould p. 162)

*"Double-dotted rests: these may replace two or more rests within a beat"*; *"use the double dotting only at
the beginning of a beat"*; and *"the longest permitted dotted rest is one value smaller than the beat"*.
Every double-dotted rest she draws is an 8th rest in 2/4. ⛔ The web's *"in 2/2, r4.. allowed but r8. r4
clearer"* is **not in the book**. Ross, Stone, G&L: nothing on double-dotted rests (UNKNOWN).

### 0.5 Usage

G&L p. 22: *"Multiple dots should be used only in situations where they will be easily understood."* Ross
p. 171 marks `h.. 8` INCORRECT against `h.` tied to `8` + `8`. Triple dots: *"very uncommon"* — Wikipedia
only; no treatise sentence (Wagner, Bruckner brass).

### 0.7 A chord whose dots COLLIDE — the engines' algorithms (Part D, 2026-09-25)

Read from source for P4e; ✅ PORTED the same day as `layout/chordDots` rows `lilypond` + `musescore`
(`lilypondChordSpaces`, `musescoreChordSpaces`), pinned to the examples below — ⚠️ which come from the same
pseudocode, so the pin proves the TS matches the transcription, ⛔ not a running engine. ⚠️ The worked examples come from Python TRANSCRIPTIONS of the cited code, ⛔ not a running
engine.

| chord | Gould pp. 55–56 | LilyPond | MuseScore | ours (`gould`, P4e) |
|---|---|---|---|---|
| F4 G4 A4 B4 | 0.5 / 1.5 / 2.5 / 3.5 (her figure) | same | 1.5 1.5 2.5 3.5 — a COLLISION | 3.5 / 2.5 / 1.5 / 0.5 |
| C5 D5 E5 F5 | 2.5 … 5.5 (her rule) | same | 3.5 3.5 4.5 5.5 — a collision | 5.5 / 4.5 / 3.5 / 2.5 |
| E4 … E5 (8 heads) | the spaces it covers (her rule) | 6 dots, 0.5 … 5.5 (`chord-dots-limit` 3) | 8 dots in 5 spaces | 4 dots, 1.5 … 4.5 |

- **LilyPond** agrees with Gould on every cluster's SHAPE (a cost-minimising chain shift, up-biased), and trims
  tall clusters by `chord-dots-limit` (3 ⇒ one space beyond the chord each end; 1 would be nearer Gould).
- **MuseScore 4** (as transcribed) lets two dots share a space whenever a line note has a second on BOTH sides —
  the collision our `vexflow` row draws too — and never drops a dot.
- ⚠️ Gould's own tall-cluster figure (p. 56) is a chord from the bottom line to ABOVE the top line with FIVE
  dots — the five spaces it covers; E4–E5 above is her RULE applied, ⛔ not her drawing.

### 0.6 Corrections to earlier docs

- `accidental-dot-research.md`: the "+0.07 sp anti-alias bias" does not reproduce with a threshold-free
  measurement — Gould's raw 0.37 / 0.26 ARE the gaps; her dot is **0.49**, not ≈0.41 (so Bravura does not
  "match her drawing").
- `dot-placement.md`: credits the equal gaps to Gould and MuseScore (neither), and cites MuseScore's
  `dotRestDistance` for rests (dead code in 4.x).
- `accidental-dot-engines.md`: MuseScore's `Rest::getDotline` is at `dom/rest.cpp:343-366`, not `:2060-2083`.

---

## Part A — the duration rule (web)

| Rule | Confirmed? | Source |
|---|---|---|
| n dots = d x (2 - 1/2^n): 1 dot x3/2, 2 dots x7/4, 3 dots x15/8 | YES | Wikipedia "Dotted note" https://en.wikipedia.org/wiki/Dotted_note : "If the base note is 1, then the xth dot adds 1/2^x the length (1/2, 1/4, 1/8, ...)". Scoring Notes https://www.scoringnotes.com/of-note/deconstructing-the-rhythm-dot-the-mathematics-of-dotted-notes/ : "Double = 1 + 1/2 + 1/4 = 1 3/4 = 7/4; Triple = ... = 1 7/8 = 15/8" |
| No modern standard defines it differently | YES (none found) | Only historical exception is Wikipedia's: "Double dots were not used until the mid-18th century, before which a single dot could sometimes mean a double dot"; French-overture "over-dotting" is a PERFORMANCE practice, not a notation value. |
| Leopold Mozart introduced the double dot c.1769 | NOT CONFIRMED online | The Violinschule (1756; 2nd ed. 1769/70) is often credited with ADVOCATING it, but no page found gives a quote + date for "introduced". Treat as UNKNOWN; Wikipedia says only "mid-18th century". |
| Dotted rests use the same value rule | YES | Wikipedia: "Rests of any value can be dotted"; usual in compound meters, "occasionally" in simple. |
| Double-dotted rests discouraged / limited | PARTLY (second-hand) | Search summary of a CPDL forum thread (https://forums.cpdl.org/phpBB3/viewtopic.php?t=6777, page 403 for me) quotes Gould, Behind Bars pp. 160-164: "the longest permitted dotted rest is one value smaller than the beat"; double-dotted rests "may replace two or more rests" WITHIN a beat, but clarity first (r4.. is OK in 2/2, but r8. r4 is clearer). Also https://ultimatemusictheory.com/simple-time-rests-no-dotted-rests/ (pedagogy: no dotted rests in simple time). Not verified against the book itself. |
| Quadruple dots exist; limit | YES, rare | Wikipedia: quadruple-dotted notes "extremely rare", worth 1 15/16. Triple dots: "found in the music of Richard Wagner and Anton Bruckner, especially in brass parts" (no Verdi example on the page). |
| MusicXML: any number of dots | YES | https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/dot/ : "One <dot> element is used for each dot of prolongation." (no cap) |
| MEI @dots | YES, capped at 4 | https://music-encoding.org/guidelines/v5/attribute-classes/att.augmentDots.html : "Records the number of augmentation dots required by a written dotted duration"; data.AUGMENTDOT = integer 0..4 (maxInclusive 4). |
| Dotted note in a tuplet = dotted value x ratio | YES (by convention; no clear spec quote) | Search summary: "Dots lengthen the written note before the tuplet ratio is applied". MusicXML <time-modification> has <normal-dot> for dotted normal-note types; the page gives no explicit sentence. Multiplication commutes, so the order does not change the value. |

Surprising: MEI caps dots at 4, MusicXML sets no cap. And the "Leopold Mozart 1769" claim could not be sourced online. Wikipedia says only that the double dot was not used before the mid-18th century.

---

## Part B — the literature

Compiled 2026-09-25. Read-only research; no repo file was edited.

### Sources and how they were read

| source | reached? | how |
|---|---|---|
| Gould, *Behind Bars* (on disk) | YES | OCR grep to locate, then pages rendered at 450 dpi and READ/MEASURED: printed pp. 38, 39, 54, 55, 63, 64 (text), 160–164 (PDF = printed + 20) |
| Ross, *Art of Music Engraving* (on disk) | YES | OCR + render of printed pp. 169–171 (PDF = printed + 12), measured p. 171; p. 139 and p. 179 from the text layer |
| Stone, *Music Notation in the 20th Century* (on disk, 2-up) | YES | printed pp. 78–79 (PDF 50), 124–127 (PDF 73–74) rendered; p. 134–135 text layer |
| Gerou & Lusk, *Essential Dictionary* (on disk, 2-up) | YES | printed pp. 21–24 (PDF 12–13), p. 22 plate measured at 450 dpi |
| SMuFL spec (`smufl.formats.music/latest/…`) | YES | `engravingdefaults.html` and `tables/individual-notes.html` fetched |
| Bravura / Leipzig / Sebastian metadata (`scripts/vendor/*.json`) | YES | `glyphBBoxes.augmentationDot` |
| Gardner Read, *Music Notation* (archive.org `musicnotationman00read`, `…0000read`, `…0000read_x8u5`) | NO: lending-only. Search-inside returns "Item not available" | — |
| Powell, *Music Engraving Today*; Vinci; Heussenstamm; Chlapik; MOLA | NO: not found on archive.org, and no quotable text found on the web | — |
| Wikipedia, *Dotted note* | YES (tertiary) | only usage and rarity statements; no engraving rule |

**How the measurements were made.** 450 dpi render, then the five staff lines found from per-row ink counts (Gould p. 54: 1 sp = 20.12 px; p. 38: 20.0 px; Ross p. 171: 25.4–25.5 px; G&L p. 22: 38.0 px), then column ink runs at threshold 128. Two measurements do not depend on the threshold: the **centre-to-centre pitch** of dots (from darkness-weighted centroids) and the **dot diameter** (from the darkness integral, `d = √(4A/π)`). The notehead edge is sub-pixel interpolated at the 128 crossing. White gaps are then `pitch − diameter` (dot→dot) and `dot centre − r − head edge` (head→dot).

⚠️ **Result for the method (it affects older notes):** measured this way, Gould's gaps come out **equal to the raw threshold figures** in `docs/research/accidental-dot-research.md` (0.37 / 0.26). The "+0.07 sp anti-alias bias" that document adds to gaps does not show up. Its "≈0.41 sp after bias" dot diameter also does not: the darkness-integral diameter is **0.49 sp**.

---

### A. Single dot, horizontal

| rule | value (sp) | source (book, printed page, quote) | agrees with our code/doc? |
|---|---|---|---|
| head → dot gap, stated | 0.5 edge to edge | Gould p. 54: *"Place the dot close to its notehead so that it can be spotted immediately – usually a half stave-space's distance."* | yes (`dotGap.ts` `house` head 0.5) |
| head → dot gap, drawn (Gould) | **0.37** (0.368 triple-dot crotchet, 0.375 double-dot chord, AA-free) | Gould p. 54 plate, re-measured today at 450 dpi | ~0.13 below our 0.5; matches `gouldDrawn`'s 0.4 (rounded). Prior doc said 0.37: confirmed |
| head → dot gap, stated (Ross) | "approximately a space"; which edges he measures from is UNKNOWN | Ross p. 169: *"When the dot is used for augmentation it is placed approximately a space to the right of the note head unless the note has a flag, in which case it would be placed beyond the tail of the flag."* | n.a. (prior doc already flags that the edges are not said) |
| head → dot gap, drawn (Ross) | **0.39** (double- and triple-dot figures) | Ross p. 171 plate, re-measured | yes, with the `ross` row (0.38) |
| head → dot gap, drawn (G&L) | **0.39** (double-dot G4), **0.42** (triple-dot B4) | G&L p. 22 plate, measured (first time) | ≈ Gould/Ross plates; below our 0.5 |
| stated gap (G&L) | none: *"place to the right of the notehead"* | G&L p. 21 | n.a. |
| up-stem with a flag | the dot goes right of the tail, or lengthen the stem | Gould p. 55: *"should the end of a tail coincide with the position of the dot and thereby obscure it, it is acceptable to move the dot to the right of the tail … It is equally acceptable to lengthen the stem."* Ross p. 171: *"Don't place a dot between a notehead and a flag … Don't place a dot below a flag's tail – if the stem is of normal length … DO place the dot after the flag!"* G&L p. 22: *"the dot is placed further right, altogether avoiding the flag. Never place a dot between the notehead and its flag."* | yes, in direction (prior doc: VexFlow's flag shift is kept) |
| …measured: white from flag to dot | Gould **≈0.30** (quaver), **≈0** (semiquaver: the dot sits just past the lowest hook, below it); Ross **0.20** (quaver). Head/stem → dot past a flag: Gould ≈1.45, Ross 1.18 | Gould p. 55 (no staff drawn; scale taken from notehead width = the p. 54 rastral, ±10%); Ross p. 171 | not checked against our flag-shift number |
| chord: dots in one column past the whole chord | — | Gould p. 55: *"Every notehead in a chord must take a duration dot. Vertically align the dots after the chord."* G&L p. 23: *"For two or more notes in a chord with the same stem direction, always align the dots vertically."* Ross p. 170: *"Notice the vertical alignment of the dots in the cluster"* | yes (`dotStack`: `startOf` = the max over the note's dots) |
| seconds / displaced heads | dots go past the rightmost head (from the column rule above; Gould's p. 55 plates draw it) | Gould p. 55 plates (adjacent-note chords) | yes |
| two voices, both dotted, adjacent notes | *"the upper dot is usually aligned with the lower dot after both parts (this layout is most compact), although it is acceptable to place each dot closer to each notehead"* | Gould p. 56 | UNKNOWN whether we do this (no voice-aware dot code seen) |
| two voices, one dotted | *"each dot is placed next to its notehead … a dot should not be separated from its notehead by the adjacent note"* · p. 57: *"do not separate a dot from its notehead by placing a stem in between"* | Gould pp. 56–57; G&L p. 22: *"Never separate a dot from its notehead."*; Ross p. 170 (a): *"Don't separate a dot from its note head."* | UNKNOWN in code |

### B. Single dot, vertical

| rule | value | source | agrees? |
|---|---|---|---|
| head in a space → dot in the middle of that space | 0 lift | Gould p. 54: *"When notes are in a space, place the dot in the middle of that space."*; G&L p. 21 | yes (`dotStack`) |
| head on a line → dot in the space above | +0.5 sp | Gould p. 54: *"When notes are on a line, place the dot in the space above"*; Ross p. 169: *"The dot is always placed in a space and never on a line. If the note is on the line, the dot is placed in the space above"*; G&L p. 21 | yes |
| ledger lines: same rule | — | Gould p. 55: *"Dotted notes on ledger lines follow the same principle. The dot moves above the ledger line when the note is on a line"*; Ross p. 169 (*"also includes dotted notes on the leger lines"*); G&L p. 21 (*"never on a staff line or on the same level as a leger line"*) | yes |
| seconds | upper note on a line → up; lower note on a line → down into the lower space | Gould p. 55: *"When the upper note is on a line, the dot moves up into the next stave-space, as usual. When the lower note is on a line, the dot drops to the lower space"*; G&L p. 23: *"The dot for the space note is always placed in the space to the right of the notehead. If the line note is above, place the dot in the space above. If the line note is below, place the dot in the space below."* | yes (`dotStack` `halfShiftY = -0.5` for a second below) |
| one dot per space; a dot may move a space away from its head | — | Gould p. 55: *"Each dot should always have a stave-space to itself … A dot may need to move a stave-space away from its notehead. Do not align the dots horizontally, as this gives double-dotted value to the notes"*; Ross p. 170; G&L p. 23 | yes (`prevDottedSpace`) |
| dots centred on the chord; drop the far ones | — | Gould p. 56: *"Centre the dots on the chord, rather than placing them in one direction … When a dot is forced to be two or more stave-spaces from the chord … use only as many dots as cover the number of stave-spaces taken up by the chord"* | UNKNOWN / probably no (`dotStack` walks top-down and never drops a dot) |
| two voices: up-stem → above, down-stem → below | ±0.5 by STEM | Gould p. 56 (*"Drop the dot into the space below the lower part"*); Ross p. 169 (b); Stone p. 125 (*"2. If a downstemmed note is on a line, the dot should be placed into the space below the line"*); G&L p. 23 | **no**: already recorded as D10 in `accidental-dot-research.md` |
| exception: down-stem part forced up | — | Gould p. 58: *"For a dotted down-stemmed part on a line, the dot is forced into the space above, to be clear of the up-stemmed part"* (overlapping adjacent notes) | n.a. |
| dotted unisons | one dot for both if both are dotted (Stone p. 125 B); single stem: *"Each dot must have a separate stave-space … they will otherwise appear to be double-dotted"* (Gould p. 58) | Stone p. 125; Gould p. 58 | UNKNOWN in code |

### C. Double dot

| rule | value (sp, edge to edge) | source | agrees with `house` 0.5 / 0.5? |
|---|---|---|---|
| stated: close and even | no number | Gould p. 54: *"Double and triple dots should be placed close together and evenly spaced"* | n.a. |
| stated: dot→dot equals head→dot | = the first gap | G&L p. 22: *"Double and triple dots are placed directly to the right of the first dot. Horizontal spacing is equal to that of the first dot."* | yes (equal) |
| stated: ½ space beyond | 0.5 | Ross p. 171 (scan): *"Double and triple augmentation dots are placed horizontally as the single dot – vertically ½ space beyond the single dot."* (his "horizontally/vertically" read reversed; see the plate) | yes |
| stated: same as single | — | Stone p. 126: *"Note that double dots are treated the same way as single dots."* and pp. 78–79: *"Double-dotted notes are treated the same as dotted notes."* (both in the unison context) | n.a. |
| **drawn, Gould** | head→dot **0.375**, dot→dot **0.26**, pitch **0.745** | Gould p. 54, three-note double-dotted minim chord, re-measured (centroid pitch 15.0 px / 20.12) | **no**: second gap ≈½ of ours; confirms `gouldDrawn` |
| **drawn, Ross** | head→dot **0.39**, dot→dot **0.35**, pitch 0.80 | Ross p. 171, re-measured | ≈ (0.35 vs 0.5) |
| **drawn, G&L** | head→dot **0.39**, dot→dot **0.39** | G&L p. 22, double-dotted beamed quaver, measured (NEW) | equal gaps like `house`, but ≈0.1 smaller |
| vertical: same as a single dot | every dot of the note on the first dot's level | all plates: Gould p. 54 (chord: three rows of two), G&L p. 22 (dots of the G4 at 1.6 sp, of the B4 at 2.6 sp above the bottom line, i.e. in the space above the line) | yes |
| chord: second dots also aligned in a column | drawn: yes, a 2-column grid | Gould p. 54 chord plate (all three rows' dots at the same two x's) | yes (one start x per note; each further dot steps by width + gap) |
| mixed single + double in one chord | not possible, since a chord has one duration | — | n.a. |
| double-dot usage | *"Multiple dots should be used only in situations where they will be easily understood"* (G&L p. 22); *"Double augmentation dots should be used very understandably"*, with INCORRECT `h.. 8` vs CORRECT `h.` tied to a quaver + a quaver (Ross p. 171) | G&L p. 22; Ross p. 171 | n.a. (usage) |
| rests with double dots | see G | — | — |

### D. Triple dot

| rule | value (sp) | source | agrees? |
|---|---|---|---|
| stated | same sentence as double (Gould p. 54; Ross p. 171; G&L p. 22) | — | — |
| **drawn, Gould** | head→dot **0.37**, dot→dot **0.26 / 0.26** (pitch 0.76 / 0.74), triple-dotted crotchet in a space | Gould p. 54, re-measured | no (0.26 vs 0.5) |
| **drawn, Ross** | head→dot **0.39**, dot→dot **0.43 / 0.51** (pitch 0.94 / 1.02), uneven: a hand-set plate | Ross p. 171, re-measured | ≈ yes |
| **drawn, G&L** | head→dot **0.42**, dot→dot **0.34 / 0.34** | G&L p. 22, triple-dotted quaver (B4 on a line, dots in the space above), measured (NEW) | ≈ (0.34 vs 0.5) |
| rarity | *"Triple dotted notes are very uncommon, and quadruple dotted notes are extremely rare"* | Wikipedia *Dotted note* (tertiary; not a treatise) | n.a. |
| rarity in the treatises | no treatise sentence found | Gould, Ross, Stone, G&L all searched | UNKNOWN |
| spacing between successive dots | even (Gould *"evenly spaced"*); every plate except Ross's is even to ±0.02 sp | as above | yes (constant step) |

### E. Dot size

| rule | value (sp) | source | agrees with Bravura 0.40? |
|---|---|---|---|
| relative to staccato | *"larger than a staccato dot – often twice the size"* | Gould p. 54 | Bravura 0.40 vs staccato 0.336: 1.2×, not 2× |
| absolute, stated | *"about one third of a space"* | Ross p. 169 | no (0.40 > 0.33) |
| drawn, Gould | **0.49** (darkness integral, five dots, 0.491–0.494); 0.50 × 0.50 by threshold (p. 38, eight dots on rests) | Gould pp. 54, 38 | no: Gould draws ≈0.1 larger. Also corrects the prior doc's "≈0.41" |
| drawn, G&L | **0.26–0.32** (threshold) | G&L p. 22 | smaller than Bravura |
| drawn, Ross | 0.43–0.51 (threshold, inky offset print) | Ross p. 171 | ≈ |
| fonts | Bravura 0.40 × 0.40; Leipzig 0.516 × 0.524; Sebastian 0.496 × 0.488 | `scripts/vendor/*.json` | — |
| SMuFL | no dot-size, dot-gap or dot-to-dot default in `engravingDefaults` (its only dot entry is `repeatBarlineDotSeparation`); U+E1E7 `augmentationDot` is only listed | smufl.formats.music, fetched today | n.a. |

### F. Rhythmic spacing, ties, barlines

| rule | value | source | agrees? |
|---|---|---|---|
| a dotted note gets the space of its DURATION (in between its neighbours), not a note's space plus room for the dot | units: 16th 2 · 8th 2½ · dotted 8th **3** · crotchet 3½ · dotted crotchet **4** · minim 5 · dotted minim **6** · semibreve 7 | Gould p. 39 table (read on the scan) | yes in principle (our √t law, per CLAUDE.md: 3.5√1.5 = 4.29 vs her 4; 3.5√3 = 6.06 vs her 6) |
| double/triple-dotted values in the table | none | Gould p. 39 | UNKNOWN (interpolation only) |
| the smallest white between characters (covers dot → next note) | ≥ ½ sp, and no collision | Gould p. 41: *"Where space is limited, the distance between characters should not be less than ½ stave-space and no characters should collide."* | yes (`pairPadding` dot→next 0.5) |
| tie and dot, single notes | the dot sits INSIDE the tie | Gould p. 63: *"Place the dot within the tie – the tie does not follow the dot. Curve the tie sufficiently to avoid obscuring the dot"* (plus "and not … nor" plates) | not checked |
| tie and dot, chords | *"Position ties so that no dot is obscured. Ties may start immediately after each notehead, in between the duration dots, as long as they will fit without colliding … Otherwise inner ties should start after the dots"* | Gould p. 64 (OCR text; not rendered) | not checked |
| tie and dot: the opposite rule | the tie goes right of the dot | G&L p. 22: *"Ties always avoid the dot – place the tie clearly to the right of the dot."* | **the books disagree with each other** |
| tie and dot: either | *"Keep dotted notes from interfering with ties by either slightly raising or lowering the dots, or by starting the ties after the dots."* | Ross p. 139 | — |
| dot → accidental of the next note | no book-specific number (only Gould's ½ sp floor) | — | UNKNOWN |
| dot → barline | no statement (Gould p. 42's *"a stave-space … on either side of a barline before a notational symbol"* is about what comes AFTER a barline) | Gould p. 42 | UNKNOWN |
| extra space for 2 or 3 dots | no statement | all four books | UNKNOWN |

### G. Dotted and double-dotted RESTS

**The claim that came second-hand** was: "the longest permitted dotted rest is one value smaller than the beat; double-dotted rests may combine rests within a beat (e.g. in 2/2 r4.. is allowed but r8. r4 is clearer)". Checked against Gould pp. 160–164 on the scans:

- ✅ **The first half is exact.** Gould p. 162: *"The longest permitted dotted rest is one value smaller than the beat. In crotchet metres, the longest dotted rest is a dotted quaver"* … *"In minim metres, the longest dotted rest is a dotted crotchet"* … *"The dotted-minim rest is normally never used in simple time. The only exception is to show units of three crotchets in time signatures such as 5/4 and also 7/4 (see Metres of variable stress, p. 178)."*
- ✅ **Double-dotted rests: the wording.** Gould p. 162: *"Double-dotted rests: these may replace two or more rests within a beat"* (plate: 2/4, `r8..` + two demisemiquavers + `r8..`). Then: *"When it is useful to differentiate rests before and after a beat, use the double dotting only at the beginning of a beat"* (plate: `r8..` at the start, undotted rests after). And: *"When it is preferable to show more clearly how the beat is divided, divide the rest into half-beats"* (plates: `r8 r16.` … or `r8 r16.` … `r16. r8`).
- ⛔ **The "2/2, r4.. allowed, but r8. r4 clearer" example is NOT on pp. 160–164.** Every double-dotted rest Gould draws there is a quaver rest in 2/4. Her minim-metre rule (the longest dotted rest is a dotted crotchet) says nothing about a double-dotted crotchet rest. **UNKNOWN**: the example looks like a paraphrase, not her text.
- Also on p. 162: *"Rests at the beginning and end of beats: the recommended practice is to use dotted rests at the beginning but not at the end of a beat … It is acceptable to use dotted rests at both the beginning and the end of a beat."* p. 161: *"Older editions do not use dotted rests … However, beats are more compact and thus easier to read when rests within a beat are combined."* p. 163: *"The dotted rest as a whole beat differentiates compound- from simple-time metres."* p. 164: *"In the middle of a beat, rests must expose at least two of the three divisions."*

**Placement (vertical)**

| rule | value | source | agrees? |
|---|---|---|---|
| the dot keeps its place relative to the rest glyph wherever the rest sits | measured: every dot centred in a space (1.50 / 2.50 / 3.50 / 4.47 sp above the bottom line), beside the crotchet rest's "breast" and the quaver-family rests' top hook | Gould p. 38: *"The dot remains in the same position relative to the rest, regardless of the rest's position on the stave"* (plate includes a **double-dotted** short rest); Ross p. 179: *"The dot for the quarter-rest is placed in the same space with the 'breast' of the rest. The dot for the eighth-, sixteenth-, thirty-second-rest, etc. is placed in the same space with the top hook of the rest"* | yes (the note's line lift is not applied to rests; `dotStack` comment) |

**Placement (horizontal), measured today (first time)**

| case | white, rest ink → dot | dot → dot | source |
|---|---|---|---|
| crotchet rests (three positions) | 0.50 / 0.55 / 0.50 (nearest rest ink in the dot's rows) | — | Gould p. 38 |
| quaver-family rests (four) | 0.40 / 0.40 / 0.40 / 0.40 | — | Gould p. 38 |
| **double-dotted** short rest | 0.40 | **0.25** (pitch 0.75) | Gould p. 38 |
| double-dotted quaver rests (no staff; dot 10 px = the p. 54 rastral) | 8 px / 7 px ≈ 0.35–0.40 | 5 px ≈ **0.25** (pitch 15 px ≈ 0.75) | Gould p. 162 |

⇒ Gould gives a rest's dots **the same spacing as a note's**: ≈0.4 from the glyph, 0.25–0.26 between dots, pitch 0.75. ⛔ No book says a rest's dot stands closer than a note's. (`dot-placement.md` justifies a smaller rest distance from MuseScore's `dotRestDistance`, an engine.)

**Double-dotted rests in the other three books**: Ross p. 179: *"All rests may be dotted exactly as notes are dotted"*, and in simple time the dotted whole, half and quarter rests are ruled out (pp. 170, 179). He says nothing about double dots on rests: UNKNOWN. G&L p. 23: *"Rests are dotted in the same way notes are dotted, but with some restrictions on their use"*, plus usage (*"Dotted whole rests are the least used … never used in simple meter"*; p. 24: *"It is acceptable to use the dotted eighth rest, dotted sixteenth rest, etc., for a cleaner look"*). Nothing about double dots on rests: UNKNOWN. Stone pp. 134–135: dotted rests of 1½ beats are ruled out at the start of a simple-meter bar and allowed on the 2nd beat of 3/4 and the 3rd of 4/4. Nothing about double dots on rests: UNKNOWN.

---

### Disagreements with our house style

1. **dot → dot gap.** `house` = 0.5. Every plate draws less: Gould **0.26** (double and triple, uniform), G&L **0.34–0.39**, Ross 0.35–0.51 (uneven). Only Ross's sentence ("½ space beyond") and G&L's "equal to the first dot" support 0.5 / equal. On the drawings, our dot→dot is the widest in the library.
2. **head → dot gap.** `house` = 0.5 (Gould's sentence). All three plates draw **0.37–0.42**, now including G&L, so this is three books, not two.
3. **Dot diameter.** Gould's plate is **0.49 sp** (darkness integral) against Bravura's 0.40, and Gould asks for ≈2× the staccato dot (Bravura: 1.2×). Ross states ⅓ sp and G&L draws ≈0.3. The books do not agree. The earlier claim that Bravura "matches Gould's drawing (≈0.41)" rests on an anti-alias correction this measurement does not reproduce.
4. **Ties.** Gould p. 63 puts the dot inside the tie. G&L p. 22 puts the tie after the dot. Ross p. 139 allows either. Our behaviour was not checked.
5. **Two-voice stem rule** (dot below for a down-stem): still not implemented (already D10).
6. **Gould p. 56: centre the dots and drop the far ones.** Probably not implemented.
7. **Rest dots.** Gould's plates give rests the note's spacing. The "smaller rest distance" in `dot-placement.md` has no treatise behind it.
8. **Method note for `accidental-dot-research.md`.** Its "+0.07 sp" anti-alias correction to gaps and its 0.41 diameter are not reproduced by threshold-free measurement. Raw 0.37 / 0.26 stand as the true values.

### UNKNOWN list

- A treatise sentence giving a NUMBER for dot→dot: none. Ross's "½ space" is the closest, and its axis wording is garbled.
- Triple-dot rarity in a treatise: none found (only Wikipedia, tertiary).
- Double/triple-dotted values in Gould's spacing units table (p. 39), and whether extra dots claim extra space: no source.
- Dot → barline and dot → the next note's accidental, as specific numbers: no source (only Gould p. 41's general ½ sp floor).
- Double-dotted rests in Ross, Stone and G&L: nothing said. The second-hand "2/2 r4.. vs r8. r4" example: not in Gould pp. 160–164.
- Gardner Read, Powell, Vinci, Heussenstamm, Chlapik, MOLA: **unreachable**. Read is lending-only on archive.org (search-inside refused); the others had no copy or quotable text. Their rules are UNKNOWN, not "silent".
- SMuFL: no statement on augmentation-dot spacing or size (checked `engravingDefaults` and the Individual Notes implementation notes).
- Gould p. 64 chord-tie text read from OCR only; its plates were not rendered.

---

## Part C — the engines

Read from SOURCE, not rendered: `which lilypond mscore musescore verovio` finds nothing, and nothing was
installed. Every number is converted to staff spaces (sp). "White" = ink-to-ink gap.

| engine | clone | commit | unit |
|---|---|---|---|
| LilyPond | `~/dev/engine-sources/lilypond` | `beedbfa` | staff space; `staff-position` = half-spaces |
| MuseScore 4.x | `~/dev/engine-sources/MuseScore` | `929d1e9` | spatium = 1 sp; note `line` = half-spaces |
| Verovio | `~/dev/engine-sources/verovio` | `efff0bc` | drawing unit = 0.5 sp (`doubleUnit` = 1 sp) |

Glyph sizes used: LilyPond Feta dot diameter `(staff_space − stafflinethickness)/2` = (1 − 0.10)/2 =
**0.45 sp** at the default 20 pt staff (`mf/feta-dots.mf:23`; line thickness from `mf/feta-params.mf:44`,
`scm/paper.scm:52`). MuseScore default font Leland: `augmentationDot` **0.40 × 0.40**, `noteheadBlack`
1.30, `flag8thUp` 1.157 wide (`fonts/leland/leland_metadata.json`). Verovio: a DRAWN circle, radius
`doubleUnit/5` = **0.20 sp** (`src/view_graph.cpp:205`); Bravura `flag8thUp` 1.056 wide.

---

### A. Head → first dot

| engine | raw rule | white gap, sp | source |
|---|---|---|---|
| LilyPond | `DotColumn.padding = pad-by-one-dot-width` (max dot-stencil X width) added to the head/stem/flag SKYLINE's right edge **at the dot's own staff position** | **0.45** | `scm/define-grobs.scm:1264`; `scm/output-lib.scm:692-704`; `lily/dot-column.cc:229-232`; `lily/dot-configuration.cc:129-136` |
| MuseScore | `dotNoteDistance` **0.5 sp** from `headBodyWidth` (dot glyph's bbox starts at its origin) | **0.50** | `style/styledef.cpp:304`; `rendering/score/chordlayout.cpp:2800` (dotX), `:3193`, `:3227-3229` |
| Verovio | Dots x = head right (`2*radius`, radius = half head width) ; drawn CENTRE at that + 1 unit | 0.5 − 0.2 = **0.30** | `src/calcdotsfunctor.cpp:96,121`; `src/view_element.cpp:899`; `src/view_graph.cpp:205` |

✅ All three match `docs/research/accidental-dot-engines.md` §3 B1/B1′ and the `lilypond` / `musescore` /
`verovio` rows of `src/engine/layout/dotGap.ts`.

Other style knobs: MuseScore `dotMag` 1.0 (`styledef.cpp:303`, `dom/notedot.cpp:64-67`); `dotRestDistance`
0.25 sp (`styledef.cpp:305`) is **read by nothing in `src/engraving`** (grep: only `styledef.cpp/.h`) — dead,
confirmed. Verovio has no `--dot…` option; every dot number is `// HARDCODED`. LilyPond: `Dots` has no
`padding` of its own; the gap is `DotColumn.padding`.

### B. Dot → dot (2nd and 3rd dots)

| engine | rule | pitch (centre→centre) | white | same as A? | source |
|---|---|---|---|---|---|
| LilyPond | `ly:dots::print` = `stack-stencils X RIGHT padding` where `padding` = the dot's OWN width — i.e. a GAP between edges | 0.90 | **0.45** | ✅ yes, literally the same expression | `scm/output-lib.scm:686-690` |
| MuseScore | `dotDotDistance` **0.65 sp**, added to each dot's ORIGIN (left edge) — origin-to-origin, not a gap | 0.65 | 0.65 − 0.40 = **0.25** | ❌ half of A | `styledef.cpp:306`; `chordlayout.cpp:3194,3227-3229`; rests `restlayout.cpp:142-149` |
| Verovio | `x += unit * 1.5` per dot, from dot CENTRE | 0.75 | 0.75 − 0.40 = **0.35** | ❌ (0.30 vs 0.35) | `src/view_element.cpp:2091-2100` (`// HARDCODED` at :2098) |

The 3rd dot uses exactly the same step as the 2nd in every engine (a loop; no per-index rule).
Every dot of one note shares one y (MuseScore `setDotRelativeLine` sets all of a note's dots,
`chordlayout.cpp:2585-2610`; LilyPond one `Dots` grob per head; Verovio one `DrawDotsPart` call per loc).

**Total reach from the notehead's right edge** (derived):

| dots | LilyPond | MuseScore | Verovio | ours (`house`) |
|---|---|---|---|---|
| 1 | 0.90 | 0.90 | 0.70 | 0.90 |
| 2 | 1.80 | 1.55 | 1.45 | 1.80 |
| 3 | 2.70 | 2.20 | 2.20 | 2.70 |

### C. How many dots, and the arithmetic

| engine | max | data model | duration of n dots | source |
|---|---|---|---|---|
| LilyPond | unbounded (parser `dots: | dots '.'`; `int dots_`) | `Duration { durlog_, dots_, factor_ }`, dots on the duration; each head gets one `Dots` grob with `dot-count` | loop `delta /= 2; mom += delta` = d·(2 − 2⁻ⁿ), exact `Rational`, × tuplet `factor_` | `lily/parser.yy:3550-3556`; `lily/duration.cc:120-136`; `scm/output-lib.scm:648-650` |
| MuseScore | **4** (`MAX_DOTS = 4`, clamped in `setDots`, `getDots`) | `TDuration { m_val, m_dots }` on the ChordRest (chord-level); `NoteDot` items created per note to match (`chordlayout.cpp:2589-2604`) | loop `tmp *= 1/2; t += tmp`, exact `Fraction`; tuplet ratio applied separately | `dom/note.h:53`; `dom/durationtype.cpp:60-75,115-157` |
| Verovio | MEI schema `data.AUGMENTDOT` `maxInclusive 4`; code draws any count (`unsigned char dots` loop) | MEI `@dots` (+ `@dots.ges`) on note/chord/rest (`AttAugmentDots`) | `duration*2 − duration/2ⁿ` = d·(2 − 2⁻ⁿ), exact `Fraction`, after `@num/@numbase` | `libmei/mei/mei-verovio_compiled.odd:395-399`; `src/durationinterface.cpp:75-92` |

Note LilyPond's `DotColumn.chord-dots-limit = 3` (`define-grobs.scm:1262`) is NOT a dot-count limit: it caps
the number of dot ROWS a tall chord may carry, killing surplus `Dots` grobs from the stem's ends inward
(`dot-column.cc:152-180`).

### D. Vertical

| question | LilyPond | MuseScore | Verovio |
|---|---|---|---|
| line note | moved ±1 half-space by `Dot_configuration::remove_collision`; direction by min **badness** = Σ 2·(moved)² +1 if not UP, +2 if against `Dots.direction` ⇒ **up** by default (`dot-column.cc:218-224`, `dot-configuration.cc:25-44,62-101,107-122`) | ±0.5 sp (`setDotRelativeLine`: y = dotMove/2, `chordlayout.cpp:2562`); **up**, or **down for voices 2 and 4** (`voice & 1`) (`chordlayout.cpp:2744-2747`) | +1 unit (0.5 sp) **up** if stem up or single layer, down for stem-down in 2 layers (`src/note.cpp:1023-1035`); plus an unconditional up-shift at paint for anything still on a line (`view_element.cpp:2087-2089`) |
| voice dependence | `\voiceTwo` sets `Dots.direction = DOWN` (Dots and DotColumn are in `direction-polyphonic-grobs`, `scm/music-functions.scm:656-674,704-712`); `\dotsUp/\dotsDown` user overrides (`ly/property-init.ly:365-367`) | voice parity (above); user `userDotPosition` overrides | layer count × stem direction; 2-layer case picks primary/secondary locs by minimum collision count (`src/layerelement.cpp:909-990`) |
| seconds / clusters | ⭐ the optimiser: dots are inserted in pure-position order; each insertion into a taken slot tries shifting that dot **and the contiguous run beyond it** up and down (`shifted`: a line dot moves 1 half-space, a space dot 2; followers cascade by 2), keeping the cheaper configuration | per-note pre-pass: line note with a second **above** ⇒ DOWN, with a second **below** ⇒ UP (`chordlayout.cpp:2700-2726`); then `placeDots` walks bottom-up then top-down against an `anchoredDots` list, flipping when the wanted space is claimed (`:2484-2541`); space-note unison ⇒ ±1.0 sp (`:2545-2554`) | per-staff `std::set` of locs; each note tries offsets `0,+1,−1,−2,+2` skipping lines (reversed for the other direction) ⇒ coincident dots MERGE into one (`src/chord.cpp:42-60,580-596`) |
| one x for the chord? | yes — one `DotColumn` per **staff** per moment; every `Dots` stack starts at its x (`ly/engraver-init.ly:73`, `lily/dot-column-engraver.cc:45-60`) | yes — `chord->dotPosX()` = max over notes (`chordlayout.cpp:2800-2804,2824-2832`) | yes — one `Dots` per chord, `max` over notes (`calcdotsfunctor.cpp:96-97`) |
| single- vs double-dotted in one column | LEFT-aligned: both stacks start at the column x (2nd dot sticks out) | a chord has one dot count; across voices dotPosX is shared when they conflict/combine (`setDotX`, `:2612-2672`) ⇒ first dots aligned | across layers, overlapping dot groups are moved to the rightmost (`src/adjustdotsfunctor.cpp:30-78`) ⇒ first dots aligned |

### E. Rests, and the flag

**Rests with 2–3 dots**: all three use the same dot→dot step as for notes (LilyPond same stencil; MuseScore
`restlayout.cpp:141-149` reads `dotNoteDistance`/`dotDotDistance`; Verovio same `DrawDotsPart`). Only x-start
and y differ: MuseScore y = `dotLine × 0.5 sp` per duration (whole +1, half…16th −1, 32/64 −3, 128+ −5;
`dom/rest.cpp:343-366` — ⚠️ the existing doc cites `:2060-2083`, which does not exist in a 739-line file);
LilyPond `dots::calc-staff-position` (whole −2, 32/64 +2, 128/256 +4 half-spaces, `output-lib.scm:652-664`),
then the same on-line collision; Verovio +1 loc if on a line, then +2/+4/+6/+8 for 32nd…1024th, x = 1.25 sp for
half/whole else the rest glyph width (`calcdotsfunctor.cpp:148-174`), then the draw adds 0.5 sp to the centre.

**Stem-up flag**:

| engine | rule | dot vs flag | source |
|---|---|---|---|
| LilyPond | the flag's box joins the dot skyline; pushes a dot only if the dot's staff position lies inside the flag's y-extent | first dot **0.45 past the flag bbox** (same padding) | `dot-column.cc:130-141` |
| MuseScore | if chord up, hook visible, dotPosX < hook right and the TOP dot is above hook bottom + 0.25 sp ⇒ `d = hook->width()` instead of 0.5 | dot left ≈ flag bbox right (≈0 white to the box) | `chordlayout.cpp:3202-3212` |
| Verovio | single note: stem up, unbeamed, flag, and the dot overlaps the flag vertically (`IsDotOverlappingWithFlag`) ⇒ shift **0.8 × flag8thUp width** (0.845 sp); chord: top note, stem up, < quarter, unbeamed ⇒ same shift, no overlap test | ≈0.09 sp white past the flag bbox | `calcdotsfunctor.cpp:86-94,109-119,179-197` (`// HARDCODED`) |

A beamed note never gets the flag push in any of the three.

### F. Horizontal spacing

| engine | how dots take room | per extra dot | source |
|---|---|---|---|
| LilyPond | the `Dots` stencil (whole stack) enters the column's separation skyline with `extra-spacing-width (0 . 0.2)` and `extra-spacing-height (−0.5 . 0.5)` ⇒ a ROD (min distance), not the ideal duration spring | +0.90 | `define-grobs.scm:1278-1279`; `lily/separation-item.cc:147-180` |
| MuseScore | each dot box is in the note's `Shape` (`fillNoteShape`), padding `NOTEDOT→NOTE` = max(dotNote, dotDot) = **0.65**, `NOTEDOT→ACCIDENTAL` 0.35, `NOTEDOT→CLEF` 1.0; also `spaceRw` includes the dots | +0.65 | `tlayout.cpp:4210-4222`; `rendering/paddingtable.cpp:94-100`; `chordlayout.cpp:264-269` |
| Verovio | the `Dots` bounding box (all dots) + right margin (`defaultRightMargin` 0) pushes the next alignment; with several layers, dots/flags only push if they actually overlap | +0.75 | `adjustxposfunctor.cpp:150-185`; `src/doc.cpp:2184-2202`; `src/options.cpp:1668-1669` |

### G. Multi-voice

- **LilyPond**: one DotColumn per staff ⇒ every voice's dots at one x. `Note_collision`: when heads merge
  (only if `merge-differently-dotted` or equal dots), dots on the down-stem (or smaller) head are killed; with a
  collision, the MORE-dotted chord goes to the RIGHT (`prefer-dotted-right`), and a dotted chord left of
  another has the right chord's heads added as DotColumn support (`lily/note-collision.cc:100-110,195-226,259-315,350-370`).
- **MuseScore**: `setDotX` aligns all voices' dots to one x when an up- and a down-stem chord are within a
  second of each other (or voices combine), else per chord (`chordlayout.cpp:2612-2672`); shared heads with
  EQUAL dot counts hide one set (the small one, else the lower voice on a line / the upper voice in a space,
  `:2066-2089`); different dot counts prevent head sharing (`:1990-1995`).
- **Verovio**: see D/F — two-layer dot locs by collision count, horizontal grouping to the rightmost.

---

### Where the three agree

- Head→dot is a fixed style distance ≈ ½ sp (0.30–0.50 white); dots of one note are equally spaced by one
  constant; the 3rd dot is stepped exactly like the 2nd.
- Every dot of a note sits at the same y; a line note's dot goes to the adjacent space, UP by default, DOWN
  for the second/lower voice.
- All dots of a chord stand in ONE x column; across voices dots are aligned into one column when they
  would clash (LilyPond always, per staff).
- Rests use the same horizontal constants as notes; only their dot y is a per-duration table.
- Duration = d·(2 − 2⁻ⁿ), exact rational arithmetic; the tuplet ratio multiplies it separately.
- Dots take horizontal room through the same collision machinery as everything else (skyline/shape/bbox).

### Where they disagree

- **Dot→dot vs head→dot**: equal only in LilyPond (0.45/0.45). MuseScore 0.50/0.25 (dots tighter than the
  head gap), Verovio 0.30/0.35 (dots slightly wider).
- **Max dots**: LilyPond unbounded; MuseScore 4 (enforced); Verovio 4 by schema only.
- **Seconds**: LilyPond global optimiser with badness; MuseScore ordered walks with a claimed-slot list;
  Verovio first-free-slot search with MERGING of coincident dots.
- **Flag clearance**: LilyPond 0.45 past the flag box, MuseScore ~0, Verovio ~0.09; LilyPond and Verovio's
  single-note path only push when the dot overlaps the flag vertically.
- **Rest dot y** tables differ (whole rest: LilyPond −1 sp, MuseScore +0.5 sp, Verovio up).

### Differences from our current code/doc

1. ✅ The single-dot numbers in `docs/research/accidental-dot-engines.md` §3 and `layout/dotGap.ts` rows
   `lilypond` 0.45/0.45, `musescore` 0.5/0.25, `verovio` 0.3/0.35 are CONFIRMED against source.
2. ⚠️ `docs/research/accidental-dot-engines.md` cites MuseScore `Rest::getDotline` at `dom/rest.cpp:2060-2083`;
   it is at **`dom/rest.cpp:343-366`** (file is 739 lines).
3. ⚠️ `docs/research/dot-placement.md` is stale on two points `dotGap.ts` already corrected: it credits the
   dot→dot half space to Gould and the "head gap = dot gap" principle to MuseScore — MuseScore's own defaults
   make its dot→dot white gap HALF its head gap. It also says rests get MuseScore's smaller `dotRestDistance`;
   that setting is dead code in 4.x.
4. 🚨 **Our DOUBLE-dotted REST**: `NoteBuilder.ts:176-180` attaches rest dots without `reserveDotRoom`, and
   `dotPlacement.placeDots` skips rests — so a rest's dots are VexFlow's **2 px (0.2 sp) head gap and 1 px
   (0.1 sp) dot→dot**. All three engines give a rest the same gaps as a note (0.25–0.45 white dot→dot).
5. 🚨 **Triple dots in the model**: `utils/durations.ts:149-152` `durationToFraction` looks up
   `DOT_MULTIPLIERS[Math.min(dots, 2)]` — a triple-dotted note would be measured as DOUBLE-dotted (7/4, not
   15/8), while `getDotMultiplier` (float) gives 15/8. All three engines compute n dots exactly. (The UI only
   toggles 0↔1 today — `PaletteController.ts:1353` — so this is reachable only from JSON/paste.)
   ✅ **FIXED 2026-09-25, `87df716`** — computed as (2ⁿ⁺¹ − 1) / 2ⁿ.
6. Our house row (0.5/0.5) = LilyPond's shape (equal gaps), a touch wider; a triple dot reaches 2.70 sp,
   the same as LilyPond, 0.5 sp further than MuseScore/Verovio.
7. Flag: ours (`layout/noteDotXs.ts`, inherited from VexFlow) pushes EVERY stem-up flagged dot past the flag
   by the flag's width + 0.2 sp, with no vertical-overlap test; LilyPond and Verovio (single notes) test the
   overlap, MuseScore tests it against the top dot.
8. Multi-voice: our `engrave/notes/dotStack.ts` (VexFlow's `Dot.format`) starts each NOTE's dots at its own
   start (`startOf` keyed by `noteKey`), so two voices' dots in one column are not forced to one x; all three
   engines align them (LilyPond always). Not tested in a browser — inferred from the code.
9. Vertical: VexFlow's rule (ours) has no voice-parity rule — a line note's dot goes UP unless a second or a
   taken space flips it; the engines send voice 2's dots DOWN.

---

## Part D — a chord whose dots collide: LilyPond and MuseScore, from source

Sources (read-only clones): `~/dev/engine-sources/lilypond` @ `beedbfa` (2026-08-03),
`~/dev/engine-sources/MuseScore` @ `929d1e9` (2026-08-18).
Neither engine binary is installed here, so the worked examples were produced by
**transcribing the source into two small Python scripts and running those**
(`ly.py`, `ms.py` in this scratchpad). They are faithful transcriptions of the code
paths cited, restricted to one voice / one staff / no unisons / 5-line staff — but they
are NOT engine output. Everything labelled *(read)* is read from source;
*(inferred)* is my reasoning.

Unit convention in results: bottom line = 1, a space = x.5 (treble E4 = 1, F4 = 1.5, …, F5 = 5).

---------------------------------------------------------------------------------------
### 1. LilyPond

#### 1.1 Coordinates (read)
- Staff position `p`: integer half-spaces, middle line = 0, lines at −4,−2,0,2,4
  (`Staff_symbol::on_line`, lily/staff-symbol.cc:372–396; includes ledger lines, allow_ledger
  defaults true, lily/include/staff-symbol.hh:40). Convert: `u = 3 + p/2`.
- A note's dot starts at its head's rounded position; `staff-position` adds 0 for notes (only
  rests get an offset) — `dots::calc-staff-position`, scm/output-lib.scm:652–664;
  dot-column.cc:210–216.
- Each dot's preferred direction `dir_` = the `Dots.direction` property (dot-column.cc:203–205):
  unset (CENTER) in a single voice; `\voiceOne`/odd voices set UP, `\voiceTwo` DOWN
  (Dots is in `direction-polyphonic-grobs`, scm/music-functions.scm:655–672, 704–712);
  `\dotsUp/\dotsDown` also set it (ly/property-init.ly:365–367).
- ONE `DotColumn` collects all dots of the column (both voices), and all its dots share
  one x (dot-column.cc:229–232).

#### 1.2 Algorithm — `Dot_column::calc_positioning_done` (lily/dot-column.cc:42–234)
```
0. Resolve note collisions first (may kill dots when merging heads)      :51–52
   (note-collision.cc:259–312: merged unison heads keep one set of dots).
1. dots := all Dots grobs in the column, sorted by staff position ASCENDING
   (pure_position_less, :150; staff-symbol-referencer.cc:213–217).
2. CHORD-DOTS-LIMIT (default 3, scm/define-grobs.scm:1262)                :152–180
   for each stem whose first head carries a dot:
     span      := top head pos − bottom head pos      (Stem::head_positions, stem.cc:103–112)
     room      := floor((span + 2 + limit) / 2)       (size_t integer division, :169–171)
     total     := number of this stem's dots
     first     := 0
     while total > room:
        if (total − room) is EVEN: kill dots[first]; first++        (lowest remaining)
        else:                      kill dots[first + total − 1]     (highest remaining)
        total--
   => alternately trims top and bottom so the survivors are centred on the chord;
      the LAST removal (excess 1) always takes the TOP one.
   Doc (scm/define-grob-properties.scm:203–205): the column is limited to
   "the height of the chord plus chord-dots-limit staff-positions".
3. cfg := empty map  position -> DotPosition{pos_ = wanted position, dir_}.
4. for each surviving dot d in ascending order:                           :195–224
     p := head position of d
     remove_collision(p)          -- if p already occupied, shove the occupant(s) away
     cfg[p] := d
     if p is on a line (incl. ledger):   -- (kievan style excepted)
        remove_collision(p)       -- shove d itself (and its neighbours) off the line
5. write each dot's final position; x := column x_offset + padding (one dot width,
   output-lib.scm:692). x_offset = max over the dots' rows of the right edge of the
   "head skyline" (heads ±1.1 pos, stems, flags) at that row  (dot-configuration.cc:130–137,
   dot-column.cc:76–141).
```

`remove_collision(p)` (lily/dot-configuration.cc:108–122):
```
if p not in cfg: return
up   := shifted(p, +1);  down := shifted(p, −1)
cfg  := (badness(up) < badness(down)) ? up : down        -- a TIE goes DOWN
```

`shifted(k, d)` (dot-configuration.cc:62–102) — builds a new map:
```
iterate cfg entries in order: ASCENDING if d = UP, DESCENDING if d = DOWN
offset := 0
for entry at key p:
   if p == k:
       p' := p + d   if p is on a line         (line -> adjacent space)
             p + 2d  otherwise                 (space -> next space)
       offset := 2d                            (NB: 2d even when k moved only 1)
       new[p'] := entry
   else:
       if new has no key p: offset := 0        (chain broken: nothing was pushed onto p)
       new[p + offset] := entry                (else carried along by 2d — the chain)
```
So the dot at k moves, and every dot that the move lands on is pushed a whole space
further, in a chain, in direction d.

`badness()` (dot-configuration.cc:26–44), summed over every dot:
```
delta  := final − wanted
cost   := 2·delta²
mv     := sign(delta)          (0 if not moved)
if dir_ ≠ CENTER and mv ≠ dir_:  cost += 2
else if mv ≠ UP:                 cost += 1      (an unmoved or down-moved dot costs 1)
```
i.e. quadratic displacement, plus a +1 bias against DOWN relative to UP (for CENTER dots)
— a single line note's dot therefore goes UP (up costs 2, down costs 3).

Tie-break: equal badness → DOWN (`b_up < b_down ? up : down`).
Dots removed: only by step 2 (and by note-collision merging). No other dropping.

#### 1.3 Worked examples (transcribed script `ly.py`; single voice, dir CENTER)
| chord | limit trims | dot spaces (u) |
|---|---|---|
| (1) F4 G4 A4 B4 | room 4, none | **0.5, 1.5, 2.5, 3.5** |
| (2) C5 D5 E5 F5 | room 4, none | **2.5, 3.5, 4.5, 5.5** |
| (3) E4…E5 (8 heads) | span 7, room 6 → kill E4's dot, then E5's | **0.5, 1.5, 2.5, 3.5, 4.5, 5.5** (6 dots) |
| E4…F5 (9 heads, the prompt's other wording) | span 8, room 6 → kill F5, E4, E5 | 0.5 … 5.5 (6 dots) |

Trace of (1), positions in half-spaces (F4=−3 … B4=0):
insert −3 → {−3}. Insert −2 (G4, line): no collision; then line-lift: up {−3,−1} b=3 vs down
{−5,−3} b=12 → UP. Insert A4 at −1: occupied; up {−3,1} b=19 vs down {−5,−3} b=12 → DOWN
(the G4 dot and the F4 dot are both pushed down a space), A4 takes −1 → {−5,−3,−1}.
Insert B4 at 0 (line): lift, up {…,1} b=15 vs down b=64 → UP. Final {−5,−3,−1,1}.
Note that the ASSIGNMENT of dots to heads is scrambled by the chain (only the SET of
positions matters to the drawing).

Other small cases (script): A4 B4 → 2.5,3.5; B4 C5 → 2.5,3.5; C5 E5 → 3.5,4.5; G4 B4 → 2.5,3.5;
with Dots.direction UP or DOWN the three test chords come out the same; a lone B4 goes to
3.5 (UP/CENTER) or 2.5 (DOWN).

#### 1.4 vs Gould (pp. 55–56 as relayed)
- Each dot its own space: **agrees** — the map cannot hold two dots at one key (by
  construction; whether an overwrite in `shifted` can ever drop an entry I could not
  exclude from reading — UNKNOWN, never observed in the three examples).
- (1) F4–B4 = 3.5/2.5/1.5/0.5: **exact match**. (2) by analogy **matches** *(inferred: I
  apply Gould's F4–B4 shape shifted up two spaces — she was not read for C5–F5)*.
- Tall clusters: **agrees in kind, disagrees in count.** LilyPond keeps
  `floor((span+2+3)/2)` dots — for E4–E5, 6 dots reaching 0.5 and 5.5, i.e. one space beyond
  the chord at each end. Gould (as relayed): only the spaces the chord covers, 5 dots.
  Setting `chord-dots-limit = 1` gives room = floor((7+3)/2) = 5 for E4–E5 *(inferred
  arithmetic)*. ⚠ E4–E5 covers only four interior spaces (1.5, 2.5, 3.5, 4.5), so "5 dots"
  must include one space outside the chord's ink or refer to a different chord — the caller
  should re-check the Gould example's exact pitches.

---------------------------------------------------------------------------------------
### 2. MuseScore

#### 2.1 Coordinates (read)
- `Note::line()`: integer half-spaces, **0 = top line, increasing DOWNWARD**; even = on a
  line (`!(line & 1)`, chordlayout.cpp:2485). Treble: F5=0, E5=1, … E4=8. Convert:
  `u = 5 − line/2`. A dot's `dotMove` −1 = up half a space, +1 = down
  (`setDotRelativeLine`: `y = dotMove/2` spaces, chordlayout.cpp:2560–2610).
- `Chord::notes()` is kept sorted by pitch ascending → bottom note first
  (dom/chord.cpp:630–654). In single voice `notes` = the chord's notes in that order
  (chordlayout.cpp:1795–1807; only sorted when >1 voice).

#### 2.2 Algorithm — `layoutChords3` (chordlayout.cpp:2680–2752) + `placeDots` (:2462–2558) + `getNoteListForDots` (:2845–2941)

Step A — per-note preferred side (chordlayout.cpp:2696–2749), notes visited TOP → BOTTOM:
```
for i = n−1 down to 0:
   dp := note.userDotPosition                    (user override wins)
   if chord has dots and dp == AUTO and n > 1 and note visible and dots not hidden:
      above := notes[i+1] (ignored if invisible / dots hidden / no dots / other voice not combined)
      below := notes[i−1] (same filter)
      intervalAbove := line − above.line   (1000 if none)
      intervalBelow := below.line − line   (1000 if none)
      if note on a LINE:
         if intervalAbove == 1 and intervalBelow ≠ 1:  dp := DOWN   (second above only)
         elif intervalBelow == 1 and intervalAbove ≠ 1: dp := UP    (second below only)
         elif a unison: dp := AUTO (handled later)
         -- a line note with a second BOTH sides stays AUTO
      else (space): only the unison case is handled (:2730–2741)
   if dp == AUTO: dp := (voice odd) ? DOWN : UP
   note.dotPosition := dp
```

Step B — `getNoteListForDots` (single voice, no cross-staff; :2887–2903):
```
anchoredDots := [] ; topDownNotes := [] ; bottomUpNotes := []
for note in chord.notes (bottom → top):
   if note on a SPACE:
       offset := 0
       if anchoredDots.last == note.line:        (a unison in a space)
           adjustDown := voice odd and stem down
           offset := ±2 (away from the previous anchor; see :2893–2897)
       anchoredDots.push(note.line + offset)      -- space dots are FIXED first
   else:
       topDownNotes.push(note)
sort topDownNotes by line ascending  (top first);  bottomUpNotes by line descending (:2937–2940)
```
Multi-voice (:2904–2935): space notes of every voice anchor at their own line; line notes of
a stem-down ODD voice (or staff-moved up) go to `bottomUpNotes`, all others to `topDownNotes`.

Step C — `placeDots`, for each note in `notes` (bottom → top in single voice) (:2484–2557):
```
if note on a SPACE: dot stays in its own space (dotMove 0)       (:2542–2556, unison aside)
else (LINE):
   -- pass 1 over bottomUpNotes (empty in single voice), mirror of pass 2 (:2487–2510)
   -- pass 2 re-simulates the line notes from the TOP DOWN until it reaches this note:
   alreadyAdded := {}
   for other in topDownNotes:
       dotMove := (other.dotPosition == DOWN) ? +1 : −1
       loc     := other.line + dotMove
       added   := loc in alreadyAdded
       if not added and loc in anchoredDots:           dotMove := −dotMove   -- flip ONCE
       elif added and alreadyAdded[loc] ≠ other:      dotMove := −dotMove
       if other == note:
           set note's dots at dotMove; anchoredDots.push(note.line + dotMove); stop
       if not added: alreadyAdded[other.line + dotMove] := other
```
Key properties *(read)*: a dot is only ever offered two places, the space above or below its
own head; after one flip **the flipped location is not re-checked**, so two dots can land in
the same space. Space notes are anchored before any line note. There is no cost function
and no chain shifting.

Step D — x: every note's dots share the chord's `dotPosX` (max right edge of the heads,
:2772–2835; `setDotX` :2612–2672 aligns up/down-stem voices when they conflict).

Dropping: **none for clusters.** `setDotRelativeLine` gives every note `chord.dots()` NoteDots
(:2589–2604). Dots are hidden only for a shared unison head between voices (:2067–2087),
a slash chord's invisible note (:3187–3189), or invisible notes (drawn not, tdraw.cpp:2414).

#### 2.3 Worked examples (transcribed script `ms.py`; voice 1, stem up)
| chord | Step A (line notes) | anchored spaces | dot spaces (u) |
|---|---|---|---|
| (1) F4 G4 A4 B4 | G4 AUTO→UP, B4 UP | 1.5, 2.5 | F4 1.5, **G4 1.5**, A4 2.5, B4 3.5 → 3 spaces, **G4 collides with F4** |
| (2) C5 D5 E5 F5 | D5 AUTO→UP, F5 UP | 3.5, 4.5 | C5 3.5, **D5 3.5**, E5 4.5, F5 5.5 → **D5 collides with C5** |
| (3) E4…E5 | E4 DOWN, G4/B4/D5 AUTO→UP | 1.5, 2.5, 3.5, 4.5 | E4 0.5, F4 1.5, G4 1.5, A4 2.5, B4 2.5, C5 3.5, D5 3.5, E5 4.5 → 8 dots in 5 spaces, **3 collided pairs** |

Trace of (1): anchored = [F4→1.5, A4→2.5]. G4 (line): top-down re-sim — B4 wants 3.5, free,
recorded; G4 wants 2.5 (UP), anchored by A4 → flip DOWN to 1.5 → **already F4's**, not re-checked.
B4: wants 3.5, free → 3.5.
Small cases that work: A4 B4 → 2.5/3.5; B4 C5 → 2.5/3.5; G4 A4 B4 → 1.5/2.5/3.5;
E4 F4 G4 → 0.5/1.5/2.5. The failure needs a line note with a space-note second on BOTH sides.

⚠ This collision result is *(read + transcribed)*, not observed in a running MuseScore. If
the caller wants certainty, a MuseScore 4 build rendering `<f' g' a' b'>4.` settles it.

#### 2.4 vs Gould
- Each dot its own space: **disagrees** for (1)(2)(3) — duplicate spaces.
- Centering on the chord / F4–B4 = 0.5–3.5: **disagrees** (1.5, 1.5, 2.5, 3.5; no dot at 0.5).
- Tall clusters: **disagrees** — no limit; all 8 dots drawn (overprinted into 5 spaces). It
  does happen to use only spaces within ½ space of the chord.

---------------------------------------------------------------------------------------
### 3. Summary table (dot spaces, u)
| chord | Gould (relayed) | LilyPond | MuseScore |
|---|---|---|---|
| F4 G4 A4 B4 | 0.5 1.5 2.5 3.5 | 0.5 1.5 2.5 3.5 | 1.5 1.5 2.5 3.5 (collision) |
| C5 D5 E5 F5 | 2.5 3.5 4.5 5.5 *(inferred from her F4–B4)* | 2.5 3.5 4.5 5.5 | 3.5 3.5 4.5 5.5 (collision) |
| E4 … E5 | 5 dots (relayed; ⚠ only 4 spaces inside the chord) | 6 dots, 0.5 … 5.5 | 8 dots in 0.5 … 4.5, 3 collisions |

Transcription notes for TypeScript: LilyPond's is the one worth porting — a sorted map of
integer positions, insert bottom-up, a two-candidate (chain-shift up / down) choice by
quadratic cost with an up-bias, and the `chord-dots-limit` trim done before placement.
The limit is a ROW (default 3; 1 is closer to Gould's count — inferred).
