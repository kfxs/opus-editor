# Vertical spacing — what the engraving literature actually says

**Research record, 2026-08-28.** His ask: *"lets think now about space between systems and space
between staves, default space i mean cause now is arbitrary; so i have the feeling that when we add a
new staff to the system the space is too wide; i expect the space be similar to a piano space or a
string quartet space… i think you should send an agent to make a general vertical space research in
the literature"*.

⛔ **DO NOT RE-RUN THIS RESEARCH.** §5 lists what is genuinely UNKNOWN *with the routes that failed*.
The sources are the four treatises on disk (`reference/README.md` — the manifest); no web search was
needed or done.

⭐ **This is a FINDINGS record.** §1–§5 are the research exactly as reported and ⛔ must not be edited
to match anything we built. What was built from it — and the one number that is taste rather than
measurement — is §0 and §6, kept separate on purpose.

---

## 0. Where we stood, and what was BUILT from this

| | before | **now** |
|---|---|---|
| **visible gap, staff → staff** | 11 sp | **6.5 sp** ✅ |
| **visible gap, system → system** | 11 sp | **11 sp** — untouched, he asked for staves only |
| a one-staff score | 150 px per system | **150 px** — byte for byte |

Before, `LAYOUT_CONFIG.STAVE_HEIGHT` (12 sp) + `VERTICAL_SPACING` (3 sp) was one stride and a system's
height was `staves × stride` — so **the two gaps were the same quantity**, and a piano grand staff was
spaced exactly as loosely as two unrelated systems. That is what he saw: *"when we add a new staff to
the system the space is too wide"*.

✅ **Built 2026-08-28** (`engine/layout/staffStride.ts`, `staffStride.gaps.test.ts`): the staff-to-staff
distance is now the staff's five LINES plus `STAFF_GAP_SPACES`, the bottom staff of a system trails
`SYSTEM_GAP_SPACES` instead, and the drag floor became the books' 4 spaces of clear air. **Where 6.5
came from is §6.**

⚠️ **Everything below is the research as it was reported** — ⛔ do not edit the findings to match what
we built; the two are separate records on purpose.

⚠️ **Every measurement below is bottom stave-LINE → top stave-LINE**, and so is the "visible gap" row
above. Whenever a source does not say what it measures between, that is called out.

---

## 1. The conversion, and the trap inside it

**1 stave-space = the distance between two stave-lines** (Gould p. 5). **1 stave HEIGHT = 4 spaces**
(Ross p. 64 step 12: *"One staff equals four spaces, the distance between the top and bottom lines"*).

🚨 **Gould's own prose and her own table disagree about what a Rastral number measures, by 4×.**
p. 482 says *"the Rastral height being the measurement of one stave-spaee [sic]"*; the Table 2 column
on p. 483 is headed **"stave height"**. **Settled by measuring the nine drawn staves of that table**
at 400 dpi: they come out at 15.69–15.95 px/mm against the printed mm figures (nominal 400 dpi =
15.748 px/mm) ⇒ **the table is printed life size and its mm values are the five-line stave height**.
⭐ **The column header is right and the p. 482 sentence is wrong.** Independently cross-checked
against Ross's own rastral chart (p. 57): the two books draw the same series to within ~1.5%.

So: rastral 3 (7 mm, *"single-stave parts / piano music, songs"*) ⇒ **1 sp = 1.75 mm**; Gould's
*"ideal stave size in good lighting conditions is 6.7 mm"* (p. 557) ⇒ 1 sp = 1.675 mm; rastral 8
(3.7 mm, *"full score"*) ⇒ 1 sp = 0.925 mm.

---

## 2. What the books SAY

### 2.1 The one hard number: a floor of four staff spaces

Two books state it independently, and they agree.

> **Gould, p. 488** (`DISTANCE BETWEEN STAVES`): *"Staves should be **at least a stave height apart**
> or they will look very cramped. Equidistant staves are not always the best layout: staves placed at
> variable distances apart will avoid disproportionally wide or cramped spacing between them."*

