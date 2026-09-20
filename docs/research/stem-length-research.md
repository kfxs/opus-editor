# What decides a STEM — its LENGTH, its ATTACHMENT, its THICKNESS

> 📄 This document was the gate on `docs/plans/note-engraving-plan.md` **P3e** — ⭐ **and the gate opened on
> 2026-09-16.** The plan had stopped at the stem's INK (§1c) *"⛔ and NOT its length"*, because
> `docs/plans/own-engraving-engine.md` §6.1 listed stem length among the places *"where we currently have no
> opinion"* and its own rule is that a re-implementation with no stated rule is **strictly worse than a
> dependency**. So: the rule first, the code after.
>
> ⭐⭐ **WHAT §1 FOUND IS NOW CODE, AND IT MOVED NO PIXEL.** The 3½-space rule is
> `STEM_LENGTH_PX` in `engine/engrave/inheritedDefaults` — ⭐ the one row in that table this library
> CONFIRMS rather than disputes, because `Tables.STEM_HEIGHT` was already 35 px = 3.5 × 10 — and the
> reach is `engine/engrave/notes/stemLength` (`stemExtents`, `stemLineHeight`), answered by
> `EngravedStem`. S6e of `docs/history/vexflow-removal-map.md`.
>
> ⏳ **What this document still gates**, and neither is decided by that number: the **ATTACHMENT**
> point (§4) and the **short-note minimums**. ⛔ Also still VexFlow's RULE: how much EXTENSION a note
> asks for — a flag's overhang, the per-duration beam table, and the reach to the middle line (§1 rule
> 2) — which meets `applyStemExtensions` from the other end in `docs/plans/beam-engraving-plan.md`.
> (⚠️ 2026-09-19: VexFlow is removed — that rule is now transcribed as our code,
> `EngravedNote.getStemExtension` + `engrave/beams/beamedStems`, unchanged.)
>
> ⛔ **Beyond that gate, this document proposes nothing and names no file to edit.**
>
> **Sources**: four treatises on disk, all read on RENDERED pages, never from the OCR layer
> (`reference/README.md` says why). **Gould: PDF page = printed page + 20. Ross: PDF page = printed
> page + 12. Stone: the PDF is 2-UP — printed pp. 48–49 are PDF page 35, left and right halves.**
> ~~Gerou & Lusk's PDF is 1-up with its own printed numbers.~~ 🚨 **WRONG, corrected 2026-09-14:
> Gerou & Lusk's PDF is 2-UP like Stone's — printed page P is on PDF page P/2 + 2 (PDF *n* carries
> printed 2n−4 and 2n−3).** Verified independently by two investigations
> (`docs/research/accidental-dot-research.md`, `docs/research/slur-tie-research.md`) on two pages each. ⚠️ **Every
> G&L citation in this document was found under the 1-up assumption and is owed a re-check** — the
> printed page numbers quoted may be right (they were read off the page) but the route to them was
> not. Three engines at
> `~/dev/engine-sources/{lilypond,MuseScore,verovio}` at the commits `reference/README.md` records.
>
> ⭐⭐ **The headline surprise: STONE HAS A FULL STEM-LENGTH CHAPTER (pp. 47–49) and this library had
> never asked him anything.** He is the only source that states a number for every case in one place,
> and he agrees with Gould on almost all of them. `reference/README.md`'s standing warning — *"every
> '⛔ Read / Stone / Ross — UNKNOWN, not on disk' line was written BEFORE 2026-08-18; treat those as
> not yet asked"* — was right.

---

## 1. The question, and the short answer

**All four treatises say the same three things, in the same words.**

1. **A stem is one octave long — 3½ stave-spaces — measured from the CENTRE of the notehead.**
   Gould p. 14, Ross p. 83, Stone p. 47, Gerou & Lusk p. 137. Four for four, no dissent, no
   qualification. Ross's footnote explains the alternative phrasing: *"Plate engravers, who say that
   the stem length is three spaces, measure from the end of the stem to the nearest point on the
   notehead."* ⭐ **3½ from the centre and 3 of visible stem are the same rule** — which is exactly
   the discrepancy every engine encodes as a notehead anchor (§4).

2. **A stem always reaches the middle stave-line.** For a note far enough out that a 3½ stem would
   stop short, the stem is LENGTHENED. Gould p. 14 (*"notes on more than one ledger line"*), Ross
   p. 86 (*"on or above the second leger line"*), Gerou & Lusk p. 137 (*"beyond one leger line"*),
   and Stone p. 48 states it as a universal: ***"all stems must either cross the middle line or
   reach it (except, of course, in double stemming)."***

3. **When the stem is forced to point AWAY from the staff — double-stemmed writing, or a chord
   whose outer note is already outside — it is progressively SHORTENED, and the floor is a sixth,
   2½ stave-spaces.** Gould p. 14, Stone p. 49, Gerou & Lusk p. 137 all name the sixth and 2½ in the
   same breath. Ross p. 86 draws the same floor without calling it an interval.

⭐ So the length is a **piecewise function of one variable — the note's staff position relative to
the middle line, in the stem's own direction** — with a constant 3½ in the middle, a lengthening
clamp on the far side, and a shortening ramp on the near side bottoming out at 2½. Every engine
implements exactly that shape (§4). **What the sources do NOT agree on is the ramp's slope**, and
the drawn evidence disagrees with all of them (§3, §5).

**ATTACHMENT.** Ross p. 83 states it outright: *"A note on or below the second space has an up-stem
on the **right side** of its notehead. A note on or above the middle staff line has a down-stem on
the **left side** of its notehead."* Gould states the principle only for the special noteheads —
p. 11 *"A stem joins the diamond at the **side** of the notehead, and **not at the central point**"*,
p. 12 *"The stem joins the cross at the **edge** of the symbol, and not at its centre"* — but never
for the ordinary oval. **No treatise gives a vertical attachment point.** All three engines take
both coordinates from the font's SMuFL `stemUpSE` / `stemDownNW` anchors, which is the only source
of an actual number.

**THICKNESS. Three treatises agree, no source gives a number, and it is the one place the drawing
does not back the prose.**
- Gould p. 13: *"Stems should be thinner than the stave-line, but not so thin as to reproduce too
  faintly."*
- Ross p. 83: *"The stem, which is somewhat thinner than the staff line, should never be flabby and
  distorted."*
- Gerou & Lusk p. 137: *"Stems are thinner than staff lines and barlines"*, and again on p. 25 in
  the barline entry — *"(staff lines being thicker than stems)"*.
- ⚠️ **Measured on Gould's own p. 14 at 450 dpi, they are the same width** — §3.4.
- Stone: **UNKNOWN** — no thickness statement anywhere in his index or his Stems chapter.

