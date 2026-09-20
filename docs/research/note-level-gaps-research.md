# Small note-level gaps inherited from VexFlow — the sourced alternatives (2026-09-14)

Research only: it recommends no value and changes no code. Every number here is a future
**house-style preset**; the value running today stays the default. Units: **sp** = staff spaces;
**px @10** = a pixel literal at the 10 px staff space. "box" = measured between bounding boxes,
"ink" = between drawn ink, "advance" = from a glyph origin.

## 0. The question, and the rows covered

For each number below: what it measures, where VexFlow's version came from, and what the books and
the three engines give for the same quantity. Rows are from `docs/research/engraving-number-inventory.md`
§2 and §5b, batch 5 of §6.

| # | number | today | file:line |
|---|---|---|---|
| 1 | `FAN_ACCIDENTAL_GAP` | 2 px @10 = 0.2 sp | `src/engine/rendering/beams/FanPass.ts:123` |
| 2 | `CROSS_SYSTEM_BEAM_STUB_LINE_START` / `…LINE_END` / `CROSS_SYSTEM_BEAM_MARGIN` | 12 / 22 / 10 px @10 = 1.2 / 2.2 / 1.0 sp | `src/engine/rendering/beams/beamInk.ts:36-38` |
| 3 | `KERN_CLEARANCE` | 0.35 sp | `src/engine/layout/kerning.ts:88` |
| 4 | `pairPadding` note↔note (the fall-through) | 0.3 sp | `src/engine/layout/spacingPadding.ts:420` |
| 5 | `pairPadding` dot→next | 0.5 sp | `src/engine/layout/spacingPadding.ts:415` |
| 6 | `INK.firstDot` / `INK.dotStep` | 1.7 / 0.9 sp | `src/engine/layout/spacingPadding.ts:98,100` |
| 7 | `BETWEEN_PARTS` | 1.0 sp | `src/engine/layout/headerInk.ts:243` |
| 8 | meter `lineShift` | ±½ line | VexFlow `timesignature.js:82`; folded in at `src/engine/rendering/engraved/EngravedTimeSignature.ts:127,134` |

⛔ **Out of scope, and covered elsewhere:**
- ledger overhang beside an accidental or under a rest, `LEDGER_ACCIDENTAL_GAP`, and the ghost's
  3 px (`ledgerAccidentalClearance.ts`, `docs/research/ledger-line-length-research.md`);
- a rest tucking under an accidental (`docs/research/rest-accidental-kerning-research.md`);
- the dot and accidental gap tables (`layout/dotGap.ts`, `layout/accidentalGap.ts`).

## 1. Sources

- **Books** (`reference/README.md`):
  - Gould *Behind Bars*. PDF page = printed page + 20. Printed p. 41 was rendered at 450 dpi and read
    from the scan.
  - Ross, Stone, Gerou & Lusk: full-text greps only.
  - Earlier findings are cited, not repeated: `docs/research/accidental-dot-research.md` §4,
    `docs/research/accidental-dot-engines.md` §2.4/§3/§4, `docs/research/spacing-model-research.md` §1d/§3,
    `docs/research/header-spacing-research.md` §2.8/§4.2/§4.4, `docs/plans/cross-barline-beaming-plan.md`,
    `docs/research/beam-hook-research.md` §8.
- **Engines** (`~/dev/engine-sources`), read but not built or run:
  - MuseScore 4: `src/engraving/...`
  - LilyPond: `scm/`, `lily/`
  - Verovio: one MEI unit = ½ sp. `m_unit` 9 × `DEFINITION_FACTOR` 10 = 90 drawing units per unit
    (`include/vrv/vrvdef.h:453,455`, `src/options.cpp:1203`).
- **VexFlow 5.0.0**: `node_modules/vexflow/build/esm/src/` (⚠️ 2026-09-19: the package is removed —
  the same build is kept at `~/dev/engine-sources/vexflow-5.0.0-npm/package/build/esm/src/`).

## 2. Books