> **Ross, p. 68**, a NOTE after step 29 — ⭐ nothing in his index points at it: *"In cases like this,
> where there are **no characters between staves**, it is advisable to **skip at least four spaces
> between staves**, instead of the two spaces called for in Nos. 28 and 29."*

A stave height **is** 4 sp by both books' own definitions, so this is one number said twice. ⚠️ It is
a **MINIMUM for a gap with nothing in it**, not a default.

### 2.2 Systems get more room than staves — stated as an ORDERING, never as a number

> **Gould, p. 488**: *"When a page contains more than one system, the distance between systems should,
> if possible, be **greater than the distance between the most widely spaced staves on an adjacent
> system**."*

> **Gerou & Lusk, p. 133**: *"**More space should be provided between systems** than between the
> staves of the systems. The spacing between systems should be balanced, with the page margins and the
> number of systems on the page in mind."*

⚠️ Gould's version is **relational and conditional** (*"if possible"*), and it compares against the
**widest** staff gap on the neighbouring system — not against an average.

### 2.3 ⭐⭐ The distance is decided by the INK, not by the relationship

This is the strongest agreement in the literature, and it is what makes a single default number a
half-answer at best.

> **Gerou & Lusk, p. 133**: *"Musical elements (notes on leger lines, articulations, slurs, pedal
> marks) projecting beyond a staff should never conflict with the elements of another staff or
> system… **The most common misjudgment is to place staves (or systems) exactly the same distance from
> one another without adjusting to compensate for the projecting musical elements.**"*

> **Ross, p. 60**: *"(Due to leger lines, extra titles within the body of the music, and stems going
> in opposite directions, **staves are not always equidistant** from one another.)"* — and p. 70:
> *"those six staves should not be equidistant from one-another. Extra distance should be allowed
> in-between those staves with leger lines."*

Ross's vertical layout is literally a **sum of the ink** (pp. 64–68), measured on a paper strip from
the top line downward: one space of air, 2.5 spaces for an `mf`, one space of air, then the next
staff's top line — *"(2) skip one space… (3) measure off two and a half more spaces… for the 'mf'
(4) skip another space"*. Chord name = 2 sp; one lyric line = 2 sp; two lyric lines = 4 sp
(*"one full staff"*); a slur under a 1st-ending line = 1 sp; a triplet number = 2 sp.

⇒ **Ross's "staff distance" is not a constant at all** — it is `1 sp + (whatever is in the gap) + 1 sp`,
with 4 sp as the floor when the gap is empty.

### 2.4 The keyboard/grand staff — no book gives a number

> **Gerou & Lusk, p. 133**: *"the staves of a system should not be too far apart. This is especially
> important for a system that is to be read by one performer — a **keyboard player**, for example. The
> eye should not have to jump too far from one staff to the other."*

Qualitative, and that is all four books have on it. See §5.

### 2.5 Instrument families in a score

> **Gould, p. 520**: *"In an orchestral score, it is helpful to **add slightly to the space** separating
> instrumental sections. The space between orchestral sections **appears, in any case, to be greater**
> than the space between staves within the section, **since barlines do not run through this space**.
> The widest space should be above the strings…"*

⭐ Note the second sentence: part of the family separation is an **illusion produced by the barline
join** — which is a feature we now have (`docs/barline-join-plan.md`).

### 2.6 Margins

> **Gould, p. 481**: *"Allow **at least 15mm/½"** for all borders around the printed area of a page —
> more for a binding edge."*

> **Ross, p. A-2**: *"it is always desirable to have a margin of **at least one-half inch** on all
> sides between the edge of the printing area and the edge of the page."*

⚠️ The **printed area includes titles and page numbers**, not just staves — Gould p. 484: the page
numerals *"define the upper boundary of the printed area"*. So this is not a system-to-margin number.

### 2.7 How a page is stretched to fill — and the one place the books contradict each other

> **Ross, p. 69**: *"If there is a matter of only **three to six extra spaces**, insert this extra
> spacing **in equal proportion between systems**. If more space is needed to expand the layout, allow
> for this **between staves**. But always give preference to the span between staves, at a **ratio of
> anywhere from three to one, to six to one**."*

