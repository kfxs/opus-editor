# The page and system frame — sourced alternatives for each number (2026-09-14)

**Research record.** Every engraving number is going to become a user-selectable **house-style
preset**. The number running today stays the default; this document gives the **sourced
alternatives**. ⛔ It recommends nothing and changes no code.

⚠️ **Units.** **sp** = staff space. Here `STAFF_SPACE_PX = 10` (`models/staffSize.ts:37`), so
**10 px = 1 sp**. Every page figure is also converted with the millimetres-per-space its own source
uses:
- this repo and MuseScore: 1.75 mm;
- LilyPond: 1.7573 mm;
- Verovio: none needed. Its page and its staff space are both in MEI units, so the ratio has no unit.

---

## 0. The question, and the rows covered

The rows come from `docs/research/engraving-number-inventory.md`: §2 "Page / system layout" (lines 185–192) and
§6 batch 6 (lines 330–332). Paths below are relative to `src/engine/`.

| # | number | today | file:line | inventory class |
|---|---|---|---|---|
| R1 | `SYSTEM_GAP_SPACES` | 11 sp | `layout/staffStride.ts:108` | T (the comment says "arbitrary") |
| R2 | `LAYOUT_CONFIG.STAVE_HEIGHT` | 12 sp | `rendering/layoutConfig.ts:125` | T |
| R3 | `LAYOUT_CONFIG.MAX_MEASURE_WIDTH` | 40 sp | `rendering/layoutConfig.ts:100` | T |
| R4 | `USER_SPACE_LINE_FRACTION` | 0.6 of the line | `rendering/MeasureLayout.ts:514` (read at `:547`) | T |
| R5 | format-width right reserve | 15 px = 1.5 sp (fixed at 10 px/sp) | `rendering/ScoreRenderer.ts:2180` | T |
| R5′ | ⚠️ its ghost duplicate: reserve, floor, fallback | 15 px / 50 px / `staveWidth − 100` | `rendering/ghosts/GhostRenderer.ts:272-273` | ? (the inventory calls it a duplicate) |
| R6 | `SKETCH_CANVAS` | 1000 px wide with a 20 px margin (100 sp, 2 sp margin, 96 sp of content) | `layout/surface.ts:104` | T |
| R7 | `A4_NORMAL` margins | 15 mm on every side = 8.57 sp | `layout/surface.ts:111` | ⭐ already answered (§1) |
| R8 | staff size on the page | 1.75 mm per sp | `layout/surface.ts:73` | S (already sourced) |
| R9 | page top margin → first staff's top line | 4 sp — VexFlow's default headroom, never chosen here | `layout/pageCastOff.ts:78` + `rendering/ScoreRenderer.ts:2566` | not in the inventory; found while tracing R1/R7 |

**Out of scope**, recorded here only as the armed default with a pointer:

- **`STAFF_GAP_SPACES` 6.5 sp** (`layout/staffStride.ts:94`) is *decided*, a compromise between the
  measured 6.16 and the 6.86 his drag chose. See `docs/research/vertical-spacing-research.md` §6 and the
  comment block at `staffStride.ts:40-93`.
- **`MIN_STAFF_GAP_SPACES` 4** (`staffStride.ts:138`) is sourced: Gould p. 488 and Ross p. 68.
- **`MIN_SPACING_ABOVE_AT_PAGE_TOP` 0** (`staffStride.ts:170`) is a clamp rule, not a distance.
- **The score header** (`FRAME_SPACES`, `COMPOSER_AIR_SPACES`) is a 🚧 sketch; see
  `docs/plans/score-header-sketch.md`.

---

## 1. What the existing docs already answer — one pointer per row