| question | source | answer |
|---|---|---|
| ⭐ the least white between two characters | **Gould p. 41** (PDF 61), *Spacing symbols*, read on the scan | *"Where space is limited, the distance between characters should not be less than ½ stave-space and no characters should collide."* It names **no pair**, so it covers note↔note, dot→note and clef→note alike. Also quoted in `spacing-model-research.md` §1d. |
| cramped music | Gould p. 43 (via `spacing-model-research.md` §1d) | *"reduce the space around clefs and accidentals to ½ space"* |
| after a clef, mid-system | Gould p. 42 (verified verbatim on the scan, `reference/README.md` §clef/meter) | *"Allow a stave-space after a clef and on either side of a barline before a notational symbol."* |
| a clef change before a barline | Stone p. 46 (`reference/README.md`) | *"about one staff-line space before the barline"* |
| the row placement of a time signature | Gould p. 152 (`header-spacing-research.md` §2.8) | *"Time-signature numerals should exactly fill the height of the stave."* No size-dependent shift is mentioned. |
| a beam's open end at a SYSTEM break | Gould, Ross, Stone, Gerou & Lusk: full-text search for *beam* within ±3 lines of *system / next line / line break* | ⛔ **UNKNOWN.** No hit is about a beam crossing a system break. The nearest are Gould's tremolo "beamed mid-system" (between staves) and her cross-staff beams. Plates were not browsed page by page. |
| vertical clearance before two inks may interleave | all four | ⛔ **UNKNOWN.** Gould p. 41's *"no characters should collide"* is the only related statement, and it gives no number. |
| accidental → notehead; column → column | `accidental-dot-research.md` §4 A1/A4 | already sourced: Gould's plate 0.19–0.38 sp, Ross 0.54 sp |

## 3. Engines, including VexFlow's own value

### 3.1 `FAN_ACCIDENTAL_GAP` — accidental ↔ head, and column ↔ column

- **VexFlow (the origin).** VexFlow has no single 2 px gap:
  - accidental → head is **3 px = 0.30 sp**: the `x = -1 * 2` literal (`stavenote.js:528`) plus
    `Accidental.noteheadAccidentalPadding: 1` (`metrics.js:74`);
  - column → column is `accidentalSpacing: 3` px = 0.30 sp (`metrics.js:76`).
  - The fan's 2 px equals the 2 px literal alone. Whether it was copied from there is ⛔ **UNKNOWN**:
    its comment says only "PROVISIONAL".
- **The other engines**: already tabled in `accidental-dot-engines.md` §3 A1/A4.
  - A1 (accidental → head): LilyPond 0.35 (skyline) · MuseScore 0.25 (cut-outs) · Verovio 0.25
    (0.395 over ledger lines).
  - A4 (column → column): LilyPond 0.2 · MuseScore 0.25 · Verovio 0.165.

### 3.2 A beam's ends at a system break

- **VexFlow**: draws no beam across a system break. `partialBeamLength: 10` (`beam.js:323`) is the
  *fractional* beam's length. That is a different quantity (`beam-hook-research.md` §8 A), and the
  code comment only calls it "the honest floor".
- **LilyPond** (`lily/beam.cc:533-534`, `:590-599`).
  - `break-overshoot` defaults to `Drul_array {-0.5, 0.0}`, and the `Beam` grob does not override it
    (`scm/define-grobs.scm:467` onward).
  - At a broken bound the open end is placed at `bound_extent[RIGHT] + event_dir * overshoot`:
    - **line end**: the break column's right edge + **0.0 sp**, i.e. flush with the barline column;
    - **line start**: the prefatory column's right edge + (−1)(−0.5) = **+0.5 sp** past the header.
  - The `Beam` grob sets no `breakable`. Whether that stops a beam crossing a line break by default
    was not traced.