🚨 **That points the opposite way to §2.2.** Gould and Gerou & Lusk both require system gaps to exceed
staff gaps; Ross sends 3–6× as much stretch into the staff gaps on a sparse page, which drives them
*above* the system gaps in exactly that case. ⚠️ Ross's phrase *"the span between staves"* is not
further defined; the contrast with the preceding sentence is explicit in the scan.

---

## 3. ⭐⭐ What the books DRAW — measured

⭐ **A SCAN BEATS AN OCR whenever the question is "what did they draw"**, and it is what produced every
number in this section. Method, identical throughout: render at 450 dpi (900 for small schematics),
take a column band containing only staff lines, find the five equally-spaced dark rows, and take
**one staff space = (bottom line − top line) / 4 of that same staff** — so the print scale cancels.
Every gap is **bottom stave-line → top stave-line**. ⛔ No bounding boxes.

### 3.1 Gould p. 489 — the only figure in these books whose subject IS staff distance

Three braced piano systems, same music, same staff size:

| label | gap |
|---|---|
| **"recommended spacing"** | **13.27 sp** |
| *"staves too far apart"* | 19.67 sp |
| *"staves too close together"* | 7.72 sp |

🚨 **The number is not the fault, and this is the single most important finding here.** In the
rejected "too close" version the hairpin has been replaced by the word *dim.*, and `f`, *dim.* and `p`
are printed **inside the treble staff among the notes**. In the recommended version the same gap
carries a full `f ——— p` hairpin, a slur and a tuplet bracket. **The drawing states a rule about INK
CLEARANCE, not a distance** — and her *rejected* spacing is still nearly **2× her own 4-sp floor**.

### 3.2 Gould p. 558 vs p. 489 — her own two system gaps straddle her own verdict

- p. 558, labelled **`not acceptable`**: **8.25 sp** — the gap stuffed with `mf`, accents, ties,
  `rit.`, `p`, `a tempo` and interpenetrating stems.
- p. 489, printed without comment (a figure about offsetting barlines): **7.95 sp** — the gap holds
  one `p`.

⇒ **She calls 8.25 sp unacceptable and prints 7.95 sp silently.** ⛔ A bare staff-to-staff number
cannot reproduce her judgement. It is the ink.

### 3.3 Gould p. 515, Table 4 — small-ensemble layouts (schematic: ratios trustworthy, absolutes not)

| layout | gaps (sp) |
|---|---|
| wind quintet, 5 instruments, one bracket | 5.90, 6.04, 5.90, 6.04 |
| brass quintet | 5.96, 6.16, 5.96, 6.16 |
| **string quartet** | **6.01, 6.16, 6.01** |
| vln/cl/hn/bsn | 5.88, 6.01, 5.88 |
| **wind octet**, four sub-bracketed same-instrument PAIRS | within-pair **4.81–4.87**; between-pair **4.66–4.69** |
| Fl/Bsn/Glock ⟨bracket⟩ · Piano ⟨brace⟩ · Vln/Vla/Vc ⟨bracket⟩ | within-group 4.68–4.84 · **braced piano pair 4.79** · **group boundary 8.05** |

⭐⭐ **Three results fall straight out of this table:**

1. **A string quartet is EQUIDISTANT** — four different instruments in one bracket get one distance.
2. **Two staves of the same instrument, sub-bracketed, get NO extra closeness** — the within-pair gap
   is if anything 0.15 sp *larger*. The pairing is carried by the **sub-bracket**, ⛔ not by space.
3. **A braced piano pair gets exactly the within-bracket distance** (4.79 against 4.68–4.84), while
   the **group boundary gets ≈1.7×** it.

### 3.4 Gould p. 517 — a real published crowded score (Carter, *A Symphony of Three Orchestras*)

23 staves. **Every staff-to-staff gap inside a system: 5.26–5.74 sp** (mean 5.47, over 20 gaps). The
**braced piano pair: 5.52 sp — identical to its neighbours.** Family and sub-group boundaries
(horn→trumpet, brass→strings): **no measurable extra space**. Orchestra I→II 15.59 sp and II→III
14.93 sp, but each of those carries a tempo/meter row.

