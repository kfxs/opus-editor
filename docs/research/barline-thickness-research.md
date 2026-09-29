# How THICK a barline is — thin, thick, the white between, and the thin double `‖`

> 📄 Research, 2026-09-29. ⛔ **This document decides nothing and schedules nothing.** §6 is a MENU of
> sourced rows; which one is armed is HIS call.
>
> **Asked:** in staff spaces (sp), (1) the ordinary thin barline, (2) the thick line of a final / repeat
> bar, (3) the white between thin and thick, (4) the thin double's strokes and its white, (5) how a barline
> relates to a staff line and a stem, and whether it scales on a small staff, (6) anything about a minimum
> width on SCREEN.
>
> **Built on, not repeated:** `reference/README.md` (the 2026-08-26 barline-family Q&A and the 2026-09-21
> small-staff Q&A), `docs/research/staff-line-research.md`, `docs/research/stem-thickness-research.md`,
> `docs/research/barline-join-research.md` (*Small staves*), `docs/plans/double-barline-plan.md`.
>
> 🚨 **Three headlines.**
>
> 1. **Gould's thin DOUBLE is drawn with her ORDINARY barline, stroke for stroke** — re-measured here,
>    threshold-free, on pp. 238–239: single barlines 0.174–0.191 sp, the double's strokes 0.174–0.192 sp,
>    on the same staves. Her *"of ordinary barline thickness"* (p. 39) is what she draws, and her white is
>    **0.306–0.314 sp** — our `gould` row (0.30) stands.
> 2. 🚨 **Our `gerouLusk` row (0.22) is not what four Gerou & Lusk doubles measure.** Measured here:
>    white **0.35–0.37 sp**, left edge to left edge **0.47–0.49** — ⛔ not the 0.38 left-to-left the row
>    was built from (§3.4).
> 3. 🚨 **Our `bravuraGlyph` row (0.288) is Bravura 1.392's glyph.** The Bravura we vendor
>    (`scripts/vendor/Bravura.json`, **1.481**) draws `barlineDouble` 0.72 wide = 0.16 + **0.40** + 0.16 —
>    i.e. its glyph now agrees with its own `barlineSeparation` (§4.4).

---

## 1. The table

All values in **staff spaces**. [T] = stated in prose · [M] = measured on a plate (§3) · [E] = engine or
font default. ⚠️ A plate's ABSOLUTE width carries its reproduction's ink spread; the RATIOS and the
left-edge-to-left-edge distances do not (§3.1).

