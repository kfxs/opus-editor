# THE CLEF, GENERALLY — what the books and the engines say

> 📄 Research for **P5b** of `docs/own-engraving-engine.md` — the header run moving off `Stave`, and
> in particular `engine/engrave/header/clef.ts`, which parks two questions as parameters and names
> this document as the place they get answered.
>
> ⛔ **This document decides nothing and schedules nothing.** It is a SURVEY: the question, every
> option with its provenance, and what we draw today, named honestly. ⛔ It is **not** a work list and
> **not** a defect list.
>
> **Done 2026-09-02.** Four treatises on disk, three engine clones, VexFlow 5, Bravura 1.481.
>
> ---
>
> ## 🚨🚨 BEFORE YOU PUT ANY ROW OF §11's TABLE TO HIM — READ THIS
>
> **A research document surveys the BOOKS. It does ⛔ NOT know what this repo has already decided.**
> On 2026-09-01 the sibling document (`docs/header-spacing-research.md` §"The table") listed two gaps
> as open choices when both were settled — one by his own rejection of a value he had looked at, one
> by an eight-day-old plan that had already weighed and rejected two of the three options being
> offered. He caught both (*"wasn't it already decided?"*).
>
> ⇒ ⭐⭐ **A row in §11's table means "the literature has something to say", ⛔ NEVER "we have not
> chosen".** Rows marked **CLOSED** are closed, and each names its closer. The losing options stay on
> the page because these numbers are a **swappable house style**
> (`project_engraving_defaults_are_a_house_style`) — ⛔ that is not evidence the question is open.
>
> ⭐ The one-page version of *what is already decided* is **`docs/clef.md` §4**. Read it first.

---

## 0. What was asked, what already existed, and what is new here

### 0.1 ⭐⭐ MOST OF THIS WAS ALREADY RESEARCHED — `docs/clef-spacing-research.md`, 2026-08-29

⛔ **Do not re-run it.** That document is 791 lines, four treatises, measured off the plates, and it
already answers — with page citations and measurements — the clef's **indent**, its **ink extents**,
the **header gaps** either side of it, **clef → first note**, the **small mid-score clef's ratio**,
**which side of the barline** a change goes, the **cautionary clef at a line end**, **mid-bar**
changes, the **vertical line registration**, and **optical centring** (⛔ UNKNOWN). Its APPENDIX
covers the three engines, Bravura's three plain clef bboxes, VexFlow's `Stave.format`, and the
interchange formats.

**This document does three things instead:**

1. **Indexes** that work against the ten questions asked here, so a reader can see the whole subject
   in **one table (§11)** without reading two files.
2. **Adds what it did not cover** — ⭐ **octave-transposing clefs** (§8), ⭐ **which clefs the books
   treat as standard and where the movable C clef sits** (§7), ⭐ the clef's scaling with **staff
   size** (§1.1), the clef with the **key and time signature** (§6), the clef at a **repeat** (§6.3),
   and the engines on the questions its own appendix did not ask (§9).
3. ⭐⭐ **Names, honestly, which questions this repo has already CLOSED** — which the 2026-08-29
   document did not attempt, and which is the discipline the 2026-09-01 round trip bought.

### 0.2 The sources, and how to reach each page again

| source | where | offset |
|---|---|---|
| **Gould, *Behind Bars*** | `reference/…(Elaine Gould)….pdf` + `gould-behind-bars-fulltext.txt` | PDF = printed **+20**. Clefs chapter printed **pp. 5–9** |
| **Ross, *The Art of Music Engraving and Processing*** | `reference/…(ted ross)….pdf` + `ross-art-of-music-engraving-fulltext.txt` | PDF = printed **+12**. Clefs printed **pp. 165–170** |
| **Stone, *Music Notation in the Twentieth Century*** | `reference/…(Kurt Stone)….pdf` + `stone-…-fulltext.txt` | ⚠️ **2-UP**: PDF n = printed **2n−22 / 2n−21** |
| **Gerou & Lusk, *Essential Dictionary*** | `reference/gerou-lusk-….pdf` + `.txt` | ⚠️ **2-UP**: PDF n = printed **2n−4 / 2n−3**. Clefs printed **pp. 49–52** |
| LilyPond · MuseScore · Verovio | `~/dev/engine-sources/…` | ⛔ never `/tmp` |
| VexFlow 5.0.0 | `node_modules/vexflow/build/esm/src/clef.js`, `stave.js` | |
| Bravura 1.481 | `scripts/vendor/Bravura.json`; our own copy of three clef boxes in `src/engine/fonts/bravuraMetrics.ts:154–156` | |
| **ours** | `src/engine/layout/headerInk.ts` · `engine/engrave/header/clef.ts` · `rendering/clefIndentPass.ts` · `rendering/clefOffsetPass.ts` · `utils/clefUtils.ts` · `engine/models/clefOps.ts` | |