| row | answered by | what it settles | what it leaves open |
|---|---|---|---|
| R1 | `vertical-spacing-research.md` §2.2 | Gould p. 488 and G&L p. 132–133: systems get more room than staves. This is an **ordering**, and no book gives a number. | the number |
| R1 | same doc, §3.2 | Gould's drawn system gaps, **measured**: 7.95 sp (p. 489, printed without comment) and 8.25 sp (p. 558, labelled *"not acceptable"*). The ink in the gap decides, not the distance. | — |
| R1 | same doc, §5 and §6 | UNKNOWN as a stated number. 11 sp was left untouched on 2026-08-28 because he asked about staves only. | — |
| R2 | `vertical-spacing-research.md` §0 and §1; `staff-size-plan.md` §5 | Since 2026-08-28 the stride is the staff's **lines** (4 sp) plus a gap. `STAVE_HEIGHT` no longer takes part in the stride (§4 below). | what it measures now |
| R3 | `layout-plan.md` §1 | Lists it as "engraving" (then 400 px). | no source |
| R3 | `bar-width-plan.md` §3; `MeasureLayout.ts:261-270` | **The cap is a preference; the floor is the music.** A bar whose incompressible demand exceeds 40 sp takes the room it needs. | — |
| R4 | `bar-width-plan.md` §3 | The 0.6 cap applies to **dead gaps** (leading spaces) only. The stretch pool was uncapped after a report from use. | the 0.6 itself has no source |
| R4 | `note-spacing-plan.md` §3 | Option B: "the gap you drag is the gap you get". | — |
| R5 | `note-spacing-plan.md` §4 and Review record R6 | Records the literal and its 50 px floor. ⚠️ It cites `ScoreRenderer.ts:1053`; the line is now `:2180`. | no source |
| R6 | `layout-plan.md` §1 and §2 | *"1000 px isn't any paper size"*. ⭐ The invariant: **a canvas has no physical size**, so "how many mm wide is the canvas?" must have no answer. | — |
| R7 | ⭐ `vertical-spacing-research.md` §2.6 | **Gould p. 481**: *"at least 15mm/½" for all borders around the printed area"*. **Ross**: *"at least one-half inch on all sides"*. The printed area includes titles and page numbers. | ⚠️ page correction in §2.3 below |
| R7 | same doc, §5 | System → page-margin distance is a **residual** in the books: UNKNOWN as a number. | — |
| R7 | `pdf-export.md` §3 | Under a page surface a staff prints at 7 mm. | — |
| R8 | `vertical-spacing-research.md` §1 | Gould Table 2, p. 483, **measured**. Rastral 3 (a 7 mm staff) gives 1.75 mm/sp. Her "ideal" 6.7 mm staff (p. 557) gives 1.675 mm/sp. Rastral 8 (3.7 mm, full score) gives 0.925 mm/sp. Ross p. 57 draws the same series to within 1.5%. | — |

---

## 2. Books

Every page below was rendered from the PDF, and every quotation was read from the scan.

### 2.1 R3 — a bar that fills a system: prose, plus a measured plate

> **Gould p. 489 (PDF 509), *Splitting bars***: *"In exceptional circumstances it is acceptable to
> divide a long bar between two systems so that spacing can be consistent. It is more difficult to
> read a system containing a single bar if it is over-spaced. It is only acceptable to split up a bar
> when a whole bar is too long to fit onto a single system, or when three bars more conveniently fit
> onto two systems, each system taking a bar and a half."*

⇒ Gould names an **over-spaced single bar** as the fault. She states no cap in staff spaces, and her
remedy is to split the bar, not to cap its width.

> **Gould p. 41 (PDF 61), *Spacing symbols***: *"ideally, each system should contain a comparable
> number of symbols (notes or other notational characters). The spacing of symbols may widen or narrow
> according to how numerous they are on a system."*

> **Ross p. 60 (PDF 72), *Casting off* (1)**: *"when all the measures in two successive staves are
> approximately the same as far as notation goes, do not have six measures on one staff, and three on
> the other."*

> **G&L p. 132 (PDF 68, left half), *Measures within the staff***: measure size is *"a compromise
> between two extremes: 1) Equal space for each measure. 2) Measure size based on note density only."*

⇒ All three books state **balance between systems**. None states a maximum width for one bar.

**Measured: Gould p. 489, the Bruckner *Symphony No. 8* violin part** (the figure for *Offsetting
barlines*).
- Method: 450 dpi; staff lines found by row projection; 1 sp = (bottom line − top line) / 4 = **20.0 px**;
  barlines are columns dark across ≥95% of the staff interior.

| system | staff length | bars | barline → barline widths |
|---|---|---|---|
| 1 | **105.9 sp** | 5 | [header + bar 1 = 28.4] · 19.82 · 19.90 · 18.70 · 19.02 |
| 2 | **105.95 sp** | 5 | [header + bar 1 = 27.5] · 18.93 · 18.65 · 20.45 · 20.40 |

- These are bars of eight quavers (eighth notes). They are **18.7–20.5 sp wide, about 19% of the line**.
- The same plate's system gap is the 7.95 sp already measured in `vertical-spacing-research.md` §3.2
  (re-measured here: bottom line 2599.5 px → top line 2758.5 px = **7.95 sp** ✓).