| quantity | Gould | Ross | Stone | Gerou & Lusk | LilyPond | MuseScore | Verovio | SMuFL fonts | Finale (Maestro default) | Dorico | VexFlow 5 | **ours today** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **thin barline** | *"thicker than a stave-line"* [T]; **0.174–0.192** [M] | *"can only be roughly estimated"* [T]; plate 0.25 ⚠️ spread | UNKNOWN [T]; plate 0.24–0.26 ⚠️ spread | *"equal to, or greater than"* a staff line [T]; plate 0.11–0.16 | **0.19** [E] | **0.18** [E] | **0.15** [E] | Bravura/Sebastian/Petaluma/Gootville/Emmentaler **0.16**, Leipzig **0.15**, Leland **0.18**, Finale Maestro **0.10** | **0.100** [E] | UNKNOWN (forum claims conflict) | 0.10 (1 px) | **0.16** (font) |
| **thick line** | *"of beam thickness"* = ½ [T]; **0.479–0.486** [M] | *"half-space wide"* [T] | UNKNOWN (*"heavy"*) | UNKNOWN; plate 0.48 | **0.60** [E] | **0.55** [E] | **0.50** [E] | **0.50** (all but Leland **0.55**) | **0.50** [E] | *"half a space wide by default"* [T] | 0.30 (3 px) | **0.50** (font) |
| **white, thin↔thick** | ½ sp *"before it"* [T] = left edge to left edge; white **0.309–0.341** [M] | *"a half-space distance"* [T]; plate L-to-L 0.46 | UNKNOWN | plate white 0.53 | **0.30** (`kern`) [E] | **0.37** [E] | **0.40** [E] | `thinThickBarlineSeparation` Bravura 1.481 **0.40**, Leland **0.37**, Finale Maestro **0.50**; absent elsewhere (falls back to `barlineSeparation`) | **0.50** (`finalBarlineSpace`) ⚠️ meaning UNKNOWN | UNKNOWN | 0.20 (2 px) | **0.32** |
| **thin double: each stroke** | *"ordinary barline thickness"* [T]; **= her single, measured** [M] | UNKNOWN [T]; plate = as thick as his single | *"two regular barlines"* [T] | plate 0.11–0.16 = their single | = thin (`hair-thickness`) | `doubleBarWidth` **0.18** = `barWidth` (separate knob) | = thin | SMuFL: `thinBarlineThickness` *"…or each of the lines of a double barline"* | = thin (`barlineWidth`) | *"both the width of a single barline"* [T] | = thin | **= thin** |
| **thin double: white** | *"about ¾ stave-space apart"* [T]; white **0.306–0.314**, L-to-L **0.48–0.49** [M] | *"approximately three-quarters of a space apart"* [T]; plate c-to-c **0.55** | UNKNOWN | white **0.35–0.37**, L-to-L 0.47–0.49 [M] | **0.30** (`kern`) | **0.37** | **0.40** | `barlineSeparation` 0.40 (Bravura, Leipzig, Petaluma, Gootville, Emmentaler), Leland 0.37, Sebastian 0.50, Finale Maestro 0.50, MuseJazz 0.30 | **0.60** (`doubleBarlineSpace`) ⚠️ meaning UNKNOWN | *"half a space apart by default"* [T] ⚠️ white or centres UNKNOWN | 0.20 (2 px) | **0.30** (`gould` preset) |
| **barline ÷ staff line** | **1.53–1.76** [M] | *"thick … staff lines thinner"* (a tendency) | ≈1.5 [M] ⚠️ | ≈1.0 [M] | 1.9 | 1.64 | 2.0 | Bravura 1.23 · Leland 1.64 · Leipzig 1.88 | 0.71 | — | 1.0 | **1.45** (0.16 / 0.11) |
| **on a small staff** | ONE absolute weight on both staves [M] | *"the same cutting tool for two or three different sized staves"* [T] | — | — | scales (`\magnifyStaff`) | fixed (`scaleBarlines` false) | fixed | — | — | — | — | **fixed** (the SYSTEM's weight) |
| **minimum on screen** | — | — | — | — | — | — | — | — | — | — | — | hinting pass (§5.2) |

"—" = the source was not asked or has no such notion. **UNKNOWN** = asked, not found.

---

## 2. The books — what they SAY

### 2.1 Gould, *Behind Bars* — pp. 38–39 (PDF 58–59), read from the text layer and the scan

> *Single barlines*: *"The barline is thicker than a stave-line, and therefore conspicuously thicker than a
> stem. It is very important that barlines stand out from stems, especially when there are long,
> complicated bars in a single-stave instrumental part."* (p. 38)
>
> *Thin double barlines*: *"These mark divisions between sections in a piece. They are of ordinary barline
> thickness, and are placed about ¾ stave-space apart."* (p. 39)
>
> *Final barlines*: *"The thick final line is of beam thickness. The thin barline is placed ½ stave-space
> before it."* (p. 39) — and p. 17: *"Beam thickness is ½ stave-space."*
>
> *Repeat barlines*: *"These use the final double barline design together with repeat dots."* (p. 39)

⛔ No number for the thin line anywhere in the book — only the two relations above.
Small staves: *"A cue stave is about three-quarters of the full-sized stave"* (p. 575); the barline
weight across them is her PLATE's answer (§3.3).

### 2.2 Ross, *The Art of Music Engraving* — pp. 151–152 (PDF 163–164), p. 147 (PDF 159), p. 82 (PDF 94)

> *"The thickness of the barline can only be roughly estimated. There are several reasons why this is so;
> first of all, most plate engravers use the same cutting tool for two or three different sized staves;
> second, the recent advent of offset printing has caused changes in barline thickness (prior to offset
> printing, staff lines were thin, stems thicker, and barlines thickest; today, although engravers differ
> on this point, the tendency is to have barlines thick, staff lines thinner, and stems thinnest)."*
> (p. 151)
>
> *"Double barlines indicate the end of a section of music. The lines are approximately three-quarters of
> a space apart."* (p. 152)
>
> *"The 'fine' double barlines, used to end a composition, are spaced the same as a repeat sign: first
> comes the single barline; then a half-space distance; and last, the thick, half-space wide barline."*
> (p. 152)
>
> The p. 147 footnote (already in `reference/README.md`): the repeat's heavy line *"as thick as a beam
> (one-half space)"*, white + thin *"one-half space"*, the dots *"one-half space"* — 1½ in all.
>
> p. 82: *"To the experienced eye, the narrow bar-line and the thick stem are glaring errors."*

⚠️ Ross's *"a half-space distance"* and Gould's *"½ stave-space before it"* do not say white or edge-to-
edge. Ross's footnote puts white + thin in ONE half space, which fixes it: **the half space runs from the
thin line's left edge to the thick line's left edge** — what Gould's plate measures (§3.2), and Ross's own
plate agrees (L-to-L 0.46, §3.4).
🚨 LilyPond's `BarLine` grob knows this is not what it draws: *"Ross. page 151 lists other values for
`kern`, `segno-kern`, and `hair-thickness`; we opt for a leaner look"* (`scm/define-grobs.scm:264–265`).
⚠️ What the printed p. 151 lists as numbers could not be found — the page has only the sentences above;
the numbers LilyPond meant are the p. 147 footnote and p. 152.

### 2.3 Stone, *Music Notation in the Twentieth Century* — printed pp. 8–9 (PDF 15)

Names only: *"F. Double Barlines (two regular barlines)"*, *"C. Final Barlines (one regular and one heavy
barline)"*, *"H. Repeat Bars (final barlines with repeat dots)"*. ⇒ his double's strokes are the ordinary
barline's. ⛔ No thickness, no spacing — **UNKNOWN**, searched `thick`/`barline` over the whole text layer.