⇒ in a crowded score, **equidistance wins everywhere except the group headings**.

### 3.5 Gerou & Lusk's own drawn systems

- p. 75 **bare grand staff** (brace, no notes): **5.05 sp**.
- p. 75 **organ**, three staves at one scale: manuals **4.19 sp**, manuals → pedal **6.14 sp**.
- p. 140, 3 bracketed staves + a braced pair: within-group 2.80–2.92, **group boundary 4.14**
  ⇒ boundary ≈ **1.44×**.
- p. 140, others: 3 bracketed staves 5.02/5.21; grand staff 4.91.
- ⚠️ The p. 75 flute+piano diagram is **not drawn to one scale** (28.2 vs 37.9 px/sp) and is unusable.

### 3.6 Vocal staves with text

- Gould p. 468, two-stave SATB, one lyric line **centred between** the staves: **12.31 sp**.
- Gould p. 468, two soprano staves each with its own lyric, S.1's lyric in the gap: **6.00 sp**.
- Ross would *compute* one lyric line between two staves as 1 + 2 + 1 = **4 sp**.

### 3.7 A by-product worth keeping: the two rastral series agree

All nine drawn staves of Gould's Table 2 (p. 483) measure 15.69–15.95 px/mm and all nine of Ross's
chart (p. 57) 15.42–15.85 px/mm against the same printed mm figures — the two books draw the same
series to within ~1.5%. That is what makes every mm→sp conversion in §1 safe.

---

## 4. The numbers, gathered

**Staff → staff, inside a system:**

| source | value | what it is |
|---|---|---|
| Gould p. 488 · Ross p. 68 | **≥ 4 sp** | the FLOOR, for a gap with nothing in it |
| Gould, Table 4 schematics | **~4.7–6.2 sp** | small ensembles, bracketed |
| Gould, Table 4 | **4.79 sp** | a **braced piano pair** — same as its bracket-mates |
| Gould p. 517 (real score) | **5.26–5.74 sp** | a crowded 23-staff score, piano pair included |
| G&L p. 75 (drawn) | **4.19–5.05 sp** | bare grand staff / organ manuals |
| Gould p. 489 (drawn) | **13.27 sp** | *"recommended"* — a gap carrying a hairpin, slur and tuplet |
| Ross pp. 64–68 | `1 + ink + 1 sp` | computed, not a constant |

**Group boundary (inside a system):** ≈ **1.44×** (G&L p. 140), ≈ **1.7×** (Gould Table 4), ~**2.7×**
in the Carter score where the boundary carries a tempo row — ⛔ **no book states a number.**

**System → system:** *greater than the widest staff gap of the adjacent system* (Gould p. 488) —
⛔ no number. Measured in her own engravings: **7.95 sp** (uncriticised) and **8.25 sp** (labelled
`not acceptable`), the difference being what is in the gap.

---

## 5. ⛔ UNKNOWN — with the routes that failed

- **A number for the grand-staff / braced-pair distance.** ⛔ None of the four books gives one.
  Routes read in full: Gould's index entries *stave spacing 487–9, 558*, *MARGINS 481, 488*, *system
  depth 488, 522–3*, *vertical spacing, minimizing 523–5*, *BRACE 514–16, 519, 524, 534*; Ross's
  `VERTICAL LAYOUT` chapter pp. 60–69; G&L *Brace*, *Grand staff* (74–5), *Systems* (140), *Scores*
  (117), *Staff* (135), *Spacing* (132–4).
- **A number for the family/bracket-group boundary.** Gould p. 520 says only *"add slightly"* and
  *"widest above the strings"*. The ratios in §3 are measured, ⛔ not stated.
- **A number for system → page margin.** Both Gould (pp. 484, 487–8) and Ross (p. 61) make it a
  **residual**: whatever is left after titles, page numbers and projecting ledger lines.
- **Vocal staves with text, as a rule with a number.** Ross gives components (2 sp per lyric line);
  Gould gives *"Centre the text between the two staves"* (p. 468) and nothing else.