- ⚠️ This is one engraving of dense, uniform music. It is a data point for "what a full bar measures",
  ⛔ not a cap.

### 2.2 R1 — the system gap

Nothing new: the prose, both measured plates, and the contradiction with Ross p. 69 are all in
`vertical-spacing-research.md` §2.2, §2.7 and §3.2. ⛔ Not redone.

One page correction for G&L: the paragraph *"More space should be provided between systems than
between the staves of the systems…"* **begins at the foot of p. 132** and continues onto p. 133
(*"…and to the minimum vertical margins, while allowing enough distance between systems to
distinguish one from another. If the page is sparse, the upper and lower page margins could be
larger."*). PDF 68 is the spread 132 | 133, verified on the scan. The vertical research cites "p. 133".

### 2.3 R7 — margins: the page correction, and two further statements

- **Ross's general margin rule is on p. A-3 (PDF 225), not A-2.** Read on the scan: *"With the possible
  exception of the quick-step size, it is always desirable to have a margin of at least one-half inch
  on all sides between the edge of the printing area and the edge of the page."*
  The preceding page (A-2, per the OCR order) is where the concert-size figure sits: *"9 inches wide;
  12 inches long; has one-half inch margins; and an 8" x 11" printing area"*.
  Ross's *Table of Sizes* (p. A-3) gives, as page → printing area:

  | size | page | printing area |
  |---|---|---|
  | concert | 9 × 12″ | 7½ × 11″ |
  | concert | 8½ × 11″ | 7½ × 10″ |
  | octavo | 6¾ × 10½″ | 5⅞ × 9½″ |
  | quick-step | 6¾ × 5¼″ | 5⅞ × 4¾″ |
  | hymn | 5¾ × 8¼″ | 4½ × 7¼″ |
  | oblong | 12 × 9″ | 10 × 7½″ |
  | oblong | 11 × 8½″ | 9¼ × 7½″ |

- **G&L p. 133 (PDF 68, right half)**:
  - *"Page numbers should be positioned **no closer than 1/4 inch** from the top (or bottom) of the
    page edge."*
  - *"The vertical page margins should be the same if at all possible."* (*Facing pages*)
- **Gould p. 488 (PDF 508)**: *"match the outer margins of the printed image across facing pages by
  lowering the top stave or raising the bottom stave slightly. This preserves a good-sized margin…
  no notation is forced to the extreme top or bottom of the page."*
- **Ross p. 61 (PDF 73)**: the first staff goes *"below the space allowed for titles, credits… (At the
  same time remember to leave room for leger line notes just above the top of the first staff.)"*

⇒ R9, the distance from the top margin to the first staff line, is a **residual of the ink** in
every book. No book gives a number (see also `vertical-spacing-research.md` §5).

### 2.4 R2, R4, R5, R6 — no book addresses them

- **R2**, a per-staff vertical allocation: the books size vertical space from the ink, never as a
  per-staff constant (`vertical-spacing-research.md` §2.3).
- **R4**, a cap on authored space: an editor safety limit. There is no engraving concept for it.
- **R5**, a formatter reserve: the book-side quantity is the last note → barline gap. That is a
  spacing-table row (`layout/spacingPadding.ts`, `docs/research/spacing-model-research.md`) and out of scope here.
- **R6**, a sketch canvas: by `layout-plan.md` §2 it has no physical size, so no book can speak to it.

⛔ Each is marked UNKNOWN for the books (§6), not "silent".

---

## 3. Engines

All three engine sources are on disk; their revisions are as recorded in `reference/README.md`.

### 3.1 MuseScore — `src/engraving/style/styledef.cpp`, 1 sp = 1.75 mm (`:797`)

