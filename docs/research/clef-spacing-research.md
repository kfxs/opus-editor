# Clef position and clef spacing — the research record (the treatises, 2026-08-29)

> ⭐ **Kept because the scratchpad dies with the session.** ⛔ **This document is EVIDENCE, not a
> work list** — nothing here has been agreed as a feature, and no number in it has been put into
> code.
>
> The question: **where a clef sits and how much room it takes** — at the head of a system, inside
> the header (clef → key → meter → first note), at a mid-score change, and vertically on the stave.
>
> ⭐⭐ **SCOPE: THE LITERATURE, and that is HIS CALL, mid-research.** PARTS 1–8 are **the treatises and
> nothing else** — what four engravers **wrote** and what they **drew**, measured off their own
> plates. ⛔ A table row whose only source is an implementation does not belong in the body.
>
> ⚠️ **Two further passes — the three engine checkouts and the SMuFL/Bravura/VexFlow metrics — ran
> BEFORE that call, and their findings are kept, fenced, in the APPENDIX at the end.** They are
> labelled as implementations throughout and ⛔ must never be quoted as if they were a treatise. They
> are there because this repo's rule is *do not re-run the research*, ⛔ not because they answer the
> question. ⛔ **Do not extend the appendix**: no further engine, font or web research belongs here.
>
> ⛔ **Do not re-run this research.** Every UNKNOWN is marked as one, with the pages that were read
> to conclude it — that list is the part that saves the next agent.
>
> ⚠️ **Read `docs/research/braces-brackets-research.md` beside this one.** Its §3.3 measured the bracket's
> serif; PART 1 below is the other half of that measurement — what the serif does to the *clef*.
>
> Sources, all on disk under `reference/` (see `reference/README.md`): **Gould, *Behind Bars*** ·
> **Ross, *The Art of Music Engraving and Processing*** · **Stone, *Music Notation in the Twentieth
> Century*** · **Gerou & Lusk, *Essential Dictionary of Music Notation***.

---

## 0. What was asked, and of whom

| # | pass | scope | landed |
|---|---|---|---|
| 1 | **Gould**, the whole book from the disk PDF | the CLEFS chapter (pp. 5–9), *Spacing symbols* (pp. 41–43), key/clef changes (pp. 91–93), repeats (pp. 234–5), and every orchestral plate with a bracket | PARTS 1–6 |
| 2 | **Ross · Stone · Gerou & Lusk** | the same questions, book by book, plus the two page-offset traps | PARTS 1–6 |
| 3 | the three engine checkouts | ⚠️ **out of the brief** — ran before the scope call | **APPENDIX** §A.1–A.5, A.8, A.10 |
| 4 | SMuFL · Bravura · VexFlow | ⚠️ **out of the brief** — ran before the scope call | **APPENDIX** §A.3, A.6, A.7, A.9 |

### Method, and the calibration behind every "MEASURED" below

Pages were located by grepping each book's extracted OCR, then **rendered to PNG with `pdftoppm`
and measured**, because for anything drawn the scan is the only authority (`reference/README.md`'s
standing rule, and the reason Gould's p. 111 slur formula, her ¾ sp thin double and Ross's wedge
have each already been overturned by their own plates).

⚠️ **One stave-space in pixels was derived PER PLATE from that plate's own five staff-line rows** —
these books' figures are not all set at one size, and a global px/sp would have been wrong. Staff-line
rows were excluded from every column profile so only glyph ink is counted.

| book | render | 1 stave-space |
|---|---|---|
| Gould (450 dpi) | PDF page = printed + 20 | p. 6 = 20.25 px · pp. 7/8/42/93/343/518 = 20.0–20.1 px · p. 507 = 18.0 px · p. 509 = 8.6–9.0 px |
| Ross (450 dpi) | PDF page = printed + 12 | p. 144 = 25.1–25.8 px · p. 156 = 25.2/25.5 px · p. 167 = 25.0/25.7 px (skewed scan, measured locally per clef) |
| Stone (450 dpi) | ⚠️ **PDF n = printed 2n−22 / 2n−21** (a spread) | pp. 45/57 = 21.3–21.6 px — ⚠️ ±0.15 sp, the coarsest plates here |
| Gerou & Lusk (450 dpi) | ⚠️ **PDF n = printed 2n−4 / 2n−3** (a spread) | p. 51 fig. 1–2 = 34.1 px · p. 51 header fig. = 38.4 px |

---

# PART 1 — ⭐⭐ THE LIVE QUESTION: does a BRACKET or BRACE move the clef?

## 1.1 The answer: NO. The clef does not move, and the inks interleave.

His hypothesis — *"engravers do NOT move the clef for this and the inks simply interleave"* — is
**confirmed, by measurement, in two books across five plates**, including two controlled comparisons
where a bracketed and an unbracketed stave appear in the **same system**.

⛔ **No book states it in words.** The answer exists **only** as drawn geometry. That is the honest
status of it: a measurement repeated five times, not a sentence anyone wrote.

## 1.2 The two controlled comparisons — same system, bracket vs no bracket

**⭐⭐ Gould p. 343, organ** (MEASURED, 1 sp = 20 px). Two braced manual staves and an **unbraced
pedal stave**, one systemic barline through all three. This is the cleanest control in any of the
four books:

| stave | brace ink | systemic barline | **clef ink left** |
|---|---|---|---|
| Manual, upper (braced) | x 949–967 = −1.35 → −0.45 sp | 976–980 | **+0.85 sp** |
| Manual, lower (braced) | x 949–967 | 976–980 | **+0.90 sp** |
| **Pedal (NOT braced)** | — none — | 976–980 | **+0.90 sp** |

**Identical.** And the brace's rightmost ink stops **0.45 sp short of the barline** — ⭐ a brace never
reaches the clef's region at all.

**⭐⭐ Gould p. 509, Table 2 (a)** — a real orchestral system with a bracketed chorus Soprano
directly above an **unbracketed** solo Soprano. At 8.9 px/sp this plate is coarse, but the comparison
is exact because it is pixel-for-pixel. Column ink counts from x 615, staff left = 633:

```
Sop. (CHORUS, bracketed)  .........9999997699721..779999999999999999999999872
Soprano solo (NO bracket) .................9932112879999999999999999999999983
```

The two profiles are **identical from x 633 rightwards** (barline 633–634, clef body ramping in at
x 640 ≈ +0.8 sp). The bracketed stave differs only by the bracket's own ink at x 621–632 and by two
stray pixels at x 635 and 638–639 — **the serif, interleaving**.

## 1.3 The serif and the clef DO overlap in x — measured five times

| plate | bracket body, sp from staff-left | systemic barline | **serif rightmost ink** | **clef leftmost ink** | overlap |
|---|---|---|---|---|---|
| **Gould p. 507** (Fl., 1 sp = 18 px) | −1.00 → −0.50 (0.53 thick) | −0.06 → +0.11 (0.17 thick) | **+0.83 sp** | **+0.78 sp** | ⭐ **they share columns x 476–477** |
| **Gould p. 518** fig. 1 | −0.85 → −0.35 (0.55 thick) | 0.00 → +0.20 (0.25 thick) | **+0.95 sp** | **+0.85 sp** | **0.10 sp** |
| Gould p. 518 figs. 2 and 3 | (bracket + brace; bracket + two braces) | | | **+0.85 sp**, all nine staves | — |
| **Ross p. 156**, SATB (1 sp = 25.19 px) | −0.87 → −0.32 (0.60 thick) | 0.00 → +0.24 | top **+1.47 sp** · bottom **+1.83 sp** | **+0.71 … +0.87 sp** | **0.63 sp** (top) / **0.99 sp** (bottom) |
| **Ross p. 156**, Fl/Ob/Cl/Bsn (1 sp = 25.50 px) | — | — | top **+0.82** · bottom **+1.06 sp** | **+0.71 sp** | 0.12 / 0.35 sp |

⭐⭐ **Why it never reads as a collision, and Ross's plate shows it in rows as well as columns.** At
y = 747 on Ross p. 156 (0.13 sp above the top staff line) the serif occupies x 535–536 while the
treble clef's top hook occupies x 555–557 — **they pass each other side by side with ≈0.75 sp of
clearance**. On Gould p. 507 the serif tip is **1.61 sp above the top staff line**, in a band where
the clef at those columns has no ink. ⇒ this is a **vertical-band** fact, exactly the distinction
`docs/history/vexflow-boundary.md` draws, and ⛔ not a case for reserved horizontal room.

