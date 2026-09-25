# Glissando, portamento, bend and the jazz slides — what the BOOKS say

> **2026-09-25.** One agent, for the planned GLISSANDO / BEND tool (a line from a note to another note,
> or to nothing; Sibelius 6's "bend" line made richer). Sources: the four treatises on disk
> (`reference/README.md`) — **Gould** *Behind Bars* (PDF = printed + 20), **Ross** *The Art of Music
> Engraving* (PDF = printed + 12), **Stone** *Music Notation in the Twentieth Century* (2-up; PDF n holds
> printed 2n−22 / 2n−21 in this range, e.g. printed 18–19 = PDF 20, 62–63 = PDF 42), **Gerou & Lusk**
> *Essential Dictionary* (2-up; printed 70–71 = PDF 37). Every page below was located by grepping the
> `.txt` and then READ ON THE SCAN (150 dpi for wording, 600 dpi for Gould and Ross plates, 440 dpi for
> Stone); the OCR is not quoted.
>
> ⛔ **Unreached, so UNKNOWN, not silent:** Gardner Read, Kurt Stone's jazz chapter beyond the brass pages
> read here, Powell, Vinci, Heussenstamm, MOLA, any jazz-arranging manual (Sussman/Abene, Lowell/Pullig,
> Wright) — the jazz-articulation vocabulary below rests on Gould p. 267 and Ross p. 210 only. No web
> source was used.
>
> **Measuring convention.** 1 sp = one staff space measured on the same plate (Gould 600 dpi: 26.5–27 px;
> staff line 3 px = 0.11 sp, as in the manifest). "Measured" = pixel column scans of the scan
> (`pdftoppm -r 600 -gray`, a run-length scan per column). "Read" = estimated off a zoomed scan, ±0.2 sp.

---

## 0. Synthesis

### 0.1 Settled — every source that speaks agrees

- **A glissando is a line from head to head.** Gould p. 140 *"A diagonal line indicates both glissando and
  portamento"*; Stone p. 19 *"A thin, straight line should be used to indicate a glissando"*; Ross p. 198
  and G&L p. 71 give the line as one of two forms (below).
- **One line per note in a chord glissando**, one word for the lot. Gould p. 143 (*"Place parallel lines for
  parallel glissandos. Regardless of the number of notes, only one gliss. instruction is necessary"*),
  p. 358 harp (*"Each note of the chord takes a separate glissando line"*), Ross p. 198 (*"a line is placed
  for each note"*), G&L p. 71 (*"add a glissando symbol for each note. The word (gliss.) is used only once
  regardless of the number of notes"*).
- **The word is `gliss.`** (Ross prints `gliss` without the full stop), italic, lower case, placed close
  to the line. Portamento = the same line with `port.` (Gould p. 140; Stone p. 296 says `port.` must
  accompany the line *every time*, "not only at first occurrence").
- **The line may run to nothing.** All three that cover it draw a line with a free end (§3).
- **The line may be curved/undulating** to trace a pitch contour (Gould p. 146, p. 358; Stone pp. 19, 64).

### 0.2 Where they disagree

| question | Gould | Ross | Stone | G&L |
|---|---|---|---|---|
| straight or wavy? | **straight** recommended; wavy = *"some older editions … can take up too much space"* (p. 140) | **wavy first** (*"A slanted wavy sign (same as arpeggio and trill sign)"*), straight line + `gliss` as the alternative (p. 198) | **straight**; wavy lines are a separate family (pp. 19, 22) | *"a wavy **or** straight line"* (p. 71), both drawn |
| is the word needed? | yes, *"at least at their first appearances"*, *especially* on two staves (p. 140) | optional ("quite often noted with …") | *"customary … but this is not mandatory; the line suffices"* (pp. 19, 63) | *"It is helpful"* (p. 71) |
| text orientation | **either**: rotated parallel to the line and on the stave *"as long as it remains legible"* (p. 141 (a)), or horizontal near the line (pp. 142, 145, 358) | along the line, above it, letters stepping up the slope (p. 198) | along the line, above it (p. 19) | *"placing it at the same angle as the symbol"* (p. 71) |

### 0.3 The numbers (Gould's plates, measured)

| what | value | where |
|---|---|---|
| line weight | **≈ staff-line weight**: 3.0–3.25 px perpendicular vs 3 px staff line ⇒ **0.11–0.12 sp** | p. 141 (a) both lines; p. 142 system break |
| start gap (source head's right edge → line start) | **0.2–0.5 sp**, and it clears a ledger line (p. 141 (a) right: starts where the ledger ends) | p. 141, p. 142 |
| end gap (line end → target head's left edge) | **0.2–0.5 sp** | p. 141, p. 142 |
| vertical anchor | NOT head centre to head centre: start is 0–0.5 sp from the source centre *toward the target*, end 0–0.25 sp from the target centre *toward the source*. p. 141 (a) left: line slope 0.72 vs centre-to-centre 0.59 — the line is steeper than the centres' join | p. 141 |
| before an accidental | stops **≈ 0.7 sp** short of the sharp/flat (read), or is re-angled to meet the accidental's left side | p. 141 |
| system break | end-of-system piece stops **0.5 sp** before the barline; new-system piece starts **≈1 sp** after the clef and stops 0.5 sp before the head, **1.3 sp** long. ⭐ **Each piece spans the WHOLE interval** (A4→C5: both pieces run from A-height to C-height, rise 0.96 and 0.85 sp) — so the two pieces have different slopes | p. 142, measured |
| text gap | rotated `gliss.` sits ≈ **0.3–0.4 sp** above the line, roughly centred on its length | p. 141 (a) |

---

## 1. Gould, *Behind Bars* (on disk, full)

Pages: printed **140–146** (the chapter, PDF 160–166) · 247–248 wind (PDF 267–268) · 265–267 brass incl.
**jazz** (PDF 285–287) · 296 timpani (PDF 316) · 326 keyboard (PDF 346) · 340 piano strings (PDF 360) ·
357–360 harp (PDF 377–380) · 377–378 guitar (PDF 397–398) · 411 pizzicato (PDF 431) · 423–425 strings
(PDF 443–445).

### 1.1 Definition, gliss vs portamento (p. 140)

- *"The term glissando (abbrev. gliss.) is used throughout this book as a generic term to describe both a
  chromatic-step scale between pitches, and a genuine microtonal slide covering all intermediary pitches."*
- *"port. is often intended to indicate an expressive legato slide between two pitches, and the term
  glissando reserved for a more deliberate, continuous slide. (It is always safest to clarify intended
  interpretation in a preface.)"*
- *"A diagonal line indicates both glissando and portamento. A thin straight line is recommended, although
  some older editions use a wavy line (this can take up too much space)"* — drawn: a wavy line between two
  quarter notes.
- *"The instructions gliss. or port. should also be placed close to the lines, and used at least at their
  first appearances. This is especially important in a part on two staves (keyboard and harp), so that the
  glissando line is not mistaken for a voice-leading indication."*
- ⇒ **Graphically, gliss and portamento are the same line; only the word differs.**

### 1.2 Placing the line (p. 141)

- *"The glissando line should follow the course of the pitches exactly. Angle it precisely between the
  noteheads (a). The line should not appear to start above the first notated pitch (b), nor to go beyond
  the finishing pitch (c)."* — (b) shows a line starting above the first head; (c) a line overshooting past
  the target head.
- *"A glissando indication may be angled parallel to the line and be placed on the stave, as long as it
  remains legible."* (a) shows `gliss.` rotated, sitting above a descending line, inside the stave.
- *"Shorten the length of a line only when the glissando is intentionally shorter than the interval between
  two pitches"* — drawn: a short line arriving at the upper note from part-way (a late start).
- *"Where the distance between pitches is too short to contain a glissando line, place the line above or
  below the notes, away from the stems. In such cases, clarify the function of the line with a gliss.
  indication."* — drawn: short lines above beamed 16ths, one below, each with its own `gliss.`; `non gliss.`
  for a repetition without.
- **With accidentals:** *"A glissando line should not run through an accidental and risk obscuring it. Stop
  the line short of an accidental, or angle it to the left of the accidental."* Both versions drawn; in the
  second the line is steepened to meet the accidental's upper-left.

**Measured, p. 141 (a)** (600 dpi, sp = 26.9 px, staff line 3 px):
- Left (descending half-note F5 → half-note D4-ish, `gliss.` rotated): line from x 718 to ≈870, slope 0.716
  (35.6°), vertical run 4 px ⇒ perpendicular **3.25 px = 0.12 sp**. Start ≈ 0.2 sp right of the head,
  0.26 sp below its centre; end ≈ 0.45 sp before the target head, ≈ 0.25 sp above its centre.
- Right (ascending, from a note on the 2nd ledger below): slope −0.865 (40.9°), vertical run 4 px ⇒
  **3.0 px = 0.11 sp**. Starts where the ledger line ends (≈0.5 sp from the head, 0.5 sp above its centre);
  ends ≈ 0.2 sp before the target head at its centre height.

### 1.3 Special cases (pp. 142–146)

- **Over a system break** (p. 142): *"Reflect the correct interval of a glissando in the gradient of the
  line"* — correct: a gentle line to the end of the system, a short gentle line after the clef into the
  target; wrong ("and not"): a steep line out of the staff, a steep one in. **Measured** in §0.3: both pieces
  span the whole interval; no restated head at the start of the new system.
- **Between notes of the same pitch letter** (p. 142): *"Angle a glissando line in the direction of the
  raised or lowered pitch"* — G♯→G♮→G♭ drawn with small downward slants, B♭→B♮→B♯ upward.
- **With clef changes** (p. 142): *"Where possible, avoid changing clef in the course of a glissando: use
  ledger lines instead"*; *"Never arrange a clef change so that the angle of the glissando line would be in
  the opposite direction to the slide."* Harp, p. 359: *"place the new clef mid-way through the glissando."*
- **To and from unspecified pitches** (pp. 142–143): *"Do not give a steep gradient to a line that is likely
  to reflect only a small interval"*; *"If the glissando is to an unspecified highest or lowest note, a
  triangular notehead indicates the end pitch"* — drawn: a line to a small triangle-headed stem after the
  note, up and down; the "and not" has a steep line to a far arrow. Harp: *"an arrow placed at the end of a
  glissando line indicates direction but not a specific finishing pitch."* Speed of an open glissando
  *"should be prescribed verbally, e.g. gliss. rapido/lentiss."*. ⚠️ The heading says "to AND FROM", but
  every drawn example is TO.
- **Clusters** (p. 143): a broad band (a thick filled shape) the width of the cluster, or outer lines + shading.
- **Starting midway** (p. 144): divide the initial value (tie) to show where the slide starts, or tie to a
  grace note *"to place a glissando just before the next measured value"*.
- **Finishing pitch** (p. 144): needed *"when a glissando is followed by a rest, by a separately
  articulated note or by a note that is other than the final pitch"*; *"Notate the finishing pitch as a
  grace note or small stemless notehead"*, bracketed or slurred if not re-articulated.
- **Durations** (pp. 144–146): interim pitches in brackets; the initial note takes the glissando's full
  duration where possible; later values *"lose their noteheads but indicate their rhythms with stems close to
  or attached to the glissando line"*. Tied initial values and rests as durations are *"not acceptable"*.
- **Contour** (p. 146): *"A glissando line may be curved to any contour"* — drawn: **"woodwind pitch bend /
  bend pitch at end of note"** (a short line after each head that dips), and an **undulating glissando** (a
  wave from a whole note rising into a quarter).

### 1.4 Bend (p. 248) — a line AFTER the head

- *"To bend a note is to alter its pitch by embouchure and/or throat adjustment. This may be specified as
  lip or bend … The bend is notated as a line after the notehead, which may be shaped to reflect the contour
  of the glissando."* Five drawings: dotted quarter → slanted line → eighth (slurred); a flat quarter with a
  straight falling line to nowhere; a half note → line → bracketed small target with a ↑ quarter-tone sharp;
  `bend down ¼-tone`: a line after the head with a shallow dip that returns; `bend pitch ¼-tone`: an
  **unshaded wavy line** after the head.
- Chromatic glissandos are written out and marked `chrom.` (p. 248); `quasi gliss.` (p. 247).

### 1.5 Jazz (p. 267) — the only jazz paragraph in the book

- *"Works in the jazz medium use a diagonal trill line or curved glissando line to 'swoop onto' or to 'fall
  off' a note, usually from or to an unspecified pitch. There are many terms that define the sounds produced
  by these different gestures; the most common term transferred to the classical repertoire is the 'rip'.
  Such slides, especially those onto a note, are usually fast, but length may be specified verbally."*
- Drawn (read, sp ≈ 22.5 display px): **`rip`** — a jagged/sawtooth (trill-like) diagonal from nothing up
  into F♯5, ≈4.3 sp wide × 4 sp rise, ending before the accidental; **`long fall off`** — the same jagged line
  down-right from the head, ≈3.8 × 3.4 sp. Then four **unlabelled curved** gestures, ≈1.5–3.6 sp long:
  a concave curve from lower-left rising into a head (scoop/swoop onto, ≈3.6 sp wide, ≈2.3 sp rise, ending
  ≈0.5 sp left of the head); a hook from above dropping into a head (plop-shaped); a curve from a head
  arcing down to the right (fall); a curve from a head arcing up to the right (doit). ⚠️ Gould names only
  `rip` and `fall off`; `doit`, `plop`, `scoop`, `smear` do not occur in the book (grepped).
- Horn harmonic gliss (p. 267): a line between the notes with `harm. gliss.` stacked above.

### 1.6 Instruments

- **Keyboard** (p. 326): *"A solid diagonal line indicates a glissando. The glissando should not be written
  out as a scale"*; `white-note gliss.` / `black-note gliss.`. Drawn: lines crossing the gap between the two
  staves, and a two-line (double-note) glissando from the bass staff up into the treble.
- **Piano strings** (p. 340): *"A conventional diagonal glissando line can indicate only a glissando across
  the strings of different pitches (a). A trill line may be used to indicate the duration of a scrape along
  the wound copper strings of a single pitch (b)"* — (a) a line **ending in an arrowhead**.
- **Harp** (pp. 357–360): measured glissando written as a scale; unmeasured = start + end notes *"connect[ed]
  with a diagonal line"*, starting note takes the full duration. Drawn: a line crossing from the bass staff
  to the treble staff unbroken; parallel-chord glissandos as 3 parallel lines; **continuous sweeps** as
  zig-zag lines across both staves, ending in an **arrow** (a) or on pitches at each peak (b). **Pedal
  glissando** (p. 359): line + slur + `ped. gliss.`.
- **Timpani** (p. 296): *"Glissando after the note is struck: the slur indicates that the final note … is not
  re-articulated"* (line to a bracketed grace, slurred); *"Rolled glissando"*: tremolo strokes on stemmed
  notes joined by lines.
- **Brass** (pp. 265–266): `half-valve gliss.` (line + text above); trombone slide limits; horn hand-stopped
  gliss.; harmonic (lip) glissando written out with `gliss.` below the notes.
- **Guitar** (pp. 377–378): *finger shift* = line + slur (inaudible); *audible glissando* *"must be marked
  gliss."*, no slur if the second note is plucked; drawn with `gliss.` horizontal above/below; a chord slide
  as three parallel lines. **String bending**: `bend` over a line after the head to a bracketed target.
- **Strings** (pp. 411, 423–425): pizzicato glissando; ⭐ p. 411 (c) *"it is not always necessary to notate a
  finishing pitch for the glissando"* — drawn: a line rising off a B♭ **into empty space**. Harmonic
  glissando with `harm. gliss.` **rotated parallel to the line** (p. 423); artificial harmonics: a line
  between both the fundamental and the diamond (two parallel lines, p. 424).

---

## 2. Ross, *The Art of Music Engraving* (on disk, full)

### 2.1 Glissando (p. 198, PDF 210)

- *"A slanted wavy sign (same as arpeggio and trill sign) extending between the notes to be embraced. It is
  quite often noted with a line running between the notes to be embraced accompanied with the abbreviation
  in lower case italic type."*
- *"If two or more notes on the same staff progress simultaneously as glissando, a line is placed for each
  note."*
- Drawn (600 dpi): the wavy form is a **heavy** wavy line (much darker than a staff line); the straight form
  is thin, with `gliss` (no full stop) above the line, letters stepping up the slope. Both start just right
  of the stem side of the first head (up-stem, so near the head's upper right) and end just short of the
  target head's lower left. Chords: one line per note, parallel.
- The wavy die is shared with the arpeggio and trill (*"The plate engraver uses a die about 3 spaces long
  and connects them to produce any desired length"*, p. 198).

### 2.2 Stage band articulations (p. 210, PDF 222) — the most complete jazz table on disk

Quoted definitions, then what is drawn (read off 600 dpi; sp ≈ 34.5 px):

| name | Ross's words | drawn |
|---|---|---|
| THE FLIP | *"Sound note, raise pitch, drop into following note (done with lip on brass)."* | an inverted-V/caret line **above** the head, rising left, falling right |
| THE SMEAR | *"Slide into note from below and reach correct pitch just before next note. Do not rob preceding note."* | a short slanted **tick above** the head (not a line from below) |
| THE DOIT | *"Sound note then gliss upwards from one to five steps."* | a short **curve** from the head's upper right, curving up |
| SHORT GLISS UP | *"Slide into note from below (usually one to three steps)."* | a **straight thin line** before the head, from lower-left, ≈1.1 sp tall × 0.7 sp wide, ending ≈0.5 sp left of the head, ≈0.4 sp below its centre |
| LONG GLISS UP | *"Same as above except longer entrance."* | the same, ≈3.2 sp tall × 1.7 sp wide |
| SHORT GLISS DOWN | *"The reverse of the short gliss up."* | a straight line **after** the head going down-right, ≈1 sp |
| LONG GLISS DOWN | *"Same as long gliss up in reverse."* | ≈2.9 sp |
| SHORT LIFT | *"Enter note via chromatic or diatonic scale beginning about a third below."* | a **wavy/beaded** thick line before the head, from lower-left |
| LONG LIFT | *"Same as above except longer entrance."* | the same, longer (≈3 sp) |
| SHORT SPILL | *"Rapid diatonic or chromatic drop. The reverse of the short lift."* | wavy line after the head, down-right |
| LONG SPILL | *"Same as above except longer exit."* | the same, longer |
| THE PLOP | *"A rapid slide down harmonic or diatonic scale before sounding note."* | a wavy line **from upper-left down into** the head, with a small ornament at its top |

⇒ Ross's graphic rule: **straight line = gliss (smooth); wavy line = lift/spill (scalar, stepped)**;
**before the head = into it (from nothing); after the head = out of it (to nothing)**; the length is a
two-value SHORT/LONG choice.

---

## 3. Stone, *Music Notation in the Twentieth Century* (on disk, full)

### 3.1 General conventions (pp. 19–21, PDF 20–21)

- *"There is no universal agreement concerning the 'proper' execution of glissandos on bowed string
  instruments (smooth slides versus fast chains of individual pitches). If a particular interpretation is
  wanted it should be explained at its first appearance."*
- *"A thin, straight line should be used to indicate a glissando. It is customary to add the abbreviation
  gliss., but this is not mandatory; the line suffices."* Drawn: `gliss.` above the line, along its slope.
- **A. Note-to-note and note-to-rest:** 1. ending in a note — *"The line leads to the next regular note"*;
  2. followed by a rest — *"The line ends with a small, parenthetical note-head. The small note-head is not
  articulated; it merely ends the glissando"*; 3. followed by a slightly separated note — *"A small comma is
  placed between the end of the line and the new pitch."*
- **B. Open-ended:** 1. final pitch approximate — *"The line ends in the vicinity of a final pitch"*
  (drawn: a line ending in empty staff before a rest); *"The line ends with an arrowhead when the final pitch
  lies beyond the arrow"*. 2. **opening pitch approximate** — *"The duration of the glissando must be
  indicated with a cue-note and bracket"* (drawn: a line from **nothing** rising into a quarter, a small
  half-note with a bracket above). 3. both approximate — cue notes + brackets, line from nothing to nothing
  with an arrowhead.
- **C. Curved or undulating:** *"The line traces the approximate course of the glissando."*
- **D. Quick, short slides (Portamento):** 1. **INTO A NOTE** — *"Short slides having no specific opening pitch
  or duration should be performed like grace notes. Use a short line"* (drawn: a short straight line just
  before the head); 2. **OUT OF A NOTE** — *"Same as above, except that it is customary to use short, curved
  lines."*
- **E. Compound durations** (p. 21): *"stems with or without flags or beams must be attached to the
  glissando line (but without note-heads)"*; the line crosses the barline.

### 3.2 Pitch chapter (pp. 63–65, PDF 42–43) — repeats and adds

- Note-to-note (lines between beamed notes; `gliss.` along one); note to a small parenthetical head.
- Open-ended: *"The free end of the glissando line implies an approximate final pitch"*; *"The arrowhead shows
  that the final pitch lies beyond the end of the glissando line."*
- **D. Slides into a note:** *"1. QUICK SLIDES — These have neither specific opening pitches nor specific
  durations, and are to be performed in the manner of grace notes"* — drawn: short straight lines, one from
  **above** into a quarter, one from **below** into a flat quarter; *"(No rests should be used.)"*
  *"2. SLOW SLIDES — These are glissandos with indefinite opening pitches"*: a **straight slide** (a long line
  from below the staff into the head, and one from above) and a **curved slide** (an S-curve rising into the
  head), each with a parenthetical cue value `(♩)` over its start — *"Parenthetical notes should be used to
  show the duration of the slide."*
- p. 65: *"Quick slide to the highest note"* (a short line to a triangle head) vs *"Ordinary (measured)
  glissando to the highest note"*.

### 3.3 Elsewhere

- **Bending the pitch** (winds, p. 187): *"A 'contour' line is drawn at the level of the note-head"* — drawn: a
  horizontal line after the head with a dip / a rise and fall.
- **Rip** (brass, pp. 202–203): *"The rip is essentially an arpeggiated glissando. It is notated either with a
  broken line (to symbolize the rip's irregular succession of pitches) or with a slurlike curved line."*
  Broken-line = a **dashed** line + slur + `rip` (*"Solid-line notation is also used but is not recommended
  because of its similarity to glissando notation"*); slurlike = a short curve, incl. *"with unspecified
  opening pitch"* (a curve from nothing into the note) and *"The forced rip to the highest possible pitch,
  usually called 'shriek'"* (a curve up to an arrowhead).
- **Vocal portamento** (p. 296): *"The notation of a vocal portamento consists of the same thin line as used
  for a glissando. Consequently, the abbreviation port. must always accompany the line (not only at first
  occurrence)"*; *"In music in which both glissando and portamento are used, it is best to add abbreviations
  for both sound productions throughout."*
- **Horizontal wavy lines** (p. 22): *"the variety of horizontal lines—solid, dotted, broken, wavy, etc.—which
  used to be employed quite indiscriminately, has become identified more and more with distinct meanings"*.

---

## 4. Gerou & Lusk, *Essential Dictionary* (on disk, full) — p. 71, "Glissando sign"

- *"A glissando is indicated by a wavy or straight line placed at an angle, ascending or descending."*
- *"Indicate the beginning and ending notes of the glissando."*
- *"It is helpful to add the abbreviation (gliss.), placing it at the same angle as the symbol."* — drawn:
  rotated `gliss.` on the upper-left side of a rising line and upper-right of a falling one.
- *"If the glissando affects more than one note, add a glissando symbol for each note. The word (gliss.) is
  used only once regardless of the number of notes."*
- All drawings are on a **grand staff**, the line (wavy or straight) **running unbroken across the gap between
  the staves**, from a low bass-staff note to a high treble-staff note.
- Jazz articulations (fall, doit, plop, scoop): **not found by grep** in the OCR; the book was not read page by
  page for them ⇒ UNKNOWN whether it has them.

---

## 5. From nothing INTO a note (added at the coordinator's request)

| source | name | drawn | where it starts | length / angle |
|---|---|---|---|---|
| Gould p. 267 | *"swoop onto"* (and `rip`) | `rip`: a jagged trill-like diagonal; *swoop*: a concave curve from lower-left, or a hook from above | in empty space before the head; ends ≈0.5 sp left of it (before any accidental) | rip ≈4.3 sp × 4 sp rise; curve ≈3.6 sp × 2.3 sp (read). *"Such slides, especially those onto a note, are usually fast, but length may be specified verbally."* |
| Gould p. 144 (b) | glissando just before a measured value | a line into a **grace note** tied from the previous note | from a real note (not from nothing) | — |
| Ross p. 210 | SHORT / LONG GLISS UP | a straight thin line | lower-left of the head, from nothing | short ≈1.1 sp tall, long ≈3.2 sp; steep (≈55–60°) |
| Ross p. 210 | SHORT / LONG LIFT | a **wavy** line | lower-left, from nothing (*"beginning about a third below"*) | short/long |
| Ross p. 210 | THE SMEAR | a small tick **above** the head | — (a sign, not a line from below) | ≈0.7 sp |
| Ross p. 210 | THE PLOP | a wavy line from **upper-left** down into the head | from nothing above | ≈2 sp |
| Stone pp. 20, 64 | quick slide / portamento INTO A NOTE | a **short straight line**, from below or from above | just before the head; *"(No rests should be used.)"* — takes no rhythmic time | ≈1–1.5 sp (read) |
| Stone p. 64 | slow slide (indefinite opening pitch) | straight or curved line from nothing | from well below/above; duration given by a **parenthetical cue value** over its start | several sp |
| Stone p. 19 | glissando with approximate opening pitch | line from nothing + cue note & bracket | — | — |
| Stone p. 203 | rip with unspecified opening pitch | slurlike curve + `rip` | from nothing below | short |

⇒ **It is a gliss line (or the wavy form), not a glyph**, in every source — only Ross's SMEAR and FLIP are
small signs above the head. It is anchored at its END (the head) and its START is free, at a length the
sources give only as SHORT / LONG (Ross) or as the pitch range meant (Gould p. 142: *"Do not give a steep
gradient to a line that is likely to reflect only a small interval"*).

---

## 6. What the plan should take from this

Each item says which sources support it. None is a blocker (CLAUDE.md rule 13); every number is a row.

1. **One kind, a straight line by default, from head to head.** Gould (recommends), Stone (thin straight),
   Ross + G&L (as one of two). **Style = a row: `straight` | `wavy`.** Wavy is Ross's first form and G&L's
   equal alternative; Gould calls it old-fashioned and space-hungry. Default **straight** (Gould preset).
2. **Gliss vs portamento = the SAME line, a different word.** Gould p. 140, Stone p. 296. Model the word as
   a text field (`gliss.` / `port.` / none / free text such as `harm. gliss.`, `ped. gliss.`,
   `half-valve gliss.`, `white-note gliss.`, `chrom.`, `rip`, `bend`), not as separate line kinds.
3. **Line weight ≈ staff-line weight** (Gould measured 0.11–0.12 sp). Ross's wavy form is heavier (the trill
   die) — the wavy style can reuse the trill line's wiggle (Ross says it IS the trill/arpeggio sign). Gould
   disagrees in her drawings: the bend's wave on p. 248 and the undulating gliss on p. 146 are drawn thin,
   of even weight. Her word for that is on p. 147, for vibrato: *"An unshaded wavy line (not the shaded
   trill line)"*. Keep the two wiggles as separate rows.
4. **Endpoints: gaps from the heads, not head centres.** Gould: start 0.2–0.5 sp after the source head (and
   after its ledger line), end 0.2–0.5 sp before the target head; each end is shifted toward the other note
   (0–0.5 sp from the centre). Rows: `startGap`, `endGap`, `startYBias`, `endYBias`.
5. **Accidentals on the target:** stop short (≈0.7 sp read) or re-angle to the accidental's left. Gould p. 141
   gives both; choose "stop short" (the simpler: the end x is the accidental's left edge minus a gap).
6. **Text:** placed close to the line, ONE per chord. Orientation is where the books split: Gould allows
   rotated-on-the-line or horizontal; Ross, Stone and G&L rotate it. **Default rotated, parallel, above the
   line, centred on it (Gould p. 141 (a): ≈0.3–0.4 sp clear)**; a horizontal option is a row. When the line
   is too short for the word, Gould p. 141: move the line above/below the notes with the word beside it —
   ⚠️ a rule for later; a simpler first cut is to **omit the word** when it does not fit (no source states
   an omission rule; UNKNOWN).
7. **Chord glissando = one line per note**, parallel, one word. All four. (Gould also allows outer-lines-only
   for clusters.)
8. **System break: two pieces, no restated head.** End piece stops 0.5 sp before the barline; the next
   system's piece starts after the clef/signature and ends at the target. Gould measured: **each piece spans
   the whole interval** (so their slopes differ) — the rule to copy is "the gradient reflects the interval",
   not "one continuous straight line cut in two", which is her *wrong* example.
9. **Between staves:** the line runs **unbroken** across the gap (Gould harp/keyboard pp. 326, 358; G&L p. 71).
10. **To nothing** (target-less, "glides away"): Gould p. 411 (c) (line into empty space), p. 143 (triangle
    head / arrow for highest–lowest), p. 340 and Stone p. 20 (arrowhead = *beyond*); Stone p. 20
    (free end = *approximate* pitch; followed by a rest ⇒ small parenthetical head). ⇒ an END CAP row:
    `none` | `arrow`; the length and angle of a free end are the user's (Gould p. 142: the gradient must
    reflect the pitch range meant).
11. **From nothing** (§5): the same line with a free START. Ross (SHORT/LONG GLISS UP, LIFT, PLOP) and Stone
    (quick slides "like grace notes", no rest; slow slides with a cue value) agree it is a line ending at the
    head. Default length: Ross's SHORT ≈ 1–1.5 sp; LONG ≈ 3 sp.
12. **Bend** (Sibelius's line): Gould p. 248 and Stone p. 187 — *a line after the notehead*, near-horizontal,
    shaped to the contour (dip, rise, wave). ⇒ "bend" is the free-end case with a near-horizontal default and
    an optional contour (dip / wave), plus text `bend` / `lip`.
13. **Jazz articulations** (fall, doit, scoop, plop, lift, spill, smear, flip, rip): Ross p. 210 is the only
    table; Gould p. 267 names only `rip` and `fall off` and draws curved/jagged lines. Ross's rule to copy:
    **straight = gliss, wavy = scalar (lift/spill/plop), curved = doit/fall/scoop, before-head = into,
    after-head = out of, SHORT/LONG = two lengths.** Gould draws the rip/fall as a *jagged* (sawtooth) line
    and Stone as *dashed* (broken) — a third style value. ⚠️ Whether these belong in this tool or are
    separate articulation glyphs (SMuFL has `brassFallLipShort`, `brassDoitMedium`, `brassScoop`, … — not
    checked here) is a PLAN decision; no book decides it.
14. **Curved/undulating contour:** Gould p. 146, 358; Stone pp. 19, 64 — a later feature; the model should not
    assume two endpoints only.
15. **Not a glissando's job, but adjacent:** the finishing-pitch grace/parenthetical head (Gould p. 144, Stone
    p. 19), stems on the line for compound durations (Gould p. 145, Stone p. 21), `non gliss.`. Out of scope
    for a first cut.