| style | value | in sp | what it measures (layout code) |
|---|---|---|---|
| `pageWidth` / `pageHeight` (`:41-42`) | 210 × 297 mm (A4) | 120 × 169.7 | — |
| `pagePrintableWidth` (`:43`) | 180 mm | **102.86** | the line length |
| `page{Even,Odd}{Left,Top,Bottom}Margin` (`:44-49`) | 15 mm | **8.57** | — |
| `staffUpperBorder` (`:52`) | 7.0 sp | **7.0** | top margin → first system on the page (`rendering/score/pagelayout.cpp:193`) |
| `staffLowerBorder` (`:53`) | 7.0 sp | **7.0** | last system → bottom margin (`pagelayout.cpp:739-741`) |
| `minSystemDistance` (`:58`) | 8.5 sp | **8.5** | added below the bottom staff's box, whose height is the staff lines (`systemlayout.cpp:2238,2242`); the result is the max of this and the skyline clearance `sld` (`:2485, 2505-2511`) ⇒ **line-to-line, ink permitting** |
| `maxSystemDistance` (`:59`) | 15.0 sp | **15.0** | the stretch ceiling when filling a page (`layoutcontext.cpp:116-121`) |
| `enableVerticalSpread` (`:95`) | true | — | when on, `minSystemSpread` 8.5 (`:99`) and `maxSystemSpread` 32 (`:100`) replace the pair above |
| `maxPageFillSpread` (`:104`) | 6.0 sp | 6.0 | — |
| `minVerticalDistance` (`:794`) | 0.5 sp | 0.5 | the ink clearance inside `sld` |
| `systemFrameDistance` / `frameSystemDistance` (`:172-173`) | 7.0 sp | 7.0 | system ↔ a text frame (the header) |
| `minMeasureWidth` (`:176`) | 8.0 sp | **8.0** | a **floor** (`horizontalspacing.cpp:1020`). ⚠️ There is **no max**: grep of `src/engraving` for `maxMeasureWidth` finds nothing. |
| `lastSystemFillLimit` (`:319`) | 0.3 | ratio | the last system is justified only if it is at least 30% full (`systemlayout.cpp:491`) |
| per-measure `userStretch` clamp | [0.1, 10] | multiplier | `horizontalspacing.cpp:739`: *"TODO: enforce via UI, not here"* |
| `staffDistance` / `akkoladeDistance` (`:55,57`) | 6.5 sp | 6.5 | out of scope (the staff gap); ⭐ the same 6.5 as ours |

### 3.2 LilyPond — `ly/paper-defaults-init.ly`; A4 default (`scm/lily.scm:391`)

**Unit.** A 20 pt staff, so 1 sp = 5 pt = **1.7573 mm**. The comment at `:36` says *"5 pt = 1.75 mm"*;
`output-scale` at `:37` is 1.7573.

**Reference point.** Vertical distances run between **the middle line of each staff**
(`Documentation/en/notation/spacing.itely:2148-2150`). For five-line staves, a line-to-line gap is
therefore the stated distance **− 4 sp**.

| variable | value | in sp | line-to-line |
|---|---|---|---|
| `system-system-spacing` (`:62-65`) | basic 12, minimum 8, padding 1, stretchability 60 | basic **12** / minimum **8** (middle → middle) | basic **8** / minimum **4**; padding 1 sp is an ink clearance |
| `score-system-spacing` (`:66-69`) | basic 14, minimum 8 | 14 / 8 | 10 / 4 (between separate `\score`s) |
| `top-system-spacing` (`:78-80`) | basic 6, minimum 0, padding 1 | 6 (top margin → middle line) | ⇒ top line **4 sp** below the top margin |
| `last-bottom-spacing` (`:84-87`) | basic 1, padding 1, stretchability 30 | 1 (middle line → bottom margin) | the ink-driven padding decides |
| `top-margin-default` / `bottom-margin-default` (`:53-54`) | 10 mm | **5.69** | — |
| `left-margin-default` / `right-margin-default` (`:93-94`) | 15 mm | **8.54** | line-width = 180 mm = **102.43 sp** |
| `indent-default` (`:110`) | 15 mm | 8.54 | the first system's indent (not a row here) |
| `default-staff-staff-spacing` (`scm/define-grobs.scm:4245-4247`) | basic 9, minimum 8, padding 1 | — | 5 / 4 — out of scope, context only |
| a maximum measure width | — | — | ⛔ none found: grep of `define-grobs.scm` and `paper-defaults-init.ly` for `measure-width` / `max…width` |

### 3.3 Verovio — `src/options.cpp`; `unit` = ½ sp (`:1203`, `DEFAULT_UNIT 9.0`, `include/vrv/vrvdef.h:455`)

`GetDrawingUnit(100)` = `unit` (`src/doc.cpp:2027-2030`), so **1 sp = 18 page units**. Page sizes are
in the same units, so every ratio below is exact whatever Verovio's physical size is (UNKNOWN, §6).

