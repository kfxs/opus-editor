# New durations — 64th to 512th, the breve and the longa: what the literature says

> **2026-09-26.** Research only, for adding 64th · 128th · 256th · 512th · breve · longa to the
> editor (today: whole … 32nd). Started at `reference/README.md` as the project rule asks. Sources
> read **on disk**: Gould *Behind Bars* (PDF, pages rendered and read on the scan; printed page =
> PDF − 20), Ross *The Art of Music Engraving and Processing* (printed = PDF − 12), Stone *Music
> Notation in the Twentieth Century* (2-up PDF), Gerou & Lusk *Essential Dictionary of Music
> Notation* (2-up PDF; printed pp. 112/113 = PDF 58). Plus the **SMuFL** spec
> (`smufl.formats.music/latest/`, fetched today) and its metadata in `public/smufl/`, and Bravura's
> metadata **1.392** (`~/dev/engine-sources/MuseScore/fonts/bravura/bravura_metadata.json` — ⚠️ this
> is the older version the README warns about, not HEAD's 1.482). Repertoire facts came from
> Wikipedia, a **tertiary** source, and are marked as such.
>
> ⛔ Not reachable, so **UNKNOWN** rather than silent: **Gardner Read** *Music Notation* (not on disk;
> Wikipedia cites *Read 1969* p. 101 and p. 459 for the breve and its rest, which is second-hand and
> not verified here), Chlapik, Powell, Vinci, Heussenstamm, the B&H house manual.
>
> Measurements: Gould's plates at 450 dpi (1 sp ≈ 20 px), threshold 128, staff lines found by row
> ink. ±0.1 sp.
>
> Related research already in the tree: `stem-length-research.md` (engines' per-beam stem tables,
> incl. Verovio's 64th), `multi-voice-rest-position.md` §3.1 (Gould p. 35's short rests, already
> built), `accidental-dot-engines.md` (engines' dot offsets for 32nd–1024th rests),
> `spacing-model-research.md` §2 (Sibelius's breve spacing value), `sibelius-keypad.md` (Sibelius's
> breve/longa/64th–512th keys, and its breve bar rest in 4/2 and 3/1).

---

## 0. Synthesis

### Settled — the books agree

- **Breve rest = a block filling ONE whole space, the one between the middle line and the
  second line from the top** (Gould p. 35, measured; G&L p. 113 *"between the third and fourth staff
  lines, touching both lines"*; Ross p. 177 *"completely fills third space"*). Width: Gould says
  the same length as a semibreve/minim rest *"or, more commonly, half"* (measured 1.14 sp and 0.60 sp).
- **The whole-bar rest turns into a breve rest at 4/2 = 8/4** (Gould p. 160 *"4/2 or 8/4 and
  over"*; Ross p. 173 *"measures in 4/2 and 8/4 time"*; Stone p. 136 *"If … the total value of a
  measure reaches eight quarters (4/2 measures), a double whole-rest should be used"*; G&L p. 113
  *"With the exception of 4/2 and 8/4, the whole rest is used to signify a complete measure of rest"*).
  Gould's figure goes on to use a **plain breve rest for 5/2 too**. Below 4/2 (e.g. 3/2) the
  semibreve rest is still the bar rest.
- **Short rests add one hook per halving, each hook in its own space** — 16th the middle two spaces,
  32nd the top three, 64th all four (Gould p. 35); Ross p. 176 builds 16th/32nd/64th the same way,
  *"all hooks and dots fall within spaces"*. Measured on Gould's plate, the 64th's stem runs **≈0.9 sp
  below the bottom line**.
- **Flags beyond two lengthen the stem** (Gould p. 16 *"Extend the length of the stem for these"*;
  Stone p. 48 *"From three flags on, however, the stem must be lengthened"*; Ross p. 127 *"For each
  flag added beyond two, 1 space should be added to the stem"*).
- **Beams beyond two lengthen the stem** (Gould p. 19; Ross p. 125 *"Approximately ½ to 1 space
  is added … for each beam more than two"*). **Beam ½ sp thick, ¼ sp apart** (Gould p. 17; Ross
  p. 119; SMuFL/Bravura `beamSpacing` 0.25, `beamThickness` 0.5). **Four beams inside the staff
  are spread slightly further apart so each touches a line** (Gould p. 18; Ross pp. 125–126).
- **Breve and whole note have no stem** (G&L p. 96).

### Disagreements / variants

- **Breve head**: Gould p. 10 gives **three** equal options, no preference: oval with **two** vertical
  lines each side, oval with **one** line each side, or the **square** head. G&L p. 96 draws only the
  double-line oval. Gould's own glossary (p. 652) prints all three again. ⛔ No book on disk says
  which is "standard" or when to use which → the choice is a house-style row.
- **Per-extra-flag stem increment**: Ross says **1 sp** per flag beyond two; Gould's plate (p. 16)
  measures **≈0.75 sp (up) / ≈0.5–1.0 sp (down)**; Stone gives no number.
- **Per-extra-beam increment**: Ross **½–1 sp**; Gould labels her plate (p. 19) exactly — see §3 —
  and the increments there are not uniform because the beam must also land on a staff line.

### UNKNOWN (no source on disk answers it)

1. Anything about **128th, 256th, 512th** in any treatise we hold — every book stops at the **64th**
   (Gould's figures and her terms appendix p. 653 end at *hemidemisemiquaver*; G&L's tables p. 96 and
   p. 113 end at 64th; Ross's rests p. 176 at 64th; Ross's beams at *quadruple*, p. 125).
   Stem length, flag stacking, rest shape and placement for 5–7 flags/beams: **UNKNOWN** from the books;
   only SMuFL/font metadata speaks (§3, §4).
2. **Five or more beams** — spacing inside the staff: UNKNOWN.
3. **The longa as a NOTE** in modern notation — how drawn (stem side, length): **UNKNOWN** from the
   treatises. Not in Gould's text or glossary, nor G&L, Ross, Stone. SMuFL has **no modern longa
   notehead or precomposed note** (only `mensuralBlackLonga`/`mensuralWhiteLonga` and `restLonga`).
4. **Dotted breve, and ties of breves across barlines**: no prose found in any book on disk (a grep of
   the OCR; figures were not searched page by page) → UNKNOWN.
5. **Spacing of the breve and of anything shorter than the 16th**: Gould's table (p. 39) runs only
   16th = 2 … semibreve = 7 units; no book on disk gives a breve or 32nd/64th value → UNKNOWN (an
   extrapolation of her series would be ours, not hers).
6. **When the breve/longa is idiomatic** (early-music editions, 2/1 and 3/1, cadenzas): UNKNOWN from
   the books beyond the rest rule above. Gould's denominator figure (p. 152) starts at 1 = semibreve,
   i.e. she does not show a breve denominator.
7. The **longa rest in a single long bar** (e.g. 8/2 or 4/1): no book on disk → UNKNOWN. What IS
   sourced is its old use as a **four-bar rest** (§4).

---

## 1. The breve — round or square? dotted?

| source | what it says / draws |
|---|---|
| **Gould p. 10** (scan) | *"The breve: this can be notated in one of three ways:"* — drawn: **oval + two vertical lines each side** · *or* · **oval + one line each side** · *or* · **square** (hollow, horizontal strokes top and bottom with side lines). No preference, no context stated. |
| **Gould p. 652** (appendix, scan) | the symbol column prints `‖o‖ or \|o\| or ▭` for *breve / double whole-note*; French *carrée / brève / double-ronde*, German *Brevis*. |
| **G&L p. 96** | *"Double whole notes (or breves) and whole notes are without stems"*; draws only the **double-line oval**. |
| **SMuFL** | `noteheadDoubleWhole` U+E0A0 (round) and `noteheadDoubleWholeSquare` U+E0A1 (square); precomposed `noteDoubleWhole` U+E1D0 / `noteDoubleWholeSquare` U+E1D1. Bravura 1.392 bboxes: round 2.396 × 1.24 sp (it **overhangs** the space by 0.12 sp each side), square 1.664 × 1.552 sp. |
| Wikipedia *Double whole note* (tertiary) | *"a hollow oval note head … with one or two vertical lines on either side … or as the rectangular shape also found in older notation"*, citing Jacob 1960 p. 21 and Read 1969 p. 459 (⛔ not verified: Read not on disk). |

**Round vs square — which is standard?** UNKNOWN from a primary source. Gould presents all three as
equals. The only sourced hint that the square is the *older* form is the Wikipedia sentence above
(tertiary). → a house-style choice, default = what Gould draws first (double-line oval).

**Dotted breve:** UNKNOWN (see §0 UNKNOWN 4). The dot rules in `multiple-dots-research.md` are
stated for notes generally; nothing on disk treats the breve as a special case.

## 2. The longa

- **Treatises on disk: silent-by-absence is not established — UNKNOWN.** None of Gould, Ross, Stone,
  G&L names a longa *note* (grep of all four OCR texts; Gould's only `lunga` hit is the *lunga* pause, unrelated).
- **SMuFL**: no modern longa note/notehead. Available: `mensuralBlackLonga` U+E951,
  `mensuralWhiteLonga` U+E95D (mensural range), `restLonga` U+E4E1. A modern-looking longa would have to
  be composed (e.g. `noteheadDoubleWholeSquare` + a primitive stem) — this is what the Sibelius keypad
  icon shows (`sibelius-keypad.md`: *square head, stem down right*), which is an **application**, not
  a rule.
- Wikipedia *Longa (music)* (tertiary): in modern scorewriters it is *"sometimes called a quadruple
  whole note"*, *"often given the rounded notehead shape of the double whole note"*; in LilyPond
  *"the longa stem appears similarly to that of a half note, instead of always appearing on the right
  of the notehead as it does in mensural notation"*; and *"the note symbol was of purely theoretical
  interest … too extended a value for practical use"*, while *"the longa rest still appears as a way
  of writing rests that last exactly four measures"*.

→ Head shape, stem side (right, as in mensural, vs. by pitch like a minim), stem length: **UNKNOWN**
from any engraving treatise we hold. Build as rows.

## 3. Stems, flags and beams for 64th and shorter

### 3.1 Flagged (unbeamed) notes

| source | rule |
|---|---|
| **Gould p. 15** | *"The standard stem length allows room for one or two tails or beams … For each additional tail or beam, the stem must be lengthened."* |
| **Gould p. 16** | Semiquaver tails *"a little less than a stave-space apart"*; combined length ¼–½ sp longer than the quaver tail, stems *"most commonly remain the same length"* (3½). *Additional tails*: *"added further from the notehead than the quaver tail. Extend the length of the stem for these"*; *"some editions shorten the tails while others lengthen the stems"* (down-stems, to keep tails off the head). |
| **Ross p. 127** | flag slightly longer than 3 sp; *"A normal 3½ space stem will accommodate a single flag … The double flag can be treated just as the single flag … For each flag added beyond two, 1 space should be added to the stem."* |
| **Stone p. 48** | *"For eighth notes and sixteenth notes the length of the stems should remain the same as for unflagged stems. From three flags on, however, the stem must be lengthened to accommodate the additional flag(s)."* No number. |
| **G&L p. 96** | draws single 8th/16th/32nd/64th flagged, no numbers. |

**Gould p. 16's plate, MEASURED** (head centre → stem tip; up-stems on F4, down-stems on E5):

| | 8th | 16th | 32nd | 64th |
|---|---|---|---|---|
| up | 3.53 | 3.58 | 4.33 | 4.83 |
| down | 3.60 | 3.55 | 4.61 | 5.16 |

So she engraves ≈3½ for one and two flags, then **≈+¾ per extra flag up, ≈+1 then +½ down**. Ross's
+1 per flag is a little longer. Nothing past four flags.

**SMuFL** (spec, *glyphsWithAnchors*): flags are registered so y = 0 is the end of a normal (3.5 sp)
stem; `stemUpNW` / `stemDownSW` on each flag give *"the amount by which an up-stem should be lengthened
… to ensure a good connection with a flag"*. The spec's *Flags* notes: shorter flags may be built
from `flag16thUp` + n × `flagInternalUp`, *"ensuring even spacing"*. Glyphs exist for every value we
want: `flag64thUp/Down` U+E246/7, `flag128th` E248/9, `flag256th` E24A/B, `flag512th` E24C/D (and
1024th E24E/F).

Bravura 1.392 stem extension per flag (sp; up / down): 8th −0.04 / +0.13 · 16th −0.09 / +0.13 ·
32nd 0.38 / −0.45 · 64th 1.17 / −1.24 · 128th 1.90 / −2.08 · 256th 2.59 / −2.81 · 512th 3.32 / −3.61.
⚠️ These are **one font's** numbers — how far the stem must reach its own flag — not a treatise's
rule; but they are the only sourced numbers past the 64th. Increment ≈0.7–0.8 sp per flag, i.e. close
to what Gould's plate shows.

### 3.2 Beamed notes

| source | rule |
|---|---|
| **Gould p. 17** | *"Beam thickness is ½ stave-space. The distance between beams is ¼ stave-space."* |
| **Gould p. 18** | Three beams: up-stems the outer beam **hangs** from a line, down-stems it **sits** on one. **Four beams**: *"If possible, place the beams slightly further apart than normal, so that each is attached to a stave-line"*; otherwise a beam in a space is acceptable if reproduction is good. |
| **Gould p. 19** | *"The outer beam moves further away from the notehead to allow space for additional beams. Beams should never be closer to the notehead than the correct position of the semiquaver beam (2½ spaces). Extend stems for the additional beams"* — plate labelled **3 beams 3¾, 4 beams 4½** (note in a space) and **3 beams 3¼, 4 beams 4** (note on a line); *"and not"* 3½ / 3. Measured: 3.72 / 4.57 / 3.23 / 4.07 — the labels hold. On ledger lines: *"one clear stave-line between the innermost beam and the first ledger line"*. |
| **Ross p. 119** | the ¼-space standard, and that machines/engravers often deviate (½ space on some dies). |
| **Ross p. 125** | *"Approximately ½ to 1 space is added to the length of the stems for each beam more than two"*; three beams hang/straddle/sit on lines; with a slant under one space the gaps are *"opened and altered"* so each beam end touches a line (*"When at least one of the beams is outside the staff lines normal spacing is used"*). |
| **Ross pp. 125–126** | *Quadruple beams*: *"the space between the beams is enlarged in order that the ends of the beams can make contact with the staff lines … Stems are lengthened as necessary."* |

**Gould p. 18's four-beam plate, MEASURED**: beams 0.5 sp thick, beam pitch **0.9 sp** (gap ≈0.4 sp)
in the "correct" example — every beam touching a staff line — versus pitch ≈0.75 sp (gap ¼) in the
"not".

**5–7 beams**: **UNKNOWN** from every book on disk.

## 4. Rests

### 4.1 64th and shorter

- **Gould p. 35**: *"Shorter rests are placed so that each hook is in a separate stave-space. The
  [16th] occupies the middle two spaces, the [32nd] the top three spaces, the [64th] all four
  spaces."* Measured on the plate (sp below the top line): 16th ink 1.2 → 3.8, 32nd 0.2 → 3.8, 64th
  0.2 → **4.9** (its stem ends ≈0.9 sp below the bottom line).
- **Ross p. 176**: 16th hook below the 8th's, 32nd hook **above** the 16th's, 64th hook **below** the
  32nd's — *"all hooks and dots fall within spaces"*. (So the 32nd grows upward, the 64th downward — the
  same shape Gould engraves.)
- **Gould p. 38** (single-line staff): the bottom stroke intersects the line, or the hooks are placed
  either side of it. Dotted rests: the dot keeps its place relative to the rest.
- **G&L p. 113**: table of rests from double whole to 64th, drawn (64th spans the full staff and
  below).
- **128th / 256th / 512th rests: UNKNOWN** from the books. SMuFL has `rest128th` U+E4EA, `rest256th`
  E4EB, `rest512th` E4EC (`rest1024th` E4ED); the spec says y = 0 is *a* staff line, not necessarily
  the same line for every rest glyph. Bravura 1.392 bboxes (sp): 64th −3.01 … +1.72; 128th −3.0 …
  +2.76; 256th −4.0 … +2.78; 512th −4.0 … +3.78 — i.e. the font keeps adding one hook per halving,
  alternately up and down, so from the 128th the rest is **taller than the staff**. Where it should
  stand is not stated anywhere we hold.

### 4.2 The breve rest

- **Gould p. 34–35**: breve, semibreve and minim rests *"are the length of a minim notehead"*; *"The
  breve rest occupies a whole stave space and is the same length or, more commonly, half the length of
  the semibreve and minim rests"*. Two drawn versions, both in the **second space from the top**
  (measured ink 1.14 → 1.84 sp below the top line after removing line pixels, i.e. line to line);
  widths 1.14 sp and 0.60 sp.
- **G&L p. 113**: *"The double whole rest is placed between the third and fourth staff lines, touching
  both lines"* — same space, counted from the bottom. Drawn in 4/2 and 8/4.
- **Ross p. 177**: double whole rest *"completely fills third space"*.
- **Gould p. 38** (single line): *"The breve rest hangs from the line (as a semibreve rest does)."*
- SMuFL `restDoubleWhole` U+E4E2 (Bravura 0.5 × 1.0 sp), plus `restDoubleWholeLegerLine` U+E4F3.

### 4.3 The longa rest

- **Ross p. 177** — the old way of writing multi-bar rests, *"still in use by some engravers"*: 1 bar
  = whole rest; 2 bars = double whole rest filling the third space; **4 bars = *"two double whole
  rests join to fill the second and third spaces"*** — i.e. a block two spaces tall, between the 2nd
  and 4th lines; 8 bars = two four-bar rests.
- **SMuFL** *Rests* implementation notes: *"'Old style' multiple measure rests can be created by
  laying out restLonga (four bars), restDoubleWhole (two bars) and restWhole (one bar) next to each
  other."* `restLonga` U+E4E1 (Bravura 0.5 × ~2.0 sp); `restMaxima` U+E4E0.
- The longa rest as the rest of a **single** long bar or of a longa note's worth of silence:
  **UNKNOWN**.

### 4.4 When does the whole-bar rest become a breve rest?

- **Gould p. 160**: *"The semibreve rest acts as a whole-bar rest in any time signature (but see
  below). For all time signatures of 4/2 or 8/4 and over, the breve rest represents a whole-bar rest"* —
  figure: 3/16, 9/8, 3/2 → semibreve rest; **4/2 and 5/2 → breve rest**. Also: *"Place a semibreve rest
  at the beginning of its duration when it represents the sum of four crotchet rests, e.g. for a
  half-bar of 4/2."* Same page: the whole-bar rest is centred in the bar (in the blank space left by a
  clef/key/meter).
- **Ross p. 173**, **Stone p. 136**, **G&L p. 113** — all four agree on the 4/2 = 8/4 threshold (quotes in
  §0). Stone and G&L say "4/2 and 8/4" and do not address longer bars; Gould says *"and over"*.
- (Application, not literature: Sibelius draws a breve bar rest in 4/2 and 3/1 — `sibelius-keypad.md`.)

## 5. Spacing of very short and very long values

- **Gould p. 39**: *"each value taking only a little more space than the next shortest value"*, table
  16th **2** · 8th **2½** · dotted 8th 3 · crotchet **3½** · dotted crotchet 4 · minim **5** · dotted
  minim 6 · semibreve **7** units. **No breve, no 32nd or shorter.** p. 40: longer durations are
  *"compressed to create more even spacing"*.
- **Ross p. 73**: an engraver *"might set his compass at three and one-half spaces for the quarter
  note, … two and one-half spaces for the eighth note, five spaces for the half note, etc."*; spacing is
  judged from the value *in the majority*. No values beyond. Ross p. 78's chart: 4/4 bars only.
- **Stone p. 46**: *"The proper horizontal spacing of notes … is too complex to be included"*.
- **Breve / 32nd–512th spacing values: UNKNOWN** from the books. (Sibelius's shipped table has a
  breve at 10.56 sp against a quarter of 3.5 — an application's number, in `spacing-model-research.md`
  §2; our shipped law is LilyPond's log rule, which is defined for any duration.)
- **G&L pp. 30–31** (PDF 17, 2-up; half not checked): *"If 32nd- and 64th-note values occupy the majority of the rhythmic values, it
  may be better to double the rhythmic values of the entire piece and alter the tempo."*

## 6. When breves and longas appear; dots and ties

- The only sourced context in the treatises is **metrical**: the breve rest as the bar rest from 4/2 /
  8/4 on (§4.4), and Gould p. 160's *"half-bar of 4/2"* example. Gould p. 152's denominator figure
  starts at **1 = semibreve**; a breve denominator is not shown. Gould mentions replicating early-music
  editions only in passing (C clefs; diamond-head stems), never for the breve.
- Early music, 2/1 / 3/1, cadenzas, dotted breves, breves tied across bars: **UNKNOWN** (no prose in
  any book on disk). Wikipedia (tertiary, citing Gehrkens 1914 p. 11): the breve *"is rarely
  encountered except in English music, where the half-note is often used as the beat unit"*.

## 7. Are 256th / 512th practical? What is the shortest value the books cover?

- **Books on disk: the 64th is the shortest value any of them treats** — Gould (plates pp. 16, 18–19,
  35; terms appendix p. 653 ends *hemidemisemiquaver / sixty-fourth note*), G&L (pp. 96, 113), Ross
  (rests p. 176; quadruple beams p. 125). Stone never names a value past "three flags on".
- **Repertoire, Wikipedia only (tertiary — not verified against scores):**
  - 128th: Beethoven *Pathétique* Op. 13 i (rapid scales); Op. 27 No. 1 Adagio bar 24 (a 128th rest);
    Mozart *Je suis Lindor* K. 354; Bach BWV 1001 Adagio; Alkan Op. 76 No. 2.
  - 256th: Mozart K. 354 var. 11; some editions of Beethoven Piano Concerto No. 3 ii; Dussek Sonata
    Op. 10 No. 2; Vivaldi RV 444; Couperin *L'art de toucher le clavecin* Prelude 2, bar 15.
  - 512th / 1024th: A. P. Heinrich *Toccata Grande Cromatica* (256ths frequent, some 512ths, two
    1024ths); Ferneyhough *Quirl* and *Inconjunctions* (values down to 4096th).
- So 256th/512th exist in print but are rare; nothing on disk tells us how the engravers drew them.
- **MusicXML / SMuFL** encode down to 1024th (SMuFL glyphs listed above).

---

## Sources (pages)

Gould *Behind Bars*: pp. 10, 15–19, 34–35, 38–40, 152, 160, 652–653 (scans read; pp. 16, 18, 19, 35
measured). Ross: pp. 73, 78, 119, 125–127, 173, 176–177. Stone: pp. 46, 48, 136. Gerou & Lusk: pp.
30–31, 96, 113. SMuFL `latest`: *glyphsWithAnchors* (stemUpNW/stemDownSW, flag registration), tables
*Flags*, *Rests*, *Noteheads*, *Individual notes* (implementation notes); `public/smufl/glyphnames.json`.
Bravura metadata 1.392. Wikipedia: *Double whole note*, *Longa (music)*, *128th note*, *256th note*
(tertiary).