---

## 2. What each treatise says

### 2.1 ⭐⭐ GOULD, *Behind Bars* — printed pp. 13–19 (plus 52, 125, 305, 569)

The stem material is `Stems` pp. 13–14, `Tails` pp. 15–16, `Beams` pp. 17–19, `Double-stemmed
writing` p. 52. Read on PDF pages 33–39, 72, 145.

| where | verbatim |
|---|---|
| **p. 13**, *Stems* | *"Stems should be thinner than the stave-line, but not so thin as to reproduce too faintly."* |
| **p. 13**, *Stem direction* | *"Notes above the centre stave-line take down-stems, notes below the centre stave-line take up-stems"*; on the centre line *"the stems may go in either direction. The direction is determined by context."* |
| **p. 14**, *Stem length* | ⭐⭐ *"The standard length of a stem is one octave (i.e. 3½ stave-spaces) **from the centre of the notehead**"* |
| **p. 14**, *Notes on ledger lines* | ⭐ *"Stems for notes on **more than one ledger line** extend to the middle stave-line"* |
| **p. 14**, *Double-stemmed writing* | ⭐⭐ *"As stems fall further outside the stave, they are **progressively shortened**. The shortest stem length is a sixth (2½ stave-spaces): **no stem should ever be shorter than this**."* Figure caption: *"stem length measured by (interval) and in stave-spaces"*, labelled (octave) 3½ · (seventh) 3 · (sixth) 2½, with *"imaginary ledger lines"* drawn at the stem ends so the interval can be counted. |
| **p. 15**, *Chords* | ⭐ *"Stem length is measured from the note closest to the open end of the stem. This stem is the length it would be as a single note."* · *"Stems within the stave are one octave long (3½ stave-spaces); stems for notes on ledger lines reach to the middle line"* · *"Stems outside the stave are progressively shortened (as in Double-stemmed writing, opposite)"* — the figure labels two chords **3** and **2½**. |
| **p. 15**, *Adding tails and beams* | ⭐ *"The standard stem length allows room for **one or two** tails or beams to be attached. In double-stemmed writing, the stem length of 2½ spaces accommodates **only one** tail or beam. For each additional tail or beam, the stem must be lengthened."* |
| **p. 15**, *Quaver tails* | *"The engraved design of tail is 2½–3¼ stave-spaces long (3–3¼ is the norm). This ensures that the tail of an up-stemmed note finishes opposite or just above the notehead."* |
| **p. 16** | ⭐ *"When a stem is shorter than 3 stave-spaces, the tail should avoid overshooting the notehead. A stem length of 2½ spaces can accommodate a tail of this length, but **the stem should be lengthened for a longer tail**."* Drawn: stem 2½ + tail 2½ ✓, stem 3 + tail 3 ✓, **stem 2½ + tail 3 ✗** (*"but not"*). |
| **p. 16**, *Semiquaver tails* | ⭐ *"Sometimes stems are slightly lengthened for this, although **they most commonly remain the same length**"* — and the figure labels all four stems **3½**. So a 16th gets no bump. |
| **p. 16**, *Additional tails* | *"These are added further from the notehead than the quaver tail. **Extend the length of the stem for these**."* · *"So that tails do not touch the noteheads of down-stemmed notes, some editions shorten the tails while others lengthen the stems."* |
| **p. 18**, *Beam placing affecting stem length — one and two beams* | ⭐⭐ *"A stem may be slightly lengthened or shortened to allow for correct beam positioning within the stave. The stem length (**including the width of the outer beam**) should be as close to 3½ spaces (normal stem length) as possible."* · *"When notes are in a space, the stem length is **3½** spaces"* (six drawn, all labelled 3½). |
| **p. 19** | ⭐⭐ *"When notes are on a line, the stem is shortened to **3¼** spaces"* (drawn 3½ 3¼ 3¼ ‖ 3½ 3¼ 3¼) · *"This prevents the inner beam from being incorrectly placed when it is added"*, with an `incorrect` pair labelled 3½ 3½. |
| **p. 19**, *Additional beams* | ⭐⭐ *"The outer beam moves further away from the notehead to allow space for additional beams. **Beams should never be closer to the notehead than the correct position of the semiquaver beam (2½ spaces)**. Extend stems for the additional beams"* — drawn **3¾ · 4½ · 3¼ · 4**, against *"and not"* **3½ · 3**. |
| **p. 19**, *Notes on ledger lines* | *"There must be one clear stave-line between the innermost beam and the first ledger line."* |
| **p. 17**, *Beams: Design* | *"Beam thickness is ½ stave-space. The distance between beams is ¼ stave-space."* (needed to read p. 18's *"including the width of the outer beam"*.) |
| **p. 52**, *Double-stemmed writing* | ⭐ *"The upper part always takes up-stems, the lower part down-stems, even when pitches overlap."* · *"Two parts with the same note-value may share a notehead as long as they take two stems."* |
| **p. 125**, *Grace notes: Design* | ⭐ *"Grace notes are notated as small noteheads with stems shortened to about **2¼ stave-spaces**."* ⚠️ **2¼, not 2½** — the OCR renders it `2%` and it is 2¼ on the page. |
| **p. 569**, *Cue notation* | ⭐ *"Stem lengths are **2–2½ stave-spaces** long. Cue notes are usually slightly larger than grace notes (stem lengths of both tend to be the same)."* |
| **p. 305**, keyboard | *"To avoid ledger lines in the middle of the system, a stem may extend from one stave to the other to take advantage of the other clef."* ⛔ A permission, with **no geometry** — that is Gould's whole word on cross-staff stems. |
| **pp. 11–12**, noteheads | ⭐ *"A stem joins the diamond at the **side** of the notehead, and **not at the central point**"* · *"The stem joins the cross at the **edge** of the symbol, and not at its centre"* (drawn `and`/`not`) · *"The stem is attached to the **centre of the base** of the triangle."* |

⛔ **Gould gives no thickness number, no attachment side for an ordinary notehead, and no vertical
attachment point.**

### 2.2 ⭐⭐ ROSS, *The Art of Music Engraving and Processing* — printed pp. 83–87

⭐ **Ross is by far the most specific source: he tabulates the length by STAFF DEGREE.** Read on PDF
pages 95, 97, 98 (printed 83, 85, 86).

| where | verbatim |
|---|---|
| **p. 83** | *"The stem, which is **somewhat thinner than the staff line**, should never be flabby and distorted."* |
| **p. 83** | ⭐⭐ *"The normal length of a stem is one octave (three and one-half spaces). Please observe in the following example that the stem actually extends from the top line of the staff to the middle of the first space making three and one-half spaces."* |
| **p. 83**, footnote | ⭐⭐ *"Plate engravers, who say that the stem length is three spaces, measure from the end of the stem to the **nearest point on the notehead**."* |
| **p. 83** | *"Only under extreme circumstances should a stem be less than two and a half spaces in length (**if a beam is used with a stem, the beam's ½ space thickness is included in the length of the stem**)."* |
| **p. 83** | ⭐⭐ *"A note on or below the second space has an up-stem on the **right side** of its notehead. A note on or above the middle staff line has a down-stem on the **left side** of its notehead."* |
| **p. 83** | ⚠️ *"Some engravers consider the middle line neutral, and take the option of using either up- or down-stems for notes that fall on it. However, more up-to-date engraving no longer permits an option; now a down-stem is always appropriate."* |
| **p. 85** | ⭐⭐ *"the normal length of a stem is one octave (eight staff degrees), which means that **the stem end touches the line or space an octave higher or lower than its notehead**. As notes ascend and descend the staff, their stems are shortened or lengthened proportionally."* |
| **p. 85** | ⭐⭐ *"Following are the only **fifteen staff degrees** that (under usual conditions) have notes with normal three and one-half space stems. Notes on all other staff degrees have altered stems. (At times, neighboring notes, beams, flags, ties and crowded conditions might influence and alter the length of stems.)"* Footnote on three of the fifteen: *"These stems are quite often more effective at **3¼** spaces."* |
| **p. 86** | *"Notes on the following staff degrees have stems **two and a half** spaces long."* + *"and up"* / *"and down"*, footnote *"These notes could possibly be 3 spaces."* |
| **p. 86** | ⭐⭐ *"**A stem with a flag is normally never less than 3 spaces.**"* (introduced by the snare-drum case: *"all stems … should be extended to 3 spaces"*) |
| **p. 86** | *"Notes on these two staff degrees have **three-space** stems."* |
| **p. 86** | ⭐⭐ *"When a notehead lies on or above the **second** leger line above the staff, its stem-end touches the middle staff line; similarly, for a notehead lying on or below the second leger line below the staff, its stem end touches the middle line."* |
| **p. 87** | ⭐ *"neighboring notes can influence the length of a stem… the stem of the A is shortened from its normal three and a half space length to three spaces, so that it will not extend higher than the stem on the B… These exceptions … are made for the sake of the appearance of the music: **the stem ends should rise and fall with their respective noteheads**."* |
| **p. 99** | *"Stems are measured in terms of the space and half space. **When a beam straddles a line, it creates a situation that demands one-fourth space.**"* |
| **p. 121** | ⭐⭐ *"a normal length stem (3½ spaces) will accommodate a double beam, a stem of 3¼ spaces will also accommodate a double beam. **A secondary beam should never be closer to the notehead than 2½ spaces (including the thickness of the beam)**, so an actual 3 space stem cannot accommodate a double beam."* · *"Any double beams placed outside the staff lines would require a normal 3½ space stem although a 3¼ space stem could be used."* |

⭐⭐ **Ross's table, recovered by MEASURING his three figures** (pp. 85 and 86, 300 dpi; staff-degree
= half-space, 0 = the middle line, + = above). His fifteen normal degrees are **up-stems at −7…−1
and down-stems at 0…+7** — verified by locating all fifteen noteheads against the local staff-line
positions (the scans are skewed; the middle line was interpolated per note), which lands each within
0.1 of an integer degree. The three asterisked *"often more effective at 3¼"* notes are the three
nearest the reversion place: **up-stem at −1, down-stem at 0, down-stem at +1.** The 2½ figure
measures to **up-stems at +1…+5 "and up"** and **down-stems at −2…−6 "and down"**; the 3-space
figure is two notes, **up-stem on the middle line** and **down-stem one degree below it**.