## 1.4 Is a bracketed stave's clef further right? If anything, very slightly LESS

| | clef indent from the staff's left edge |
|---|---|
| Ross, **unbracketed** single stave (p. 144, two figures) | **0.84 sp**, **1.05 sp** |
| Ross, **bracketed + systemic barline** (p. 156, six staves) | **0.71 – 0.87 sp** |
| Gould, no barline (p. 6, four stubs; p. 42) | **0.64 – 0.69 sp** |
| Gould, with a systemic barline (pp. 343 / 518 / 507) | **0.78 – 0.90 sp** |

⭐⭐ **The invariant is the CLEAR GAP, not the offset from the staff's origin.** Gould leaves
**0.65 ± 0.05 sp of white** between whatever ink terminates the stave at the left and the clef's
first ink — which is 0.64–0.69 sp from the staff edge when nothing stands there, and 0.85–0.90 sp
when a 0.25 sp systemic barline does. ⇒ **the thing that moves the clef right is the BARLINE, not the
bracket.**

## 1.5 The brace, separately

| source | finding |
|---|---|
| **Gould p. 343** (MEASURED) | brace ink ends **0.45 sp before** the systemic barline |
| **Gerou & Lusk p. 51** fig. 2 (MEASURED) | brace ink ends **0.50 sp before** the barline's left edge; never crosses it |
| **Ross p. 155** (STATED) | only the shape and length — *"Its length is determined by the distance it spans from the top line of one staff to the bottom line of the staff below"* |
| ⛔ a horizontal number for the brace | **UNKNOWN in prose in all four books** (see PART 8) |

---

# PART 2 — THE CLEF AT THE HEAD OF A SYSTEM

## 2.1 The indent — ⭐ two books state a number, and both draw it TIGHTER than they say

| source | STATED IN WORDS | MEASURED OFF THE PLATE |
|---|---|---|
| **Gould p. 6**, *Indentation* | *"**A clef is indented into the stave by one stave-space (⌐) or a little less:**"* | Her four stubs directly under the sentence: treble **0.69**, bass **0.69**, alto **0.64**, percussion **0.69 sp**. Elsewhere: p. 42 header fig. **0.64**, p. 42 table (3 rows) **0.65–0.70**, p. 7 new system **0.80**, p. 8 (3 figs.) **0.70–0.75**, p. 93 **0.70** |
| **Ross pp. 144 and 166** — ⭐ **the same sentence printed twice, 22 pages apart** | *"A clef is customarily indented from the open end of the staff (or from the systematic barline) by **½ to 1 space**."* (p. 166 prefixes *"Although tradition might vary,"*) | his own labelled figures: **1.05 sp** (the one labelled *"1 space"*) and **0.84 sp** |
| **Gerou & Lusk p. 51** | *"Clefs are **slightly indented** on the staff, to the right of a systemic barline or the open single staff. Be sure to leave the single staff open — **do not put a barline before the clef!**"*, with two captioned figures. No number. | bare stave **0.41 sp** · header fig. **0.36 sp** · grand staff w/ brace + barline: treble **0.59**, bass **0.88 sp** |
| **Stone** | ⛔ **UNKNOWN** — see PART 8 | — |

⚠️ **Gould's own ruler glyph measures 14–15 px against a 20.25 px stave-space** — i.e. she draws
**≈0.7 sp** and calls it *"one stave-space or a little less"*. The rulers on that page are internally
consistent (on p. 42 a ruler labelled *"1"* measures 19 px and one labelled *"1¼"* measures 26 px), so
the 0.7 is real and not a scaling artefact.

⚠️ **Gerou & Lusk's engraver took *"slightly"* literally**: 0.36–0.41 sp is half Ross's stated
minimum and half his own drawing. ⇒ across the three books that draw it, the band is **0.36 – 1.05 sp**,
and the two books that state a number both draw at or below the bottom of what they wrote.

## 2.2 The clef's own ink extent — three books, and they disagree about the treble clef's SPLIT

MEASURED, in stave-spaces, relative to the five lines of the stave (a negative figure means the ink
stops **inside** the stave):

| clef | source | width | above the top line | below the bottom line | total height |
|---|---|---|---|---|---|
| **Treble** | **Gould p. 6** | 2.85–2.95 | **+1.83** | **+1.53 … +1.57** | **7.41 – 7.50** |
| Treble | **Gerou & Lusk p. 51** | 2.81 | +1.29 | +1.73 | 7.03 |
| Treble | **Ross p. 156** (Soprano) | 2.54 | +1.33 | +1.63 | 6.95 |
| Treble | Ross p. 144 · G&L p. 51 header fig. | 3.10 / 3.18 | — | — | — |
| Treble | **Stone p. 45** (5 instances) | 2.68–2.78 | — | — | — |
| **Bass** | **Gould p. 6** | 2.81–2.91 | **−0.15** (ink stops inside) | **−0.72 … −0.74** | **3.11 – 3.16** |
| Bass | **Ross p. 167** | 2.68 (incl. dots) | ≈0.0 | −0.64 | 3.28 |
| Bass | Ross p. 156 (Tenor stave) | 2.58 | +0.10 | −0.77 | 3.33 |
| Bass | **G&L p. 51** | 3.00 (incl. dots) | +0.03 | −0.94 | 3.09 |
| Bass | **Stone p. 57** | 3.07 (incl. dots) | ≈+0.1 | −0.7 | 3.21 |
| **Alto (C)** | **Gould p. 6** | 2.80–2.86 | **−0.15** | **−0.15** | **3.70 – 3.75** |
| Alto (C) | **G&L p. 51** | 3.9 | +0.04 | +0.04 | **4.0 (flush)** |
| **Percussion** | **Gould p. 6** | 1.43 (two bars) | −1.19 | −1.19 | **1.68** |

⭐ **The one thing all five bass measurements agree on**: the bass clef is **3.1–3.3 sp tall** and its
lowest ink stays **0.6–0.9 sp above the bottom staff-line** — it never leaves the stave downwards.

⭐ **The C clef fills the stave**, which is Gould's own sentence (*"It covers the height of the
stave"*, p. 6) and G&L's drawing (flush to 0.04 sp).

🚨 **The treble clef's SPLIT is where the books part company**: Gould draws **1.83 above / 1.55
below**, Ross and G&L **1.29–1.33 above / 1.63–1.73 below** — the same total height (≈7.0–7.5 sp)
distributed differently, i.e. **Gould's treble clef sits ≈0.3 sp higher on the stave than the other
two engravers'**. No book states the split in words.

C-clef internal structure, MEASURED on Gould's five-C-clef row (p. 6): thick bar **0.55 sp**, gap
**0.25 sp**, lobes **2.10 sp**.

---

# PART 3 — CLEF SPACING WITHIN THE HEADER

## 3.1 🚨🚨 THREE BOOKS, THREE CONVENTIONS — and mixing them is a ~3 sp bug for a clef

This trap is already recorded for the key signature (`docs/research/key-signature-research.md` §9.4.2b) and it
is **worse** for the clef, because a clef's ink is three times an accidental's:

| book | what its numbers measure | stated where |
|---|---|---|
| **Ross** | ⭐ **ORIGIN TO ORIGIN** — left of character to left of character | p. 143: *"Metal-plate engravers, as well as engravers that use the stamping process, **measure their spacing from the left side of the character**. A quarter note with a down stem is measured from its stem side. A sharp is measured from the vertical line on its left side. A flat is also measured from its left side."* |
| **Stone** | ⭐ **GAPS** — white space | p. 45: *"**The gaps between them can best be measured by cutting a short strip of staff from the music paper and using its cutting edge as a measuring device.**"*, and the figure is captioned *"(With cutting edges of staff to show how to measure the gaps)"*. His footnote defers to Ross by name. |
| **Gould** | **ink to ink** in her tables and her p. 93 plate; ⚠️ her p. 42 top figure is the exception (§3.5) | — |
| **Gerou & Lusk** | drawn only; no numbers at all | p. 51: *"**Notice the distance** from the end of the staff to the clef, from the clef to the key signature, and from the key signature to the time signature."* |