- **Verovio** (`src/beam.cpp:1770-1806`).
  - **Line end** (`SPANNING_START` / `MIDDLE`): the beam is stretched to the **right barline's
    x**, 0 overshoot, continuing its slope.
  - **Line start** (`SPANNING_END` / `MIDDLE`): it starts **half the mean note-to-note distance**
    before the first note, `(back.x − front.x) / (2(n−1))`.
  - A one-note fragment gets a hardcoded **270** drawing units = 3 units = **1.5 sp**. The comment
    there says *"1.5 * unit"*, which would be 0.75 sp: the value and the comment disagree.
- **MuseScore** (`rendering/score/beamlayout.cpp:74-110`): splits the beam per system and passes a
  `SpannerSegmentType` (BEGIN / MIDDLE / END) to `layout2`. But `layout2` leaves that parameter
  **unnamed**, i.e. unused (`:304`). No extension at the break was found. Whether anything else
  extends it: ⛔ UNKNOWN.

### 3.3 `KERN_CLEARANCE` — vertical white before two inks count as sharing a band

- **VexFlow**: no kerning at all. Neither `skyline` nor `kern` occurs anywhere in `build/esm/src`, so
  VexFlow has no value to inherit.
- **MuseScore**: `computeVerticalClearance` gives **0.1 sp** when the right-hand item is an
  **accidental** (or either is a parenthesis), and **0.2 sp** otherwise
  (`horizontalspacing.cpp:1650-1660`).
  - It is applied through `intersects(a, b, c, d, clearance)` = `(b + k > c) && (a < d + k)`
    (`infrastructure/shape.h:198-203`) and scaled by `squeezeFactor`
    (`horizontalspacing.cpp:1242-1243`). This is the same test shape as ours
    (`kerning.ts:131-134`).
- **LilyPond**: `skyline-vertical-padding` **0.15** on `NoteColumn` (`define-grobs.scm:2579`) and
  **0.08** on `PaperColumn` (`:2751`). The padding is baked into the horizontal skylines
  (`lily/separation-item.cc:105-109`), so it pads skylines, not boxes.
- **Verovio**: `BoundingBox::VerticalContentOverlap(other, margin)` exists
  (`src/boundingbox.cpp:203`), but the margin the spacing pass hands it was not traced ⇒ ⛔ UNKNOWN.

### 3.4 note↔note — the least white between adjacent note columns

- **VexFlow**: `TickContext.padding = 1` px on each side (`tickcontext.js:20`; `getWidth()` returns
  `width + padding*2`, `:67`). `Formatter.preFormat` lays contexts end to end at that width
  (`formatter.js:318-331`) ⇒ **0.2 sp** box to box before justification.
  (`NoteHead.minPadding: 2`, `metrics.js:106`, is read only by annotations and chord symbols.)
- **MuseScore**: `table[NOTE][NOTE]` = `minPadUnit` **0.1 sp** (`paddingtable.cpp:44,55`), with the
  comment *"we don't set note-note padding to minNoteDistance because there are cases when they
  should be allowed to get closer"* (`:52-54`). It is raised to `minNoteDistance` **0.35 sp**
  (`styledef.cpp:264`) when the two shapes intersect and are the same voice or adjacent by duration
  (`horizontalspacing.cpp:1491-1502`). Measured between shapes.
- **LilyPond**: every element's skyline is widened by `extra-spacing-width` defaulting to
  **(−0.1 . 0.1)** (`lily/separation-item.cc:166-167`) ⇒ 0.2 sp. `Separation_item::set_distance`
  then adds a `padding` (`spacing-spanner.cc:274`, `separation-item.cc:56`) whose value was not
  traced ⇒ the total is ⛔ UNKNOWN.
- **Verovio**: `leftMarginNote` **1.0** unit (`options.cpp:1748-1750`, also used for `STEM`,
  `doc.cpp:2162`) + `rightMarginNote` **0.0** (`options.cpp:1818-1820`), summed per overlap
  (`adjustxposfunctor.cpp:352-357`) ⇒ **0.5 sp**.

### 3.5 dot → next note

- **VexFlow**: dots sit inside the note's right modifier width, so the next context is again
  **0.2 sp** away (§3.4).