| option | value | in sp | what it measures |
|---|---|---|---|
| `pageWidth` / `pageHeight` (`:1100, 1120`) | 2100 / 2970 | 116.67 × 165.0 | — |
| `pageMargin{Top,Bottom,Left,Right}` (`:1104-1117`) | 50 | **2.78** | content width 2000 = **111.11 sp** |
| `spacingSystem` (`:1525`) | 4 MEI units | **2.0** | *"The system minimal spacing"*; added between successive systems' aligners (`src/page.cpp:606`, `src/alignfunctor.cpp:856`) with a floor of `2 × unit` = **1.0 sp**. ⚠️ Whether this is line-to-line or overflow-to-overflow was **not traced** — see §6. |
| `spacingStaff` (`:1521`) | 12 MEI units | 6.0 | *"staff minimal spacing"* (`src/verticalaligner.cpp:578-590`) — out of scope, context only |
| `minLastJustification` (`:1057`) | 0.8 | ratio | the last system is justified above 80% full |
| a maximum measure width | — | — | ⛔ none found: grep of `src/` and `include/` |

### 3.4 VexFlow 5.0.0 — `node_modules/vexflow/build/esm/src`

⚠️ 2026-09-19: VexFlow is no longer installed; the same build is kept at
`~/dev/engine-sources/vexflow-5.0.0-npm/package`, and these line numbers still hold there.

| item | value | in sp | file:line |
|---|---|---|---|
| `spaceAboveStaffLn` / `spaceBelowStaffLn` default | 4 / 4 | 4 / 4 | `stave.js:51` |
| stave line y | `y + (line + headroom) × spacing` | the top line sits **4 sp** below `stave.y` | `stave.js:194-198` |
| `getBottomY` | line 5 + `spaceBelowStaffLn` | ⇒ above + lines + below = 4 + 4 + 4 = **12 sp** | `stave.js:186-190` |
| `Stave.padding` / `endPaddingMax` / `endPaddingMin` | 12 / 10 / 5 px | 1.2 / 1.0 / 0.5 | `metrics.js:132-134` |
| `Stave.defaultPadding` = padding + endPaddingMax | 22 px | **2.2** | `stave.js:33-35` |
| `Stave.rightPadding` = endPaddingMax | 10 px | **1.0** | `stave.js:36-38` |
| `Formatter.formatToStave` justify width | `noteEndX − noteStartX − Stave.defaultPadding` | reserves **2.2 sp** | `formatter.js:603` |

---

## 4. What this repo draws today