### 2.4 Gerou & Lusk, *Essential Dictionary* — pp. 25–26 (PDF 14–15)

> *"The thickness of a barline is equal to, or greater than, the staff line thickness (staff lines being
> thicker than stems)."* (p. 25) · DOUBLE BARLINE *(Thin/thin)* · FINAL DOUBLE BARLINE *(Thin/thick)*:
> *"Consists of a thin barline followed by a thick barline."* (p. 26)

No numbers in staff spaces.

### 2.5 The relation to the staff line and the stem, in one line

All four books: **stem < staff line ≤ barline** (Gould p. 38 *"thicker than a stave-line … conspicuously
thicker than a stem"*; Ross p. 151 as a *tendency* engravers *"differ on"*; G&L p. 25 *"equal to, or
greater than"*). ⛔ None gives a ratio. The measured ratios are §3.

---

## 3. The plates — what they DRAW (measured 2026-09-29)

### 3.1 Method

Pages extracted at NATIVE resolution where the PDF holds one image (`pdfimages -png`), else rendered with
`pdftoppm -gray` at the page's native dpi, measured with PIL (the scripts were scratch, not kept):

- Staff lines from the row profile (five equally spaced rows of long dark runs); 1 sp = their spacing / 4.
- A barline = columns inked over ≥ 97 % of the staff height. Its horizontal ink profile is averaged over
  rows at the CENTRES of the four spaces (±0.2 sp), so no staff line enters it.
- Width = the **ink integral** Σ (paper − v)/(paper − black) over the stroke ± 2 px — threshold-free.
  Centre = the ink centroid. White = centre-to-centre − (w₁ + w₂)/2.
- ⚠️ Every photo-offset reproduction spreads ink, adding roughly the same amount to EVERY stroke. So an
  absolute width reads high (`staff-line-research.md` found ≈ +5 % on Gould), a white reads low by the
  same amount, and **ratios, centre-to-centre and left-edge-to-left-edge are the robust numbers.**

### 3.2 ⭐ Gould pp. 238–239 (PDF 258–259) — native 238 ppi, 1 sp = 10.50–10.75 px

The *Da Capo / Dal Segno* figures: single barlines, thin doubles and final bars on the SAME staves.

| sign | strokes (sp) | white (sp) | left edge → left edge |
|---|---|---|---|
| **single** barlines (10) | 0.174 · 0.178 · 0.178 · 0.180 · 0.180 · 0.181 · 0.181 · 0.181 · 0.191 · 0.191 | — | — |
| **thin double** (5) | 0.180 + 0.192 · 0.180 + 0.192 · 0.180 + 0.191 · 0.176 + 0.174 · (p. 239 (d)) 0.177 + 0.187 | 0.313 · 0.312 · 0.314 · 0.314 · 0.306 | 0.482–0.494 |
| **final** (4) | thin 0.191 / 0.192 / 0.178 / 0.175 · thick 0.485 / 0.486 / 0.480 / 0.479 | 0.317 · 0.316 · 0.341 · 0.309 | 0.484–0.518 |
| staff lines, same staves | 0.109 · 0.114 · 0.116 · 0.113 · 0.115 | | |

⇒ ⭐ The double's strokes ARE her single barline (0.174–0.192 against 0.174–0.191). The double's white
(0.306–0.314) is her final bar's white (0.309–0.341). Barline ÷ staff line = **1.53–1.76**. This confirms
the 2026-08-26 reading (thin 0.15–0.20, gap 0.30–0.35, thick 0.45–0.50) with a threshold-free method, and
`stem-thickness-research.md`'s p. 490 barlines (0.174–0.179, 1.54–1.58× the staff line).

### 3.3 Gould on a SMALL staff — p. 576 and p. 497 (already measured, `reference/README.md` 2026-09-21)

Ravel Trio, cue over cello, staff spaces 0.746 apart: barlines 4.31–4.40 px on the cue staff, 4.22–4.35 on
the main one — **one absolute weight**, while her staff LINES do scale. p. 497: a thin double on an ossia
and on the main staff — strokes, separation and x the same on both. ⚠️ The plates cannot tell a constant
absolute from a constant ratio to the MAIN staff.

### 3.4 Ross p. 152 (PDF 164), Gerou & Lusk pp. 26, 28, 29 (PDF 15–16), Stone p. 8 (PDF 15)

| plate | resolution | strokes (sp) | white | L-to-L / c-to-c | staff line |
|---|---|---|---|---|---|
| **Ross p. 152**, thin double | 360 dpi bilevel, 1 sp = 20.25 px | 0.245 + 0.258 | 0.30 | c-to-c **0.553** | 0.20 (!) |
| **Ross p. 152**, final | same | thin 0.254 · thick 0.648 | 0.205 | L-to-L **0.459** | |
| **G&L p. 26**, double | 300 dpi bilevel, 1 sp = 19.05 px | 0.106 + 0.116 | **0.368** | L-to-L 0.479 | 0.12–0.14 |
| **G&L p. 26**, final | 1 sp = 19.00 px | thin 0.106 · thick 0.479 | **0.527** | c-to-c 0.819 | 0.12–0.15 |
| **G&L p. 28**, two doubles (key change) | 1 sp ≈ 25.4 px | 0.122 + 0.155 · 0.119 + 0.158 | **0.350 · 0.359** | L-to-L 0.473 · 0.478 | |
| **G&L p. 29**, double (courtesy signs) | 1 sp = 25.75 px | 0.139 + 0.129 | **0.352** | c-to-c 0.486 | 0.15–0.16 |
| G&L p. 29, single, same staff | | 0.155 | | | 0.15–0.16 |
| **Stone p. 8**, singles | 300 dpi gray, 1 sp = 14.5 px | 0.24–0.26 | | | 0.16–0.17 |

- **Ross**: his reproduction spreads badly — a staff line reads **0.20 sp** here, against 0.081 on his
  p. 79 specimen (`staff-line-research.md` §3.4). ⛔ Don't quote his absolute widths. What survives: his
  double's strokes equal (to 0.01), **centre-to-centre 0.55 sp — like Gould's plate, not his own ¾**; his
  final's thin-left to thick-left **0.46 ≈ his "half-space"**. ⭐ A reading that fits both of his sentences
  AND his plate: *"three-quarters of a space apart"* as the OUTER edges of the double (c-to-c + one stroke
  = 0.55 + ≈0.17 ≈ 0.72). That is an interpretation, ⛔ not something he states.
- **Gerou & Lusk** (digitally set, 1996): barline ≈ their staff line (0.11–0.16 against 0.12–0.16) —
  their *"equal to"* half. ⚠️ Bilevel at ≈2 px a stroke, so ±1 px = ±0.05 sp on a width; the WHITE and the
  L-to-L are larger and steadier. 🚨 **All four doubles: white 0.35–0.37, L-to-L 0.47–0.49.** The plan's
  *"G&L p. 29 plate: 0.38 left edge to left edge"* is **not reproduced**; the preset built on it
  (`gerouLusk` 0.22 = 0.38 − 0.16) is contradicted by these four. Their final's white is wider: **0.53**.
- **Stone**: only single barlines drawn; barline ÷ staff line ≈ **1.5** (both inflated alike).

---

## 4. The engines and the fonts — what they DEFAULT to

### 4.1 LilyPond (`master@beedbfa`)

`BarLine` (`scm/define-grobs.scm:261–317`): `hair-thickness 1.9` (`:282`), `thick-thickness 6.0` (`:305`),
`kern 3.0` (`:285`), all × `line-thickness` (`scm/bar-line.scm:229–231`, `:242–244`, `:737`).
`line-thickness` = `calc-line-thickness` (`scm/paper.scm:52–66`, set `:84`), an interpolation that at the
default 20 pt staff (staff space 5 pt) gives **0.50 pt = 0.10 sp**. So:

| | × line-thickness | at 20 pt (0.10 sp) |
|---|---|---|
| thin | 1.9 | **0.19 sp** |
| thick | 6.0 | **0.60 sp** |
| white (`kern`) — for BOTH the double and the final | 3.0 | **0.30 sp** |

`kern` is the WHITE: `bar-line::compound-bar-line` joins the glyphs with `ly:stencil-combine-at-edge … kern`
(`scm/bar-line.scm:771–790`), edge to edge. The double `||` is two `|` = two `hair-thickness` strokes.
⚠️ `line-thickness` is ~constant in POINTS (*"largely independent on staff size"*), so the ratios in sp
move with the staff: 16 pt (4 pt space) ⇒ line 0.116 sp ⇒ thin **0.22**; 26 pt (6.5 pt space) ⇒ 0.085 sp ⇒
thin **0.16**. `\magnifyStaff` scales `hair-thickness`/`thick-thickness`/`kern` per staff
(`ly/music-functions-init.ly:1156–1159`, per `barline-join-research.md`).

### 4.2 MuseScore (`main@929d1e9`)

`src/engraving/style/styledef.cpp:177–183`: `barWidth` **0.18**, `doubleBarWidth` **0.18**, `endBarWidth`
**0.55**, `doubleBarDistance` **0.37**, `endBarDistance` **0.37**, `repeatBarlineDotSeparation` 0.37 (all
`_sp`). Staff line `staffLineWidth` 0.11 (`:277`), stem `stemWidth` 0.10 (`:257`).
The distances are WHITE: `x += (lw/2 + doubleBarDistance + lw/2)` (`rendering/score/tdraw.cpp:771`; final
`:761`). ⭐ The thin double has its OWN stroke knob, defaulting to the thin barline's. When the "optimize
style" box maps a font's defaults in, `thinBarlineThickness` feeds **both** `barWidth` and `doubleBarWidth`
(`internal/engravingfont.cpp:788`) and `barlineSeparation` feeds `doubleBarDistance` (`:793`) — the SMuFL
reading. Small staves: `Sid::scaleBarlines` **false** (`styledef.cpp:792`, applied `tlayout.cpp:1110`).

### 4.3 Verovio (`develop@efff0bc`) — unit = MEI unit = **½ sp** (`src/options.cpp:1202`)

`m_barLineWidth` 0.30 → **0.15 sp** (`options.cpp:1240`); `m_thickBarlineThickness` 1.0 → **0.50 sp**
(`:1553`); `m_barLineSeparation` 0.8 → **0.40 sp** (`:1236`), one number for BOTH the double and the
final; `m_repeatBarLineDotSeparation` 0.36 → 0.18 sp (`:1458`); staff line 0.15 → 0.075 sp (`:1529`);
stem 0.20 → 0.10 sp (`:1533`). A supplied font's `engravingDefaults` override these × 2
(`options.cpp:2102–2145`), but the shipped fonts carry none. It is WHITE: `BARRENDITION_dbl` draws line 2
centred at `x + separation + width` (`src/view_page.cpp:920–922`), the final at `x + separation +
(thin+thick)/2` (`:916–918`). Barline strokes are not scaled per staff (`barline-join-research.md`).

### 4.4 SMuFL — the spec, and the fonts on disk

The **SMuFL 1.4 spec** (`www.w3.org/2021/03/smufl14/specification/engravingdefaults.html`, 2026-09-29):

> `thinBarlineThickness`: *"The thickness of a thin barline, e.g. a normal barline, or each of the lines of
> a double barline"* · `thickBarlineThickness`: *"…e.g. in a final barline or a repeat barline"* ·
> `barlineSeparation`: *"The default distance between multiple thin barlines when locked together, e.g.
> between two thin barlines making a double barline, measured from the right-hand edge of the left barline
> to the left-hand edge of the right barline."* · `thinThickBarlineSeparation`: *"…between the thin and
> thick barlines making a final barline, or between the thick and thin barlines making a start repeat
> barline."*

⇒ SMuFL states outright that a double's strokes ARE the thin barline, and that the separation is WHITE.
It publishes **no default values** — every number below is a FONT's.

| font (file) | thin | thick | `barlineSeparation` | `thinThickBarlineSeparation` | staff line | stem |
|---|---|---|---|---|---|---|
| **Bravura 1.481** (`scripts/vendor/Bravura.json`, ours) | 0.16 | 0.50 | 0.40 | 0.40 | 0.13 | 0.12 |
| Bravura 1.392 (`verovio/fonts`, `MuseScore/fonts`) | 0.16 | 0.50 | 0.40 | — | 0.13 | 0.12 |
| **Sebastian 1.35** (ours) | 0.16 | 0.50 | **0.50** | — (we fall back to Bravura's) | 0.13 | 0.125 |
| **Leipzig 5.2.86** (ours) / 5.2.101 (Verovio) | **0.15** | 0.50 | 0.40 | — (we fall back to Bravura's) | 0.08 | 0.076 |
| Leland 0.80 (MuseScore default) | **0.18** | **0.55** | **0.37** | 0.37 | 0.11 | 0.10 |
| Petaluma 1.04 / 1.065 | 0.16 | 0.50 | 0.40 | — | 0.13 | 0.20 / 0.12 |
| Gootville 1.3 | 0.16 | 0.50 | 0.40 | — | 0.13 | 0.12 |
| Emmentaler 2.003 (`MuseScore/fonts/mscore`) | 0.16 | 0.50 | 0.40 | — | 0.08 | 0.13 |
| MuseJazz 1.0 | 0.30 | 0.60 | 0.30 | — | 0.10 | 0.20 |
| Finale Maestro 2.7 (`musxdom/tests/data/font_metadata`) | **0.10** | 0.50 | **0.50** | **0.50** | 0.091 | 0.091 |

Leland's values are MuseScore's style defaults (`styledef.cpp:177–183`) — chosen to match, not the cause
(`reference/README.md`). Precomposed glyph widths (`glyphBBoxes`, bBoxNE.x − bBoxSW.x):

| | `barlineSingle` | `barlineDouble` | ⇒ double's white | `barlineFinal` |
|---|---|---|---|---|
| Bravura **1.481** | 0.16 | **0.72** | **0.40** | 1.06 |
| Bravura 1.392 | 0.144 | 0.576 | 0.288 | 0.912 |
| Leipzig | 0.152 | 0.704 | 0.40 | 1.048 |
| Sebastian | 0.12 | 0.668 | 0.428 | 0.912 |

🚨 So `DOUBLE_BARLINE_GAP_RULES.bravuraGlyph` (0.288) is the **older** Bravura; the Bravura this repo reads
draws 0.40, i.e. the same as the `verovio` row.

### 4.5 Finale (via `musxdom`, the 99 Finale 27.4 fixtures) — 1 sp = 24 EVPU = 1536 Efix

`BarlineOptions` (`musxdom/src/musx/dom/Options.h:149–152`): `barlineWidth`, `thickBarlineWidth`,
`doubleBarlineSpace`, `finalBarlineSpace`, all Efix (`Fundamentals.h:62, 89–93`). The Maestro default
documents (`tests/data/reference/MaestroFontDefaultWin.enigmaxml`, `…Mac`):

| | Efix | sp |
|---|---|---|
| `barlineWidth` (thin) | 154 | **0.100** |
| `thickBarlineWidth` | 768 | **0.500** |
| `doubleBarlineSpace` | 922 | **0.600** |
| `finalBarlineSpace` | 768 | **0.500** |
| `staffLineWidth` / `stemWidth` | 140 | 0.091 |

Other defaults: Patterson thin 256 (0.167), thick 1152 (0.75); Jazz/Handwritten 224 (0.146); Broadway 230
(0.150), double 998 (0.650). ⭐ Finale is the one program with SEPARATE spacings for the double and the
final. ⛔ Whether a "space" is white, centre-to-centre or edge-to-edge is **UNKNOWN** — musxdom only
parses it, and no Finale manual is on disk.

### 4.6 Dorico — the manual, online

Dorico 2 manual, *Barlines* (`archive.steinberg.help/dorico/v2/en/dorico/topics/notation_reference/notation_reference_barlines_c.html`,
fetched 2026-09-29): *"A double barline consists of two lines, both the width of a single barline,
positioned half a space apart by default."* · *"A thick barline is half a space wide by default."* ·
*"A final barline consists of two lines: one of normal width, the other thick."*
⛔ The thin barline's own default, and whether "half a space apart" is white or centres: **UNKNOWN** —
secondary search snippets gave both 0.16 and ⅕ sp, and `notat.io` is Cloudflare-gated
(`reference/README.md`). Sibelius's Engraving Rules ▸ Barlines defaults: **UNKNOWN** (not found online).

### 4.7 VexFlow 5.0.0 — the code we replaced (`build/esm/src/stavebarline.js:140–165`, 10 px = 1 sp)

Thin 1 px = **0.10**; the double `x − 3` and `x`, 1 px each ⇒ white **0.20**; the final: thin at `x − 5`,
thick `x − 2 … x + 1` = 3 px = **0.30**, white **0.20**. `Tables.STAVE_LINE_THICKNESS = 1` (`tables.js:597`)
is set by the constructor and never read by the drawing (`barlineInk.ts` header).

---

## 5. Two questions most sources do not answer

### 5.1 Does a barline thin on a small (cue / ossia) staff?

- **Books:** no sentence. Ross p. 151 implies not (*"the same cutting tool for two or three different
  sized staves"*). **Gould's plates, pp. 576 and 497: no** — one absolute weight and one separation on both
  staves (§3.3).
- **Engines:** MuseScore **no** by default (`scaleBarlines` false); Verovio **no** for a measure barline;
  LilyPond **yes** under `\magnifyStaff`.
- ⛔ A repeat or final bar on a small staff, and whether its DOTS scale: **UNKNOWN** in the books (searched
  2026-09-21, `reference/README.md`).

### 5.2 A minimum width on screen

⛔ **UNKNOWN in every source here.** No treatise addresses screens; SMuFL gives only staff-space values;
LilyPond, MuseScore's layout and Verovio carry no minimum-pixel rule for a barline in the files read (a
grep of MuseScore's `engraving/` and `draw/` for a minimum or cosmetic pen found none). VexFlow's answer was
a literal 1 px, whatever the zoom. The only screen rule in view is **this repo's own**:
`src/engine/rendering/staff/barlineInk.ts` `hintBarlines` (a thin line's x and width snapped to whole
device pixels, a thin double hinted as one sign with each width and gap floored at one device pixel) — a
practice, ⛔ not a source. `staff-line-research.md` §8 F (*screen vs paper*) is the open decision it
belongs to.

---

## 6. Where our numbers stand — a MENU, ⛔ not a decision

Every row has a source. Whether a row is armed is his call; nothing here asks for a code change.

### 6.1 The thin barline — ours **0.16** (`engravingDefault('thinBarlineThickness')`, `layout/thinLineWeight.ts`)

**Supported, at the low end of the field.** It is the SMuFL fonts' value (Bravura, Sebastian; Leipzig
0.15), and it keeps the books' relation (1.45× our 0.11 staff line). Gould DRAWS a little heavier.

| row | sp | source |
|---|---|---|
| Finale Maestro default | 0.10 | `MaestroFontDefaultWin.enigmaxml` `barlineWidth` 154 Efix |
| Verovio | 0.15 | `options.cpp:1240` |
| Leipzig | 0.15 | its `engravingDefaults` |
| **Bravura / Sebastian — ours** | **0.16** | their `engravingDefaults` |
| Gould's plate | ≈0.18 (0.174–0.192, reads ≈5 % high) | §3.2 |
| MuseScore / Leland | 0.18 | `styledef.cpp:177` |
| LilyPond, 20 pt | 0.19 | `define-grobs.scm:282` × `paper.scm` |
| as a RATIO to the staff line | Gould 1.53–1.76 · MuseScore 1.64 · LilyPond 1.9 · Verovio 2.0 · Bravura 1.23 | §§3.2, 4 |

### 6.2 The thick line — ours **0.50** (`engravingDefault('thickBarlineThickness')`, `layout/barlineSign.ts`)

**Supported — the best-sourced number in the family.** Gould [T] + [M 0.479–0.486], Ross [T], Dorico's
manual [T], every SMuFL font but Leland, Verovio, Finale. Alternatives: MuseScore/Leland **0.55**,
LilyPond **0.60**, VexFlow 0.30.

### 6.3 The white between thin and thick — ours **0.32** (`barlineSign.SEPARATION`)

**Supported by Gould's plate** (0.309–0.341, and 0.30–0.35 in the 2026-08-26 reading); consistent with
the books' ½ sp thin-left-to-thick-left (0.32 + our 0.16 = 0.48). The books' prose reads as that same
distance, not as a white of ½ (§2.2).

| row | sp (white) | source |
|---|---|---|
| VexFlow | 0.20 | `stavebarline.js:153–154` |
| LilyPond | 0.30 | `kern` 3.0 × 0.10 |
| **Gould's plate — ours** | **0.32** (0.309–0.341) | §3.2 |
| books' ½ sp as L-to-L, with our 0.16 thin | 0.34 | Gould p. 39, Ross p. 152 / p. 147 |
| MuseScore / Leland | 0.37 | `endBarDistance`, `styledef.cpp:182` |
| SMuFL Bravura 1.481 / Verovio | 0.40 | `thinThickBarlineSeparation`; `options.cpp:1236` |
| books' ½ sp read as WHITE | 0.50 | ⚠️ a reading their own plates do not draw |
| Finale default / Gerou & Lusk's plate | 0.50 / 0.53 | `finalBarlineSpace` (meaning UNKNOWN) / §3.4 |

### 6.4 The thin double — strokes ours **= the thin barline**; white ours **0.30** (`gould` preset)

**Strokes: supported by everything that speaks** — Gould [T] and now [M] stroke for stroke, SMuFL's own
definition, Stone's *"two regular barlines"*, Dorico's manual, MuseScore's font mapping, every engine's
drawing. Only MuseScore offers a separate knob (`doubleBarWidth`), and defaults it equal.

**White 0.30: supported** — Gould's plate re-measured at 0.306–0.314; LilyPond's `kern` is the same. The
existing preset table (`layout/doubleBarlineGap.ts`), row by row against this research:

| row | today | this research |
|---|---|---|
| `gould` ✅ default | 0.30 | ✅ confirmed, 0.306–0.314 (§3.2) |
| `prose` | 0.59 → ✅ kept, + rows `proseWhite` 0.75 and `proseOuter` 0.43 (2026-09-29) | ⚠️ one of three readings of *"about ¾ apart"*: centres ⇒ 0.59 · white ⇒ 0.75 · **outer edges ⇒ 0.75 − 2 × 0.16 = 0.43** (the reading Ross's plate fits, §3.4). None is stated |
| `gerouLusk` | 0.22 → ✅ **0.36** (fixed 2026-09-29) | 🚨 **contradicted** — four G&L doubles measure white **0.35–0.37** (§3.4) |
| `finalBar` | 0.32 | ✅ = our `SEPARATION`, and Gould does use one white for both (§3.2) |
| `lilypond` | 0.30 | ✅ `kern` 3.0 × 0.10, `define-grobs.scm:285` |
| `musescore` | 0.37 | ✅ `doubleBarDistance`, `styledef.cpp:181` |
| `verovio` | 0.40 | ✅ `options.cpp:1236`; also Bravura 1.481 / Leipzig / Petaluma `barlineSeparation` |
| `bravuraGlyph` | 0.288 → ✅ **0.40** (fixed 2026-09-29) | ⚠️ **Bravura 1.392 only**; our vendored 1.481 glyph gives 0.40 (§4.4) |

✅ **Added to the table 2026-09-29** (`sebastian`, `finale`, `dorico`, `vexflow`). Rows that were not in the table, each with a source: Sebastian `barlineSeparation` **0.50** (our own second face);
Finale Maestro `doubleBarlineSpace` **0.60** (meaning UNKNOWN); Dorico *"half a space apart"* **0.50**
(white or centres UNKNOWN); VexFlow **0.20**.

### 6.5 On a small staff — ours: the SYSTEM's weight (`BarlineRenderer` `signSpace`)

**Supported** by Gould's plates (§3.3), Ross p. 151's cutting tool, MuseScore's and Verovio's defaults.
The one alternative with a source is LilyPond's `\magnifyStaff` (scale with the staff).

### 6.6 On screen — ours: the hinting pass

**UNKNOWN in every source** (§5.2). What we do is our own practice, not a borrowed rule.

---

## 7. UNKNOWN — asked and not found

- A thin barline's thickness as a NUMBER in any treatise (Gould, Ross, Stone, G&L all give only relations).
- Whether *"about ¾ apart"* (Gould p. 39, Ross p. 152) means white, centres or outer edges.
- What Finale's `doubleBarlineSpace` / `finalBarlineSpace` measure between; Dorico's thin-barline default
  and whether its *"half a space apart"* is white; any Sibelius Engraving Rules default.
- A repeat or final bar on a small staff, in the books (`reference/README.md`, 2026-09-21).
- Any source on a barline's minimum width on screen.