⚠️ **A treble clef's own ink is 2.5–3.2 sp wide**, so *Ross's 3½ origin-to-origin ≡ a ≈0.3–0.7 sp
gap*, and *Ross's 5½ ≡ a ≈2.4–2.9 sp gap*. ⛔ Never put a number from one table into another's
arithmetic.

## 3.2 clef → key signature, and clef → time signature

| source | kind | value |
|---|---|---|
| **Gould p. 41** | STATED | *"**Separate the clef, key signature, time signature by 1–1½ stave-spaces.**"* |
| **Gould p. 42**, table | MEASURED, ink-to-ink | clef → key **0.95 sp** · clef → meter (no key) **0.95 sp** |
| **Gould p. 93** | MEASURED, ink-to-ink | clef → key **1.00 sp** |
| **Gould p. 42**, top figure | ⚠️ MEASURED | clef → key **1.53 sp** · key → meter **1.83 sp** — see §3.5 |
| **Ross pp. 144–145** | STATED, **origin-to-origin** | clef → 1st flat **3½** · clef → 1st sharp **3½** · clef → time signature **3½** · last key accidental → time signature **2½** |
| **Ross p. 144** | MEASURED | clef → 1st flat **3.38 sp** origin-to-origin (his stated 3½ ✔) — **the corresponding ink gap is 0.28 sp** |
| **Stone p. 45** | STATED, **gaps** | *"between the **clef** and any subsequent symbol (key signature or time signature): **one staff-space or a little less**; between the **key signature** and the **time signature**: **one staff-space**"* |
| **Stone p. 45** | MEASURED | clef → time signature **1.11 sp** ✔ · clef → key signature **1.39 sp** (over his own label) |
| **Gerou & Lusk p. 51** | MEASURED | clef → 1st sharp **3.26 sp** origin-to-origin / **0.08 sp** ink · sharp → sharp **1.09** · last sharp → meter **1.56** origin / **0.13 sp** ink |

⭐ **Read in one convention, the four books converge**: an ink gap of roughly **0.3 – 1.4 sp** between
the clef and the next symbol, with **Gould's own plates at 0.95–1.00** and **Stone's stated "one
staff-space or a little less"** landing on the same place. Ross's and G&L's ink gaps are the tight end
(0.08–0.28 sp) because their clefs are drawn wide (2.5–3.2 sp) inside a fixed 3½ origin step.

## 3.3 clef → first note (no key, no meter) — ⭐ Gould gives a TABLE and Ross a number

> **Gould p. 42**, STATED: *"The greatest distance between symbols should precede the first note. For
> a note without an accidental, allow **2–3 stave-spaces**."*

**Gould p. 42, *Recommended distances before first note*** — STATED, and the row heading is the
symbol the note follows:

| the note follows… | no accidental | one accidental | more accidentals |
|---|---|---|---|
| **a clef only** | **2½** | 1½ | 1 |
| **a key signature** | **2½** | 1½ | 1 |
| **a time signature** | **2** | 1 | 1 |

⭐⭐ **The distance depends on WHAT PRECEDES the note, and the meter is the tight one** — Gould p. 42:
*"Notes can be placed slightly closer to a time signature than to a clef or key signature."*

MEASURED, ink-to-ink, and all five instances agree with the table:

| instance | measured |
|---|---|
| Gould p. 42, *"with clef only, 2½"* (her ruler ticks at 1 sp: 1133→1153→1173→1184) | **2.55 sp** |
| Gould p. 42, key → note | **2.45 sp** |
| Gould p. 42, meter → note | **2.05 sp** |
| Gould p. 8, fig. 1, clef → first note | **2.40 sp** |
| Gould p. 8, mid-bar fig., clef → first note | **2.50 sp** |

| source | kind | clef → first note |
|---|---|---|
| **Ross p. 145** | STATED, **origin-to-origin** | **5½** — and, with one accidental before the note **6**, with two **7** (p. 146). Also: last key accidental → note **3½**, time signature → note **3½**, barline → note **1**. |
| Ross p. 146 | STATED | *"When an accidental precedes the first note of music, that note must be moved **half a space to the right**… One space is allowed for each similar accidental (sharps may be given one and a quarter spaces)."* |
| **Stone p. 45** | STATED, **gap** | *"between any of the above and the **first note or accidental or rest** (with the exception of whole rests and measure-filling whole notes): **1½ staff-spaces**"* |
| **Stone p. 45** | 🚨 MEASURED | clef → first note **2.96 sp** · clef → accidental **2.39 sp** — **twice his own sentence** |

⭐⭐ **Converted, three books land in the same place and Stone's SENTENCE is the outlier.** Ross's 5½
origin-to-origin less a 2.7–2.8 sp clef ink ⇒ a **≈2.7 sp gap**; Gould's table says **2½**; Stone
*draws* **2.96**. His stated 1½ agrees with nobody, including his own engraver — who followed the
manual Stone's own footnote cites.

## 3.4 Does the order or the spacing change when a part is absent?

**No — the order is invariant in all four books**, and only the *last* symbol before the note changes
the distance:

- **Gould p. 42** — the table's three rows ARE the answer: dropping a part just selects a different
  row, and only the time-signature row differs (2 instead of 2½).
- **Gerou & Lusk p. 51** — *"The clef is always **placed before the key signature and time
  signature**."* · p. 78 — *"Key signatures appear after the clef but before the time signature."* ·
  p. 28, on courtesies — *"The order is the same as the order presented at the beginning of the piece
  (clef, key signature, time signature)."*
- **Ross pp. 143–147** — he gives an independent number for **every pair**, so an absent element
  simply selects another row (clef → meter 3½ when there is no key; clef → note 5½ when there is
  neither).
- **Stone p. 45** — makes it explicit by **drawing all five cases** under one rule set: *clef, key,
  time, accidental, note* / *clef, key, accidental, note* / *clef, time, accidental, note* / *clef,
  accidental, note* / *clef, note*, plus a sixth for whole-measure whole notes and whole rests.

## 3.5 ⚠️ Gould's p. 42 top figure is 1.22× looser than its own rulers

Her drawn rulers there read **1–1¼ · 1–1½ · 2** (clef→key, key→meter, meter→note) and the ruler
glyphs measure exactly that (19 px, 26 px; 20 px, 31 px against sp = 20.25 px). The **ink** does not:

| gap | her label | MEASURED ink-to-ink | ratio |
|---|---|---|---|
| clef → key signature (4♭) | 1–1¼ | **1.53 sp** | 1.22× |
| key signature → time signature (6/8) | 1–1½ | **1.83 sp** | 1.22× |
| time signature → first note | 2 | **2.42 sp** | 1.21× |

The ratio is **uniformly 1.22×** and each ruler stops 0.22–0.44 sp short of the next glyph's extreme
ink. Two readings are possible — she measures to a symbol's *optical* left edge rather than to the tip
of a flat's ascender or the rounded left of a digit; or that one plate was set loose. ⭐ **The table
directly beneath it on the same page, and p. 93, both measure ink-to-ink and land on the stated
numbers**, so treat the top figure as the outlier, not the rule.

## 3.6 The floors

- **Gould p. 42** — *"Allow a stave-space after a clef and on either side of a barline before a
  notational symbol"* · *"An accidental should never be closer to a preceding symbol than one
  stave-space"*.
- **Gould p. 41** — *"Where space is limited, the distance between characters should not be less than
  **½ stave-space** and no characters should collide."*
- **Gould p. 43**, *Additional clefs and accidentals* — *"Reduce the space around clefs and
  accidentals to **½ space**, to minimize distortion"* (when notes are close together).

---

# PART 4 — MID-SCORE CLEF CHANGES

## 4.1 ⭐⭐ The small clef's SIZE — every book states or draws a different number