| note's degree (half-spaces from the middle line) | UP-stem | DOWN-stem |
|---|---|---|
| ≤ −8 | end pinned to the middle line (lengthened past 3½) | 2½ |
| −7 … −2 | **3½** | **2½** |
| −1 | **3½** (*often 3¼*) | **3** |
| 0 (middle line) | **3** | **3½** (*often 3¼*) |
| +1 | **2½** | **3½** (*often 3¼*) |
| +2 … +7 | **2½** | **3½** |
| ≥ +8 | 2½ | end pinned to the middle line |

### 2.3 ⭐⭐ STONE, *Music Notation in the Twentieth Century* — printed pp. 47–49

**A complete chapter, `Stems → A. Stem Lengths`, in seven numbered cases.** ⭐ It is the most
systematic statement of the rule in the library, and nothing in this project had ever read it.
(PDF page 35 is the printed 48/49 spread; p. 47 is the right half of PDF 34.)

| case | verbatim |
|---|---|
| **1. Single notes (unbeamed)**, p. 47–48 | ⭐⭐ *"Stems on single notes should be one octave long unless the note is farther than one octave from the middle line of the staff, in which case the stem is lengthened to reach the middle line"* … *"**In other words, all stems must either cross the middle line or reach it** (except, of course, in double stemming—see below)."* |
| **2. Intervals and chords (unbeamed)**, p. 48 | *"Stems on intervals and chords should be one octave long, **or a little shorter**, measured from the end of the stem to the nearest note. If that note is farther than one octave from the middle line of the staff, the stem is lengthened to reach the middle line."* Figure label: *"Stem ½ space shorter"*. |
| **3a. Single beam, identical pitches**, p. 48 | ⭐⭐ *"The basic rule for unbeamed notes, that stems should be 3½ spaces (one octave) long, also applies to notes with one beam, **provided the notes are all in a space**. (The stems are measured **from the center of the note to the outside of the beam**.) For notes on a line, the stem is **a quarter of a staff-space shorter** because the beam straddles a staff-line, i.e., the outside of such a beam does not reach all the way to the center of the staff-space"* — drawn **3½ spaces** / **3¼ spaces**. |
| **3b. Single beam, different pitches**, p. 48 | ⭐ *"Here the stem lengths cannot be regulated, except that **the stem of the note(s) closest to the beam should not be shorter than the interval of a sixth**"* — with a *"With minimum slant"* / *"With greater slants (used by engravers)"* pair. |
| **3c. Double and multiple beams**, p. 49 | ⭐⭐ *"Stems are usually lengthened by **half a space for each additional beam**, but when three or more beams are used, **no rigid rule is followed** and a balance is attempted between lengthening the stems just enough to prevent the note(s) nearest the beams from being too close"* — drawn as *"Regular lengths"* vs *"Compromise lengths"*. |
| **4. Flagged notes**, p. 49 | ⭐⭐ *"For eighth notes and sixteenth notes the length of the stems should remain **the same as for unflagged stems**. **From three flags on**, however, the stem must be lengthened to accommodate the additional flag(s)."* |
| **5. In double-stemmed notation**, p. 49 | ⭐⭐ *"In double stemming, the stems are usually shortened by **½ to 1 space, i.e., from an octave to a seventh or sixth**, except in multiple beaming, where such reductions would bring the secondary beam(s) too close to the notes. There also are other situations that do not permit shortening of the stems, such as **when tremolo bars are drawn through the stem**."* |
| **6. Grace notes**, p. 49 | *"Stems usually take up about **2½ spaces**."* |
| **7. Cues**, p. 49 | *"Stems usually take up about **3 spaces**."* |
| **B.1 Stem directions**, p. 49 | ⚠️ *"Notes below the middle line of the staff are stemmed up; notes **above and on** the middle line of the staff are stemmed down"* + N.B.: *"The old rule that the stem direction for notes on the middle line of the staff is governed by the majority of the other stems in the measure … **is rarely if ever followed any longer**, at least not by today's professional engravers and autographers."* |