- **MuseScore**: `table[NOTEDOT][NOTE]` = `max(dotNoteDistance 0.5, dotDotDistance 0.65)` =
  **0.65 sp** (`paddingtable.cpp:94-95`; `styledef.cpp:304,306`).
  - The table is indexed `[left item][right item]` (`horizontalspacing.cpp:1455-1459`), so this row
    **is** dot → following note.
  - Neighbouring rows: `NOTEDOT→ACCIDENTAL` 0.35 (`:98`), `NOTEDOT→REST` = the note row (`:99`).
- **LilyPond**: `Dots` `extra-spacing-width (0.0 . 0.2)` (`define-grobs.scm:1279`) ⇒ **0.2 sp**
  past the dot, plus the untraced `padding`.
- **Verovio**: dots have no margin option, so they fall to `defaultRightMargin` **0.0**
  (`options.cpp:1669`, `doc.cpp:2202`). Adding the next note's left margin gives **0.5 sp**.

### 3.6 `BETWEEN_PARTS` — what VexFlow put there

- VexFlow's `StaveModifier.padding = 10` px = **1.0 sp** (`stavemodifier.js:22`), returned as **0**
  for slot index < 2 (`:42-43`).
- `TimeSignature` `customPadding = 15` px (`timesignature.js:17,28`). That is why the clef → meter
  gap was *drawn* at 1.42 sp (`header-spacing-research.md` §4.4). `BETWEEN_PARTS` is a measurement of
  that drawing, reconciled with LilyPond's `Clef.space-alist (time-signature . 1.52)` (§4.2).
- Engine values for what `BETWEEN_PARTS` still prices:
  - after a clef: Verovio `rightMarginClef` 1.0 unit = **0.5 sp** (`options.cpp:1782-1784`);
  - before a clef: MuseScore `table[NOTE][CLEF]` **0.8 sp** (`paddingtable.cpp:60`), and
    `table[NOTEDOT][CLEF]` 1.0 (`:100`).

### 3.7 meter `lineShift`

- **VexFlow**: `this.lineShift = height > 30 ? 0.5 : 0` (`timesignature.js:82`). `height` is the
  taller row's `actualBoundingBoxAscent + Descent` (`element.js:347-348`). It moves the upper row
  **up** and the lower row **down** by half a line (`:136`, `:141`), spreading the two baselines from
  2 sp to 3 sp.
  - ⭐ **It cannot fire with Bravura at our size.** A `timeSig` digit's ink is 1.004 sp up and
    1.0 sp down (`src/engine/fonts/bravuraMetrics.ts:158-159`) ≈ 2.0 sp = **20 px** at the 10 px
    space, and 20 < 30 ⇒ `lineShift = 0`. This is arithmetic, not a browser measurement.
  - Why 30 px: ⛔ UNKNOWN. VexFlow's repository history is not on disk.
- **Verovio**: fixed baselines **±1 sp** about the middle line (`view_element.cpp:2139-2140`,
  `y ± GetDrawingDoubleUnit`), with no size switch.
- **MuseScore**: each row is placed from its **own bbox height** plus `timeSigNormalNumDist` **0.0**
  (`tlayout.cpp:6297`, `:6359-6360`; `styledef.cpp:243`). A taller glyph therefore moves outward by
  half its extra height: a continuous analogue of `lineShift`.
- **LilyPond**: 2.0 sp between the rows (`header-spacing-research.md` §2.8, row H). Behaviour for an
  oversize glyph was not traced. (`compound-meter`'s `baseline-skip 4.5`,
  `scm/time-signature-settings.scm:679`, belongs to that markup command, not the default glyph path.)

## 4. What this repo draws today