- ❌ **Kurt Stone contributes NOTHING here — checked via his index, so nobody repeats it.** No entry
  for *braces*, *systems*, *margins*, *layout*, *page layout*, *staves (distance)* or *score layout*.
  His *spacing, 44–47, 341–342* is entirely **horizontal**; `Score Setups` (pp. 170–176) is instrument
  order and barline grouping only.

⚠️ **Two internal contradictions to know about** (both settled or flagged above, ⛔ don't rediscover
them): Gould p. 481's *"15mm/½""* are 18% apart (15 mm = 0.59″); and Gould p. 482 vs her p. 483 table
on what a Rastral number measures, 4× apart, settled by measurement in favour of the table.

---

## 6. What this means for a default — and what was decided

⭐⭐ **The literature's answer is a FLOOR plus a rule, not a default.** Every source says the gap is
decided by the ink in it; the only stated constant is *at least 4 sp when nothing is there*, and the
only stated ordering is *systems wider than staves*.

Against that, today's **11 sp** for both is roughly **twice the measured drawn practice** for staves
inside a system (4.2–6.2 sp in every bare or bracketed example measured), which is exactly what he
reported by eye. And system-to-system at the same 11 sp violates the one ordering all three prose
sources agree on.

⚠️ **Two things the sources refuse to decide for us**, and both were his calls:

1. **How much of the gap is a constant and how much is measured from the ink.** Ross computes the
   whole thing; Gould and G&L give a floor and then judge by eye. We have the ink
   (`outsideStaffBand`, the skyline the ladder already builds), so a measured gap is buildable — but
   ⛔ it is a bigger change than a constant, and it is not what he asked for yet.
2. **Whether a braced/grand staff is tighter than its neighbours.** ⭐ The measured answer is
   **NO** — Gould's Table 4 and the Carter score both give a braced piano pair the same distance as
   the bracketed staves around it, and G&L's *"the eye should not have to jump too far"* is about the
   gap being small in general, not about the brace. ⛔ So "a piano space" and "a string quartet space"
   are, in the literature, **the same space** — which is worth stating back to him, because his ask
   assumed they differ.

### ✅ What was decided, 2026-08-28 — and by whom

**`STAFF_GAP_SPACES = 6.5`**, and the number is a *negotiation between a measurement and an eye*,
which is worth recording as such:

| | sp | whose |
|---|---|---|
| the floor, stated twice (Gould p. 488 · Ross p. 68) | 4 | the books' |
| Gerou & Lusk's drawn bare grand staff | 5.05 | measured |
| the Carter score, every inner gap | 5.26–5.74 | measured, and a REAL page |
| Gould Table 4's widest small-ensemble gap | **6.16** | measured, ⚠️ schematic |
| **what we ship** | **6.5** | the measured top, rounded up |
| what HIS HAND dragged to | 6.86 | his eye, sent back as a `staffSpacing` override |
| Gould's *"recommended"* braced piano | 13.27 | measured — but that gap holds a hairpin, a slur and a tuplet |

He saw 5 (*"too short"*), then 6, then dragged a staff himself and asked to *"find a compromise based
on the research"*. ⭐ **Going above every measured example is defensible here for one reason**: Table 4
is schematic (*"ratios trustworthy, absolutes not"*) and every trustworthy absolute is a page **with
ink in the gap**, so the literature has **no number for two bare staves** — the case a default is
about. Between 4 and 13.27 this is taste inside a range, ⛔ not a rule being broken.

**`SYSTEM_GAP_SPACES = 11`** — today's number kept deliberately, because he asked for staves only. It
also puts us on the right side of the one ordering every source states (Gould p. 488, G&L p. 133):
**11 > 6.5**, where before it was 11 = 11.

⏭️ **Still open, and the literature says it is the real rule:** the gap should be measured from the
INK. We already build the skyline (`layout/outsideStaffBand`), so it is buildable. ⛔ Not a work list —
`docs/layout-plan.md` §8 (THE VERTICAL) is where a build would be planned.