| source | kind | ratio |
|---|---|---|
| **Gould p. 7** | **STATED** | *"A change of clef placed after the beginning of the system is **two-thirds of the size** of the clef at the beginning of the stave (see following examples)."* |
| **Gould p. 573** | STATED | *"The cue clef is the same size as a mid-system clef: **about two-thirds** of the full-sized clef."* |
| 🚨 **Gould**, six measured pairs | **MEASURED** | **0.75** — see below |
| **Gerou & Lusk p. 51** | **STATED** — the only other numeric ratio in any of the four books | *"When the clef changes within a staff, a cue-size clef is used (**usually 75% of the original clef size**). Courtesy clefs are also cue size."* |
| **Gerou & Lusk p. 52** | STATED | *"The **courtesy clef is cue size**; the key signature and time signature are **normal size**."* |
| **Ross p. 166** | STATED, non-numeric | *"For clef change occurring during a composition, use a clef **two or three sizes smaller than normal**. If this clef change continues on the following staff, the clef becomes normal size, and remains so throughout the piece."* — die-size language |
| **Ross p. 167** | **MEASURED** | **0.68 (height) / 0.65 (width)** — a small courtesy bass clef and a full bass clef on one plate: 2.22 sp vs 3.28 sp tall, 1.75 sp vs 2.68 sp wide |
| **Stone pp. 46, 57** | STATED, non-numeric | *"of a **slightly smaller** size"* (twice), *"a **warning clef**, of a slightly smaller size"* |
| **Stone p. 57** | ⚠️ MEASURED | width ratio 0.61, height ratio 0.81 — **internally inconsistent at 21 px/sp; unusable**, though its width leans the same way as Ross's |

🚨🚨 **GOULD WRITES TWO-THIRDS AND DRAWS THREE-QUARTERS.** Six independent pairs, three pages, two
clef shapes, and 1 px = 0.05 sp here — it is not measurement noise:

| plate | full clef | small clef | ratio (w / h) |
|---|---|---|---|
| p. 7, *"and not"* — treble | w 2.95, h 7.55 | w 2.20, h 5.60 | **0.746 / 0.742** |
| p. 7, end-of-system cautionary — bass | w 2.84, h 3.13 | w 2.14, h 2.39 | **0.753 / 0.764** |
| p. 8, fig. 1 — bass | w 2.85, h 3.15 | w 2.15, h 2.45 | **0.754 / 0.778** |
| p. 8, fig. 2 — treble | w 2.95, h 7.50 | w 2.20, h 5.65 | **0.746 / 0.753** |
| p. 93 — alto | w 2.86, h 3.75 | w 2.20, h 3.10 | **0.769 / 0.827** |
| p. 93 — bass | w 2.85, h 3.15 | w 2.10, h 2.50 | **0.737 / 0.794** |

⭐ **So the literature's band is 0.65 – 0.75, and the two ends are held by a MEASUREMENT each**:
Ross's plate draws **0.65–0.68**, Gould's plates draw **0.75**, Gerou & Lusk *state* **0.75**, and
Gould's *sentence* — two-thirds, which she hedges once as *"about"* — is the only support for 0.667
and her own engraver did not follow it. **The scan beats the sentence, a fifth time in this repo.**

## 4.2 ⭐⭐ WHICH SIDE OF THE BARLINE — four books, no dissent: **BEFORE it**

| source | statement |
|---|---|
| **Gould p. 8**, *At the beginning of a bar* | *"**The clef always goes before the barline, whether or not rests precede the entry.**"* · *"The only time that clefs appear directly after a barline are clefs for cues (see* Positioning clef changes*, p. 573) and clef changes after repeat sections (see* Changes after a repeat*, p. 235)."* |
| **Gould p. 93** | *"Place the new clef **before** the barline, the new key signature **after** the barline (and in the new clef)."* |
| **Ross p. 166** | *"If a clef change affects an entire measure, the change is made **ahead of the barline** of the measure to be changed."* |
| **Ross pp. 151, 167** | *"A barline never precedes a clef **unless** the barline comprises a complete system of music"* · *"(A barline never precedes a clef sign unless it is a systemic barline.)"* |
| **Stone p. 46** | *"At changes of clefs between measures, the new clef is placed about **one staff-line space before the barline**."* ⭐ the only stated *distance* for a change clef in any of the four books, and it is a **gap** |
| **Stone p. 57** | *"If a clef change takes place at a barline, the new clef, which should be of a slightly smaller size, is placed **before the barline**"* |
| **Gerou & Lusk p. 27** | *"**If a clef change affects a complete measure, it is always placed before the barline.**"* · *"The new clef (cue size) is placed before the barline if the clef changes mid-staff."* |
| **Gerou & Lusk p. 51** | *"**Only a systemic barline can precede a clef sign.**"* · p. 27: *"A single staff should never begin with a barline."* |

**Related, and consistent** — **Gould p. 234**: *"When there is a new clef, key signature or time
signature at the beginning of a repeated section, place the repeat marks **afterwards**"*;
**p. 235**: *"A change that affects the music only after a repeat goes **after** the repeat
barline."*

**MEASURED room around a barline-adjacent change clef (Gould):**

| plate | small clef ink → barline ink | the barline | barline → next ink |
|---|---|---|---|
| p. 8, fig. 1 | **0.75 sp** | 0.25 sp, full stave height | 1.60 sp |
| p. 8, fig. 2 | **0.75 sp** | 0.25 sp | 1.70 sp |
| p. 93, alto change | **0.75 sp** | 0.25 sp | **0.80 sp** to the new key signature |
| p. 93, bass change | **0.80 sp** | 0.20 sp | **0.80 sp** to the new key signature |

(Key-signature accidentals after that barline are spaced **0.25 sp** apart — Gould p. 93, measured.)

## 4.3 A clef change MID-BAR

| source | statement |
|---|---|
| **Ross p. 167** | *"With few exceptions, the substituted clef is placed **immediately before the note involved**."* · when the affected notes fall on the beat, *"the new clef sign is placed **directly before the notes affected**"*; on a fractional beat, *"the clef is placed **prior to the rest** marking the silent portion of the beat"* |
| **Gerou & Lusk pp. 51–52** | *"If a clef change is within a measure, the clef is placed **directly before the first note involved**."* · after a rest **and on a beat**, *"directly before the first note affected"*; after a rest **but not on a beat**, *"the clef **precedes the rest**"* |
| ⛔ **Stone p. 46** | ⭐ **an explicit refusal, worth recording as such**: *"**There are no specific rules for clef changes within a measure.**"* |

**MEASURED, Gould p. 8, the *mid-bar* figure** (1 sp = 20 px) — she draws a *recommended* and a
*rather than* version:

| | space before the clef | space after the clef |
|---|---|---|
| her **recommended** version | **0.75 sp** | **0.80 sp** |
| her *"rather than"* version | 1.25 sp | 0.55 sp |

## 4.4 The CAUTIONARY clef at the end of a system — ✅ four books, one shape

| source | statement |
|---|---|
| **Gould p. 7**, *At the beginning of the system* | *"Give warning of the clef change by placing the new clef **at the end of the previous system before the barline**."* |
| **Ross p. 167** | *"If a change in clef is indicated for a staff, the change is made with a **smaller size clef before the barline in the previous staff**. The clef at the beginning of the next staff will be the **regular size**."* |
| **Stone p. 57** | *"If a clef changes from one line to the next, a **warning clef**, of a slightly smaller size, is placed **at the end of the line before the barline** to signal that the next line begins with a new (full-size) clef."* |
| **Gerou & Lusk p. 52** | *"If a clef change occurs at the beginning of a staff, a **courtesy clef is placed before the barline at the end of the previous staff**, followed by the new clef at full size in the new staff."* · p. 27: *"A courtesy clef is placed **before the last barline** of the staff if the new clef begins immediately on the next staff."* |

**MEASURED — and it confirms the asymmetry already recorded for the key signature:**

| | Gould p. 7 | Ross p. 167 | Stone p. 57 |
|---|---|---|---|
| cautionary clef ink → barline ink | **0.50 sp** | **1.01 sp** | **0.75 sp** |
| the barline itself | 0.25 sp thick, plain, full stave height, **and it terminates the stave** | full barline **closing** the stave (0.27 sp) | closes the stave |
| the next system's clef | full size, indent 0.80 sp | *"regular size"* | full size |