⛔ Stone states **no thickness** and **no attachment geometry** — the nearest thing is a passing
*"These have their stems attached right or left, in the same manner as regular [notes]"*, said of
special noteheads (⛔ printed page not established; found in `stone-notation-20th-century-fulltext.txt`
only).

### 2.4 GEROU & LUSK, *Essential Dictionary of Music Notation* — pp. 25, 32, 83, 137–139

The `Stems` entry is pp. 137–139; the beam-related parts are under `Beams` p. 32; the ledger rule is
duplicated under `Leger lines` p. 83.

| where | verbatim |
|---|---|
| **p. 137** | *"**Stems are thinner than staff lines and barlines.**"* |
| **p. 137**, *Stem length* | *"The normal stem length is 3½ spaces (**one octave**)."* |
| **p. 137**, *With leger lines* | *"When a note extends beyond one leger line, the stem must touch the middle staff line."* (repeated p. 83: *"Stems of all notes ABOVE or BELOW the first leger line past the staff must extend at least to the middle staff line."*) |
| **p. 137**, *When parts share a staff* | ⭐⭐ *"Up-stem notes above the middle line are shorter than normal. Traditionally, their stem length is **relative to surrounding notes**, getting **progressively shorter as the notes go higher**. The shortest stem length is 2½ spaces (interval of a 6th)."* · *"Down-stem notes below the middle line follow the same guidelines as the above."* |
| **p. 137**, same paragraph | ⭐⭐ *"**For the computer, a setting should be chosen that works well for most situations.**"* — the only sentence in the library that addresses software directly, and what it says is: **pick one constant and live with it.** |
| **p. 138** | ⭐ *"The stem is always placed **between** the two notes of an interval of a 2nd, with the **upper note always to the right**, the **lower note always to the left**."* |
| **p. 138** | *"For notes on the middle line and above, the stem is down. For notes below the middle line, the stem is up."* · *"When the two notes are an equal distance from the middle line, the preferred direction is down."* |
| **p. 32**, *Double beams* | *"**Normal stem length will accommodate a double beam** — the stem need not be adjusted."* |
| **p. 32**, *Triple and quadruple beams* | ⭐⭐ *"When a third or fourth beam is added below the secondary beam, the stems must be extended by **approximately one staff space per beam**. The extension of the stems allows **the space between the noteheads and the lowest beam to remain normal**."* |
| **p. 33** | *"Beamed notes with leger lines slant ½ staff space. (Remember that stems must extend to the middle line.)"* |
| **p. 25**, *Barlines* | *"The thickness of a barline is equal to, or greater than, the staff line thickness (**staff lines being thicker than stems**)."* |

⭐ **G&L p. 32's second sentence is the cleanest statement of the beam model anywhere**: what is held
constant when beams are added is *the free stem between the notehead and the nearest beam*, not the
total. That is precisely LilyPond's `beamed-minimum-free-lengths` (§4.1).

---

## 3. ⭐ What Gould DRAWS, measured

All measurements at **450 dpi** off `pdftoppm` renders of the local PDF, per `reference/README.md`'s
method. **Printed p. 14 is PDF 34.** Two independent staves on that page give **1 sp = 20.0 px**
(the p. 14 *Stem length* figure) and **1 sp = 19.75 px** (the *Double-stemmed writing* figure).

### 3.1 The standard length — the drawing states 3½ twice, and once as a RULER

The *Stem length* figure is a minim in the bottom space with an up-stem and a minim on the top line
with a down-stem, with a bracket ruler down the left-hand side labelled *"1 stave-space"* at the top
and *"½ stave-space"* at the bottom.