| row | what it actually does | file:line | decided? |
|---|---|---|---|
| R1 | A one-staff system = 4 sp of lines + **11 sp** to the next system's top line (`systemStaffTops`) | `layout/staffStride.ts:221` | T — *"still arbitrary"* (`:105-106`) |
| R2 | ⚠️ **No longer the stride.** It is read in only four places. **(a)** The cull-window box (`rendering/ScoreRenderer.ts:4093`). **(b)** The height of a measure's and a system's highlight box (`MusicEngine.ts:6301, 6318`). **(c)** `VIEWPORT_HEIGHT` = 3.5 × (12 + `VERTICAL_SPACING` 3) + 40 px (`rendering/layoutConfig.ts:153-155`). **(d)** The export's initial SVG size, which the render overwrites (`export/scoreSvg.ts:72`). Its 12 sp equals VexFlow's default stave box, 4 above + 4 lines + 4 below (§3.4). No comment says it came from there. | `rendering/layoutConfig.ts:125` | T |
| R3 | `min(max(natural, MIN + signRoom), MAX + signRoom)`, then max'ed with the incompressible floor | `rendering/MeasureLayout.ts:326-333` | T (the cap); the floor-over-cap was reported by him (`bar-width-plan.md`) |
| R4 | The authored leading space on a line is scaled down once it exceeds 0.6 × the available width. The stretch pool is not capped. | `rendering/MeasureLayout.ts:547` | T; the uncapping was reported from use (`bar-width-plan.md` §3) |
| R5 | `formatWidth = max(noteAreaWidth − 15 − userSpacePx, 50)` feeds `formatter.format`. ⚠️ Then `applySpacingPass` **overwrites every tick x** from `room`, which contains **no 15 px term** (`:2202-2203`). The 15 px decides placement only when that pass returns `null`: fewer than 2 columns, no contexts, or a bad meter (`rendering/format/spacingPass.ts:114-125`). It came from commit `4e4295b` (2025-12-19), *"Padding before barline"*, with no source. | `rendering/ScoreRenderer.ts:2180` | T |
| R5′ | The same 15 px and 50 px, but **without** subtracting user space, and with a separate `staveWidth − 100` fallback when the note area is ≤ 0. Nothing ties it to R5. | `rendering/ghosts/GhostRenderer.ts:272-273` | T |
| R6 | `{ kind: 'canvas', widthPx: 1000, marginPx: 20 }`: 100 sp wide, 2 sp on every side, 96 sp of content. It is the non-layout surface in `PaletteController.ts:307`. | `layout/surface.ts:104` | T (called *"historical"*) |
| R7 | A4 with 15 mm on every side. At 1.75 mm/sp that is a 120 × 169.7 sp page, 8.57 sp margins and 102.86 sp of content (1028.6 px). It is the app's default surface (`App.ts:716`). | `layout/surface.ts:107-113` | sourced (§1) |
| R8 | `PX_PER_MM = STAFF_SPACE_PX / 1.75` | `layout/surface.ts:73, 94` | S (MuseScore `spatium`) |
| R9 | A system's top is placed at `marginTopPx + used` (`layout/pageCastOff.ts:78`). The stave is a default-option `EngravedStave` (`rendering/ScoreRenderer.ts:2566`), so its top line sits VexFlow's **4 sp** of headroom below that (plus the first page's header head). | as listed | inherited from VexFlow, never chosen |

---

## 5. ⭐ Preset rows

Each row gives a value in sp, what it measures, and its citation. The first row of each table is
today's number, which stays the default.

### R1 — system → system (bottom staff line → next top staff line)

| preset | sp | what it measures | citation |
|---|---|---|---|
| **today (default)** | **11** | line → line, a constant | `layout/staffStride.ts:108` |
| MuseScore minimum | 8.5 | line → line, max'ed with skyline clearance (0.5 sp) | `styledef.cpp:58`; `systemlayout.cpp:2485-2511` |
| MuseScore page-fill ceiling | 15 (32 with vertical spread) | stretch limit | `styledef.cpp:59, 100` |
| LilyPond basic | 8 | line → line (12 middle → middle), + 1 sp ink padding, stretchable | `paper-defaults-init.ly:62-65`; `spacing.itely:2148-2150` |
| LilyPond minimum | 4 | line → line (8 middle → middle) | same |
| Verovio minimum | 2 (floor 1) | ⚠️ between system aligners; reference not traced | `options.cpp:1525`; `alignfunctor.cpp:856` |
| Gould, drawn without comment | 7.95 | line → line, one `p` in the gap | p. 489 (PDF 509); `vertical-spacing-research.md` §3.2, re-measured §2.1 |
| Gould, drawn as *"not acceptable"* | 8.25 | line → line, a gap crowded with ink | p. 558 (PDF 578); `vertical-spacing-research.md` §3.2 |
| books' ordering (a constraint, not a value) | > the widest staff gap of the adjacent system (today 6.5) | relation | Gould p. 488; G&L pp. 132–133 |

### R2 — a staff's vertical box (non-stride uses only: cull, highlight, viewport)

| preset | sp | what it measures | citation |
|---|---|---|---|
| **today (default)** | **12** | box height | `rendering/layoutConfig.ts:125` |
| VexFlow default stave box | 12 (4 above + 4 lines + 4 below) | `stave.y` → `getBottomY` | `stave.js:51, 186-198` |
| the five lines only | 4 | top line → bottom line | Ross p. 64; `layout/staffStride.ts:39` (`STAFF_LINES_SPACES`) |
| MuseScore border around a page's staves | 7 above / 7 below | page margin ↔ staff, not a per-staff box | `styledef.cpp:52-53` |

### R3 — the maximum width of one bar

| preset | sp | what it measures | citation |
|---|---|---|---|
| **today (default)** | **40** | a cap on the natural width, under the incompressible floor | `rendering/layoutConfig.ts:100`; `MeasureLayout.ts:326-333` |
| no cap | ∞ | — | MuseScore (only a floor, `minMeasureWidth` 8 sp, `styledef.cpp:176`); LilyPond and Verovio: none found (§3.2, §3.3) |
| Gould's measured full bar | 18.7–20.5 (≈19% of a 105.9 sp line) | barline → barline, 8 quavers, 5 bars per system | Gould p. 489 (PDF 509), measured §2.1 — ⛔ a data point, not a stated cap |
| books' rule (qualitative) | — | split an over-spaced single bar; balance symbols between systems | Gould pp. 489, 41; Ross p. 60 (1); G&L p. 132 |

### R4 — the share of a line that authored leading space may claim

| preset | value | what it measures | citation |
|---|---|---|---|
| **today (default)** | **0.6** | Σ authored gaps ÷ available line width | `rendering/MeasureLayout.ts:514` |
| MuseScore per-measure stretch | [0.1, 10] × | a different quantity: a multiplier per bar | `horizontalspacing.cpp:739` |
| books, LilyPond, Verovio | UNKNOWN | — | §6 |

### R5 / R5′ — the formatter's right-hand reserve before the barline

| preset | sp | what it measures | citation |
|---|---|---|---|
| **today (default)** | **1.5** (15 px fixed at 10 px/sp) | subtracted from VexFlow's format width (⚠️ 2026-09-19: ours now, `rendering/format/columnFormat`); ⚠️ moves pixels only when `applySpacingPass` returns `null` | `rendering/ScoreRenderer.ts:2180`; `GhostRenderer.ts:272` |
| VexFlow `formatToStave` | 2.2 | `Stave.defaultPadding` = padding 1.2 + endPaddingMax 1.0 | `formatter.js:603`; `stave.js:33-35`; `metrics.js:132-133` |
| VexFlow `Stave.rightPadding` | 1.0 | `endPaddingMax` alone | `stave.js:36-38`; `metrics.js:133` |
| VexFlow minimum end padding | 0.5 | `endPaddingMin` | `metrics.js:134`; `formatter.js:424` |
| 0 | 0 | the spacing model's `room` (it already carries the run-out row) | `ScoreRenderer.ts:2202-2203`; the rows in `layout/spacingPadding.ts` |
| the ghost's floor / fallback | 5 sp (50 px) / `staveWidth − 10 sp` | a clamp, not a gap | `GhostRenderer.ts:273` |

### R6 — the sketch canvas (no physical size, `layout-plan.md` §2)

| preset | width / margin (sp) | citation |
|---|---|---|
| **today (default)** | **100 / 2** (96 of content) | `layout/surface.ts:104` |
| line length on A4, MuseScore | content 102.86 | `styledef.cpp:43` |
| line length on A4, LilyPond | content 102.43 | `paper-defaults-init.ly:93-94` |
| line length, Verovio default page | content 111.11 / margin 2.78 | `options.cpp:1104-1121` |
| Gould's printed line (a violin part) | 105.9 | p. 489 (PDF 509), measured §2.1 |

⚠️ These are page line lengths, offered only as widths to wrap at. ⛔ The canvas must not acquire
millimetres (`layout-plan.md` §2).

### R7 — page margins (A4)

| preset | T / B / L / R | citation |
|---|---|---|
| **today (default)** | **15 / 15 / 15 / 15 mm = 8.57 sp** | `layout/surface.ts:111` |
| Gould minimum | ≥ 15 mm (or ½″) on all borders, more at a binding edge | p. 481 (PDF 501); `vertical-spacing-research.md` §2.6 |
| Ross minimum | ≥ ½″ = 12.7 mm (7.26 sp) on all sides | p. A-3 (PDF 225) |
| MuseScore | 15 mm on every side (8.57 sp) | `styledef.cpp:44-49` |
| LilyPond | 10 / 10 / 15 / 15 mm (5.69 / 5.69 / 8.54 / 8.54 sp) | `paper-defaults-init.ly:53-54, 93-94` |
| Verovio | 2.78 sp on every side (unit-free) | `options.cpp:1104-1117` |
| page-number inset | ≥ ¼″ from the page edge | G&L p. 133 (PDF 68) |

### R8 — staff size on the page (mm per sp)

| preset | mm/sp | citation |
|---|---|---|
| **today (default)** | **1.75** (a 7 mm staff) | `layout/surface.ts:73`; MuseScore `styledef.cpp:797` |
| LilyPond 20 pt | 1.7573 | `paper-defaults-init.ly:36-37` |
| Gould "ideal" (6.7 mm) | 1.675 | p. 557; `vertical-spacing-research.md` §1 |
| Gould rastral 8, full score (3.7 mm) | 0.925 | p. 483 Table 2; same doc §1 |
| (every other rastral) | see Table 2 | Gould pp. 482–483 (PDF 502–503) |

### R9 — top margin → first staff's top line

| preset | sp | citation |
|---|---|---|
| **today (default)** | **4** (VexFlow headroom) | `layout/pageCastOff.ts:78`; `ScoreRenderer.ts:2566`; `stave.js:51, 194-198` |
| MuseScore | 7 | `styledef.cpp:52`; `pagelayout.cpp:193` |
| LilyPond | 4 basic (6 to the middle line), + 1 sp ink padding | `paper-defaults-init.ly:78-80` |
| books | residual of the ink: *"leave room for leger line notes"* | Ross p. 61; Gould p. 488 |

Bottom counterpart: MuseScore 7 sp (`styledef.cpp:53`); LilyPond `last-bottom-spacing` 1 sp from
the middle line + padding 1 (`:84-87`).

---

## 6. ⛔ UNKNOWN — with the routes checked

- **R1, as a number from a book.** Already UNKNOWN in `vertical-spacing-research.md` §5 (routes listed
  there). This pass re-read Gould pp. 488–489 and G&L pp. 132–133 and found no number.
- **R2, a per-staff vertical allocation in any book.** The books size vertical space from the ink
  (§2.4). There is no source for 12 sp beyond VexFlow's default box.
- **R3, a maximum bar width in any book or engine.**
  - Gould pp. 41, 489; Ross p. 60 *Casting off*; G&L p. 132: qualitative only.
  - MuseScore `src/engraving`, Verovio `src/` + `include/`, LilyPond `define-grobs.scm` +
    `paper-defaults-init.ly`: grep found no max-width setting.
- **R4, a cap on authored space.** No book covers it. LilyPond and Verovio: no equivalent found.
  MuseScore's per-bar multiplier is a different quantity.
- **R5, the origin of 15 px.** Commit `4e4295b` states no reason beyond *"Padding before barline"*. It
  matches neither VexFlow constant (2.2 or 1.0 sp).
- **R6, a book or engine figure for a canvas with no paper.** ⛔ Unanswerable by design
  (`layout-plan.md` §2).
- **R9 and its bottom counterpart, as a number from a book.** It is a residual (Ross p. 61, Gould p. 488).
- **Verovio's physical page size.** Its unit is not stated in `options.cpp`; `doc/importer.svg` only
  shows 2100 px with a 21000 viewBox. Every Verovio figure above is given as a unit-free sp ratio.
- **Verovio `spacingSystem`: what it measures between.** Its value is added between system aligners
  (`alignfunctor.cpp:856`). Whether the aligner's bottom includes below-staff overflow was **not
  traced** (`verticalaligner.cpp`), so line-to-line is unconfirmed.
- **Stone.** Already recorded as contributing nothing to layout (`vertical-spacing-research.md` §5).
  Not re-checked.

### Corrections to existing docs and code comments

Found in passing. ⛔ Nothing was edited.

1. `vertical-spacing-research.md` §2.6 cites **Ross p. A-2** for *"at least one-half inch on all
   sides"*. The scan puts it on **p. A-3 (PDF 225)**.
2. The same doc cites **G&L p. 133** for *"More space should be provided between systems"*. It begins
   on **p. 132** (PDF 68 is the spread 132 | 133).
3. `layout/staffStride.ts:105` says **"11 > 5"**. The staff gap is 6.5 now (`:94`). The ordering still
   holds (11 > 6.5), but the figure is stale. Also, `:46` still reads *"**5**, and here is where it
   comes from"* above the 6.5 constant.
4. `layout/staffStride.ts:15-16` calls `STAVE_HEIGHT` *"the room one staff's own ink occupies"*, and
   `rendering/ScoreRenderer.ts:3607-3608` calls it *"the per-line vertical allocation (staff + gap
   to the next system)"*. Neither is what it does any more (§4, R2).
5. `rendering/layoutConfig.ts:126-128` still describes `VERTICAL_SPACING` 3 sp as *"the clearance
   below a staff, to the next one"*. Its only reader is `VIEWPORT_HEIGHT` (`:154`). The comment at
   `:150` calls `STAVE_HEIGHT + VERTICAL_SPACING` *"the per-line content height"*; the real one-staff
   stride is 4 + 11 = 15 sp. The two sums agree by coincidence.
6. `note-spacing-plan.md` §4 cites `ScoreRenderer.ts:1053` for `formatWidth`; it is now `:2180`.
   ⚠️ And since spacing-model P4, `applySpacingPass` makes the 15 px moot wherever it succeeds (§4, R5).