1. **`FAN_ACCIDENTAL_GAP` 0.2 sp, box to box, used for three things**
   (`chordAccidentalColumns.ts:99-103`):
   - the white between the nearest column and the chord's left edge (`right = chordLeftX − gap`);
   - the white between columns (`right −= width + gap`);
   - the `standoff` handed to `ledgerAccidentalClearance` (`FanPass.ts:156`).

   It applies only to fan members k ≥ 1 (`FanPass.ts:514,721`). ⚠️ **Member 0 is a real VexFlow note
   (⚠️ since 2026-09-19 our `EngravedNote`, VexFlow's rule transcribed)
   and gets 0.30 plus the armed `accidentalGap` row**, so one fanned chord carries two standoffs.
2. **Cross-system stubs**, from the stem x, not from ink (`ScoreRenderer.ts:3141-3148`):
   - line start: `startX − 1.2 sp`;
   - line end: `max(barlineX, startX) + 1.0 sp`;
   - line end, when the bar's bounds are unknown: `startX + 2.2 sp`.
3. **`KERN_CLEARANCE` 0.35**: two boxes on one staff share a band unless separated vertically by more
   than 0.35 sp (`kerning.ts:131-134`). Kerning is allowed only into a right-hand accidental
   (`MAY_KERN`, `:103-111`).
4. **note↔note 0.3**, box to box on the `INK` extents. With `INK.notehead` 1.13 this gives a 1.43 sp
   floor (`spacingPadding.ts:370-374`). `spacing-model-plan.md` §1.1 had predicted "~0.25".
5. **dot→next 0.5**, box to box. ⚠️ It precedes the `right === 'accidental'` row, so dot → accidental
   is also 0.5 (`spacingPadding.ts:415-416`).
6. **`INK.firstDot` / `dotStep` are ADVANCES, and they are the same quantity as the dot gap table.**
   `firstDot` = head ink + head→dot gap (1.18 + 0.5 = 1.68 ≈ 1.7). `dotStep` = `dotWidth` 0.4 +
   dot→dot gap 0.5 = 0.9. Together they are the `house` row of `layout/dotGap.ts` restated as
   advances. **Its presets are that table's rows** — stopping there, as the brief says.
   - ⚠️ `dotExtent()` (`spacingPadding.ts:353-356`, used by `measureColumns.ts:152`) reads the two
     constants, **not** `armedDotGap()`. The ink does read the armed row (`dotPlacement.ts:76,92`).
   - Compare `accidentalExtent`, which applies the armed row's delta (`spacingPadding.ts:345-346`).
     Arming a non-`house` dot row would therefore move the dots without moving this reservation.
     This is by reading the code; no test was run.
7. **`BETWEEN_PARTS` 1.0, box to box.**
   - ✅ Its clef → meter use is **DECIDED**: replaced by the `clefMeterGap` table
     (`headerInk.ts:268-289`, `layout/clefMeterGap.ts`).
   - It still prices a mid-bar clef change, `CLEF_SMALL + 1.0` (`headerInk.ts:249-251`, consumed at
     `MeasureLayout.ts:232`).
   - It still prices every cautionary clef, key and meter, extent + 1.0 (`headerInk.ts:325-331`,
     consumed at `MeasureLayout.ts:775-782,830`).
   - Which side of the sign the 1.0 stands on in the *drawing* was not traced.
   - Related decided rows: `CAUTIONARY_KEY_TO_LINE_END` 0.75 (his choice, `cautionaryKey.ts:105`) and
     the mid-line barline → meter table, armed at 0.75 (`layout/barlineMeterGap.ts`).
8. **`lineShift`**: VexFlow's rule, folded into the ys (`EngravedTimeSignature.ts:124-134`); 0 on
   Bravura (§3.7). The row gap it modulates is ⛔ UNKNOWN in the books
   (`header-spacing-research.md` §2.8 row H).

## 5. ⭐ Preset rows

Each row: value · what it measures · citation. **house** = today's default.

### 5.1 Fan member: accidental ↔ head, and column ↔ column

| row | value (sp) | measures | citation |
|---|---|---|---|
| **house** | 0.2 / 0.2 | box | `FanPass.ts:123` |
| match member 0 | the armed `accidentalGap` row (0.30 `house`) / VexFlow `accidentalSpacing` 0.30 | box | `layout/accidentalGap.ts`; `metrics.js:74,76` |
| gouldDrawn | 0.19–0.38 (mean ≈0.30) / — | ink, plate | `accidental-dot-research.md` §4 A1 |
| ross | 0.54 / — | ink | `accidentalGap.ts` `ross` row (Ross p. 131) |
| lilypond | 0.35 / 0.2 | skyline | `accidental-dot-engines.md` §3 A1/A4 |
| musescore | 0.25 / 0.25 | cut-out shape | same |
| verovio | 0.25 / 0.165 | cut-out rects | same |

### 5.2 Cross-system beam: open ends

| row | line START | line END | measures | citation |
|---|---|---|---|---|
| **house** | 1.2 left of the first stem | barline + 1.0 (2.2 past the stem if bounds unknown) | stem x / barline x | `beamInk.ts:36-38`, `ScoreRenderer.ts:3141-3148` |
| lilypond | header column's right edge + 0.5 | break column's right edge + 0.0 | column extent | `beam.cc:533-534,590-599` |
| verovio | ½ the mean note distance before the first note (1.5 for a lone note) | right barline x + 0 | element x / barline x | `beam.cpp:1784-1803` |
| musescore | no extension found | no extension found | — | `beamlayout.cpp:74-110,304` |
| books | ⛔ UNKNOWN | ⛔ UNKNOWN | — | §2 |

### 5.3 `KERN_CLEARANCE` — vertical white before kerning

| row | value (sp) | measures | citation |
|---|---|---|---|
| **house** | 0.35 | box, vertical | `kerning.ts:88` |
| musescore (accidental on the right — our only kerning case) | 0.10 | shape, vertical | `horizontalspacing.cpp:1650-1655` |
| musescore (other pairs) | 0.20 | shape, vertical | `horizontalspacing.cpp:1659` |
| lilypond NoteColumn | 0.15 | skyline padding | `define-grobs.scm:2579`, `separation-item.cc:105-109` |
| lilypond PaperColumn | 0.08 | skyline padding | `define-grobs.scm:2751` |

### 5.4 note↔note — least white

| row | value (sp) | measures | citation |
|---|---|---|---|
| **house** | 0.3 | box (INK extents) | `spacingPadding.ts:420` |
| gould | 0.5 | ink, stated | Gould p. 41 (PDF 61), scan |
| musescore floor | 0.1 | shape | `paddingtable.cpp:44,55` |
| musescore when the shapes intersect | 0.35 | shape | `styledef.cpp:264`, `horizontalspacing.cpp:1491-1502` |
| verovio | 0.5 | bbox + margins | `options.cpp:1748,1818`, `adjustxposfunctor.cpp:352-357` |
| vexflow | 0.2 | box (tick-context padding) | `tickcontext.js:20,67` |
| lilypond | ≥ 0.2 + untraced padding | skyline | `separation-item.cc:166-167` |

### 5.5 dot → next note

| row | value (sp) | measures | citation |
|---|---|---|---|
| **house** | 0.5 | box | `spacingPadding.ts:415` |
| gould | 0.5 | ink, stated (any characters) | Gould p. 41 |
| musescore | 0.65 | shape | `paddingtable.cpp:94-95`, `styledef.cpp:304,306` |
| verovio | 0.5 | bbox + margins | `options.cpp:1669,1748` |
| lilypond | 0.2 + untraced padding | skyline | `define-grobs.scm:1279` |
| vexflow | 0.2 | box | `tickcontext.js:20` |

### 5.6 `INK.firstDot` / `dotStep`

The same quantity as `layout/dotGap.ts`. Its rows are that table's rows:
`house` / `gould` / `gouldDrawn` / `ross` / `lilypond` / `musescore` / `verovio` / `vexflow`,
restated as `head ink + head gap` and `0.4 + dot gap`. Nothing new here.

### 5.7 `BETWEEN_PARTS` — the pairs it still prices

| row | value (sp) | measures | citation |
|---|---|---|---|
| **house** | 1.0 | box | `headerInk.ts:243` |
| vexflow origin | 1.0 (`StaveModifier.padding`) | advance box | `stavemodifier.js:22` |
| gould (after a clef, before a symbol) | 1.0 | ink, stated | Gould p. 42 |
| gould cramped | 0.5 | ink, stated | Gould p. 43 |
| stone (clef change before the barline) | 1.0 | gap, stated | Stone p. 46 |
| verovio (after a clef) | 0.5 | bbox + margin | `options.cpp:1782-1784` |
| musescore (note → clef) | 0.8 | shape | `paddingtable.cpp:60` |
| clef → meter | ✅ DECIDED — see `layout/clefMeterGap.ts` | ink | `header-spacing-research.md` §4.4–4.5 |

### 5.8 meter `lineShift`

| row | value | measures | citation |
|---|---|---|---|
| **house** = vexflow | ±0.5 line when a row's measured height > 30 px; **0 on Bravura** | measureText ink height | `timesignature.js:82,136,141`; `bravuraMetrics.ts:158-159` |
| fixed (verovio) | 0: baselines ±1 sp about the middle line | fixed | `view_element.cpp:2139-2140` |
| bbox-derived (musescore) | continuous: each row offset by half its own height + `numDist` 0 | glyph bbox | `tlayout.cpp:6359-6360`, `styledef.cpp:243` |
| gould | numerals exactly fill the staff, i.e. no shift for a correctly sized glyph | stated | Gould p. 152 (`header-spacing-research.md` §2.8) |

## 6. UNKNOWN

1. **Every book** on a beam's open end at a system break (text search of all four; plates not browsed).
2. **Every book** on a vertical clearance for kerning.
3. **Where VexFlow's 30 px `lineShift` threshold came from** (no repository history on disk). It is
   also unmeasured in a browser that it never fires: that rests on the §3.7 arithmetic.
4. **LilyPond's `padding` into `Separation_item::set_distance`** (`spacing-spanner.cc:274`), so its
   total note↔note and dot→note minima.
5. **LilyPond's behaviour for an oversize time-signature glyph.**
6. **Whether LilyPond's `Beam` crosses a line break by default** (no `breakable` in the grob).
7. **Verovio's vertical margin in kerning**, i.e. the argument to `VerticalContentOverlap` in the
   spacing pass.
8. **Whether anything in MuseScore extends a beam fragment at a system break** beyond `layout2`.
9. **Whether `FAN_ACCIDENTAL_GAP`'s 2 px was copied from VexFlow's `getModifierStartXY` literal.**
10. **Which side of a cautionary sign or inline clef `BETWEEN_PARTS`' 1.0 lands on in the drawing.**
11. **No plate was measured for note↔note or dot→note minima.** Gould p. 41's ½ sp is the stated
    rule only.

### Contradictions found, for the record

- **`kerning.ts:85-86`** says *"MuseScore's own vertical clearance is in this range"*. MuseScore's is
  **0.1** when the right-hand item is an accidental (the only case we kern) and **0.2** otherwise;
  0.35 is 1.75–3.5× that.
- **The inventory (§5b)** says MuseScore's dot row *"runs the other direction"*. `table[NOTEDOT][NOTE]`
  is indexed left → right, so it **is** dot → next note, at 0.65. What is borrowed is its *value*:
  the note→dot and dot→dot style values.
- **The inventory calls `INK.firstDot`/`dotStep` "VexFlow's placement".** VexFlow's own is 0.2 / 0.1
  sp of white. 1.7 / 0.9 is the widened `house` dot gap, and `dotExtent` does not follow the armed
  dot row.
- **Verovio `beam.cpp:1801-1802`**: the comment says *"1.5 * unit"*, the value 270 is 3 units
  (1.5 sp).
- **A fanned chord draws two accidental standoffs**: member 0 at 0.30 (VexFlow + `accidentalGap`),
  members ≥ 1 at 0.2.