- ⭐⭐ **The ruler is the measurement**: four brackets, spanning **1 + 1 + 1 + ½ = 3½ spaces**, drawn
  from the top staff line (the up-stem's tip) down to the **centre of the notehead** in the bottom
  space. Bracket edges land on 1915.5 / 1935 / 1955.5 / 1975.5 / ≈1985.5 px — three exact
  stave-spaces and one exact half. **Her figure defines the measurement as head-centre-to-stem-tip,
  in so many words, in ink.**
- The **stem ink** itself: up-stem 1985.5 → 1914 = **3.58 sp**; down-stem 1915 → 1986 = **3.55 sp**.
  ⚠️ Both slightly over 3.5 because the ink measurement includes the stem's tip and starts at the
  head's centre rather than at the attachment point — the same ±0.08 sp the ruler resolves away.

### 3.2 ⭐⭐ The shortening ramp — she DRAWS a gradient where she WRITES three values

The *Double-stemmed writing* figure is six examples left to right, labelled above and below with an
arrow running **(octave) 3½ → (seventh) 3 → (sixth) 2½**. What is actually drawn is a **continuous
ramp in about ¼-space steps**, and the note climbs by exactly **one staff degree (½ sp) per
example**.

Measured head-centre → stem-tip, 1 sp = 19.75 px, degree = half-spaces from the middle line:

| ex. | note's degree | UP-stem | DOWN-stem | she labels |
|---|---|---|---|---|
| 1 | ∓1 | **3.47** | **3.44** | 3½ |
| 2 | 0 (one head, **two stems**) | **3.22** | **3.29** | — |
| 3 | ±1 | **2.96** | **3.11** | 3 |
| 4 | ±2 | **2.76** | **2.81** | — |
| 5 | ±3 | **2.56** | **2.61** | 2½ |
| 6 | ±4 (the outer staff lines) | **2.41** | **2.56** | 2½ |

- ⭐ The step is ≈ **0.25 sp per staff degree** at the top of the ramp, easing to ≈0.15 near the
  floor. She names three values; she draws six.
- ⭐ Example 2 is her p. 52 *"Two parts … may share a notehead as long as they take two stems"* —
  one notehead on the middle line carrying an up-stem AND a down-stem, both ≈3¼.
- 🚨 Example 6 measures **2.41 sp**, i.e. **below her own stated floor of 2½** by 0.09 sp. Within
  ±0.05 of measurement noise it is 2½-ish, but it does not measure over.
- ⚠️ **One honest caveat, and it is about example 1, not the ramp.** In examples 3–6 the two
  noteheads share an x and the stems point outward (upper part up, lower part down — p. 52's rule);
  the ink is continuous from each stem tip to its own head's centre and the attribution is
  unambiguous. In **example 1** the two heads are offset by 10 px and the stems are 36 px apart
  (against 25 px, one notehead width, in example 3): the down-stem sits on the LEFT edge of the
  UPPER head and the up-stem on the RIGHT edge of the LOWER head, and the up-stem's ink runs
  continuously past the middle line down to the lower head's centre. Read that way both stems are
  **3.47/3.44 = her 3½**; read the other way both are **2.28**, which is below her own floor and
  cannot be what she drew. So the numbers above stand, but **which part owns which stem in example 1
  is not settled by the scan.**

### 3.3 ⭐ The "imaginary ledger lines" are a RULER, not a quantiser

The figure's left-hand label *"imaginary ledger lines"* points at short dashes drawn near the stem
tips. Measured, the dashes sit at **exactly 1, 2 and 3 stave-spaces beyond the outer staff line** —
true ledger-line positions — while the **stem tips do not**: they land at 0.94 / 1.19 / 1.44 / 1.75 /
2.05 / 2.41 sp above the top line. ⛔ **So the stem end is NOT snapped to a ledger position.** The
dashes exist so a reader can COUNT the interval (octave / seventh / sixth) that the caption names.

### 3.4 ⚠️⚠️ THE THICKNESS — her prose and her plate do not agree

Two independent samples on p. 14, measured by ink coverage (sum of `(255−v)/255` across a
perpendicular cut, which is subpixel-accurate to about ±0.2 px):

| | stems | staff lines |
|---|---|---|
| *Stem length* figure (1 sp = 20 px) | **0.106 – 0.112 sp** | **0.115 sp** |
| *Double-stemmed* figure (1 sp = 19.75 px) | **0.106 – 0.120 sp** | **0.107 – 0.116 sp** |

⭐ **Her engraved stems and her engraved staff lines are the same weight to within the scan's
resolution.** A real difference of up to about 0.015 sp (≈0.3 px here) would be invisible, so this
does not prove they are identical — but it does mean **the drawing gives no support for the sentence
on p. 13**, and any number taken from her plate would be ≈0.11 sp for both. Compare §4: Bravura
(0.12 stem / 0.13 staff line) and Leland (0.10 / 0.11) both engrave the sentence; LilyPond and
Verovio both contradict it (§5.4).

### 3.5 ⭐ The attachment, measured

On the p. 14 *Stem length* figure:

- The **up-stem** occupies x 1452.8–1455.0 (coverage-weighted); the lower notehead's ink ends at
  **x = 1455**. The stem's **right edge is flush with the notehead's right extremity**.
- The **down-stem** occupies x ≈ 1580.5–1582.7; the upper notehead's ink begins at **x = 1580**. The
  stem's **left edge is flush with the notehead's left extremity**.
- ⭐ That is exactly the SMuFL `stemUpSE` / `stemDownNW` convention and exactly LilyPond's *"the
  lower right corner of this rectangle is attached to the glyph"* (§4.1): the **outer** edge of the
  stem sits on the anchor, so the stem is drawn entirely inside the head's horizontal extent.
- Vertically, the ink in the head's rightmost column runs about **0.2 sp below the head's centre**,
  which is consistent with a tilted-ellipse head whose widest point is below centre — i.e. with
  Bravura's `stemUpSE.y = 0.168`. ⚠️ This is corroboration, not a measurement of an attachment
  point: at the head's extremity the stem's ink and the head's ink cannot be separated.

---

## 4. What the three ENGINES do

All three implement §1's shape — a constant, a middle-line clamp that only ever lengthens, and a
shortening ramp with a 2½ floor — and **all three take the attachment from the font, not from a
rule.**

| | **LilyPond** `master@beedbfa` | **MuseScore** `main@929d1e9` | **Verovio** `develop@efff0bc` |
|---|---|---|---|
| base length | **3.5 sp** — `lengths` head `scm/define-grobs.scm:3454` | **3.5 sp** — `Sid::stemLength`, `style/styledef.cpp:259` | **3.5 sp** — `STANDARD_STEMLENGTH 7` (half-spaces), `include/vrv/vrvdef.h:753` |
| measured from | the extremal **head's centre** — `head_positions`, `lily/stem.cc:588` | the **far note's centre** + `chordHeight`, `rendering/score/stemlayout.cpp:122` | the **note's centre**, `src/calcstemfunctor.cpp:395` |
| working precision | **half-spaces** (`stem.cc:501` *"WARNING: IN HALF SPACES"*) | **quarter-spaces, integer**, deliberately (`stemlayout.cpp:39-40`) | **thirds of a half-space** = ⅙ sp unbeamed (`calcstemfunctor.cpp:375`), ¼ sp beamed (`beam.cc:1924`) |
| reaches the middle line | `stem_end = 0 if dir*stem_end < 0`, `stem.cc:591-593`; off via `no-stem-extend` | `extraLength = \|tip − target\|`, lengthen only, `stemlayout.cpp:123-159` | `if endY past m_verticalCenter → extend`, `calcstemfunctor.cpp:463-477` |
| shortening trigger | the extremal head is **at or past the middle line in the stem's own direction** — `stem.cc:522` | the **tip** is more than **0.75 sp outside the staff** — `Sid::shortStemStartLocation`, `stemlayout.cpp:77` | the **note** is within 5 half-spaces of the far staff line — `src/note.cpp:583-595` |
| ramp | ⅙ sp per degree for a quarter note (`shortening_step = min(max(0.25, shorten/6), 0.5)` half-spaces, `stem.cc:541`) | a hand-tuned 4×5 table in quarter-spaces, `stemlayout.cpp:352-358` → **¼ sp per half-space of extension** | ⅙ sp per degree, a 6-entry switch, `note.cpp:585-595` |
| floor | **2.5 sp** (quarter note, `hp≥5`) | **2.5 sp** — `Sid::shortestStem`, `styledef.cpp:261` (MuseJazz 2.25) | **2.5 sp** — the ramp bottoms out, `note.cpp:594`; ⛔ no named minimum exists |
| flag bump | **none for 8th/16th; 4.25 sp at the 32nd**, then 5/6/7/8/9 — `lengths`, indexed by flag count | none by duration; the **font's flag anchor** is added — Leland `flag32ndUp` **+0.692 sp**, 8th −0.008 (`tlayout.cpp:5379-5381`) | 🚨 **dead code** — the SMuFL flag extension is commented out as crashing (`calcstemfunctor.cpp:446-461`), so an unbeamed 32nd is as long as an 8th |
| flagged-stem floor | flagged stems shorten only ½ sp (unflagged 1 sp) — `stem-shorten (1.0 0.5 0.25)` | — | **2.83 up / 3.00 down** for unbeamed flagged notes, `note.cpp:599-606` |
| beamed | `beamed-lengths (3.26 3.5 3.6)` **+** `beamed-minimum-free-lengths (1.83 1.5 1.25)`, indexed by **beams on this side**, `stem.cc:1167-1211`; the final end is **quantized** by the beam scorer | `minStemLengths[9] = {11,13,15,18,21,24,27,30,33}` quarter-spaces = **2.75 … 8.25 sp**, `beamtremololayout.cpp:93`; +0.5 sp base at 3 beams, +0.75 per beam after | a table in half-units: 8th/16th **3.50 or 3.25**, 32nd **4.50 or 4.00**, 64th 5.50/5.00 … `beam.cc:1936-1954` |
| line-vs-space | via beam quanting (`straddle/sit/inter/hang`, `beam-quanting.cc:906-910`) | `stemOpticalAdjustment` **−0.25 sp when the tip lands in a space**, 1–2 beams only, `stemlayout.cpp:399-413` | `onStaffSpace ? 14 : 13` half-units = **3.50 vs 3.25**, `beam.cc:1922-1943` |
| grace / cue | `length-fraction` 0.8 (grace) → **2.8 sp**; cue `magstep(−4)` ≈ 0.63 → **2.2 sp**; grace also sets `no-stem-extend` | `intrinsicMag` 0.7 → **2.45 sp**, and small notes aim at the **2nd line from the bottom**, not the middle | `graceFactor` 0.75 → **2.625 sp**; grace exempt from the middle-line rule |
| two voices | ⛔ **no length rule** — `\voiceOne` sets `direction` only (`music-functions.scm:704-712`); shortening falls out of the forced-direction test | ⛔ **none** — voice sets direction only (`chordlayout.cpp:1577-1582`) | ⛔ **none** — and the header comment *"should be 6 in two-voice notation"* (`vrvdef.h:753`) is **unimplemented** |
| whole notes | grob exists, `is_normal_stem` false, not painted (`stem.cc:370-377`) | **no stem object** (`durationtype.cpp:222-240`) — ⚠️ the **longa does** get one | `SetDrawingStemLen(0)` for `dur < DURATION_2` (`calcstemfunctor.cpp:355-362`) |
| attachment x | the **font's** `attachment` point, `note-head.cc:227-242`; ±1.0 on a −1…1 bbox scale for every elliptical head (`feta-params.mf:302`); centre pulled in by half the stem width (`stem.cc:1085`) | **SMuFL** `stemUpSE`/`stemDownNW`; Leland `(1.30, +0.16)` / `(0.0, −0.168)` sp; outer edge on the anchor (`tlayout.cpp:5388`) | **SMuFL** `stemUpSE`/`stemDownNW`; Bravura `(1.18, 0.17)` / `(0.0, −0.17)` sp; outer edge on the anchor (`calcstemfunctor.cpp:390-405`) |
| attachment y | the stem **begins at the anchor**, `stem.cc:934-963`, so drawn ink ≈ 3.5 − 0.17 ≈ **3.33 sp** | same shape — origin at the far note's centre, line starts at the anchor (`tlayout.cpp:5365-5375`) | same — drawn ink runs `noteY+0.17 → noteY+3.50` |
| **thickness** | **0.13 sp** = `thickness 1.3` × line-thickness 0.1 (`define-grobs.scm:3475`, `stem.cc:911`) | **0.10 sp** — `Sid::stemWidth`, `styledef.cpp:257` | **0.10 sp** — `m_stemWidth 0.20` units, `options.cpp:1533` |
| staff-line thickness, for comparison | **0.10 sp** (`scm/paper.scm:52-66`) ⇒ 🚨 **stem THICKER** | **0.11 sp** (`Sid::staffLineWidth`) ⇒ ✅ thinner | **0.075 sp** (`m_staffLineWidth 0.15` units, `options.cpp:1529`) ⇒ 🚨 **stem THICKER** |
| reads the font's `stemThickness`? | n/a (no SMuFL) | ⚠️ mapped (`engravingfont.cpp:779`) but applied **only from the style dialog** — a Bravura score still draws 0.10, not Bravura's 0.12 | ⚠️ **opt-in only** — `Options::Sync` returns early unless `--engraving-defaults` is passed (`options.cpp:2091`) |

### 4.1 LilyPond

⭐ **The stem END is primary and the length is derived** — `length = |stem_end − stem_begin_position|`
(`lily/stem.cc:989`), and for a beamed stem the beam writes both properties directly
(`stem.cc:171-173`). The `lengths` list `(3.5 3.5 3.5 4.25 5.0 6.0 7.0 8.0 9.0)` is indexed by
`duration_log − 2` = **the flag count** (`stem.cc:510`), clamped at both ends by `robust_list_ref`
(`lily/lily-guile.cc:183-188`) — so whole and half notes take 3.5 too, and ⭐ **the growth starts at
the 32nd, which is Stone p. 49's *"from three flags on"* exactly.** The shortening is a genuine ramp,
gated on the extremal head being past the middle line in the stem's own direction
(`stem.cc:522`) — i.e. on the direction being FORCED, expressed as a position test — and its
comments cite *"[Roush & Gourlay]"* for one staff space unflagged, half a space flagged
(`define-grobs.scm:3455-3457`), which is Stone p. 49's *"shortened by ½ to 1 space"* to the letter.
🚨 The divisor is admitted heuristic in the source: *"value 6 is heuristic; it determines the
suggested transition slope steepnesas"* (`stem.cc:539`).

⚠️ Two things a treatise would never state. **The beamed minimum is a 5000-point demerit, not a
clamp** (`beam-quanting.cc:1118, 1138`), with too-short weighted 1.5× worse than too-long
(`beam-quanting.cc:122-125`) — a short stem can win. And **the stem's Y-extent and its ink disagree
on purpose**: `set_stem_positions` extends to the beam's outer edge and `Stem::print` subtracts it
again (`stem.cc:142` vs `:1035`), so skylines see the long version and the page sees the short one.
Also: `beamed-stem-shorten` is **fractional in the number of forced stems**,
`shorten *= forced/normal` (`beam.cc:1071-1085`) — a beam half of whose stems are forced is
shortened by half.

### 4.2 MuseScore

The algorithm moved again: it is now **`src/engraving/rendering/score/stemlayout.cpp`**, no longer
`chordlayout.cpp`. Everything is **integer quarter-spaces** *"to eliminate all possibilities for
rounding errors"* (`stemlayout.cpp:39-40`). ⭐ **Its independent variable is different from everyone
else's**: it shortens by how far the **stem TIP** falls outside the staff (from 0.75 sp out), not by
where the note sits — `maxReduction`, a hand-tuned 4×5 table indexed [beam count][extension]
(`stemlayout.cpp:352-358`), giving **¼ sp of shortening per ½ sp of extension**, capped at 1.0 sp,
and **zero for ≥4 beams**. That per-degree slope is Gould's drawn slope (§3.2), reached from the
other end.

⭐⭐ **The one rule here that no treatise states and every treatise implies: `stemOpticalAdjustment`
(`stemlayout.cpp:399-413`) — subtract 0.25 sp when the stem tip would land in the middle of a staff
space, for 1–2 beams only.** That is Gould p. 19's 3½/3¼ and Stone p. 48's *"a quarter of a
staff-space shorter"*, implemented as a length rule rather than a beam rule.

⚠️ Small and grace notes aim at the **2nd line from the bottom**, not the middle line
(`stemlayout.cpp:174`, `staffLineOffset = 4`) — an engine rule with no source. And the flag
contribution is **entirely the font's**: Leland's `flag32ndUp` anchor is +0.692 sp while the 8th and
16th are ≈0, which reproduces Stone's *"from three flags on"* without any code saying so.

### 4.3 Verovio

The unit is **half a staff space** (`options.cpp:1202`), so `STANDARD_STEMLENGTH 7` is 3.5 sp. The
shortening is a six-step switch in **thirds of a unit** = ⅙ sp (`src/note.cpp:585-595`), keyed on
`unitToLine`, the half-spaces from the note to the **far** staff line — numerically identical to
LilyPond's quarter-note ramp. Chords delegate to the top note for up-stems and the bottom for down
(`chord.cpp:379-395`), which is Gould p. 15 / Stone p. 48's *"the note closest to the open end"*.

🚨 **Three things are broken or unimplemented, and all three matter to this question.** The SMuFL
flag extension from the 32nd is **commented out** — *"Commented since this is crashing - needs
investigating"* (`calcstemfunctor.cpp:446-461`) — so `flagHeight` is always 0 and an unbeamed 32nd
gets an 8th's stem. The two-voice reduction its own header calls for is **not implemented**
(`vrvdef.h:753`). And the chord path hard-codes `m_verticalCenter` as 4 units
(`calcstemfunctor.cpp:146`) where the note path generalises over the line count (`:259`) — a latent
bug on any staff that is not 5-line.

⭐ Its one genuinely distinct contribution is the **beamed length table keyed on
`onStaffSpace || !isHorizontal`** (`beam.cc:1922-1955`): 8th/16th 3.50 vs 3.25, 32nd 4.50 vs 4.00,
64th 5.50 vs 5.00 — Gould p. 19's *"extend stems for the additional beams"* written out per duration.

### 4.4 ⭐ What SMuFL contributes, and what it does not

`engravingDefaults` in the bundled fonts (`MuseScore/fonts/*/*_metadata.json`):

| font | `staffLineThickness` | `stemThickness` | `beamThickness` |
|---|---|---|---|
| Bravura, Petaluma | 0.13 | **0.12** | 0.5 |
| Leland | 0.11 | **0.10** | 0.5 |

⭐ Both engrave the treatises' sentence — the stem is thinner than the staff line, by ≈8–9%. ⛔ SMuFL
says **nothing** about stem length; the attachment, and only the attachment, is the font's
(`stemUpSE` / `stemDownNW`), and both engines that read it take the anchor as the stem's OUTER edge,
so the stem never protrudes past the notehead's own bbox.

---

## 5. ⚠️ The disagreements

### 5.1 ⭐⭐ The shortening ramp's SLOPE — the drawing disagrees with every engine

Gould's own p. 14 engraving falls **≈0.25 sp per staff degree** (§3.2), reaching 2½ about four
degrees past the middle line. LilyPond and Verovio both fall **⅙ sp per degree** and reach 2½ five
to six degrees out. MuseScore falls ¼ sp per half-space **of tip extension**, which is a different
variable. Ross does not ramp at all: he **quantises to three values** (3½ / 3 / 2½), reaching the
floor **one degree** past the middle line for an up-stem (§2.2). Stone declines to give a ramp: *"½
to 1 space, i.e., from an octave to a seventh or sixth"* is a range, not a function. Gerou & Lusk say
the shortening is *"relative to surrounding notes"*, i.e. **contextual, not a function of position at
all** — and then tell the software to pick a constant.

⛔ **Five sources, five different slopes.** Nothing adjudicates.

### 5.2 The FLAG

- **Stone p. 49 and LilyPond**: no change for 8th or 16th; lengthen **from three flags on**.
  Gould p. 16 agrees for the semiquaver (*"most commonly remain the same length"*, drawn 3½).
- **Ross p. 86**: *"A stem with a flag is normally never less than 3 spaces"* — a **floor**, not a
  bump, and it bites where the others do nothing (a forced 8th that would otherwise be 2½).
- **Gould p. 15/16** takes a third line entirely — the constraint is the TAIL's own length: 2½ of
  stem carries a 2½ tail, and *"the stem should be lengthened for a longer tail"*, where her
  engraved tail is 2½–3¼ with 3–3¼ the norm.
- **Verovio** does none of it (the code is commented out); **MuseScore** does it only via the font's
  flag anchor.

### 5.3 ADDITIONAL BEAMS — ½ space, 1 space, or "no rigid rule"

| source | per extra beam |
|---|---|
| **Stone p. 49** | *"usually lengthened by **half a space** for each additional beam"* — then explicitly *"when three or more beams are used, **no rigid rule is followed**"* |
| **Gerou & Lusk p. 32** | *"extended by **approximately one staff space** per beam"* |
| **Gould p. 19** | no per-beam number: a constraint (*"never closer to the notehead than … 2½ spaces"*) and four drawn examples, **3¾ · 4½ · 3¼ · 4** |
| **Ross p. 121** | the same constraint as Gould, same number (*"never … closer than 2½ spaces including the thickness of the beam"*), and *"a normal length stem (3½) will accommodate a double beam"* |
| **MuseScore** | +0.5 sp at the 3rd beam, +0.75 per beam thereafter (`stemlayout.cpp:326-343`) |
| **LilyPond** | not additive at all: it holds the **free length** constant (`beamed-minimum-free-lengths`) and lets the beam stack grow — which is G&L p. 32's own justification |

⭐ Gould's and Ross's *"never closer to the notehead than 2½ spaces"* is the **one rule three sources
state identically** (Gould p. 19, Ross p. 121, and Stone p. 48's *"not shorter than the interval of a
sixth"* for the note nearest the beam). It is a constraint on the INNERMOST beam, not a length.

### 5.4 THICKNESS — three treatises say one thing, two engines do the opposite, and Gould's plate says neither

Gould p. 13, Ross p. 83 and G&L pp. 25/137 all say the stem is thinner than the staff line. Bravura
(0.12 / 0.13) and Leland (0.10 / 0.11) engrave it; MuseScore's hard default (0.10 / 0.11) engraves
it. 🚨 **LilyPond draws the stem 30% THICKER than its staff line (0.13 / 0.10) and Verovio 33%
thicker (0.10 / 0.075).** And §3.4: on Gould's own p. 14 the two measure the same, ≈0.11 sp each.

### 5.5 The MIDDLE-LINE threshold — one ledger line or two

| source | the note that first needs a longer stem |
|---|---|
| **Gould p. 14** | *"notes on **more than one** ledger line"* |
| **Ross p. 86** | *"on or above the **second** leger line"* |
| **Gerou & Lusk pp. 83/137** | *"**beyond one** leger line"* / *"ABOVE or BELOW the first leger line"* |
| **Stone p. 48** | *"**farther than one octave** from the middle line"* — the same thing said as a length rather than a position |

⭐ These converge in practice: a note 7 half-spaces from the middle line is exactly where a 3½ stem
lands on it, so all four bite at the 8th half-space = the second ledger line. ⚠️ G&L's wording is the
loosest and, read literally, would bite one degree early.

### 5.6 The MIDDLE-LINE note's direction

**Gould p. 13**: either, *"determined by context"* — and she gives the context rules (continue a
one-direction run; keep the beat's direction). **Ross p. 83**: *"more up-to-date engraving no longer
permits an option; now a down-stem is always appropriate."* **Stone p. 49**: down, and the old
majority rule *"is rarely if ever followed any longer."* **G&L p. 138**: down. ⚠️ Three against one,
and the three are explicit that Gould's rule is the older practice. (Off this document's question,
but it decides which branch of the length rule a middle-line note takes.)

### 5.7 GRACE and CUE

| | Gould | Stone | LilyPond | MuseScore | Verovio |
|---|---|---|---|---|---|
| grace | **2¼ sp** (p. 125) | **≈2½ sp** (p. 49) | 2.8 (`length-fraction` 0.8) | 2.45 (mag 0.7) | 2.625 (0.75) |
| cue | **2–2½ sp** (p. 569), *"stem lengths of both tend to be the same"* | **≈3 sp** (p. 49) | ≈2.2 (`magstep(−4)`) | — | — |

🚨 **Gould and Stone are the wrong way round**: she makes the cue shorter than or equal to the grace,
he makes it half a space longer. And ⭐ every engine derives grace length by **scaling** the normal
one, which is not what either treatise says — both state an absolute number.

---

## 6. ⛔ UNKNOWN — what could not be answered, and exactly where I looked

1. **A NUMBER for stem thickness.** ⛔ No treatise gives one. Checked: Gould's whole `Stems` section
   (p. 13) and every `thickness`/`thicker`/`thinner` hit in her fulltext (she numbers beams ½ sp,
   barlines, ledger lines, the flat's stem, accent strokes — never the note stem); Ross p. 83 and
   his `thick|thin` index; Gerou & Lusk pp. 25 and 137; Stone — no entry at all. **The only numbers
   in the library are the fonts' `engravingDefaults` (§4.4) and the engines' own constants.**

2. **A vertical attachment point.** ⛔ **UNKNOWN from any treatise.** Gould gives the principle for
   the diamond, cross and triangle heads (pp. 11–12) and never for the oval; Ross gives the side
   only (p. 83); G&L give the side for a second (p. 138); Stone says only *"attached right or left,
   in the same manner as regular notes"*. Every number in existence is the font's `stemUpSE.y` /
   `stemDownNW.y` (0.16–0.17 sp), which no book has ever seen.

3. **How much the stem may overlap the notehead's ink.** ⛔ Not stated anywhere. §3.5 measures the
   OUTER edge flush with the head's extremity on Gould's plate, and all three engines put the outer
   edge on the anchor — but that is three implementations agreeing, not a rule.

4. **The shortening ramp as a FUNCTION.** ⛔ No source states one. Gould names three values and draws
   six (§3.2); Ross quantises to three; Stone gives a range; G&L say *"relative to surrounding
   notes"*. **The per-degree slope in §3.2 is MEASURED off one figure on one page and is not a
   quotation.**

5. **CROSS-STAFF stems.** ⛔ **UNKNOWN.** Gould p. 305 permits one (*"a stem may extend from one
   stave to the other"*) with no geometry; Ross, Stone and G&L were searched for `cross`/`stave to
   the other`/`between the hands` and give nothing. The engines each invent something (LilyPond's
   `Span_stem_engraver` unions the extents and draws one rounded box, `scm/music-functions.scm:2519-2534`;
   Verovio has `beamMixedStemMin` = 1.75 sp, `options.cpp:1258`).

6. **WHOLE-BAR / stemless notation.** ⛔ Not a stem-length question in any source. Gould p. 52
   (*Stemless notes*) is about bracketing simultaneities; MuseScore does not create a stem for a
   whole note but ⚠️ **does** for a longa (`durationtype.cpp:222-240`); LilyPond keeps an invisible
   Stem grob so tremolos have something to hang on (`stem.cc:1063-1064`); Verovio sets the length to
   0. **No treatise discusses any of this.**

7. **Which part owns which stem in Gould's p. 14 example 1.** ⛔ Unsettled from the scan — §3.2's
   caveat. The measured lengths are unaffected.

8. **GARDNER READ, *Music Notation*.** ⛔ Still not on disk (`reference/README.md`'s *"Still
   missing"*). He is the obvious fifth opinion and LilyPond cites him by page for the tempo mark, so
   he probably has a stem section. **Not consulted.**

9. **CHLAPIK, and any publisher house manual.** ⛔ Not on disk, per the same section. Not searched
   online — the instruction was to exhaust the local library first, and it was not exhausted until
   Stone turned out to have a whole chapter.

10. **What a 5-line staff's rule becomes on 1-line percussion staves.** ⛔ No treatise. Verovio
    generalises over `m_drawingLines` in one place and hard-codes 4 units in another
    (`calcstemfunctor.cpp:146` vs `:259`); MuseScore has explicit branches for `lineDistance ≠ 1 sp`
    and staves under 2 sp tall (`stemlayout.cpp:135-151`).