⭐⭐ **The clef is the OPPOSITE of the key and the meter**, and Gerou & Lusk say it in words
(pp. 28, 52): the courtesy **clef** is drawn **before** the barline and the stave is **closed**;
the courtesy **key signature** and **time signature** are drawn **after** the last barline and the
stave is left **OPEN** (*"Also notice the open staff after the courtesy key signature and time
signature"*). ✅ That is exactly what `reference/README.md`'s 2026-08-28 table already records from
Gould p. 7 / Stone p. 57 / G&L p. 52 — re-verified here, with the 0.50 sp measurement confirmed and
two more instances added.

**Other instances of the same pattern in Gould**: **p. 235** (*"place the warning clef … at the end
of the repeated section"*), **p. 9**, *After periods of rests* (*"Place the clef change at the end of
the system after the player has finished"*), **p. 507** (octave-transposing clef exchanges — *"give
warning of the new clef at the end of the previous system"*, measured there too, same shape).

**A simultaneous clef + key (+ meter) change**, for completeness — three books, no dissent, and this
half is already in `docs/research/key-signature-research.md`:

- **Gould p. 93** — clef before, key after, *"and in the new clef"*.
- **Ross p. 168** — *"a smaller clef is added **prior to a double barline**, after which comes the
  change of key (in the **new** clef) followed by the new time signature"*, spelled out separately for
  treble→bass and bass→treble; and *"If the staff in question contains a key signature, the signature
  does **not** alter the rule."*
- **Gerou & Lusk p. 52** — *"The rules for clef changes are **not affected** by the addition of a key
  change and/or time signature change. **The clef sign precedes the barline; the key signature and
  time signature follow the barline.**"*

---

# PART 5 — VERTICAL

## 5.1 Line placement — STATED by Gould and Ross, drawn by all four

> **Gould p. 5** — *"There are four clefs in common use. It is important to place each on the stave so
> that it **centres precisely on the relevant stave-line**. The treble (or G) clef winds around the G
> line; the bass (or F) clef winds around the F line, and its dots fall each side of the F line."*
>
> **Gould p. 6** — C clefs *"centre on whichever line is to be designated as middle C"*; *"The alto
> clef centres on the middle stave-line. **It covers the height of the stave.** The tenor clef centres
> on the second stave-line down. It is the same height as the alto clef (the height of the stave), but
> **placed one stave-line higher**."*; percussion clefs *"are placed in the middle two stave-spaces"*.
>
> **Ross p. 165** — *"the **ball of the bass clef always falls on the F line**, and the dots which
> center the F line lie in the **spaces above and below it**"*.
>
> **Ross p. 166** — *"Though the **center of the C clef usually straddles a staff line**, it is being
> seen more and more in the **third space**, especially in choral works."*, with a drawn row of
> soprano / mezzo-soprano / alto / tenor / baritone. Neutral (percussion) clef: *"The vertical lines
> are approximately **½ space apart** and approximately **¼ of a space thick**. They extend from the
> **second to the fourth line** of the staff."* Double treble clef: *"the two clefs **touch but do not
> overlap**."*

**MEASURED (Gould p. 6), relative to each clef's own reference line:**

| | |
|---|---|
| treble clef about its G line (2nd from the bottom) | **4.84 sp above**, **2.55 sp below** |
| bass clef about its F line (4th from the bottom) | **0.85 sp above**, **2.26 sp below** |
| bass-clef dots | centred **0.41 sp above** and **0.46 sp below** the F line, diameter **0.54 sp** — one in each adjacent space ✔ |

## 5.2 ⭐ OPTICAL CENTRING — ⛔ **UNKNOWN, and Gould's book does not contain the word**

A full-text grep for `optical` / `optically` across Gould's entire 983 KB OCR layer returns
**zero hits anywhere in the book**. She frames clef placement purely as **line registration** — the G
line, the F line, the middle-C line — never as balancing the glyph within the stave.

**Ross p. 165 is the closest any of the four books comes, and it is a rule about the BODY, not the
bbox:**

> *"the **body of the treble clef always fills the two spaces between the bottom and middle
> staff-lines**; its head and tail, however, are quite often its distinguishing elements."*

⭐ That is worth keeping: **the clef is registered by its body, and its head and tail are allowed to
vary** — which is why the treble clef's total height differs by half a stave-space between Gould's
engraver and Ross's (§2.2) without either being wrong.

**MEASURED, Gould p. 6** — where each clef's ink centre falls relative to the stave's own vertical
centre (the middle line):

| clef | ink centre |
|---|---|
| Treble | **0.15 sp ABOVE** — effectively centred |
| Bass | **0.30 sp ABOVE** |
| Alto (C) | **0.00 sp — exactly on the middle line** ✔ |
| Percussion | **0.00 sp** ✔ |

⚠️ The treble clef's near-centring is a **consequence of the glyph's design**, not a stated rule.
⛔ Do not turn it into one.

---

# PART 6 — 🚨 WHERE THE DRAWING BEATS THE SENTENCE

Five, this time — and each is a case where implementing the prose would have been wrong:

1. ⭐⭐ **Gould's small clef.** Prose pp. 7 and 573: **two-thirds**. Drawn, six independent pairs across
   three pages, two clef shapes: **0.75**. Gerou & Lusk *state* 0.75. ⇒ the sentence is the outlier.
2. ⭐⭐ **Stone's clef → first note.** Stated p. 45: **1½ stave-spaces** (a gap). His own plate draws
   **2.96 sp**, Gould's table says 2½, and Ross's 5½ origin-to-origin converts to ≈2.7. His engraver
   followed the manual his own footnote cites.
3. **Gould's indentation.** Prose p. 6: *"one stave-space or a little less"*. Drawn four times on the
   same page: **0.64–0.69 sp**.
4. **Gould's p. 42 top figure.** Its own rulers say 1–1¼ / 1–1½ / 2; its ink is uniformly **1.22×**
   that. The table beneath it, on the same page, is the one that agrees with the prose.
5. **Ross's bracket thickness** (from `docs/research/braces-brackets-research.md`, re-measured here on p. 156).
   Stated p. 155: *"a vertical line **half a space thick** (the same as a beam)"*. Drawn:
   **0.60–0.67 sp**. ⭐ Gould's, by contrast, measures **0.53–0.56 sp** on pp. 507 and 518 — she draws
   her own sentence (*"the square bracket is beam thickness"*, p. 516).

---

# PART 7 — HOW IT LANDS AGAINST THE NUMBERS WE HOLD

⚠️ **This section is a COMPARISON, not a work list.** `src/engine/layout/headerInk.ts` and
`keySignatureLayout.ts` were read **only** to know which of our numbers the literature should be held
against. ⛔ Nothing here proposes a change, and ⛔ no number below has been put into code.

| ours | value | the literature | verdict |
|---|---|---|---|
| `HEADER_TO_NOTE` | **2.0 sp**, one number for the gap after *any* header | Gould p. 42's table gives **2½ after a clef or a key signature** and **2 after a time signature**, and says why — *"Notes can be placed slightly closer to a time signature than to a clef or key signature"*. Ross p. 145 converts to ≈**2.7**; Stone draws **2.96**. | 🚨 **PARTIALLY CONTRADICTED — and in a structural way, not by 0.5 sp.** Our 2.0 is exactly Gould's *time-signature* row; every source puts the *clef* and *key* rows **higher**. ⭐ The literature says this is **one number per preceding symbol**, not one number. |
| `CLEF_TO_KEY_INK` | **0.82 sp** | Gould p. 42 table **0.95**, p. 93 **1.00**, prose p. 41 *"1–1½"*; Stone p. 45 *"one staff-space or a little less"*; Ross p. 143's 3½ origin-to-origin converts to ≈0.82 with a 2.68 sp clef. | ✅ **CONFIRMED, at the tight end.** The books' band is ≈0.8–1.0; ours is its floor. |
| `BETWEEN_PARTS` (clef → meter) | **1.0 sp** | Gould p. 42 table **0.95** ink; Stone p. 45 **1.0** gap, stated; Gould p. 41 *"1–1½"*. | ✅ **CONFIRMED — two independent statements and one measurement.** |
| `KEY_TO_METER_INK` | **1.15 sp** | Gould p. 41 *"1–1½"*, p. 42 figure label *"1–1½"*; Stone p. 45 **1.0** gap, stated. | ✅ **CONFIRMED** (already recorded in `docs/research/key-signature-research.md`). |
| our clef indent | the clef's ink starts **≈0.4–0.5 sp** past the stave's left edge | Gould **0.64–0.90** (a **0.65 sp clear gap** after whatever terminates the stave); Ross **STATED ½–1**, drawn **0.71–1.05**; G&L drawn **0.36–0.41**. | ⚠️ **INSIDE the band but at its low end** — above G&L, at the floor of Ross's stated range, below everything Gould draws. ⏭️ ⛔ Not a defect: three books span 0.36–1.05 and no two agree. |
| `CLEF_FULL` : `CLEF_SMALL` | extents 3.2/3.5/3.6/3.6 vs 2.6/2.6/2.7/2.7 | Gould **STATES ⅔** (pp. 7, 573) and **DRAWS 0.75**; G&L **STATE 75%**; Ross **DRAWS 0.65–0.68**; Stone unusable. | ⚠️ **The literature does not agree with itself** — band **0.65–0.75**, with a measurement at each end. ⛔ Our numbers are *extents including their lead-in*, so they are not directly comparable to a glyph ratio; the comparable quantity is the premium, and the books cannot settle it below ±0.10. |
| a clef CHANGE at a bar start, drawn **after** the barline | `hasClefChange` draws the small clef at the head of the new bar | 🚨 **All four books say BEFORE the barline** — Gould p. 8 (*"always"*), Ross p. 166, Stone pp. 46/57, G&L p. 27; and three of them add that **only a systemic barline may precede a clef** (Ross pp. 151/167, G&L p. 51). | 🚨🚨 **CONTRADICTED, unanimously.** This is the sharpest finding for the codebase in the whole document. ⏭️ It is a *drawing* question, and ⛔ nothing here says how to fix it. |
| the CAUTIONARY clef at a line end | drawn small, before the closing barline | ✅ Gould p. 7, Ross p. 167, Stone p. 57, G&L pp. 27/52 — all four, same shape, and **measured at 0.50 / 0.75 / 1.01 sp** clef-ink → barline. | ✅ **CONFIRMED, four sources.** ⚠️ But it fires only at a **line end**; §4.2's rule is about **every** barline. |
| `cautionaryExtent` treats a courtesy **clef** as small and a courtesy **key/meter** as full size | — | **G&L p. 52**, stated outright: *"The courtesy clef is cue size; the key signature and time signature are normal size."* | ✅ **CONFIRMED** (already cited in the file). |
| clef ink extents (whatever we reserve above/below) | — | treble **6.95–7.50 sp** tall, split **1.3–1.8 above / 1.5–1.7 below**; bass **3.1–3.3**, never below the bottom line; C clef **fills the stave**. | ⭐ **A measured range now exists**, from three books, where before there was none. |

---

# PART 8 — ⛔ UNKNOWN: checked, and genuinely absent

⭐ **Every line names the book and the pages read.** ⛔ None of these is "the books are silent" as a
shorthand for not having looked.

## 8.1 Questions the literature does not answer at all

| question | status |
|---|---|
| ⭐⭐ **Does a bracket or brace move the clef?** | **UNKNOWN IN PROSE, in all four books.** The answer in PART 1 is **measured geometry only** — five plates, two books, two of them controlled comparisons. Read and not found: Gould pp. 5–9, 41–43, 486–7, 507, 509, 516–519; Ross pp. 143–157, 165–170; Stone pp. 6–7, 217; G&L pp. 42–44, 51, 75, 120. |
| **A brace's horizontal offset from the systemic barline** | **UNKNOWN in prose.** Ross p. 155 gives only its length. Measured: 0.45 sp (Gould p. 343), 0.50 sp (G&L p. 51). |
| **The clef's ink extent above/below the stave, as a stated rule** | **UNKNOWN.** No book states it; §2.2 is entirely measurement. The nearest prose is Ross p. 165's *"the body of the treble clef always fills the two spaces between the bottom and middle staff-lines"* — a rule about the **body**, explicitly not about the head and tail. |
| **The treble clef's vertical SPLIT** (why Gould draws it 0.3 sp higher than Ross and G&L) | **UNKNOWN.** Not addressed by any of the four. |
| **Optical centring of a clef within the stave** | **UNKNOWN.** ⭐ The word `optical`/`optically` appears **nowhere in Gould's whole book** (full-text grep, 983 KB OCR). Read and not found: Gould pp. 5–9; Ross pp. 143–152, 165–170 and his index; Stone pp. 6–7, 44–47, 52–53, 56–57, 72–73; G&L pp. 27–29, 42–43, 49–53, 74–75, 78–81, 120–121. |
| **Whether the header's order changes when a part is absent** | **Answered NO** by all four (§3.4) — but *"the numbers change"* is answered only by Gould's three-row table; no other book varies a number with what precedes. |
| **A clef change WITHIN a measure, as a rule** | ⭐ **Stone p. 46 REFUSES it in words**: *"There are no specific rules for clef changes within a measure."* Ross p. 167 and G&L pp. 51–52 do give one (immediately before the note; before the rest on a fractional beat). Recorded because a stated non-rule is not a silence. |

## 8.2 Checked negatives, per book — ⛔ so nobody re-reads them

**Gould** — the complete clef bibliography from her own index (`CLEFS 5–9, 32, 41–3, 78–9, 91, 93,
142, 234–5, 279, 393, 433, 486–7, 506–7, 562–3, 573–4`) was walked, and every entry is accounted for
in this document except these, which carry **no position or spacing number**:

- **p. 519** — read in full: small-ensemble bracketing prose, then *Enlarging time-signature symbols*.
  **No figure at all.**
- **p. 517** — the Carter extract is a **photographic reproduction of a published score**, not Gould's
  own engraving, at ≈8.9 px/sp (1 px = 0.11 sp) with staff lines below threshold. ⛔ **Not measurable,
  and not evidence of her house style** — use p. 509 Table 2 for the same orchestral case.
- **pp. 562–563** — indexed under CLEFS but about clef *choice* when extracting parts.
- **pp. 486–487** — indexed as *"clefs, new movement, change for"*; about **indenting the first system
  for instrument labels** and which barline goes between movements. **No clef offset.**
- **p. 43** — the ½-space rule is stated, but both figures put every clef change *inside a beamed
  group*, so the clef's own ink cannot be separated from the beam. **Prose only; not measurable.**
- Grep hits checked and discarded: **p. 32** (ledger lines vs octave signs), **pp. 78–79** (an
  accidental holds good only in its own clef), **p. 142** (glissando with clef changes), **p. 279**
  (clefs on the five-line percussion stave), **pp. 393, 433** (instrument-specific clef choice).

**Ross** — pp. 143–152 and 165–170 are the whole of his clef material; the appendix hits (A-8, A-46)
are index entries pointing back to those runs and carry **no further clef numbers**.

**Stone** — ⛔ **any staff-start → clef distance is UNKNOWN.** Read: pp. 6–7, 44–47, 52–53, 56–57,
72–73. His only indent sentence is *"At the beginning of a composition or movement, always indent the
first line"*, which is the **system's** indent, not the clef's. His clef list on p. 56 is drawn with
no geometry.

**Gerou & Lusk** — ⛔ **any numeric header spacing is UNKNOWN.** They substitute *"Notice the
distance…"* and the figure (p. 51). ⭐ **Their only numeric statement about clefs anywhere in the book
is the 75% cue size** (p. 51). Their pp. 49–51 clef plates are drawn and captioned with middle C, with
no prose about centring or line placement.

## 8.3 Still genuinely missing from the library

**Gardner Read**, *Music Notation* · **Chlapik**, *Die Praxis des Notengraphikers* · Boosey & Hawkes'
house manual. ⛔ When one of these would have answered a question, the honest report is **UNKNOWN** —
`reference/README.md` says so, and none of them was reachable for this pass.

---

## What `reference/README.md` should gain from this pass

⏭️ Not written yet — recorded here so the manifest can be updated in the same commit as any follow-up:
a *"What was asked of it on 2026-08-29"* table covering **the clef**, whose headline rows are
(1) **Gould p. 6 states the indentation and draws it 0.3 sp tighter**; (2) **Gould p. 7's two-thirds
change clef is drawn at three-quarters, six times** — the fifth scan-beats-sentence finding in this
directory; (3) **Stone p. 45's 1½ sp before the first note is drawn at 2.96** and his own footnote
defers to Ross, who agrees with the drawing; (4) **the bracket serif overlaps the clef in x on five
plates and no clef moves** — measured, and stated in words nowhere; and (5) **Gould p. 8: the clef
always goes before the barline**, with the two named exceptions (cue clefs p. 573, after a repeat
p. 235).

---

# APPENDIX — NON-LITERATURE FINDINGS (⛔ outside the brief, kept because they were gathered)

> ⛔⛔ **NOTHING IN THIS APPENDIX IS AN ENGRAVING AUTHORITY.** Everything above the line is what four
> engravers **wrote** or **drew**. Everything below it is an **implementation** — an engine's
> constant, a font's metric, a library's layout code — or, where marked, a **web source**. Three
> engines agreeing is three implementations agreeing, ⛔ not a rule with a citation.
>
> ⭐ **Why it is here at all.** Two passes over the engines and the font ran *before* the scope was
> narrowed to the literature, and this repo's standing rule is *do not re-run the research*. So the
> findings are kept, fenced, and labelled — ⛔ never to be quoted as if they were a treatise, and
> ⛔ not to be extended: no further engine, font or web research belongs in this document.
>
> Revisions read: **LilyPond `beedbfa`** · **MuseScore `929d1e9`** (⚠️ self-described 5.0-dev,
> **shallow clone, no history** ⇒ no MS3-vs-MS4 attribution is possible) · **Verovio `efff0bc`**, all
> in `~/dev/engine-sources`. Font data: `scripts/vendor/Bravura.json` (**fontName Bravura,
> fontVersion 1.481**) and `node_modules/vexflow/build/esm/src/*.js` (⚠️ 2026-09-19: the package is
> removed; the same npm build is kept at `~/dev/engine-sources/vexflow-5.0.0-npm/package`).

## A.1 ⭐⭐ The live question, in the engines: **all three say NO, the bracket does not move the clef**

⭐ This **corroborates** PART 1 by an entirely independent route — but PART 1 is the evidence, because
PART 1 is what engravers drew.

| | LilyPond `beedbfa` | MuseScore `929d1e9` | Verovio `efff0bc` |
|---|---|---|---|
| does the bracket move the clef? | **No** | **No** ¹ | **No** |
| why | the bracket is side-positioned off the **StaffSymbol**, `direction LEFT` (`scm/define-grobs.scm:3691-3699`) | bracket x = `xPosition − bracketWidth` (`rendering/score/systemheaderlayout.cpp:292`); the clef's x comes from `getFirstSegmentXPos` (`rendering/score/horizontalspacing.cpp:1204`), which knows nothing of brackets | `GrpSym::GetDrawingX()` returns literally 0 (`src/grpsym.cpp:65-75`); the sign is drawn in the **view**, decrementing a local `int &x` |
| what the bracket reserves | the **LINE only** — *"The reference for positioning the delimiter in X-direction should be the bracket line, not the right bound of the bracket tips."* (`lily/system-start-delimiter.cc:54-61`) | the **LINE only** — `bracketWidth + bracketDistance` = 0.90 sp; the serif is in the `Shape`, which spacing never reads | **nothing**, unless the group carries an instrument label (`src/view_page.cpp:507-509, 539`) |
| serif tip reaches, past the staff's left edge | **+0.65 sp** | **+1.06 sp** (Leland) / +0.98 (Bravura) | **+0.60 sp** (Leipzig, its default font) / +0.88 (Bravura) |
| clef ink left | +0.80 sp | +0.93 sp | +0.65 sp |
| serif vs clef | stops 0.15 sp short | **overlaps by 0.13 sp** | stops 0.05 sp short |

¹ One exception, MuseScore only: on a **single-staff** system a bracket forces a `BeginBarLine`
segment into existence (`rendering/score/measurelayout.cpp:2073-2074`), moving the clef from the
0.75 sp path to the 0.93 sp path — **+0.18 sp**.

⭐ **LilyPond states the principle in a code comment** — the tips are deliberately excluded from the
X-extent while the Y-extent keeps them. That is the same *"a vertical band, not a column of reserved
room"* reading PART 1 measures.

## A.2 The header gap table, in staff spaces (⛔ engine constants)

| gap | LilyPond | MuseScore | Verovio |
|---|---|---|---|
| system start → clef ink | 0.80 (`LeftEdge.space-alist (clef . (extra-space . 0.8))`, `scm/define-grobs.scm:2093`) | 0.75 (`Sid::clefLeftMargin`, `style/styledef.cpp:214`) / 0.93 with a `BeginBarLine` | 0.50 / 0.65 with a system start line |
| clef → key signature | **0.82** (`Clef.space-alist`, `scm/define-grobs.scm:918`) | **0.75** (`clefKeyDistance`, `styledef.cpp:221`) | 1.00 |
| clef → time signature (no key) | **1.52** | **1.00** (`clefTimesigDistance`, `styledef.cpp:222`) | 1.00 |
| clef → first note (no key, no meter) | `(first-note . (minimum-fixed-space . 5.0))` — ⚠️ **NOT a gap**: it spans the clef *and* the gap, so after a 2.565 sp treble clef the actual gap is **≈2.44** | **2.50** at a system head (`systemHeaderDistance`, `styledef.cpp:225`); **0.80** mid-measure | **1.50** |
| clef → barline | 0.70 | 0.50 (`clefBarlineDistance`, `styledef.cpp:230`) | 0.50 |
| barline → clef | 1.00 | 0.75 | 1.00 |
| is a system start different from mid-line? | **yes, structurally** — a different neighbour (`LeftEdge` vs `BarLine`) *and* a different break-align order | the margin value is **identical**; what differs is alignment (mid-measure clefs are **right**-aligned, `rendering/score/tlayout.cpp:1849`) and the 2.5 sp header gap | **yes, by 0.15 sp** — the systemic-barline seed |

⭐ Worth noting against §3.3: **LilyPond's 5.0 is measured from the clef's LEFT EDGE, not as a gap** —
the same origin-vs-gap trap the treatises have, one layer down.

## A.3 The small clef, in the engines and the fonts (⛔ implementations)

| source | mechanism | ratio |
|---|---|---|
| **LilyPond** | a **separate METAFONT glyph** (`lily/clef.cc:38-43` appends `_change`), drawn with `reduction = 0.8` and **optically redrawn** — `mf/feta-clefs.mf:406` keeps hairlines at full weight, and `:404-405` enlarges the reduced G clef's loop *"Too small loop in reduced clef (G_change) interacts badly with stafflines"* | **0.80** |
| **MuseScore** | the **same glyph**, magnified — `dom/clef.cpp:110-117`, `Sid::smallClefMag` (`styledef.cpp:521`). ⛔ `SymId::gClefChange` etc. exist but are used by **no** clef layout or draw path | **0.80** |
| **Verovio** | SMuFL `*Change` glyph swap, **no scaling** (`src/clef.cpp:200/213/218`) ⇒ whatever the font says | **0.78–0.88** (Leipzig, its default) / 0.65–0.72 (Bravura) |
| **VexFlow 5** | `Clef.getPoint` (`build/esm/src/clef.js:101-103`): `size === 'default' ? Metrics.get('fontSize') : (fontSize * 2) / 3` — the **ordinary** glyph at 20 pt instead of 30 | **exactly ⅔** |
| **Bravura 1.481** `*Change` glyph bboxes | a redrawn glyph | **height 0.651–0.662**; width 0.656 / 0.694 / 0.724 (G / F / C) |
| **Leland** (MuseScore's font) | idem | **0.750** across the board |

⭐ So the implementations span **0.65 – 0.88**, which brackets the literature's 0.65–0.75 (§4.1)
without settling it.

## A.4 Which side of the barline, and the cautionary clef (⛔ engine behaviour)

| | LilyPond | MuseScore | Verovio |
|---|---|---|---|
| clef change at a barline | **before** — `break-align-orders` puts `clef` ahead of `staff-bar` mid-line (`scm/define-grobs.scm:633-694`) | **before**, unless it is an end-repeat and `Sid::placeClefsBeforeRepeats` (default **false**, `styledef.cpp:2179`) sends it after — `rendering/score/modifydom.cpp:296-318` and `:346-364` | **before** — right-aligned against whatever follows (`src/adjustclefchangesfunctor.cpp:90-123`); ⚠️ it never moves a clef across a barline, it honours the encoded order |
| cautionary clef at a line end | **yes, small** (`ly/engraver-init.ly:864` `explicitClefVisibility = #all-visible`) | **yes, small** (`Sid::genCourtesyClef` true, `styledef.cpp:528`) | **yes, FULL SIZE** — its alignment type is `ALIGNMENT_SCOREDEF_CAUTION_CLEF`, so the `*Change` swap never fires |

✅ All three agree with the four treatises (§4.2) that a clef change goes **before** the barline.

## A.5 Vertical (⛔ implementations)

- Per-clef line tables: **MuseScore** `ClefInfo::clefTable` (`dom/clef.cpp:49-91`, line counted from
  the bottom = 1, plus a `pitchOffset` that shifts by ±7 per octave while the **line stays the
  same**); **LilyPond** `scm/parser-clef.scm:30-62` (`clefPosition` in half-spaces from the centre
  line: treble −2, alto 0, bass +2); **Verovio** MEI `@line` (`src/clef.cpp:93-125`). All three keep
  the glyph on the same line for octave-transposing variants and change only the pitch map.
- ⛔ **Optical centring: none of the three has a horizontal optical-centre rule for a clef.**
  MuseScore's `opticalCenter` is used for articulations and dynamics only; Verovio's centring code is
  for articulations and multirests; LilyPond's one `optical` comment about a clef is **vertical**
  (`mf/feta-clefs.mf:324`, the F clef's top dot).
- **Bravura 1.481** publishes `opticalCenter` for exactly **30 glyphs, every one a dynamic** — ⛔ no
  clef has one. No clef appears in `glyphsWithAnchors` at all except the two ligature helpers.
- ⭐ **Verovio deliberately excludes the header clef from the staff-overflow skyline**
  (`src/calcbboxoverflowsfunctor.cpp:139-144`, with the comment *"Exception for the scoreDef clef
  where we do not want to take into account the general overflow"*) — the G clef is tall on every
  system and would otherwise inflate every system gap.

## A.6 Bravura's clef metrics, and the ink extents they imply (⛔ font metric)

From `scripts/vendor/Bravura.json` (1.481; the clef bboxes are byte-identical in the 1.392 and 1.482
copies, so there is **no version skew** on any number here). Placed with each clef's origin on the
line it names, on a stave whose bottom line is 0 and top line is 4:

| clef | bbox SW → NE | width | above the top line | below the bottom line | height |
|---|---|---|---|---|---|
| `gClef` | [0, −2.632] → [2.684, 4.392] | 2.684 | **+1.392** | **+1.632** | **7.024** |
| `fClef` | [−0.02, −2.540] → [2.736, 1.048] | 2.756 | +0.048 | **−0.460** (inside) | **3.588** |
| `cClef` | [0, −2.024] → [2.796, 2.024] | 2.796 | +0.024 | +0.024 | **4.048** |

⚠️ **Compare §2.2 and note the disagreement**: the font puts the treble clef at **1.39 above / 1.63
below**, which is Ross's and G&L's split (1.29–1.33 / 1.63–1.73) and **not Gould's** (1.83 / 1.55).
And the font's bass clef is **3.59 sp** where all four engraved bass clefs measure **3.1–3.3**.

⛔ `engravingDefaults` has **no key that bears on a clef or on the header** — all 30 are thicknesses
or line-to-line separations.

## A.7 VexFlow 5, which is what we drew through at the time (⛔ library constant)

> ⚠️ **2026-09-19: VexFlow is removed** (`docs/history/vexflow-removal-map.md`). What follows describes the
> library as it was read; the walk is now ours (`engrave/staff/signWalk`, `Stave.format()`
> transcribed) and so is the line each clef names (`engrave/header/clefSign`, from `Clef.types`).

- `Stave.format()` (`build/esm/src/stave.js:389-404`) walks the BEGIN modifiers in the order
  `Barline 0, Clef 1, KeySignature 2, TimeSignature 3`, and `StaveModifier.getPadding`
  (`stavemodifier.js:42-44`) returns **0 for index < 2** ⇒ **the clef gets zero padding on both
  sides**. Its x is `stave.x + 5 px` — the begin-barline slot, **5 px = 0.5 sp for every barline type
  including `NONE`** (`stavebarline.js:36-42`).
- There is **no glyph metrics table in VexFlow 5**: widths come from `context.measureText`
  (`element.js:346-349`) at draw time, i.e. the live Bravura advance.
- ⭐ **Our `headerInk.ts` measurements are reproducing a computation, not a constant.** For a
  line-opening treble bar with `4/4`: `0.5 (barline) + 2.684 (gClef advance) + 1.5 (timeSig padding)
  + 1.88 (timeSig4 advance) + 1.2 (Stave.padding)` = **7.764 sp**, which is the **7.8** recorded as
  *"VexFlow drew"* in `headerInk.ts`.
- Vertical placement was entirely VexFlow's (at the time of reading), from `Clef.types[type].line` (`clef.js:13-65`) +
  `Stave.getYForLine`; **no file in `src/` sets a clef's y**. Its line indices agree with our own
  `CLEF_REFERENCES` / `CLEF_MIDDLE_LINE_DIATONIC` tables independently.

⚠️ **One anomaly found in our own numbers while doing that arithmetic**, recorded and ⛔ not acted on:
`CLEF_FULL.treble = 3.2` sits **+0.02** above the closed form `0.5 + advance`, while every other row
of `CLEF_FULL`/`CLEF_SMALL` sits a consistent **≈ +0.3** above it. The premium `FULL − SMALL` is
**0.9 / 0.9 / 0.9** for bass/alto/tenor — which is one-third of each clef's advance, exactly what a
⅔ small clef implies — and **0.6** for treble. ⏭️ Worth re-measuring before anything leans on
`lineOpeningClefPremium`; `e2e/spacing.e2e.ts` pins 3.2 against the current drawing, so nothing is
silently wrong today.

## A.8 Interchange formats (⛔ spec text, read from local schema copies)

| | MusicXML 4.0 (`~/dev/engine-sources/MuseScore/src/importexport/musicxml/schema/musicxml.xsd`) | MEI (`~/dev/engine-sources/verovio/libmei/mei/mei-all_compiled.odd` — ⚠️ **6.0-dev**, not v5) |
|---|---|---|
| cautionary clef | ❌ **nothing** — no `@cautionary`/`@courtesy` on `<clef>` anywhere in the XSD | ✅ `@cautionary` on `att.clef.log`, purely **logical**: *"A 'cautionary' clef does not change the following pitches."* |
| size | ✅ `<clef size="full\|cue\|grace-cue\|large">`; ⚠️ the **percentage lives elsewhere**, in `<defaults><appearance><note-size type="cue">` ⇒ **MusicXML never states ⅔** | ❌ no `@cue`/`@scale`; only `@fontsize` |
| position / spacing | ❌ nothing normative. `@after-barline="yes"` is an **ordering** flag; `default-x`/`relative-x` are explicitly *"an override of the computation of the default position"* | ❌ nothing. `@ho` is *"a horizontal adjustment to a feature's **programmatically-determined** location"*; `att.distances` covers dir/dynam/harm/reh/tempo — no clef |

## A.9 ⛔ A web-sourced quotation, fenced and NOT relied on

One SMuFL implementation note was fetched from `smufl.formats.music` **before the web was ruled out**.
It is recorded here only because of what it cites, and ⛔ it is **not** used as evidence anywhere
above:

> *"Clef changes are normally drawn at **two-thirds the size** of clefs at the beginning of the
> system¹ … ¹ **Gould, ibid., page 7.**"*

⭐ **The substantive fact is on disk anyway and is where it belongs — Gould p. 7, §4.1** — and §4.1's
finding is that **her own six engravings draw 0.75, not ⅔**. So the spec is relaying a sentence whose
own author's plates contradict it.

## A.10 ⛔ Symbols that do NOT exist at those revisions (so nobody hunts them twice)

`Sid::clefRightMargin` · `Sid::clefNoteDistance` (CLEF→NOTE reuses `clefKeyRightMargin`) ·
`Sid::showCourtesyClef` (the style is `genCourtesyClef`) · a `BracketLayout` file — **all absent in
MuseScore**. `Sid::midClefKeyRightMargin` **exists but is read by no layout code**.
`SetCurrentScoreDefFunctor` (it is `ScoreDefSetCurrentFunctor`) · `CalcSystemLeftMarginFunctor` ·
`m_smallClef` / `IsSmall()` · any `SMUFL_F4xx` · a `systemHeaderDistance` equivalent — **all absent in
Verovio**. `lily/bar-line.cc` — **absent in LilyPond** (it is `scm/bar-line.scm`).

⚠️ Two standing caveats: a SMuFL font does **not** push its `engravingDefaults` into MuseScore's style
at load, so `styledef.cpp` is what MuseScore actually draws; and Verovio's default font is
**Leipzig**, not Bravura.