⚠️ **The OCR is NOT quotable** (Gould's opening lines read `IVE G333"DE TO MU`). It locates a page;
the **scan** is then rendered (`pdftoppm -r 450`) and read. ⭐⭐ **A SCAN BEATS AN OCR whenever the
question is *what did they draw*** — this repo has now overturned five prose statements with their
own author's plates (`clef-spacing-research.md` PART 6).

---

## 1. THE CLEF'S SIZE, and how far its ink reaches

### 1.1 ⭐⭐ Is a clef drawn at the same scale as the staff? — **YES, and Gould states it outright**

> **Gould p. 5**: *"**The size of every notational symbol is measured in proportion to the stave
> size.** A stave-space is the distance between two stave-lines and is used as a measurement for
> notational symbols and spacing in this book."*

⭐ That is the governing sentence for this whole document, not just for the clef: **every number here
is a ratio because she says every number is a ratio.** Her C clef *"covers the height of the stave"*
(p. 6) is the same idea applied to one glyph.

**And a SMALL staff — measured on the books' own reduced plates, which is the real test:**

| plate | staff ratio | the clef, in stave-spaces |
|---|---|---|
| **Gould p. 433** — a Marenzio incipit beside the full-size score | sp 13.25 px vs 17.75 px = **0.746** | incipit bass clef **2.79 × 3.25 sp** · main bass clef **2.70 × 3.21 sp** ⇒ ⭐ **identical** |
| **Gerou & Lusk p. 54** — a cue-size solo staff above a full-size grand staff | sp 16.62 px vs 25.38 px = **0.654** | cue treble clef **2.65 × 7.04 sp** · full treble clef **2.64 × 6.94 sp** ⇒ ⭐ **identical** |

⇒ ⭐⭐ **In both books the clef is scaled WITH the staff and is unchanged in stave-spaces.** ⛔ It is
never held at an absolute size, and there is no separate clef magnification.

Both also state the staff-size rule that produces those plates:

> **Gould p. 575**: *"**A cue stave is about three-quarters of the full-sized stave.**"*
> **Gerou & Lusk p. 3**: *"The piano part may be full size or cue size… **If cue size, the staff should
> be cue size also.** (Cue-size notes on a full-size staff are not as easy to read.)"* — and p. 54,
> *"**All musical elements associated with the cue notes will also be at cue size**"* (65–75%).

**Ross** reaches the same place from the workshop rather than the page: his punches come in **twelve
catalogued sizes** *"covering all sizes of music"* with a chart of the staff sizes (p. 57), so a clef
simply exists once per staff size; and for the neutral clef he says it outright — *"In the event this
clef is used on a single line, **the clef shall correspond in size to the note size being used**"*
(p. 166).

⛔ **Stone: UNKNOWN.** Read for it: pp. 46, 56–57, 72–73, 248, plus a full-text grep for
*ossia / cue / small staff / reduced*.

⚠️ **This is a SEPARATE question from the mid-score change clef's reduction (§3)** — a small *staff*
scales everything; a change *clef* is reduced against its own staff. ⛔ Do not conflate them; two of
the engines apply both, multiplicatively.

**What we do:** ✅ **the same thing, structurally.** A staff is drawn inside a
`<g transform="scale(k)">` group, so a small staff's clef shrinks with everything else. ⭐ There is no
clef magnification of our own, and ⛔ there must not be one (`docs/small-staff-spacing.md`).

### 1.2 How far the ink reaches — MEASURED, because no book states it

⛔ **No book states a clef's ink extent.** The nearest prose is **Ross p. 165**, and it is a rule
about the *body*, explicitly not the whole glyph:

> *"the **body of the treble clef always fills the two spaces between the bottom and middle
> staff-lines**; its head and tail, however, are quite often its distinguishing elements."*

⭐ That sentence is worth keeping: **the clef is registered by its body, and its head and tail are
allowed to vary** — which is why the treble clef's total height differs by half a stave-space between
engravers without either being wrong.

Everything else is measurement (`clef-spacing-research.md` §2.2), in stave-spaces relative to the
five lines — a negative figure means the ink stops *inside* the stave:

| clef | source | width | above top line | below bottom line | height |
|---|---|---|---|---|---|
| **Treble** | Gould p. 6 | 2.85–2.95 | **+1.83** | +1.53…+1.57 | **7.41–7.50** |
| Treble | Gerou & Lusk p. 51 | 2.81 | +1.29 | +1.73 | 7.03 |
| Treble | Ross p. 156 | 2.54 | +1.33 | +1.63 | 6.95 |
| Treble | Stone p. 45 (5 instances) | 2.68–2.78 | — | — | — |
| **Treble** | ⛔ **Bravura 1.481** `gClef` | **2.684** | **+1.392** | **+1.632** | **7.024** |
| **Bass** | Gould p. 6 | 2.81–2.91 | −0.15 | −0.72…−0.74 | **3.11–3.16** |
| Bass | Ross p. 167 · G&L p. 51 · Stone p. 57 | 2.58–3.07 | ≈0.0 | −0.64…−0.94 | 3.09–3.33 |
| **Bass** | ⛔ **Bravura** `fClef` | **2.756** | +0.048 | **−0.460** | **3.588** |
| **Alto (C)** | Gould p. 6 | 2.80–2.86 | −0.15 | −0.15 | 3.70–3.75 |
| Alto (C) | G&L p. 51 | 3.9 | +0.04 | +0.04 | **4.0 (flush)** |
| **C** | ⛔ **Bravura** `cClef` | **2.796** | +0.024 | +0.024 | **4.048** |

⭐ **Three findings the table carries:**

1. **All five bass measurements agree**: the bass clef is 3.1–3.3 sp tall and its lowest ink stays
   0.6–0.9 sp *above* the bottom staff-line — it never leaves the stave downwards. 🚨 **Bravura's is
   3.588 sp and reaches 0.46 sp BELOW the bottom line** — the font is taller than every engraved bass
   clef in the library.
2. **The C clef fills the stave** — Gould's own sentence, G&L's drawing (flush to 0.04 sp), and
   Bravura (4.048). ✅ Three-way agreement, and the only clef where the books, the drawings and the
   font all land together.
3. 🚨 **The treble clef's SPLIT is where the books part company.** Gould draws **1.83 above / 1.55
   below**; Ross, G&L *and Bravura* draw **1.29–1.39 above / 1.63–1.73 below** — the same total
   height distributed differently, i.e. **Gould's treble clef sits ≈0.3 sp higher on the stave**.
   ⛔ No book states the split. ⛔ **UNKNOWN why.**

**What we do:** ⛔ we reserve no vertical extent for a clef at all — the clef is not in any skyline.
⭐ Bravura's three boxes are in the repo (`fonts/bravuraMetrics.ts:154–156`) and are used for the
*horizontal* ink only. ⚠️ Verovio deliberately **excludes** the header clef from its staff-overflow
skyline (`calcbboxoverflowsfunctor.cpp:139–144`) precisely because a G clef is tall on every system
and would otherwise inflate every system gap — so "reserve nothing" has a precedent.

---

## 2. THE VERTICAL ANCHOR — the curl, the dots, the centre

### 2.1 Stated, by two books

> **Gould p. 5**: *"There are four clefs in common use. It is important to place each on the stave so
> that it **centres precisely on the relevant stave-line**. The treble (or G) clef winds around the G
> line; the bass (or F) clef winds around the F line, and its dots fall each side of the F line."*
>
> **Gould p. 6**: C clefs *"centre on whichever line is to be designated as middle C"*; *"The alto
> clef centres on the middle stave-line. **It covers the height of the stave.** The tenor clef centres
> on the second stave-line down. It is the same height as the alto clef (the height of the stave), but
> **placed one stave-line higher**."*; percussion clefs *"are placed in the middle two stave-spaces"*.
>
> **Ross p. 165**: *"the **ball of the bass clef always falls on the F line**, and the dots which
> center the F line lie in the **spaces above and below it**"*.

### 2.2 ⭐⭐ The anchor is a FEATURE of the glyph, ⛔ never its box

Every statement above names a **part of the drawing** — the curl, the ball, the dots, the centre —
and none names a bounding box. Measured on Gould p. 6:

| | |
|---|---|
| treble clef about its G line (2nd from the bottom) | 4.84 sp above, 2.55 sp below |
| bass clef about its F line (4th from the bottom) | 0.85 sp above, 2.26 sp below |
| bass-clef dots | centred **0.41 sp above** and **0.46 sp below** the F line, diameter 0.54 sp — one in each adjacent space ✔ |

⭐⭐ **The font implements this for us.** SMuFL cuts each clef so its **origin sits on the anchor
line** — `gClef`'s curl encircles it, `fClef`'s dots straddle it, `cClef` is centred on it. ⇒ the
whole rule reduces to *put the glyph's origin on the line*, which is exactly what
`engine/engrave/header/clef.ts`'s `clefPlacement()` states:

> *"A clef stands ON A STAFF LINE — the one its name names — and that line's y is the glyph's
> BASELINE, ⛔ not its top and ⛔ not its centre."*

⛔ **A clef that looks too high is a FONT question or an anchor-line question, never a fudge factor.**

### 2.3 ⛔ OPTICAL CENTRING — UNKNOWN, and Gould's book does not contain the word

A full-text grep for `optical` / `optically` across Gould's entire 983 KB OCR layer returns **zero
hits anywhere in the book**. She frames clef placement purely as **line registration**. None of the
three engines has a horizontal optical-centre rule for a clef either; **Bravura publishes
`opticalCenter` for exactly 30 glyphs, every one a dynamic** — ⛔ no clef has one.

⚠️ Measured, Gould p. 6: the treble clef's ink centre falls 0.15 sp above the stave's middle line and
the alto's exactly on it. ⛔ **That near-centring is a consequence of the glyph's design, not a
stated rule. Do not turn it into one.**

**What we do:** ⛔ nothing of our own — the line each clef names is still VexFlow's `Clef.types`
table, arriving at `engine/engrave/header/clef.ts` as `ClefAnchor.lineY` already resolved. ⭐ Our own
`CLEF_MIDDLE_LINE_DIATONIC` (`clefUtils.ts:19`) and `ElementRegistry.CLEF_REFERENCES` agree with it
independently.

---

## 3. ⭐ THE SMALL CLEF — the ratio

### 3.1 🚨 The literature does not agree with itself, and the two ends are each held by a MEASUREMENT

| source | kind | ratio |
|---|---|---|
| **Gould p. 7** | **STATED** | *"A change of clef placed after the beginning of the system is **two-thirds of the size** of the clef at the beginning of the stave"* |
| **Gould p. 573** | STATED | *"The cue clef is the same size as a mid-system clef: **about two-thirds** of the full-sized clef."* |
| 🚨 **Gould**, six measured pairs (pp. 7, 8, 93) | **MEASURED** | **0.737 – 0.769 width / 0.742 – 0.827 height ⇒ ≈0.75** |
| **Gerou & Lusk p. 51** | **STATED** | *"a cue-size clef is used (**usually 75% of the original clef size**). Courtesy clefs are also cue size."* |
| **Ross p. 166** | STATED, non-numeric | *"use a clef **two or three sizes smaller than normal**"* — die-size language |
| **Ross p. 167** | **MEASURED** | **0.68 height / 0.65 width** |
| **Stone pp. 46, 57** | STATED, non-numeric | *"of a **slightly smaller** size"* |
| Stone p. 57 | ⚠️ MEASURED | internally inconsistent at 21 px/sp — **unusable** |

🚨🚨 **GOULD WRITES TWO-THIRDS AND DRAWS THREE-QUARTERS** — six independent pairs, three pages, two
clef shapes, at 1 px = 0.05 sp. ⇒ the literature's band is **0.65 – 0.75**, with a measurement at
each end, and Gould's *sentence* is the only support for 0.667.

⚠️ **A web source relays her sentence and cites her for it** (SMuFL's implementation notes: *"Clef
changes are normally drawn at two-thirds the size… ¹ Gould, ibid., page 7"*) — ⛔ fenced, not relied
on, and the point is that **the spec is relaying a sentence whose own author's plates contradict it**.

### 3.2 The implementations span wider still

| source | mechanism | ratio |
|---|---|---|
| **LilyPond** | a **separate METAFONT glyph** (`lily/clef.cc:38–43` appends `_change`), drawn with `reduction = 0.8` and **optically redrawn** — `mf/feta-clefs.mf:406` keeps hairlines at full weight, `:404–405` enlarges the reduced G clef's loop *"Too small loop in reduced clef (G_change) interacts badly with stafflines"* | **0.80** |
| **MuseScore** | the **same glyph, magnified** — `dom/clef.cpp:110–117`, `Sid::smallClefMag` (`styledef.cpp:521`) | **0.80** |
| **Verovio** | SMuFL `*Change` glyph swap, **no scaling** (`src/clef.cpp:200/213/218`) ⇒ whatever the font says | 0.78–0.88 (Leipzig) / 0.65–0.72 (Bravura) |
| **VexFlow 5** | `Clef.getPoint` (`clef.js:101–103`): `(fontSize * 2) / 3` — the **ordinary** glyph at 20 pt instead of 30 | **exactly ⅔** |
| **Bravura 1.481** `*Change` bboxes | a redrawn glyph | height **0.651–0.662** |
| **Leland** (MuseScore's font) | idem | **0.750** |

⭐⭐ **LilyPond's is the interesting one**: it does not scale at all — it draws a *different glyph*,
optically redrawn so the hairlines keep their weight and the reduced loop does not fight the staff
lines. That is the design answer to *"why does a naively-scaled small clef look wrong"*.

### 3.3 Is the same reduction used for a CAUTIONARY clef?

✅ **Yes, and it is stated twice.**

> **Gerou & Lusk p. 51**: *"Courtesy clefs are also cue size."*
> **Gerou & Lusk p. 52**: *"The **courtesy clef is cue size**; the key signature and time signature
> are **normal size**."*

Gould p. 7, Ross p. 167 (*"a smaller size clef before the barline in the previous staff. The clef at
the beginning of the next staff will be the **regular size**"*) and Stone p. 57 all draw it small and
all restore full size on the next system. ⭐ Measured: cautionary clef ink → barline ink =
**0.50 sp** (Gould p. 7), **0.75** (Stone p. 57), **1.01** (Ross p. 167).

⚠️ **Verovio is the one dissenter among the engines**: its cautionary clef is **FULL SIZE**, because
its alignment type is `ALIGNMENT_SCOREDEF_CAUTION_CLEF` and the `*Change` swap never fires.

**What we do:** `stave.addEndClef(clef, 'small')` — small, before the closing barline, restored full
size on the next line. ✅ Agrees with the four books. `cautionaryExtent` gives the clef the CUE-size
branch and the key/meter the full-size one, citing G&L p. 52. ⭐ The **ratio itself is VexFlow's ⅔**,
inherited rather than chosen.

---


## 4. A CLEF CHANGE'S HORIZONTAL PLACEMENT

### 4.1 ⭐⭐ WHICH SIDE OF THE BARLINE — four books, no dissent: **BEFORE it**

| source | statement |
|---|---|
| **Gould p. 8**, *At the beginning of a bar* | *"**The clef always goes before the barline, whether or not rests precede the entry.**"* · *"The only time that clefs appear directly after a barline are clefs for cues … and clef changes after repeat sections"* |
| **Gould p. 93** | *"Place the new clef **before** the barline, the new key signature **after** the barline (and in the new clef)."* |
| **Ross p. 166** | *"If a clef change affects an entire measure, the change is made **ahead of the barline** of the measure to be changed."* |
| **Ross pp. 151, 167** | *"A barline never precedes a clef **unless** the barline comprises a complete system of music"* |
| **Stone p. 46** | *"At changes of clefs between measures, the new clef is placed about **one staff-line space before the barline**."* ⭐ the only stated *distance* for a change clef in any of the four books, and it is a **gap** |
| **Stone p. 57** | *"If a clef change takes place at a barline, the new clef, which should be of a slightly smaller size, is placed **before the barline**"* |
| **Gerou & Lusk p. 27** | *"**If a clef change affects a complete measure, it is always placed before the barline.**"* |
| **Gerou & Lusk p. 51** | *"**Only a systemic barline can precede a clef sign.**"* |

✅ **And all three engines agree**: LilyPond's `break-align-orders` puts `clef` ahead of `staff-bar`
mid-line (`scm/define-grobs.scm:633–694`); MuseScore places it before unless it is an end-repeat and
`Sid::placeClefsBeforeRepeats` (default **false**) sends it after (`modifydom.cpp:296–364`); Verovio
right-aligns the change clef against whatever follows (`adjustclefchangesfunctor.cpp:90–123`).

**MEASURED room around a barline-adjacent change clef (Gould):**

| plate | small clef ink → barline ink | the barline | barline → next ink |
|---|---|---|---|
| p. 8, fig. 1 | **0.75 sp** | 0.25 sp | 1.60 sp |
| p. 8, fig. 2 | **0.75 sp** | 0.25 sp | 1.70 sp |
| p. 93, alto change | **0.75 sp** | 0.25 sp | **0.80 sp** to the new key signature |
| p. 93, bass change | **0.80 sp** | 0.20 sp | **0.80 sp** to the new key signature |

🚨🚨 **WE DRAW IT AFTER THE BARLINE.** A bar-opening change is `stave.addClef(clef, 'small')` at the
head of the new bar (`VexFlowRenderer.ts:2604`). ⛔ **This is a drawing question, it was first
recorded on 2026-08-29, and ⛔ nothing here says how to fix it or that it should be fixed.**

### 4.2 A clef change MID-BAR

| source | statement |
|---|---|
| **Ross p. 167** | *"With few exceptions, the substituted clef is placed **immediately before the note involved**."* · on a fractional beat, *"the clef is placed **prior to the rest** marking the silent portion of the beat"* |
| **Gerou & Lusk pp. 51–52** | *"If a clef change is within a measure, the clef is placed **directly before the first note involved**."* · after a rest but not on a beat, *"the clef **precedes the rest**"* |
| ⛔ **Stone p. 46** | ⭐ **an explicit refusal, and a stated non-rule is not a silence**: *"**There are no specific rules for clef changes within a measure.**"* |

**MEASURED, Gould p. 8's *mid-bar* figure** — she draws a *recommended* and a *rather than* version:

| | space before the clef | space after the clef |
|---|---|---|
| her **recommended** version | **0.75 sp** | **0.80 sp** |
| her *"rather than"* version | 1.25 sp | 0.55 sp |

✅ **We agree**: `interleaveClefNotes` emits the `ClefNote` immediately before the note at or after
its beat (`VexFlowRenderer.ts:1348–1372`).

### 4.3 At a SYSTEM BREAK — ✅ four books, one shape

| source | statement |
|---|---|
| **Gould p. 7** | *"Give warning of the clef change by placing the new clef **at the end of the previous system before the barline**."* |
| **Ross p. 167** | *"the change is made with a **smaller size clef before the barline in the previous staff**. The clef at the beginning of the next staff will be the **regular size**."* |
| **Stone p. 57** | *"a **warning clef**, of a slightly smaller size, is placed **at the end of the line before the barline** to signal that the next line begins with a new (full-size) clef."* |
| **Gerou & Lusk p. 52** | *"a **courtesy clef is placed before the barline at the end of the previous staff**, followed by the new clef at full size in the new staff."* |

⭐⭐ **The clef is the OPPOSITE of the key and the meter, and Gerou & Lusk say it in words** (pp. 28,
52): the courtesy **clef** goes **before** the barline and the stave is **closed**; the courtesy
**key signature** and **time signature** go **after** the last barline and the stave is left **OPEN**.

⭐ Measured, cautionary clef ink → barline ink: **0.50 sp** (Gould p. 7) · **0.75** (Stone p. 57) ·
**1.01** (Ross p. 167).

⚠️ **Whether a warning is given at all is not something the books make optional** — all four state it
as the practice. **We make it opt-in per change** (`cautionaryClefAllowedOf`), and ⛔ that is **HIS**
decision, twice: deferred 2026-06-01 (*"courtesy clef at the end of the previous measure … not wanted
unless asked"*) and then built as the *Allow cautionary* control. ⇒ **CLOSED.**

---

## 5. THE GAPS IMMEDIATELY AROUND A CLEF, and the CRAMPED case

### 5.1 The stated gaps

| gap | Gould | Ross (⚠️ **origin-to-origin**) | Stone (gaps) |
|---|---|---|---|
| clef → key signature | *"Separate the clef, key signature, time signature by **1–1½** stave-spaces"* (p. 41); drawn **0.95–1.31** | 3½ ⇒ ≈**0.8** as a gap | *"**one staff-space or a little less**"* (p. 45) |
| clef → time signature | as above; drawn **0.95–1.06** | 3½ ⇒ ≈0.8 | drawn **1.11** ✔ |
| clef → first note | *"For a note without an accidental, allow **2–3 stave-spaces**"*, table **2½** (p. 42); drawn **2.40–2.55** | 5½ ⇒ ≈**2.7** | stated **1½**, ⚠️ **drawn 2.96** |
| **barline → clef** (a mid-line change) | *"Allow a stave-space after a clef and **on either side of a barline**"* (p. 42); drawn **1.05** | — | — |
| **clef → barline** | — | — | **1 space before** the barline (p. 46) |

⚠️⚠️ **THE THREE BOOKS USE THREE CONVENTIONS AND MIXING THEM IS A ~3 sp BUG FOR A CLEF** — worse than
for an accidental, because a clef's ink is three times as wide. **Ross measures origin to origin**
(p. 143: *"engravers … **measure their spacing from the left side of the character**"*); **Stone
measures white gaps** (p. 45: *"**The gaps between them can best be measured by cutting a short strip
of staff … and using its cutting edge**"*); **Gould measures ink to ink** — proven on her own
bracket-marked plate (`header-spacing-research.md` §3.1). ⛔ Never put a number from one table into
another's arithmetic.

### 5.2 ⭐ THE CRAMPED CASE — a floor of ½ a stave-space, stated three times by one author

> **Gould p. 41**: *"Where space is limited, **the distance between characters should not be less than
> ½ stave-space** and no characters should collide."*
>
> **Gould p. 43**, *Additional clefs and accidentals*: *"**reduce the space around clefs and
> accidentals to ½ space**, to minimize distortion"* … *"an accidental or grace note may be closed up
> to within ½ space of a barline. **Stems must never come closer to a barline than one space**"*

⭐ **Note the asymmetry she draws**: the clef and the accidental are the things allowed to be squeezed
to ½; the **stem** keeps its whole space, *"because the close parallel lines are difficult to read"*.
⇒ the floor is per-PAIR, not global.

⛔ **UNKNOWN in Ross, Stone and Gerou & Lusk** — their numbers are compass settings, i.e. fixed, and
none of them gives an interpolation or a floor.

**What we do:** ⛔ **there is no header-specific floor at all** — the spacing solve has none. This is
row **G** of `docs/header-spacing-research.md` §8's table and it is listed there as **genuinely
open**. ⭐ Same question, one glyph over; ⛔ do not answer it twice.

---

## 6. THE CLEF WITH THE KEY SIGNATURE AND THE TIME SIGNATURE

### 6.1 The ORDER — four books, no dissent

**clef → key signature → time signature → note.** Gould p. 152 (*"the time signature goes **after a
clef and any key signature**"*), Ross p. 145, Gerou & Lusk p. 51 (*"The clef is always **placed before
the key signature and time signature**"*) and p. 79 (*"Key signatures appear after the clef but before
the time signature"*), Stone p. 44. ✅ We agree — `headerInk.headerExtent`'s `parts` array is built in
exactly this order, and it says so.

⭐ **And the order is invariant when a part is ABSENT.** Gould's table simply selects a different row;
Ross gives an independent number for every pair; Stone **draws all five cases** under one rule set
(clef+key+time+accidental+note · clef+key+accidental+note · clef+time+accidental+note ·
clef+accidental+note · clef+note), plus a sixth for whole-measure whole notes and whole rests.

### 6.2 ⭐⭐ Does a clef change force anything about them? — **YES, and it is stated three times**

> **Gould p. 93**: *"Place the new clef **before** the barline, the new key signature **after** the
> barline (**and in the new clef**)."*
>
> **Ross p. 168**: *"a smaller clef is added **prior to a double barline**, after which comes the
> change of key (**in the new clef**) followed by the new time signature"* — spelled out separately
> for treble→bass and bass→treble. And: *"If the staff in question contains a key signature, the
> signature does **not** alter the rule."*
>
> **Gerou & Lusk p. 52**: *"The rules for clef changes are **not affected** by the addition of a key
> change and/or time signature change. **The clef sign precedes the barline; the key signature and
> time signature follow the barline.**"*

⭐⭐ **Two separate claims, and both matter:**

1. **The clef's own rule does not bend** for a simultaneous key or meter change — the clef still goes
   before the barline, they still go after it. ⇒ the three symbols **split across the barline**.
2. **A key signature after a clef change is written in the NEW clef** — i.e. the accidentals stand on
   the lines the *new* clef gives them. ✅ **We do this**: `keySignatureLayout.cancelledOctave(a, clef)`
   resolves each cancelling natural against the clef in effect, and `keyChangeRow` takes the clef as
   a parameter for exactly this reason.

⚠️ **Key-signature accidentals after such a barline are spaced 0.25 sp apart** on Gould's p. 93 plate
(measured) — which is `KEY_ACCIDENTAL_GAP`'s value, arrived at independently.

### 6.3 The clef at a REPEAT

> **Gould p. 234**: *"When there is a new clef, key signature or time signature at the beginning of a
> repeated section, place the repeat marks **afterwards**."*
> **Gould p. 235**: *"A change that affects the music only after a repeat goes **after** the repeat
> barline."* — and *"place the warning clef … at the end of the repeated section"*.

⭐ This is one of the two exceptions Gould names to *"the clef always goes before the barline"* (the
other being **cue clefs**, p. 573). ✅ MuseScore has a style id for exactly this fork —
`Sid::placeClefsBeforeRepeats`, default **false** (`styledef.cpp:2179`).

⛔ **UNKNOWN what we do**: we have repeats and we have clefs, but no rule connects them — the
bar-opening clef is drawn at the head of its bar regardless of what boundary precedes it.

---

## 7. WHICH CLEFS, and where the movable C clef sits

### 7.1 The inventory — ⚠️ **the four books do not agree about what is CURRENT**

| clef | Gould (2011) | Ross (1970) | Stone (1980) | Gerou & Lusk (1996) |
|---|---|---|---|---|
| **treble** (G, line 2) | current, p. 5 | current, p. 165 | current, p. 56 | current, p. 49 |
| **bass** (F, line 4) | current, p. 5 | current, p. 165 | current, p. 56 | current, p. 49 |
| **alto** (C, line 3) | current, p. 6 | current, p. 166 | current *"(viola)"*, p. 56 | current, p. 50 |
| **tenor** (C, line 4) | current, p. 6 | current, p. 166 | current, p. 56 | current, p. 50 |
| soprano · mezzo-soprano · baritone **C** clefs | drawn, but **historical** — *"used to replicate the original clefs of early music vocal scores"* (p. 6) | drawn as named positions, ⛔ **no currency verdict** (p. 166) | ⛔ **not among the survivors** (p. 56) | 🚨 *"**The following C clefs are obsolete**"* (p. 50) |
| **baritone F clef** (F on line 3) | ⛔ absent | ⛔ absent | ⛔ absent | ⛔ absent — their *"baritone clef"* is the **C clef on line 5** |
| **French violin clef** (G on line 1) | ⛔ absent | ⛔ absent | ⛔ absent | ⛔ absent |
| **percussion / neutral** | current, p. 6 — *"recommended"* and *"acceptable"* forms | current, p. 166 — adopted by *"modern composers, orchestrators and publishers"* | current, *"No-pitch clef"*, p. 56 | current, *"Neutral clefs"*, p. 50 |
| **octave-transposing** | §8 | double treble clef only | current, pp. 56–57 | current, p. 49 |
| **tablature** | ⛔ absent (⭐ **zero** hits for *tablature* in her whole text) | ⛔ absent | instrument-specific tablature staves, ⛔ not a clef | ⭐ *"**TAB replaces clef**"*, p. 141 |

⭐⭐ **The four in common use are the four we have** — and each book says so in its own words:

> **Gould p. 5**: *"**There are four clefs in common use.**"* · p. 6: *"**The C clefs in common use are
> the alto and tenor clefs.** … The other C clefs are used to replicate the original clefs of early
> music vocal scores."*
>
> **Stone p. 56**: *"Although many clefs and clef positions were used at various times in the past,
> **only the following survive in twentieth-century music**"* — G-clef · bass · alto *(viola)* · tenor
> *(bassoon, trombone, cello, but only for notes too high for the bass clef)* · **No-pitch clef**.
>
> **Gerou & Lusk p. 49**: *"**Treble and bass clefs are most frequently used.** Keyboard, harp and
> organ music is written using only these clefs."*
>
> **Gould p. 433**: *"Clefs other than the treble and bass are used only to replicate authentic
> performing editions of early music or before the opening of a piece as an incipit."*

🚨 **THE FRENCH VIOLIN CLEF AND THE BARITONE F CLEF ARE IN NONE OF THE FOUR BOOKS.** Checked: Gould
pp. 5–9 plus her index's whole `CLEFS` entry; Ross pp. 165–168; Stone pp. 56–57, 72–73; Gerou & Lusk
pp. 49–52; and a full-text grep for *"French violin"* across all four returns **0 hits**. ⇒ ⛔ **UNKNOWN
as engraving practice**, not "rejected" — the books simply never raise them.

### 7.2 ⭐ The movable C clef — MEASURED, and three books agree exactly

Positions are the clef's ink centre, in stave-spaces above the **bottom** line:

| | soprano | mezzo-soprano | alto | tenor | baritone |
|---|---|---|---|---|---|
| **Gould p. 6** (sp = 20.0 px) | **0.03** | **1.05** | **2.00** | **3.00** | **3.98** |
| **Ross p. 166** (sp = 29.3 px) | 0.06 | 1.00 | 1.97 | 2.95 | 3.97 |
| **Gerou & Lusk p. 50** (sp = 37–38.5 px) | −0.03 | 1.03 | 1.99 | 2.96 | 4.00 |

⭐ **Lines 1 · 2 · 3 · 4 · 5 from the bottom, one line apart, in all three.** ⛔ There is no ambiguity
and no dissent.

> **Ross p. 166**: *"**Being movable, the C clef assumes a different name for each of its
> positions.**"* — his five labels are drawn on ONE continuous five-line staff, the clef stepping up a
> line per name.
>
> **Gould p. 6**: *"These centre on whichever line is to be designated as middle C. The five clefs are:
> soprano, mezzo-soprano, alto, tenor, baritone."* … *"The alto clef centres on the middle stave-line.
> **It covers the height of the stave.** The tenor clef centres on the second stave-line down. It is
> the same height as the alto clef, but **placed one stave-line higher**."*

**The C clef's glyph, measured** (⛔ no book states a number):

| | height | width |
|---|---|---|
| Gould p. 6 | **4.00–4.10 sp** — confirms *"covers the height of the stave"* | 2.80–2.85 sp |
| Ross p. 166 | 4.03–4.09 sp | 2.53–2.61 sp |
| Gerou & Lusk p. 50 | 4.05–4.14 sp | 2.73–2.86 sp |

**What we do:** ✅ our `alto` and `tenor` are Gould's two *"in common use"*, on lines 3 and 4, and
`CLEF_MIDDLE_LINE_DIATONIC` puts alto's middle line at C4 and tenor's at A3 — the same two positions.
⭐ **A soprano / mezzo / baritone C clef would be one row in that table and one in
`ElementRegistry.CLEF_REFERENCES`, and no new glyph** (`fontMetrics.clefGlyph` already maps both C
clefs to `cClef`).

### 7.3 ⭐ The C clef IN A SPACE — only Ross, and his plate agrees with his prose

> **Ross p. 166**: *"**Though the center of the C clef usually straddles a staff line, it is being seen
> more and more in the third space, especially in choral works.**"* … *"Employed mostly in male quartet
> music as a **replacment** [sic] for the bass clef or double treble clef in the tenor voices, this
> unorthodox usage of this clef permits notes to be written within the staff and avoids leger lines so
> frequently necessary when using the bass clef."*

⭐ **MEASURED on that very drawing** (sp = 29.4 px): the clef's ink is 3.9 sp tall and its centre sits
**2.52 sp above the bottom line** — exactly midway between lines 3 and 4, i.e. the third space up.
**His prose and his plate agree.**

⛔ **The other three do not address it**: Gould says C clefs *"centre on whichever **line**"*, Gerou &
Lusk draw all five on lines, Stone lists positions with no space option.

⚠️ **Gould does allow a space position for the PERCUSSION clef**, which is a different thing:
> **p. 279**: *"In a full score, tiny percussion clefs may be placed **on the relevant line or space**
> to define the position of each instrument. However, these are too small to be of use in a part."*

### 7.4 The percussion / neutral clef — ⚠️ agreement on the span, a **5× spread** on the weight

**All four agree it spans line 2 → line 4** (the middle two stave-spaces). ⛔ Nothing else agrees.

| | vertical span | stroke thickness | inner gap | total ink width |
|---|---|---|---|---|
| **Gould p. 6**, *"recommended"* | line 2→4, **2.05 sp** | **0.50 sp** | 0.35 sp | 1.35 sp |
| **Gould p. 6**, *"acceptable"* (the ⊐ bracket) | 2.05 sp | bars 0.55, spine 0.20 | — | 1.50 sp |
| **Ross p. 166** — **STATED** | *"from the second to the fourth line"* | *"approximately **¼ of a space** thick"* | *"approximately **½ space** apart"* | — |
| **Ross p. 166** — **MEASURED on his own cut** | 2.25 sp | **0.31–0.39 sp** | 0.31 sp | 1.05 sp |
| **Stone p. 56** | 2.14 sp | **0.56–0.61 sp** | 0.19 sp | 1.35 sp |
| **Gerou & Lusk p. 50** | 2.11 sp | **0.10 sp** — the weight of their own staff line | 0.44 sp | 0.64 sp |

🚨 **Ross's plate disagrees with Ross's sentence** — the sixth *scan-beats-sentence* finding in this
library. And the four sources span **0.10 → 0.61 sp** on the stroke, a **5× range**. ⇒ ⭐ this is a
**house-style number, not a rule.**

🚨 **And Gould and Ross flatly contradict each other on using treble/bass clefs for unpitched
percussion:**
> **Ross p. 166**: *"the treble and bass clefs have been — and are still — **widely used**: however, in
> this function the clefs are of no significance."*
> **Gould p. 279**: *"**do not use them** for instruments of indefinite pitch (as in older editions) as
> this falsely implies definite pitch. Instead use a clef of two lines (the 'percussion clef') that
> **'cancels' any assumed pitch**."*

**What we do:** ⛔ **no percussion clef, deliberately** — a percussion staff is a staff whose lines are
not pitches, not a fifth `Clef` value (`docs/unpitched-staves-plan.md`). ⇒ **CLOSED**, and the books
support the split: Gould p. 6 adds *"The clef is optional for a stave of fewer than five lines, since
such staves are assumed not to signify pitches anyway"* — i.e. **the staff carries the meaning, not
the clef.**

### 7.5 ⭐ Other things the books say about clefs that this list did not ask

> **Gould p. 7** — 🚨 **the strongest prohibition in the chapter**: *"**Except for percussion, each
> stave must begin with a clef. Never omit the clef;** only in hand-copied theatre and entertainment
> music has it ever been an accepted convention to use a clef on the first line and no other."*
>
> **Gould p. 7** — *"The practice of retaining the most commonly used clef at the beginning of the
> stave while inserting a new clef after it **is obsolete**. This includes the very start of a piece."*
> (drawn: Viola with 𝄢 + 𝄞 labelled *"and not"*)
>
> **Gould p. 7** — ⭐ **a clef change costs more than ledger lines**: *"For performance material, stay
> in one clef for as long as is practicable, using **up to at least three ledger lines** rather than
> changing clef frequently. **This shows the contour of the pitches, which a change of clef would
> obscure.**"* Echoed p. 562: *"An instrumental part is better written with occasional ledger lines,
> rather than with frequent clef changes."*
>
> ⚠️ **Stone p. 57 dissents on the prohibition, for one repertoire**: *"**N.B.:** In popular music
> (jazz, rock, show music, etc.), **clefs are usually omitted in the parts after the first line**,
> since they are (rightly) considered 'understood.'"*
>
> **Stone p. 72** — *"**Most instruments are notated in one clef only**, regardless of the many leger
> lines required for very high or very low notes. Only a few instruments, such as horns or cellos,
> permit the use of more than one clef."*

🚨🚨 **AND THE GLYPH'S OUTLINE IS EXPLICITLY NOT STANDARDISED — only its registration is.** Ross p. 165
draws the treble clef in **seven** engraver variants and the bass clef in **five**:

> *"Over the centuries, clef signs have passed through several stages of development before attaining
> today's accepted standards. **Whatever slight differences remain in their designs can be attributed
> to the varying preferences of die makers**: for instance, the body of the treble clef always fills
> the two spaces between the bottom and middle staff-lines; its head and tail, however, are quite
> often its distinguishing elements."*

⭐ Measured across his seven specimens, total glyph height ranges roughly **6–9 sp** — the old cuts
vary far more than any modern font. ⇒ **the invariant is where the clef REGISTERS, not what it looks
like**, which is exactly the boundary `engine/engrave/header/clef.ts` draws when it says the anchor
line is the whole rule and the reach is the font's business.

⭐ **Tablature**: Gerou & Lusk p. 141 — *"**TAB replaces clef**"*, i.e. the TAB letters occupy the clef
slot. Measured on their plate, the six-line TAB staff is drawn **1.38×** wider-spaced than the notation
staff above it. ⛔ Gould and Ross do not treat tablature at all.

---

## 8. OCTAVE-TRANSPOSING CLEFS — the `8` / `15` numeral

⭐ **Nothing in this repo has ever researched this**, and `docs/octave-clefs-plan.md` was written from
the Clef window's UI, not from the books. ⚠️ `reference/README.md` carries a row reading
*"octave-transposing clefs | UNKNOWN"* — ⛔ **that row is about KEY SIGNATURES on such clefs and is
not a claim that the books say nothing about the clefs themselves.** They say a great deal.

### 8.1 Do the books APPROVE of them? — ⚠️ **three positions, and one book has none**

| source | position |
|---|---|
| **Gould p. 506** | ⭐ **optional**: *"To indicate an octave transposition, an '8' **may** be attached to a clef. **This notation is optional**, but the modified clef makes it easier to identify the position of instruments with such transpositions in a score."* And p. 507: *"It is assumed that a score uses this octave-transposing convention, **whether or not** the octave-transposing clefs are indicated."* |
| **Gould p. 32** | 🚨 **a limit**: *"**Do not use these clefs to replace genuine octave transpositions** (Britten used them in his late scores, especially for piano and harp). **The clefs tend to go unnoticed, as the player is unaccustomed to reading them.**"* |
| **Gould p. 563** | **a second limit, about PARTS**: *"Octave-transposing clefs are **usually redundant in instrumental parts** since this conventional transposition is assumed… The alternation of octave-transposing and ordinary clefs tends to clutter a doubling part and is **best reserved for a full score**."* |
| **Gould p. 276** | ⭐ …but **required** in the one ambiguous case: for tuned percussion, *"as these instruments are occasionally written at pitch, or the glockenspiel one octave (rather than two octaves) lower than sounding, **clarify the pitch of the part with a clef showing the transposition**"* |
| **Stone p. 71** | ⭐⭐ **he requires it**: *"a small 8 **should be** placed at the top of the G-clef"* (piccolo) · *"a small 8 **should be** placed at the bottom of the bass clef"* (contrabass clarinet, contrabassoon, double bass) |
| **Stone pp. 71–72** | and gives the reason the device exists: *"**N.B.:** In former days… it was understood that the piccolo, double bass, and tenor voice, etc., were notated in octave transposition, **rendering the small 8 at the clefs superfluous**. Today, with some scores notated in C and some in transpositions… **the small 8 has become necessary to avoid ambiguity.**"* |
| **Gerou & Lusk p. 49** | purely **descriptive** — *"The **octave treble clef** is sometimes used for tenor vocal parts"*; *"The regular **treble clef** is also commonly used for tenor vocal parts; **the octave is assumed**."* No approval, no deprecation |
| 🚨 **Ross** | ⛔ **HE HAS NONE.** His clef chapter (pp. 165–168) draws seven treble specimens, five bass specimens, the C clef in five positions, the third-space C clef, the double treble clef and the neutral clef — **and not one clef with a numeral**. Checked as scans, pp. 165, 166, 167, 203. ⛔ Read his silence as neither approval nor prohibition: he offers two *substitutes* instead (§8.6) |

⚠️⚠️ **KEEP THE TWO `8`s APART.** Gerou & Lusk's *"the abbreviation **8vb** is only a copyist's
shorthand and should not be used in engraved music"* (p. 98) is about the **OTTAVA LINE's label**, and
Ross's *"the 8 being approximately 1½ spaces in height"* (p. 203) is the **ottava sign's** 8. ⛔ Neither
is a statement about a clef, and neither may be cited as one.

### 8.2 ⭐⭐ Which numeral, which side — and it is not only about octaves

**Gould p. 506, TABLE 1** (the plate; every form drawn again on p. 563):

| sounding | clef drawn | instruments |
|---|---|---|
| **two octaves higher** | treble + **15 ABOVE** | glockenspiel, crotales |
| **one octave higher** | treble + **8 ABOVE** | piccolo, xylophone |
| " | treble + 8 above **and** bass + 8 above | celesta |
| **one octave lower** | bass + **8 BELOW** | contrabass clarinet, contrabassoon, double bass |
| " | treble + **8 BELOW** | bass flute, bass oboe/heckelphone, **guitar** |

⇒ **numeral ABOVE = sounds higher; BELOW = sounds lower.** All four combinations exist, bass-8**va**
included.

⭐ **`15`, never `16`** — drawn twice by Gould (pp. 276, 506), and **no book anywhere writes 16**.
⛔ **A `15` BELOW a clef is never drawn by anyone** (Gould's 15 appears only in the *two octaves
higher* column).

🚨🚨 **AND THE SLOT IS NOT AN OCTAVE SLOT — Stone p. 57 puts other numbers in it:**

> **Horn bass clef** in traditional (transposed) scores and parts (Horn in F):
> ***"Sounds a fifth lower than notated"*** — bass clef with **5 below**;
> ***"Sounds a fourth higher than notated"*** — bass clef with **4 above**.

⇒ ⭐⭐ **the row key is *(clef, numeral, side)*, not *(clef, ±octave)*.** ⚠️ This bears directly on
`docs/octave-clefs-plan.md`, which models the feature as two extra `Clef` values.

### 8.3 🚨 An inconsistency INSIDE Gould, worth knowing before copying a picture

**p. 32** draws the pair as **treble-8vb + bass-8vb** (both numerals *below*) while the sentence beside
it names *"the piccolo and double bass… written respectively an octave lower and higher than
sounding"* — and her own Table 1 gives the piccolo as treble-**8va**. ⇒ **Read p. 506, not p. 32,**
for which numeral goes where.

### 8.4 ⭐⭐ WHAT THEY DRAW — measured, in stave-spaces

⚠️ **No book states a size or a distance for a clef's numeral.** Everything below is measurement.
Two independent passes measured Gould p. 507 and agreed (1.11 × 0.66 sp and 1.04 × 0.66 sp,
gap 0, ≈+0.55 sp right of the bbox centre) — the numbers are reproducible.

| plate | numeral | height | width | gap to clef ink | horizontal, vs the clef's bbox centre | extra width |
|---|---|---|---|---|---|---|
| **Gould p. 506**, treble-8va | *italic* 8 above | 1.38 | 0.84 | **0** | **+0.74 right** | 0 |
| **Gould p. 506**, treble-15ma | *italic* 15 above | 1.18 | 1.18 | **0** | +0.64 right | 0 |
| **Gould p. 506**, bass-8vb | *italic* 8 below | 1.42 | 0.79 | **0** | **−1.28 LEFT** | ⚠️ **+0.29 sp proud** of the clef's left edge |
| **Gould p. 507**, treble-8va **at ⅔ size** | *italic* 8 above | **1.04–1.11** | **0.66** | **0** | **+0.54 right**, i.e. on the upper spine | 0 |
| **Stone p. 56**, piccolo (treble-8va) | upright 8 above | 1.37 | 1.10 | ~0.05 | +0.95 right | 0 |
| **Stone p. 56**, tenor voice (treble-8vb) | upright 8 below | 1.52 | 1.10 | ~0 | −0.26 (≈centred) | 0 |
| **Stone p. 57**, double bass (bass-8vb) | upright 8 below | 1.53 | 1.10 | ⚠️ **0.47** | −0.97 left, flush with the clef's left ink | 0 |
| **Gerou & Lusk p. 49**, octave treble (treble-8vb) | upright 8 below | 0.96 | 0.75 | **0** | ⭐ **centred, ±0.01** | 0 |

⭐⭐ **Three rules hold across every plate:**

1. **A numeral ABOVE a treble clef centres on the clef's UPPER SPINE — ≈0.5–0.95 sp RIGHT of the
   glyph's bounding-box centre.** ⛔ Never on the bbox. (Measured on Gould p. 507: the numeral's
   centre lands within **0.08 sp** of the upper terminal's centre.)
2. **A numeral BELOW a treble clef sits at or near the bbox centre** (0.00 / −0.26 sp) — the
   descending tail already ends there.
3. **A numeral BELOW a bass clef hangs LEFT, under the tail, never under the dots** (−0.97 / −1.28 sp).

⭐ **And the NUMERAL BUYS NO HORIZONTAL ROOM.** In seven of the eight plates it lies wholly inside the
clef's own x-extent; the single exception is Gould's bass-8vb, 0.29 sp proud on the left. ⇒ **a
numeral-bearing clef is the same width as its plain form.** ⛔ No book states this; it is measured.

⭐ **The numeral SCALES WITH THE CLEF.** Gould's mid-system octave clef on p. 507 is drawn at the
ordinary change-clef reduction, numeral and all — measured **0.74×** against the full clef on the same
plate, and the numeral shrinks with it (1.38 sp at full size → 1.04–1.11 sp at ⅔). ⭐ Her ratio
numeral-height ÷ clef-height is **0.18–0.20** on both plates ⇒ these read as **one font glyph**, not a
clef with a separately-placed digit.

⭐⭐ **AND THE CLEF BODY IS UNCHANGED BY THE NUMERAL** — measured on Gould p. 507, where a
`8`-over-treble change clef and a plain treble change clef stand in the same system: both are
**2.19 sp wide × 5.53 sp tall**, with their top ink **+0.63 sp** above the top staff line, to the
pixel. The `8` is simply added above, from +0.74 to +1.73 sp.

⚠️ **One dissent about WHAT the numeral is positioned against.** Stone's bass-8vb (p. 57) is the only
plate with a real gap (0.47 sp) — and it is explained: he hangs the `8` **on the bottom staff line**,
i.e. a **staff-relative** rule, where everyone else uses a **clef-relative** one (gap 0). ⛔ **No book
says which of the two governs.**

### 8.5 A change TO or FROM an octave clef — ⭐ Gould p. 507, the only treatment in any of the four

> **Exchanging ordinary and octave-transposing clefs** — *"Place an octave-transposing clef **before
> the relevant entry**; replace it with an ordinary clef before the entry of an instrument that sounds
> at written pitch. **When the clef change is mid-system, place the new clef just before the entry.**
> When several rest bars precede the instrument change, place the new clef **at the beginning of the
> first system after the instruction to change instrument** (give warning of the new clef at the end
> of the previous system)."*
>
> *"**The advantage of not using the octave-transposing clefs is that the clef exchanging is
> redundant.**"*

⭐ The engraved example (Fl. → *to Piccolo* → treble-8va → *to Flute* → plain treble) draws the
mid-system change **at the ordinary reduced size, numeral and all**, and puts a warning clef at the
system's end with a full-size clef opening the next system — i.e. **an octave clef obeys every
ordinary clef-change rule**; the numeral changes nothing about its placement.

### 8.6 ⭐ The TENOR VOICE, and the two substitutes for an octave clef

The tenor's treble-8vb is the case every book except Ross addresses, and they do not agree:

| source | what to write for a tenor part |
|---|---|
| **Stone p. 71** | ⭐ *"the tenor voice does not have an extreme range. There is, however, **a strong tradition of notating the tenor in the G-clef, one octave above its sound. This notation should be retained, though with a small 8 below the G-clef** to indicate the actual pitch."* |
| **Gerou & Lusk p. 49** | all three are current: the **octave treble clef**; the **double treble clef**, which *"serves the same function… but is much less frequently seen"*; and the plain **treble clef**, where *"the octave is assumed"* |
| **Ross p. 166** | ⛔ no octave clef. Instead the **third-space C clef** — *"it is being seen more and more in the third space, especially in choral works. **Employed mostly in male quartet music as a replacement for the bass clef or double treble clef in the tenor voices**"* — and the **double treble clef** |

⭐ **The DOUBLE TREBLE CLEF is the one alternative with a stated geometry**, and it is Ross's:

> **Ross p. 166**: *"The double treble clef used by some publishers is notated in the following manner,
> observe that **the two clefs touch but do not overlap**."*

✅ **Gerou & Lusk's drawing obeys it exactly** — measured p. 49: the two bottom-dot centres are 100 px
apart against a 102 px clef, i.e. abutting without overlap. ⚠️ And unlike a numeral it **costs
horizontal room**: **5.27 sp against a single clef's 2.65 sp — 2×.**

### 8.7 What we do

⛔ **Nothing — the `Clef` union has four values and none of them carries a numeral**
(`types/music.ts:454`). `docs/octave-clefs-plan.md` plans `treble8vb` and `bass8vb`, unbuilt.

⭐ **Two things the research says about that plan, recorded here and ⛔ not proposed as changes:**

1. Its §0 calls bass-8vb *"rarer, but free once the mechanism exists"*. **Both Gould (p. 506's whole
   *sounding one octave lower* column) and Stone (p. 57, *Double-bass clef in C-scores*) treat it as
   the PRIMARY case** — contrabass clarinet, contrabassoon, double bass.
2. Its model is *(clef, ±octave)*. **Stone p. 57's horn clefs put a `5` and a `4` in the same slot**,
   so the drawn thing is *(clef, numeral, side)*. ⭐ Modelled that way, the horn clefs fall out for
   free — and so does `15`.

⚠️ Its §4 open question (what MusicXML's `clef-octave-change` means for `<pitch>`) is **untouched by
this pass** — it is a format question, not an engraving one.

---

## 9. THE ENGINES, on the questions the 2026-08-29 appendix did not ask

> ⛔⛔ **NOTHING IN THIS SECTION IS AN ENGRAVING AUTHORITY.** Everything above is what four engravers
> **wrote** or **drew**; this is four **implementations** and one **font**. Three engines agreeing is
> three implementations agreeing, ⛔ not a rule with a citation.
>
> Revisions: **LilyPond `beedbfa`** · **MuseScore `929d1e9`** (5.0-dev, shallow) · **Verovio `efff0bc`**
> · **VexFlow 5.0.0** · **Bravura 1.481**. Units: LilyPond `staff-space` = 1 sp (`staff-position` is
> **half** sp) · Verovio 1 vu = **½ sp** · MuseScore `spatium` = 1 sp · VexFlow 10 px = 1 sp ·
> **SMuFL bBox values are staff spaces directly** (1 em = 4 sp).

### 9.1 ⭐⭐ THE FINDING: a `*Change` glyph and a `*Small` glyph are DIFFERENT AXES

Bravura publishes a stylistic set **`ss01` — *"Smaller optical size for small staves"*** whose only
clef members are `gClefSmall`, `cClefSmall`, `fClefSmall` (U+F472–F474):

| glyph | width | height | **ratio vs the plain clef** |
|---|---|---|---|
| `gClefSmall` | 2.664 | 7.040 | **0.99 / 1.00** |
| `fClefSmall` | 2.896 | 3.536 | **1.05 / 0.99** |
| `cClefSmall` | 3.064 | 4.024 | ⭐ **1.10 / 0.99** |

⭐⭐ **These are NOT smaller glyphs. They are the same height and up to 10% WIDER** — a classic
**optical-size master**, meant to be drawn *at* a reduced scale where the hairlines would otherwise
thin out.

⇒ **two independent reductions, and this document had been recording only the first:**

| axis | what it is | Bravura | LilyPond |
|---|---|---|---|
| **`*Change`** | the **mid-score clef change** (§3) | `gClefChange` **0.656 w / 0.662 h**, `fClefChange` 0.694/0.651, `cClefChange` 0.724/0.656 | a redrawn `_change` METAFONT glyph at `reduction = 0.8` |
| **`*Small` / `ss01`** | the **small STAFF** (§1.1) | ≈**1.00 and wider** | the design-master swap inside `layout-set-staff-size` |

⭐ **The font vendor and LilyPond reached the same conclusion independently** — LilyPond states it in
prose at `mf/feta-clefs.mf:404–406`: *"Too small loop in reduced clef (G_change) interacts badly with
stafflines"*, and `:406` keeps the hairlines at full weight under the reduction. ⛔ **No engine
surveyed uses `ss01`.**

### 9.2 Does a clef scale with the staff? (§1.1, in code)

| engine | scales? | mechanism |
|---|---|---|
| **MuseScore** | ✅ | `Clef::mag()` — `Sid::smallStaffMag` **0.7** (`style/styledef.cpp:520`) × `StaffType::userMag()` |
| **Verovio** | ✅ | `staffDef@scale` → the font's **point size**, `Doc::GetDrawingSmuflFont` (`src/doc.cpp:2121–2128`); ossia default **0.75** (`src/options.cpp:1448–1450`) |
| **LilyPond** | ⭐ **depends which knob**: `\magnifyStaff` and `\set Staff.fontSize` ✅ · `layout-set-staff-size` rescales the whole page so the clef is unchanged *in sp* · ⚠️ `\teeny`/`\tiny`/`\small` do **NOT** (they set `fontSize` in the **Voice** context; `Clef_engraver` lives in **Staff**) · ⚠️ `StaffSymbol.staff-space` alone does **NOT** — which is why `TabStaff` (`staff-space = 1.5`) needs a *markup* clef that reads `staff-space` explicitly (`scm/tablature.scm:63, 81–96`) |
| 🚨 **VexFlow 5** | ⛔ **NO** | the clef's **y** scales (`getYForLine`) but its **size does not**: `Clef.getPoint` returns `Metrics.get('fontSize')` = **30 pt fixed** (`clef.js:101–103`), and `MetricsDefaults` has **no `Clef` key**. A stave built with a smaller line spacing gets a **full-size clef on a small staff** |

⭐⭐ **That last row explains why our small staves look right**: we scale the whole staff with an SVG
`scale(k)` group rather than asking VexFlow to draw a smaller clef — ⛔ VexFlow could not have.

**Small staff × mid-score change — all three multiply, by three different mechanisms:**

| | small-staff | change-clef | combined |
|---|---|---|---|
| **LilyPond** | a `font-size` step | ⭐ **a different GLYPH** (`_change`, ×0.8) | orthogonal by construction |
| **MuseScore** | `smallStaffMag` 0.7 | `smallClefMag` 0.8 | ⭐ **one multiplication you can point at** — `dom/clef.cpp:110–117`, `mag *= smallClefMag`. Net **0.56** |
| **Verovio** | the font's point size | the **`*Change` glyph swap** | independent — `GetClefGlyph` never reads the staff size |

### 9.3 The reserved horizontal extent — 🚨 **three reserve INK, VexFlow alone reserves the ADVANCE**

| engine | what is reserved | file:line |
|---|---|---|
| **LilyPond** | ⭐ the METAFONT **`set_char_box` ink bbox**. `Clef` has no `X-extent`, so `ly:grob::stencil-width` applies; ⛔ the advance (`chardx`) is **never consulted** | `lily/clef.cc:62–63` → `lily/open-type-font.cc:371–409`; `lily/grob.cc:893–899` |
| **MuseScore** | **two paths**: a header clef ⇒ the ink **bbox**; a mid-measure clef ⇒ an ink **`Shape` with SMuFL cutouts**. ⛔ `symAdvance` is never called on a clef | `rendering/score/tlayout.cpp:1849–1857` |
| **Verovio** | the **ink bbox**; `advX` is read but only to advance x *within a string*, so a single-glyph clef discards it | `src/bboxdevicecontext.cpp:354–386` |
| 🚨 **VexFlow 5** | the **ADVANCE WIDTH**, live from `context.measureText().width`, with **zero padding on both sides** of the clef slot | `element.js:339–352`; `stave.js:394–402`; `stavemodifier.js:42–44` |

**The ink, side by side (staff spaces):**

| | LilyPond (Emmentaler) | MuseScore (Leland) | Verovio (Leipzig) | Bravura | **our `CLEF_FULL`** |
|---|---|---|---|---|---|
| treble | 2.565 | 2.560 | 2.588 | 2.684 | **3.2** |
| bass | 2.683 | 2.655 | 2.776 | 2.756 | **3.5** |
| alto/tenor | 2.720 | 2.508 | 2.424 | 2.796 | **3.6** |

⚠️ **⛔ Those columns are not comparable row-for-row, and it is not a defect.** Ours is a
*measurement of a computation* — `0.5 (VexFlow's barline) + the advance + 1.2 (Stave.padding)` — where
theirs are pure ink with margins named separately (**MuseScore** `clefLeftMargin` 0.75; **Verovio**
`--left-margin-clef` + `--right-margin-clef` = 0.5 + 0.5, and it says so in its own cast-off
estimator, `src/view_page.cpp:154–155`; **VexFlow** 0 and 0).

**Asymmetry:**

- ⭐ **LilyPond**: `extra-spacing-width` is **absent** on `Clef` ⇒ the symmetric default `(−0.1, 0.1)`.
  ⚠️ The asymmetric `(0.0 . 1.0)` belongs to `KeySignature`/`KeyCancellation`, ⛔ not the clef. But the
  **anchor** is asymmetric by design: `Clef.break-align-anchor-alignment = RIGHT`
  (`define-grobs.scm:908`) ⇒ the anchor is the ink box's **right edge**.
- ⭐ **MuseScore**: the glyph has ~zero left bearing, but the *reserved room* is strongly asymmetric
  because left and right are different style ids — `clefLeftMargin` 0.75 vs `clefKeyRightMargin` 0.8,
  `clefKeyDistance` 0.75, `clefTimesigDistance` 1.0, `clefBarlineDistance` 0.5, CLEF→ACCIDENTAL 0.6
  (`rendering/paddingtable.cpp:100–143`).
- ⭐ **VexFlow**: mixed — `getBoundingBox` uses the **advance** for x and true **ink** for y
  (`element.js:187`).
- ⭐ **Bravura**: advance ≈ ink for every clef; the side bearings are essentially zero. ⚠️ The
  exception is the optional ligature `gClef8Above` — ink **3.192** against an advance of **2.680**, an
  overhang of **+0.512 sp**.

### 9.4 The octave numeral, in code

⭐⭐ **LilyPond is alone in composing it; the other three swap a single SMuFL ligature.**

| | mechanism | size | distance |
|---|---|---|---|
| **LilyPond** | ⭐ a separate grob, `ClefModifier`, carrying **TEXT markup in the serif italic text font** — not a music glyph (`lily/clef-engraver.cc:93–116`; `scm/define-grobs.scm:945–976`) | `font-size` **−4** ⇒ magstep **0.630**, with a **0.6** dampener and a **−1.7** step compensation on a change clef | ⭐ `padding` is **ABSENT** ⇒ **0.0** — the numeral's skyline **touches** the clef's (`lily/side-position-interface.cc:355–362`) |
| **MuseScore** | one ligature `SymId` per `ClefType`, one `drawSymbol` (`dom/clef.cpp:52–57`; `tdraw.cpp:1215–1229`) | ⛔ none — baked into the outline | ⛔ none: `yoff = lineDist × (5 − line)`, and every octave variant carries the **same `line`** as its plain parent |
| **Verovio** | one ligature via `Clef::GetClefGlyph` (`src/clef.cpp:132–226`) | ⛔ none | ⛔ none |
| **VexFlow 5** | ligature swap in `setType` (`clef.js:81–96`) | ⛔ none | ⛔ none |

⭐⭐ **AND LILYPOND'S CHOICE VINDICATES STONE p. 57.** Because the numeral is *text*, an **arbitrary
number works** — `\clef "alto_2"`, `\clef "F^5"` — the engraver simply writes `abs(transp)+1` as a
decimal string (`lily/clef-engraver.cc:97–99`, documented at
`Documentation/en/notation/pitches.itely:1230–1249`). ⇒ **the one engine that did not bake the numeral
into a glyph is the one that can draw Stone's horn clefs** (§8.2). ⭐ It also has
`clefTranspositionStyle`: `default` / `parenthesized` / `bracketed` (`scm/parser-clef.scm:193–200`).

⭐ **The only published clef→numeral distance anywhere — and no engine reads it.** Bravura's
`glyphsWithAnchors` contains exactly two clefs, both ligature helpers, both carrying only
`numeralBottom`: `gClefLigatedNumberAbove` **[2.224, 3.468]** and `…Below` **[1.052, −2.616]** — the
numeral's **baseline**, 3.468 sp above / 2.616 sp below the G4 line. ⭐ Compare §8.4's measured plates
(numeral bottom at +0.74 sp above the top staff line ⇒ ≈ +3.7 sp above the G line): **the font's
anchor and Gould's engraver agree to about a quarter of a space.**

⭐ **The numeral costs no width, and the font makes that exact** — measured across Bravura, the width
delta for `gClef8va/8vb/15ma/15mb`, `fClef8va/8vb/15ma/15mb` and `cClef8vb` is **exactly 0.000 sp**.
⚠️ Two real exceptions, both historical forms: `gClef8vbOld` **+1.492 sp** and `gClef8vbCClef`
**+0.684 sp** (there the 8 / C sits *beside* the clef, not below).

⚠️ **Coverage is uneven, and VexFlow's gap is the one that matters to us**: `clef.js:81–96` handles
only `'8va'` and `'8vb'`, and only on `gClef`/`fClef`. `Glyphs.gClef15ma/15mb`, `fClef15ma/15mb` and
`cClef8vb` all **exist** in the package and nothing wires them.

### 9.5 Which clefs, and a C clef in a space

| engine | pitched types | soprano / mezzo / bar-C | baritone F | French violin | percussion | tab |
|---|---|---|---|---|---|---|
| **LilyPond** | **20 standard + ~45 ancient** (`scm/parser-clef.scm:27–134`) | ✅ | ✅ `varbaritone` | ✅ `french` | ✅ | ✅ |
| **MuseScore** | **37 `ClefType` rows** (`types/types.h:617–659`) | ✅ | ✅ `F_B` | ✅ `G_1` | ✅ | ✅ 4 kinds |
| **Verovio** | **6 shapes × any line** (`data_CLEFSHAPE`) | ✅ | ✅ | ✅ | ✅ | ⚠️ via `notationtype` |
| **VexFlow 5** | **12** (`clef.js:13–64`) | ✅ | ✅ `baritone-f` | ✅ `french` | ✅ | ✅ |

⭐ **VexFlow already ships nine clefs we do not use** — soprano, mezzo-soprano, baritone-c,
baritone-f, subbass, french, percussion, tab — so the four in `types/music.ts` are **our** choice, not
the library's limit (§7.1's four books are the reason).

**A C clef in a SPACE (Ross p. 166's third-space clef, §7.3):**

| engine | verdict |
|---|---|
| **LilyPond** | ⭐ **YES, unconditionally** — `clefPosition`'s predicate is `,number?`, not integer; the offset is `pos × space / 2.0` with **no rounding and no warning** (`lily/staff-symbol-referencer.cc:130–136`) |
| **VexFlow 5** | ⭐ **YES, incidentally** — `line` is a plain number, and **`tab` already uses `2.5`** (`clef.js:62`) |
| **MuseScore** | ⛔ **NO** — `ClefInfo::m_line` is an `int`, consumed as `lineDist × (5 − line)` |
| **Verovio** | ⛔ **NO** — `@line` is a `char` parsed with `StrToInt`, so `line="2.5"` truncates |

### 9.6 The clef at a repeat, at a system break, and in the spacing solve

**At a REPEAT** — ⭐ **MuseScore is the only engine with an explicit rule**: `Sid::placeClefsBeforeRepeats`
(default **false**, `styledef.cpp:2179`) read at exactly two sites, plus a **per-clef override**
`ClefToBarlinePosition {AUTO, BEFORE, AFTER}` that wins over the style and propagates to every staff in
the segment (`dom/clef.cpp:342–359`). LilyPond needs none — `clef` precedes `staff-bar` in all three
break-align orders and every bar type gets the same 1.0. ⛔ **Verovio: ABSENT at this revision**
(greps recorded). ⛔ VexFlow: none.

**At a SYSTEM BREAK — 🚨 the engines disagree about the warning clef's SIZE:**

| engine | trailer (end of the old line) | header (start of the new) |
|---|---|---|
| **LilyPond** | **small** (`_change`) | ⭐ **FULL, always** — the begin-of-line copy never gets `_change`, independently of `full-size-change` (`lily/clef.cc:38–42`) |
| **MuseScore** | **small** — `courtesyClef->setSmall(true)` (`measurelayout.cpp:2010–2020`) | **FULL** — explicitly `setSmall(false)` (`:1799`) |
| 🚨 **Verovio** | ⭐ **FULL SIZE** — the caution clef's alignment is `ALIGNMENT_SCOREDEF_CAUTION_CLEF`, so the `*Change` swap never fires | FULL |

⇒ **Verovio's end-of-line warning clef is full size where the other two — and all four books (§4.3) —
reduce it.** ✅ We are with the books and with LilyPond/MuseScore.

⭐ **LilyPond has no warning CUE clef at a line end** — `CueClef` is `end-of-line-invisible`
(`ly/engraver-init.ly:865`), against `explicitClefVisibility = all-visible` for an ordinary one.

**In the SPACING SOLVE** — ⭐ **LilyPond gives the clef a real `Spring`** (`lily/staff-spacing.cc:117–221`,
with a hard **0.3 sp** clearance floor), and inflates it to its whole vertical axis group's height **at
a line start only** so nothing packs beside it. **MuseScore has no spring** — clef segments are
**right-aligned** and slid right, the slack refunded to the previous chord-rest
(`horizontalspacing.cpp:643–690`). **Verovio removes mid-measure clefs from the x-solve entirely**
(`adjustxposfunctor.cpp:132–134`) and fixes them up in a dedicated `AdjustClefChangesFunctor` — snap
onto the next alignment, **pull left** if it overruns, **then push right** if it now collides, ±0.5 sp.

⭐⭐ **AND MUSESCORE CORROBORATES OUR `clefOffsetPass` DESIGN EXACTLY.** The clef is the one element
whose shape deliberately ignores the user offset:

```cpp
s.add(e->shape().translate((e->isClef() ? e->ldata()->pos() : e->pos()) + ...))   // dom/segment.cpp:2641
```

⇒ **nudging a clef moves the ink and does NOT re-space the measure** — which is precisely what
`clefOffsetPass`'s header states (*"the column's width is already reserved at the un-shifted position,
so a nudged clef moves its own ink and nothing else's"*). ⭐ Arrived at independently, here and there.

### 9.7 Collision handling — three different designs

- ⭐ **LilyPond**: `Clef.avoid-slur = inside` (`define-grobs.scm:905`) ⇒ the clef joins the slur's
  `encompass-objects` and **the slur arches around it**. And a clef change **invalidates local
  alterations**, forcing accidentals to be restated (`lily/clef-engraver.cc:151`).
- ⭐ **MuseScore**: a **header** clef `isNeverKernable` — nothing may overlap it
  (`horizontalspacing.cpp:1684–1690`) — while a **mid-measure** clef **is** kernable, CLEF↔NOTE being
  `KERN_UNTIL_RIGHT_EDGE` both ways. ⚠️ That is what lets a notehead tuck under a mid-measure treble
  clef's curl, **using Leland's cutout anchors** — and ⛔ **Bravura ships NO `cutOut*` anchors for any
  clef**, so under Bravura the tuck is much smaller.
- **Verovio**: the two-pass fix-up in §9.6.

### 9.8 ⚠️ Defects and dead code found while reading — ⛔ recorded, not ours to act on

| | |
|---|---|
| **Verovio** | `@dis="22"` is legal MEI but has **no case** in `GetClefGlyph`, so the glyph falls through to plain while `GetClefLocOffset` still shifts pitch by ±21 — glyph and pitch silently disagree. `shape="C" dis="8" dis.place="above"` draws **`cClef8vb`** (no `GetDisPlace()` test). `@dis` with no `@dis.place` gives **zero** pitch shift while the glyph *does* become the `8vb` ligature. `clef@cautionary` is parsed and **never read**. Two silent-drop paths return before `StartGraphic`, so an unhandled clef produces **no SVG element at all** |
| **MuseScore** | `Sid::clefRightMargin` — **0 hits in all of `src/`** (confirming the 2026-08-29 appendix). `Sid::midClefKeyRightMargin` is declared, defaulted and **read by nothing**. `G8_VB_P` carries `pitchOffset = 45` (the untransposed value) where `G8_VB` and `G8_VB_O` carry 38 |
| **LilyPond** | on a magnified staff the numeral's step is `−4 + fontSize + 0.6·(fontSize − 1.7)`, so staff magnification lands on the numeral **1.6×** — undocumented, flagged as a probable bug, ⛔ not a rule. Only the *opening* delimiter of the clef-name regex is read, so `\clef "treble_(8"` and `"treble_(8]"` both print `(8)` |

⛔ **Bravura's `engravingDefaults` has no key bearing on a clef** — all 30 are thicknesses or
line-to-line separations (re-confirmed). ✅ But `glyphAdvanceWidths` **does** carry clefs — 145
entries — which is what made §9.3's ink-vs-advance comparison possible.

---

## 10. WHAT WE DRAW TODAY — read off the source, ⛔ not intentions

⭐ The full account is **`docs/clef.md`**. The short version, for §11's last column:

| | |
|---|---|
| **types** | four: `treble` `bass` `alto` `tenor` (`types/music.ts:454`). ⛔ no percussion (a staff, not a clef); ⏳ octave clefs planned only |
| **storage** | `Measure.clefs: ClefChange[]`, per-staff, positional. ⛔ **no `Score.clef`** — it existed, it bled across staves, it was removed (`docs/clef-model-plan.md`) |
| **the indent** | **0.7 sp** — `headerInk.CLEF_INDENT`, applied as a **0.2 sp shift** by `clefIndentPass`, line-opening bars only |
| **horizontal room** | `CLEF_FULL` 3.2 / 3.5 / 3.6 / 3.6 and `CLEF_SMALL` 2.6 / 2.6 / 2.7 / 2.7 — ⚠️ **measurements of VexFlow's drawing**, with the old 0.5 indent inside them |
| **the size ratio** | VexFlow's `'small'` = **exactly ⅔**. ⛔ Not chosen by us |
| **the anchor line** | VexFlow's `Clef.types`. ⛔ Not ours |
| **vertical extent** | ⛔ reserved nowhere |
| **a change at a barline** | drawn **AFTER** it — `stave.addClef(clef, 'small')` at the head of the new bar |
| **a change mid-bar** | a `ClefNote` interleaved immediately **before** the note at/after its beat ✅ |
| **a cautionary clef** | small, before the closing barline, **and OPT-IN per change** |
| **the ink** | ⏳ moving to `engine/engrave/header/clef.ts` (P5b, 2026-09-02); the PLACEMENT is still `Stave.format()` |
| **small staff** | the clef scales with the staff, via the staff's own `scale(k)` group ✅ — ⭐ and only because we do it ourselves: VexFlow does not (§9.2) |

---

## 11. ⭐⭐ THE TABLE — every clef question, its options, and what we do

⛔ **Nothing below is a defect list and nothing below is a queue.** Each row is a question the
literature has something to say about, with the options and their provenance, and the answer we draw
today named honestly. **Rows marked ⛔ CLOSED are closed and each names its closer** — ⛔ re-opening one
by re-quoting a source is exactly the mistake the box at the top of this document records.

| # | the question | the options, with provenance | what we do now |
|---|---|---|---|
| **A** | **Does a clef scale with the STAFF?** | (i) **yes, always** — Gould p. 5 states it for *every* symbol (*"The size of every notational symbol is measured in proportion to the stave size"*), her p. 433 incipit at 0.746× and Gerou & Lusk's p. 54 cue staff at 0.654× both draw the clef **identical in stave-spaces**; Ross has a punch per staff size. ⛔ Stone UNKNOWN · (ii) held at an absolute size — **nobody** | ✅ **yes** — the staff's own `scale(k)` group, ⛔ no clef magnification of ours. ⭐⭐ **And that is the only reason it works: VexFlow does NOT scale a clef with the staff** (`Clef.getPoint` is a fixed 30 pt, §9.2). **CLOSED by agreement**, not by us |
| **A′** | ⭐⭐ **Is a small-STAFF clef the same reduction as a change clef?** | ⛔ **NO — they are different axes, and the FONT says so.** Bravura's stylistic set **`ss01` "Smaller optical size for small staves"** gives `gClefSmall` / `fClefSmall` / `cClefSmall` at ratios of **0.99–1.10 wide, ≈1.00 tall** — *the same height and up to 10% WIDER*, an optical master for a glyph already being scaled down. Against `*Change` at **0.65–0.72**. ⭐ LilyPond states the same principle in prose (`mf/feta-clefs.mf:404–406`). ⛔ **No engine surveyed uses `ss01`** | ⛔ we have neither — one glyph, scaled by the staff group and by VexFlow's ⅔ |
| **B** | **The clef's INK EXTENT above and below the stave** | ⛔ **no book states it.** Measured: treble **6.95–7.50 sp** tall, split **1.29–1.83 above / 1.53–1.73 below**; bass **3.09–3.33**, never leaving the stave downwards; C clef **fills the stave** (4.0). Bravura: gClef 7.024 (1.392/1.632), fClef **3.588** (reaching 0.46 sp *below* the bottom line), cClef 4.048. ⭐ Nearest prose is Ross p. 165, and it is about the **body**: *"the body of the treble clef always fills the two spaces between the bottom and middle staff-lines; its head and tail, however, are quite often its distinguishing elements"* | ⛔ **we reserve no vertical extent at all** — the clef is in no skyline. ⚠️ Verovio deliberately excludes the header clef from its overflow skyline too |
| **C** | **The VERTICAL ANCHOR — what the clef registers on** | ⭐ **one answer, two books, no dissent**: the *feature*, never the box — Gould p. 5 (*"centres precisely on the relevant stave-line"*, the G clef winds around the G line, the F clef's *"dots fall each side of the F line"*), Gould p. 6 (C clefs *"centre on whichever line is to be designated as middle C"*), Ross p. 165 (*"the **ball** of the bass clef always falls on the F line"*). ⭐ SMuFL cuts every clef so the **origin sits on that line**, so the rule reduces to *put the origin on the line* | ✅ stated as the rule in `engine/engrave/header/clef.ts` (*"that line's y is the glyph's BASELINE"*). ⏳ **WHICH line each clef names is still VexFlow's `Clef.types`** — that module names this as open |
| **D** | **OPTICAL CENTRING of a clef** | ⛔ **UNKNOWN in every source.** The word `optical` appears **nowhere in Gould's whole book** (full-text grep, 983 KB); none of the three engines has a horizontal optical-centre rule for a clef; **Bravura publishes `opticalCenter` for 30 glyphs, every one a dynamic** | ⛔ none. ⚠️ Our treble clef's near-centring is a consequence of the glyph, ⛔ not a rule — do not turn it into one |
| **E** | ⭐ **The SMALL (change / cue) clef's RATIO** | 🚨 **the literature does not agree with itself.** (i) **⅔** — Gould *writes* it twice (pp. 7, 573), and VexFlow uses exactly this · (ii) **0.75** — Gould *draws* it, six pairs across three pages, and Gerou & Lusk **state** it (p. 51) · (iii) **0.65–0.68** — Ross *draws* it (p. 167) · (iv) **0.80** — LilyPond and MuseScore, and LilyPond does it by **drawing a different, optically-redrawn glyph** rather than scaling · (v) whatever the font says — Verovio, 0.65–0.88 depending on the font | **VexFlow's exactly ⅔**, inherited rather than chosen. ⏳ **GENUINELY OPEN, and HIS** — ⛔ there is no single sourced answer to adopt. ⚠️ And see **A′** below: this is a *different axis* from the small-staff one |
| **F** | **Is a CAUTIONARY clef the same reduction?** | ✅ **yes, stated outright** — Gerou & Lusk p. 51 (*"Courtesy clefs are also cue size"*) and p. 52 (*"The courtesy clef is cue size; the key signature and time signature are **normal size**"*); Gould p. 7, Ross p. 167, Stone p. 57 all draw it small and restore full size next system. ⚠️ **Verovio dissents** — its cautionary clef is FULL size | ✅ **we implement exactly this** — `cautionaryExtent` gives the clef the cue branch and the key/meter the full branch, citing G&L p. 52. **CLOSED** |
| **G** | **Is a cautionary clef drawn AT ALL?** | all four books state it as the practice, unconditionally; LilyPond and MuseScore default it **on** | ⛔⛔ **CLOSED — OPT-IN, and it is HIS, twice.** Deferred 2026-06-01 (*"courtesy clef … not wanted unless asked"*), then built as the *Allow cautionary* control (`1b4a656`, `69d2755`). ⚠️ It deliberately **diverges from the key signature**, whose courtesy is always on |
| **H** | ⭐⭐ **WHICH SIDE OF THE BARLINE a clef change goes** | **BEFORE it — four books, no dissent, and all three engines**: Gould p. 8 (*"The clef **always** goes before the barline"*, with two named exceptions: cue clefs and after a repeat), Gould p. 93, Ross p. 166, Stone pp. 46/57, Gerou & Lusk p. 27; three of them add that **only a systemic barline may precede a clef**. Stone p. 46 even gives the distance: *"about **one staff-line space before the barline**"*, and Gould draws 0.75–0.80 sp | 🚨🚨 **WE DRAW IT AFTER** — `stave.addClef(clef, 'small')` at the head of the new bar. Recorded 2026-08-29; ⛔ **a drawing question, and nothing here says how or whether to fix it** |
| **I** | **A change MID-BAR** | *"immediately before the note involved"* — Ross p. 167, Gerou & Lusk pp. 51–52 (and *"the clef precedes the rest"* on a fractional beat). ⭐ **Stone p. 46 REFUSES the question in words**: *"There are no specific rules for clef changes within a measure"* — a stated non-rule, ⛔ not a silence | ✅ **we agree** — `interleaveClefNotes` emits the `ClefNote` immediately before the note at/after its beat |
| **J** | **The INDENTATION** | 0.6–0.8 sp — Gould p. 6 drawn 0.64–0.74, Ross p. 144 *"½ to 1 space"*, Gerou & Lusk drawn 0.36–0.70; LilyPond 0.80, MuseScore 0.75, Verovio 0.50 | ⛔⛔ **CLOSED — 0.7 sp, decision A, HIS, 2026-09-01.** ⛔ Do not re-open it by re-quoting Gould's drawing: she is one of the three sources that produced it |
| **K** | **clef → key signature, and key → meter** | Gould *"1–1½"* (p. 41), drawn 0.95–1.31 / 1.57 · Stone *"one staff-space or a little less"* / *"one staff-space"* · Ross 3½ and 2½ **origin-to-origin** ⇒ ≈0.8 / ≈1.5 · Gerou & Lusk drawn 0.41 / 0.76 | ⛔⛔ **CLOSED — 0.82 and 1.15**, and both by **HIS OWN REPORTS** (1.5 was tried on the first and rejected: *"isn't the first accidental too far from the clef?"*; the second exists because he said the last accidental sat too far from the meter). `docs/header-spacing-research.md` §8 B and C |
| **L** | **header → FIRST NOTE** | keyed on what precedes: Gould p. 42's **2½ / 2½ / 2**, MuseScore's `systemHeaderDistance` 2.5 / `systemHeaderTimeSigDistance` 2.0, LilyPond's three tags · vs Stone's flat 1½ · vs Ross's 5½ origin-to-origin (≈2.7 as a gap) | ⛔ **CLOSED — decision D, HIS, 2026-09-01**: `headerToNoteGap()`, 2.5 after a clef or key, 2.0 after a meter |
| **M** | **A CRAMPED minimum around a clef** | (i) ⭐ **½ stave-space** — Gould p. 41 (*"the distance between characters should not be less than ½ stave-space"*) and p. 43 (*"**reduce the space around clefs and accidentals to ½ space**, to minimize distortion"*), with the asymmetry that a **stem** keeps its whole space · (ii) ⛔ UNKNOWN in Ross, Stone and Gerou & Lusk — their numbers are compass settings | ⛔ **none — the spacing solve has no header floor.** ⏳ **GENUINELY OPEN**, and it is the same question as `docs/header-spacing-research.md` §8 **G** — ⛔ do not answer it twice |
| **N** | **WHICH CLEFS are standard** | **the four we have** — Gould p. 5 *"four clefs in common use"*, Stone p. 56 *"only the following survive"*, Gerou & Lusk p. 49. The soprano / mezzo / baritone **C** clefs: Gould "early music", **Gerou & Lusk "obsolete"**, Stone omits, Ross no verdict. ⛔ **The French violin clef and the baritone F clef are in NONE of the four.** Percussion: all four have one; tablature: only Gerou & Lusk (*"TAB replaces clef"*) | ✅ **four**, matching the books' four. ⛔ **no percussion clef, and that is CLOSED** (Clef window, 2026-07-20): it is a *staff whose lines are not pitches*, and Gould p. 6 supports the split — *"The clef is optional for a stave of fewer than five lines, since such staves are assumed not to signify pitches anyway"* |
| **O** | **Where the movable C clef sits** | ⭐ **lines 1·2·3·4·5 from the bottom** = soprano · mezzo-soprano · alto · baritone…, measured in **three books to within 0.06 sp**. ⭐ Ross alone adds a **third-SPACE** C clef (p. 166, prose *and* plate, measured 2.52 sp) | ✅ alto (line 3) and tenor (line 4). ⭐ A further position is **one row** in `CLEF_MIDDLE_LINE_DIATONIC` + `CLEF_REFERENCES` and **no new glyph** |
| **P** | **The percussion clef's geometry** | span **line 2 → line 4** in all four ✅. Stroke: Ross **states** ¼ sp and **draws** 0.31–0.39; Gould 0.50–0.55; Stone 0.56–0.61; Gerou & Lusk **0.10**. ⇒ a **5× spread** — ⭐ a house-style number, not a rule. 🚨 And Ross vs Gould flatly disagree on using treble/bass clefs for unpitched percussion | ⛔ n/a — see **N** |
| **Q** | ⭐ **OCTAVE-TRANSPOSING clefs: are they approved?** | (i) **optional** — Gould p. 506 (*"an '8' **may** be attached… This notation is optional"*), with two limits: p. 32 *"**Do not use these clefs to replace genuine octave transpositions** … they tend to go unnoticed"* and p. 563 *"usually redundant in **instrumental parts** … best reserved for a full score"* — but **required** for tuned percussion (p. 276) · (ii) **required** — Stone p. 71 (*"a small 8 **should be** placed…"*), because *"the small 8 has become necessary to avoid ambiguity"* · (iii) **descriptive** — Gerou & Lusk p. 49 · (iv) 🚨 **Ross has none at all** — not one numeral-bearing clef in pp. 165–168 | ⛔ **none** — the `Clef` union has four values. `docs/octave-clefs-plan.md` plans two, unbuilt |
| **R** | **The octave numeral's SIZE, DISTANCE and SIDE** | ⛔ **no book states a size or a distance** — everything is measured. **Above = sounds higher, below = sounds lower** (Gould p. 506's table). `15`, ⛔ never `16`, and ⛔ never below. Measured: numeral **0.96–1.53 sp** tall, **0.66–1.18 sp** wide, **gap 0** in seven of eight plates (Stone's bass 8 is the one outlier at 0.47 sp, because he hangs it on the **bottom staff line** — a *staff*-relative rule where everyone else is *clef*-relative). ⭐ Above a treble clef the numeral centres on the **upper spine**, 0.5–0.95 sp RIGHT of the bbox centre; below a treble clef it is ≈centred; below a bass clef it hangs LEFT under the tail | ⛔ n/a |
| **S** | **Does the numeral cost horizontal room?** | ⭐ **No** — measured, it lies wholly inside the clef's x-extent in seven of eight plates (one exception, 0.29 sp proud). And the clef body is **unchanged**: on Gould p. 507 an `8`-clef and a plain clef in the same system are both **2.19 × 5.53 sp**, to the pixel. ⚠️ The **double treble clef** is the opposite — **2× the room** (Ross p. 166: *"the two clefs touch but do not overlap"*) | ⛔ n/a |
| **T** | **The clef's HORIZONTAL ink extent — what we reserve, and against what** | 🚨 **three engines reserve INK, VexFlow alone reserves the ADVANCE** (§9.3). Their ink, in sp: treble **2.565** (LilyPond) · **2.560** (MuseScore) · **2.588** (Verovio) · **2.684** (Bravura); bass 2.683 / 2.655 / 2.776 / 2.756; C 2.720 / 2.508 / 2.424 / 2.796. Margins are named **separately** — MuseScore `clefLeftMargin` 0.75; Verovio 0.5 + 0.5; VexFlow 0 and 0 | `CLEF_FULL` **3.2 / 3.5 / 3.6 / 3.6** and `CLEF_SMALL` **2.6 / 2.6 / 2.7 / 2.7**. ⚠️⚠️ **⛔ NOT comparable to the column beside it, and that is not a defect**: ours is a *measurement of a computation* — `0.5 (VexFlow's barline) + the advance + 1.2 (Stave.padding)` — where theirs are pure ink. 🚨 Against `0.5 + advance` every row sits ≈**+0.3** except **`CLEF_FULL.treble`, which sits +0.02**; the premium is 0.9 for bass/alto/tenor (⅓ of the advance, exactly what a ⅔ small clef implies) against **0.6** for treble. Recorded 2026-08-29, ⛔ not acted on; `e2e/spacing.e2e.ts` pins 3.2 |
| **U** | **The clef with the KEY and TIME signature** | **order clef → key → meter → note**, four books, no dissent ✅. And a clef change **does not bend** for a simultaneous key/meter change: the clef goes before the barline, they go after it — Gould p. 93, Ross p. 168, Gerou & Lusk p. 52, all three adding that the new key is written **in the NEW clef** | ✅ the order is `headerExtent`'s `parts` array. ✅ the new-clef rule is `keySignatureLayout.cancelledOctave(a, clef)`. ⚠️ the *split across the barline* half depends on **H** |
| **V** | **A clef at a REPEAT** | Gould p. 234 (*"place the repeat marks **afterwards**"*) and p. 235 (*"A change that affects the music only after a repeat goes **after** the repeat barline"*) — one of the two exceptions to **H**. ✅ **MuseScore is the only engine with an explicit rule** — `placeClefsBeforeRepeats` (default false) **plus a per-clef `ClefToBarlinePosition {AUTO, BEFORE, AFTER}` override** that wins over the style. ⛔ Verovio: absent at this revision | ⛔ **no rule connects them here** — a bar-opening clef is drawn at the head of its bar whatever boundary precedes it |

---

## 12. ⛔ UNKNOWN — checked, and genuinely absent

⭐ **Every line names what was read to conclude it.** ⛔ None of these is *"the books are silent"*
standing in for not having looked.

### 12.1 Nothing in any source answers these

| question | what was read |
|---|---|
| **A clef's ink extent as a STATED rule** | Gould pp. 5–9; Ross pp. 165–166; Stone p. 56; Gerou & Lusk pp. 49–51. The only stated proportions anywhere are Gould's *"It covers the height of the stave"* (C clef) and Ross's *"the body of the treble clef always fills the two spaces"* — ⛔ neither is a bounding box |
| **Why the treble clef's vertical SPLIT differs between engravers** (Gould 1.83/1.55 against Ross, Gerou & Lusk **and Bravura** at 1.29–1.39/1.63–1.73) | not addressed by any of the four |
| **OPTICAL CENTRING of a clef** | Gould pp. 5–9 + a full-text grep of the whole book for `optical`/`optically` — **0 hits**; Ross pp. 143–152, 165–170 + his index; Stone pp. 6–7, 44–47, 52–53, 56–57, 72–73; Gerou & Lusk pp. 27–29, 42–43, 49–53, 74–75, 120–121 |
| **The FRENCH VIOLIN clef (G on line 1) and the BARITONE F clef (F on line 3)** | Gould pp. 5–9 + her whole index `CLEFS` entry; Ross pp. 165–168; Stone pp. 56–57, 72–73; Gerou & Lusk pp. 49–52; full-text grep for *"French violin"* in all four = **0 hits**. ⛔ Absent, ⛔ not rejected |
| **A stated SIZE or DISTANCE for an octave clef's numeral** | Gould pp. 32, 276, 506, 507, 563; Ross pp. 165–167, 203; Stone pp. 56, 57, 70–72; Gerou & Lusk p. 49. ⚠️ Ross's *"the 8 being approximately 1½ spaces in height"* (p. 203) is the **ottava sign's** 8, ⛔ not a clef's |
| **Whether a numeral-bearing clef reserves more horizontal room** | no statement anywhere; the measured answer (no) is ours |
| **A `15` BELOW a clef** | never drawn by anyone; Gould's 15 appears only in the *two octaves higher* column (pp. 276, 506) |
| **Whether Ross accepts an octave clef at all** | pp. 165–168 and 203 read as scans — he never mentions or draws one, and offers two substitutes instead. ⛔ Read the silence as neither approval nor prohibition |
| **Whether the numeral is clef-relative or STAFF-relative** | seven plates give gap 0 (clef-relative); Stone p. 57 hangs the 8 on the bottom staff line (staff-relative). ⛔ No book says which governs |
| **Key signatures under an octave clef** | Gould pp. 506–507, Stone pp. 56–57, 70–72, Gerou & Lusk p. 49 — nothing. (`reference/README.md` already carries this one) |
| **Clef scaling with a small/ossia staff — STONE only** | Stone pp. 46, 56–57, 72–73, 248, plus a grep for *ossia/cue/small staff/reduced*. The other three answer it (§1.1) |
| **Tablature as a clef — Gould and Ross** | full-text greps: **zero** hits for *tablature* in either. Gould's guitar chapter notates guitar *"on a single stave in the treble clef"* |

### 12.2 Stated NON-rules — ⭐ recorded because a refusal is not a silence

- **Stone p. 46**: *"**There are no specific rules for clef changes within a measure.**"*
- **Gould p. 506**: the octave clef itself — *"**This notation is optional.**"*

### 12.3 🚨 Where the books contradict each other, or themselves

1. **The small clef**: Gould **writes** ⅔ and **draws** ¾, six times. *(The scan beats the sentence — the fifth such finding in this library.)*
2. **The percussion clef's stroke**: Ross **states** ¼ sp and **draws** 0.31–0.39; and the four books span **0.10 → 0.61 sp**. *(The sixth.)*
3. **Unpitched percussion on treble/bass clefs**: Ross *"still widely used"* vs Gould *"do not use them"*.
4. **The soprano/mezzo/baritone C clefs**: Gould *"early music"* · Gerou & Lusk *"**obsolete**"* · Stone omits them · Ross gives no verdict.
5. **Gould against herself on octave clefs**: her p. 32 drawing shows treble-8**vb** where her own p. 506 table gives the piccolo treble-8**va**. ⇒ read p. 506.
6. **Clefs after the first system**: Gould p. 7 *"**Never omit the clef**"* vs Stone p. 57, *"in popular music … clefs are usually omitted in the parts after the first line"*.
7. **The clef→first-note gap**: Stone **states** 1½ sp and **draws** 2.96 — and his own footnote defers to Ross, who agrees with the drawing, not with Stone's sentence.

### 12.4 Still missing from the library

**Gardner Read**, *Music Notation* · **Chlapik**, *Die Praxis des Notengraphikers* · Boosey & Hawkes'
house manual. ⛔ When one of these would have answered a question, the honest report is **UNKNOWN**.

---

## 13. ⭐ The findings that would surprise a reader of this repo's other docs

1. ⭐⭐ **The books' one general rule is a RATIO rule, and Gould writes it on p. 5**: *"The size of
   every notational symbol is measured in proportion to the stave size."* That is the literature's own
   version of this repo's standing directive that engraving numbers are a swappable house style
   expressed as ratios — ⛔ it did not need inventing.
2. ⭐⭐ **A small-STAFF clef and a mid-score CHANGE clef are different reductions, and the font says
   so.** Bravura's `ss01` `*Small` clefs are the **same height and up to 10% wider** — an optical
   master — against `*Change` at 0.65–0.72. ⛔ No engine uses `ss01`, and this document had been
   recording only one of the two axes.
3. ⭐⭐ **The octave numeral's slot is not an octave slot.** Stone p. 57 puts a **5** and a **4** in it
   for the horn's bass clef — and **LilyPond, the one engine that draws the numeral as TEXT rather
   than baking it into a ligature, can draw exactly that** (`\clef "alto_2"`). A model of
   *(clef, ±octave)* cannot express it; *(clef, numeral, side)* gets it, and `15`, for free.
4. ⭐⭐ **The clef's OUTLINE is explicitly not standardised — only its registration is.** Ross p. 165
   draws seven treble clefs and five basses, *"attributed to the varying preferences of die makers"*,
   spanning roughly 6–9 sp in height. ⇒ the invariant is the anchor line — exactly the line
   `engine/engrave/header/clef.ts` draws between what it owns and what it leaves to the font.
5. ⭐⭐ **MuseScore reached our `clefOffsetPass` design independently.** The clef is the one element
   whose shape deliberately ignores the user offset (`dom/segment.cpp:2641`), so nudging a clef moves
   the ink and does **not** re-space the measure — which is what that pass's header already argues
   from first principles.
6. 🚨 **VexFlow does not scale a clef with the staff at all** (`Clef.getPoint` = a fixed 30 pt, no
   `Clef` row in `MetricsDefaults`). Our small staves look right only because we scale the whole staff
   group ourselves.
