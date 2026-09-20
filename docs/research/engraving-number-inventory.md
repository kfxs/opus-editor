# Engraving number inventory — which numbers have a source (2026-09-14)

## 0. Purpose and classes

Every number that decides how the music LOOKS is going to become a user-selectable **house-style
preset**, and this document records which of those numbers already have a source, so no research is
repeated. It is an inventory, not research: it recommends no value and changes no code.

**Scope:** `src/engine/layout/`, `src/engine/rendering/`, `src/engine/engrave/`, `src/engine/fonts/`
(all non-test `.ts`), swept at HEAD `5a13039`. The evidence column quotes the code comment's own words.

| class | meaning |
|---|---|
| **S** — sourced | the comment or its table cites a book page, an engine (file:line), a font value, or a research doc |
| **F** — font fact | a glyph's own width/height/reach/anchor, or a SMuFL engraving default — it follows the font, not a house style |
| **D** — decided by his eye | the comment records that the user chose/rejected it by eye; the doc it points to is listed |
| **T** — taste, no source | "by eye", "taste", "first cut", "provisional", "no source", or a bare constant with no citation |
| **?** — unsure | S/T unclear (an engine value copied without citation, a borrowed number, conflicting comments) — the reason is given |

Units: **sp** = staff spaces; **px @10** = a pixel literal fixed at a 10 px staff space (it does not follow
staff size); **pt** = VexFlow glyph points (×4/3 → px); **ratio**; **deg**; **mm**.

**Skipped** (UI/interaction tolerances, performance, colour, debug, ghost-cursor chrome, or files that only
*read* constants defined elsewhere): `layout/` barWidthRoom, measuredRoom, pageBounds, pageCastOff,
fanRampRoom, inkBand, curveObstacleBand, dynamicsChain, outsideStaffBand, systemBand, measureRestOnset
(+ `BARLINE_BOX_STRADDLE_PX`, `EMPTY_BAR_FLOOR_PX`/`MIN_COLUMN_GAP` (derived), `VEXFLOW_SOFTMAX_FACTOR`,
`SIBELIUS_TABLE_SPACES` dump copy); `engrave/` glyph, noteheads, accidental, articulation, openingBarline,
curveInk `SAMPLE_STEPS`; `rendering/` EngravedAccidental/Articulation/Dot/Clef/Stave/Barline, CrossBarBeams,
FanGhost, fanArticulations, beamSlopeExperiment, accidentalPlacement, noteInkBox, staffSpace,
staffScaleGroup, slurDirection, slurEncompass, slurMelodicTilt, slurSlantLimit, slurStemEndpoint,
slurArticulationEndpoint, tieDirection, tieEndpoints, tieStaffLineClearance, brokenSlurTilt, SlurRenderer,
barlineGap, barlineInk, BarlineGhost, KeySignatureGhost, GroupSignGhost, systemEdges, headerPlacementPass,
clefOffsetPass, spacingPass, PagePass (`PAGE_GAP_PX` desk gutter), MeasureLayout (probes), layoutConfig hit
widths/VIEWPORT/GUTTER, hairpinBreaks, dynamicsLinePlan, dynamicMarkAnchor, dynamicMarkTransform,
dynamicNudgePass, TrillGhost, OttavaGhost, PedalGhost, pedalReleaseWrap, tempoAnchorInk, tempoLinePass,
tempoMarkTransform, tempoNudgePass, markPreviewPass, drawnText, drawnHitBox, OttavaRenderer, PedalRenderer,
glyphPainter, svgDrawGroup, MeasureWidthCache, MeasureRedrawKey, RenderPass, measureRenderRoles, ghostTypes,
ghostCursor, hiddenElements, inkSurface, musicFontReady, CoordinateMapper (legacy pixel↔beat fallback);
the GhostRenderer cursor offsets; `curveStyle.tieStubLength` (pending-tie preview).

## 1. Summary

**271 entries:** S 105 · F 37 · D 22 · **T 76** · ? 31. A preset table counts as ONE entry.

| family | S | F | D | T | ? | total |
|---|---|---|---|---|---|---|
| **trills / ottava / pedal** | 1 | – | 3 | **28** | 4 | 36 |
| slurs & ties | 23 | 2 | 6 | 5 | 3 | 39 |
| header (clef/key/meter) | 14 | 5 | 1 | – | 4 | 24 |
| **hairpins & dynamics** | 8 | 1 | 4 | **7** | 1 | 21 |
| accidentals & dots | 8 | 6 | – | 3 | 1 | 18 |
| beams | 11 | 1 | 1 | 3 | – | 16 |
| spacing | 4 | – | 2 | 4 | 5 | 15 |
| **tempo & text** | 4 | 1 | 1 | **7** | 1 | 14 |
| noteheads & stems | 3 | 6 | – | 1 | 3 | 13 |
| braces & brackets | 7 | 3 | 1 | – | 1 | 12 |
| **tuplets** | 2 | – | – | **5** | 5 | 12 |
| barlines | 6 | 4 | – | – | – | 10 |
| page / system layout | 4 | – | 1 | 4 | 1 | 10 |
| **tremolo** | 2 | – | – | **6** | 1 | 9 |
| ledger lines | 3 | 2 | – | 3 | 1 | 9 |
| rests | 5 | 2 | 1 | – | – | 8 |
| flags | – | 3 | – | – | – | 3 |
| staff & lines | – | 1 | 1 | – | – | 2 |

**Where the gap is:** the marks outside the staff hold 42 of the 76 T entries (trills/ottava/pedal 28,
hairpins & dynamics 7, tempo & text 7). The staff, the header, barlines, braces, beams and the spacing law
are almost entirely S/F/D, and most of them are already preset tables. **Nine T entries are glyph
ink RATIOS that the font already answers** (marked *F-answerable* below). Measuring them is a
glyph-box lookup, not research.

## 2. ⭐ The T list (taste, no source), by family

"Covering doc" = an existing doc that may already answer or frame the question. ⭐ **ALREADY
ANSWERED** means the doc has the sourced figures and the code just doesn't cite them. **OPEN** means the doc
lists it as owed to his eye.

### Trills / ottava / pedal (28)

| name | value | file:line | comment words | possibly-covering doc |
|---|---|---|---|---|
| `TRILL_PAREN_RAISE` | 0.22 × paren size | rendering/trillStyle.ts:109 | "Taste, and derived from assumed font metrics rather than measured ones" | none found (paren is serif text; `ornamentTrill` bbox quoted at trillStyle.ts:80) |
| `TRILL_GLYPH_SIZE` (`tr`) | 26 pt = 3.47 sp @10 | rendering/trillStyle.ts:112 | "A shade under the dynamics' 30" | pedal-plan.md §12 item 3 (text band 2.02–2.42 sp, pre pt→px fix); above-staff-ladder.md §"pt vs px" |
| `TRILL_GLYPH_INK_ABOVE` | 0.62 × drawn px | rendering/trillStyle.ts:123 | "First-cut proportions, not a measurement" | *F-answerable* (`ornamentTrill` glyphBBox); above-staff-ladder.md §"The RATIOS are still guesses"; trill-plan.md §10 P2 |
| `TRILL_GLYPH_INK_BELOW` | 0.04 × drawn px | rendering/trillStyle.ts:124 | "First-cut proportions, not a measurement" | *F-answerable* (as above) |
| `TRILL_LINE.minFromStaff` | 1.0 sp | rendering/trillStyle.ts:158 | "1.0 is a taste value … genuinely waiting on his eye" | OPEN trill-plan.md §10 P2; above-staff-ladder.md §3 |
| `TRILL_CONTINUATION_INSET` (`(tr)` left of music) | 2.0 sp | rendering/trillStyle.ts:183 | "tuned separately by eye. It starts equal to the ottava's" | ottava-plan.md §"HIS EYE, 2026-08-13" item 5 (direction only); ottava-plan.md §1 "Covered by Gould, NOT yet read" (pp. 28–34) |
| `TRILL_END_INSET` | 0.5 sp | rendering/trillStyle.ts:209 | "Starting at half a space by eye — a taste value" | OPEN trill-plan.md §10 P2; dynamics-line-and-hairpins-plan.md §2.4c (Gould "about a space") |
| `OTTAVA_PAREN_SCALE` | 0.52 × glyph size | rendering/ottavaStyle.ts:88 | "Taste, and starting from the trill's 0.52" | OPEN ottava-plan.md §"HIS EYE, 2026-08-13" still-open list |
| `OTTAVA_PAREN_RAISE` | 0.22 × paren size | rendering/ottavaStyle.ts:97 | "Taste, from the trill's 0.22" | OPEN ottava-plan.md §"HIS EYE"; SMuFL `octaveParensLeft/Right` would make it F |
| `OTTAVA_GLYPH_SIZE` (8va numeral) | 26 pt = 3.47 sp @10 | rendering/ottavaStyle.ts:102 | "Gould gives the numeral's height … that page is … unread … a first cut" | ottava-plan.md §1 "Covered by Gould, NOT yet read" (pp. 28–34) — Gould now on disk (reference/README.md) |
| `OTTAVA_GLYPH_INK_ABOVE_RATIO` | 0.62 × drawn px | rendering/ottavaStyle.ts:112 | "First-cut proportions, not a measurement" | *F-answerable* (`ottavaAlta`/`ottavaBassaBa` glyphBBox); above-staff-ladder.md §"The RATIOS are still guesses" |
| `OTTAVA_GLYPH_INK_BELOW_RATIO` | 0.04 × drawn px | rendering/ottavaStyle.ts:113 | "First-cut proportions, not a measurement" | *F-answerable* (as above) |
| `OTTAVA_LINE.padding` | 0.5 sp | rendering/ottavaStyle.ts:167 | "Taste, and owed to his eye" | ottava-plan.md §1 rule 5, §5; ottava-plan.md:161 (Gould p. 102 engraving measured, "prices the PADDING") |
| `OTTAVA_LINE.minFromStaff` | 1.5 sp (was 2.5) | rendering/ottavaStyle.ts:168 | "Taste, and OWED TO HIS EYE" | ottava-plan.md §5; reference/README.md Gould p. 337 figure measured (8 bracket 3.25 sp below bottom line) |
| `OTTAVA_DASH_LENGTH` | 0.5 sp | rendering/ottavaStyle.ts:205 | "The dash pattern, in staff spaces" (no source) | OPEN ottava-plan.md §"HIS EYE" ("the dash pattern"); §1 Gould pp. 28–34 unread |
| `OTTAVA_DASH_GAP` | 0.4 sp | rendering/ottavaStyle.ts:206 | (as above) | (as above) |
| `OTTAVA_END_AIR` | 0.5 sp | rendering/ottavaStyle.ts:258 | "Taste, starting at the trill's own half-space by eye" | ottava-plan.md §"HIS EYE" item 2 (rule, not value) |
| `OTTAVA_MIN_LINE` | 1.0 sp | rendering/ottavaStyle.ts:275 | no source | OPEN ottava-plan.md §"HIS EYE" ("the min line") |
| `OTTAVA_HOOK` | 0.8 sp | rendering/ottavaStyle.ts:285 | "The closing HOOK's length" (no source) | OPEN ottava-plan.md §"HIS EYE" ("the hook"); §1 rules 3–4; Gould pp. 28–34 unread |
| `PEDAL_GLYPH_SIZE` (`Ped.`) | 26 pt = 3.47 sp @10 | rendering/pedalStyle.ts:61 | "A first cut, and one of the five numbers owed to his eye" | OPEN pedal-plan.md §12 item 3; above-staff-ladder.md §"pt vs px" |
| `PEDAL_GLYPH_INK_ABOVE_RATIO` | 0.52 × drawn px | rendering/pedalStyle.ts:72 | "First-cut proportions, not a measurement" | *F-answerable* (`keyboardPedalPed`); above-staff-ladder.md §"The RATIOS are still guesses" (measured 0.577) |
| `PEDAL_GLYPH_INK_BELOW_RATIO` | 0.18 × drawn px | rendering/pedalStyle.ts:73 | "`Ped.` has a real DESCENDER" | *F-answerable*; ⚠️ above-staff-ladder.md §"The RATIOS are still guesses" measured **0.0** — "the 'descender' … does not exist" |
| `PEDAL_LINE.padding` | 0.6 sp | rendering/pedalStyle.ts:107 | "Taste … the dynamics line's own padding, borrowed unchanged" | OPEN pedal-plan.md §12 item 2 |
| `PEDAL_LINE.minFromStaff` | 4.0 sp | rendering/pedalStyle.ts:108 | "Taste… 4.0 is the plan's suggested start" | OPEN pedal-plan.md §12 item 1; reference/README.md Gould p. 337 (Ped. line 7.25 sp below, under an 8 bracket) |
| `PEDAL_CONTINUATION_INSET` | 2.0 sp | rendering/pedalStyle.ts:121 | "Taste, and §12.5 asks his eye for it" | OPEN pedal-plan.md §12 item 5 |
| `PEDAL_MIN_SPAN` (Ped.→✻) | 3.4 sp | rendering/pedalStyle.ts:136 | "Taste, §12.6" | OPEN pedal-plan.md §12 item 6, §5.1a |
| `PEDAL_BARLINE_AIR` | 0.4 sp | rendering/pedalStyle.ts:152 | "one of the five numbers owed to his eye" | OPEN pedal-plan.md §12 item 4; reference/README.md Gould pp. 333/335 (release point, prose) |
| `PEDAL_SIGN_GAP` (Ped. → ✻) | 0.5 sp | rendering/pedalStyle.ts:161 | "larger because both sides of this gap are solid glyphs" | pedal-plan.md §12 item 6 (mentions, no value source) |

### Hairpins & dynamics (7)

| name | value | file:line | comment words | possibly-covering doc |
|---|---|---|---|---|
| `HAIRPIN.GROWTH_PER_SPACE` (aperture ramp slope) | 0.012 sp/sp | rendering/hairpinShape.ts:189 | "A taste number with no source" | dynamics-line-and-hairpins-plan.md §2.4d (seven-case fit), §13.1 "PROVISIONAL … no source for either"; §2.4b/§2.4c (Dorico 8→36 ramp, Sibelius/Finale two-step) |
| `HAIRPIN.END_INSET` | 0.25 sp per end | rendering/hairpinShape.ts:276 | "Unconditional is the POINT, and it was his call" (rule his; value uncited) | OPEN dynamics-line-and-hairpins-plan.md §13.1 "air between two abutting wedges — STILL OPEN. Dorico leaves a notehead width (~1.18 sp)"; §2.4c |
| squeezed-wedge sliver | 1 sp | rendering/HairpinRenderer.ts:559 | "a wedge squeezed to nothing … keeps a sliver" | none found (degenerate case) |
| `DYNAMIC_GLYPH_SIZE` (p/f/mf) | 30 pt = 4.0 sp @10 | rendering/dynamicStyle.ts:13 | bare constant, no comment | none found for the size; above-staff-ladder.md §"THE LADDER'S INK WAS A QUARTER TOO SMALL — pt vs px" measures its ink (1.80 sp) |
| `DYNAMIC_GLYPH_INK_ABOVE` | 0.68 × drawn px | rendering/dynamicStyle.ts:51 | "First-cut proportions of the glyph size — tune to taste" | *F-answerable* (glyphBox, already used per letter in dynamicMarkInk.ts); above-staff-ladder.md §"The RATIOS are still guesses" (measured 0.45) |
| `DYNAMIC_GLYPH_INK_BELOW` | 0.18 × drawn px | rendering/dynamicStyle.ts:52 | "First-cut proportions … tune to taste" | *F-answerable*; same doc (measured 0.15) |
| co-located dynamics row `GAP` (`p dolce`) | 6 px @10 = 0.6 sp | rendering/DynamicsLayout.ts:154 | "0.6 staff-spaces of INK, in the bar's own space" | dynamics-line-and-hairpins-plan.md §3 (keeps the row and the GAP, no value source) |

### Tempo & text (7)

| name | value | file:line | comment words | possibly-covering doc |
|---|---|---|---|---|
| `TEMPO_GLYPH_FONT_SIZE` (metronome ♩) | 20 pt = 2.67 sp @10 | rendering/tempoStyle.ts:38 | "tracks TEMPO_TEXT_FONT_SIZE at about 1.12× … roughly the word's own height" | none found (tempo-marks-research.md §3 / tempo-marks-plan.md §6 cover rendering, not the note's size) |
| `TEMPO_INK_ABOVE` (♩ top) | 0.75 × drawn px | rendering/tempoStyle.ts:77 | "First cut BY EYE, exactly as dynamicStyle's 0.68/0.18 and trillStyle's 0.62/0.04 were" | *F-answerable* (`metNoteQuarterUp`); above-staff-ladder.md §"The RATIOS are still guesses" |
| `TEMPO_INK_BELOW` (text descender) | 0.22 × drawn px | rendering/tempoStyle.ts:78 | "First cut BY EYE" | text-font metric, not SMuFL; above-staff-ladder.md §"The RATIOS are still guesses" |
| `TEMPO_LINE.padding` | 0.8 sp | rendering/tempoStyle.ts:106 | "Both are TASTE, and they are the pair owed to his eye" | OPEN ottava-plan.md §8 P0b ("Owed to his eye — the two numbers"); above-staff-ladder.md §1/§3 |
| `TEMPO_LINE.minFromStaff` | 3.0 sp | rendering/tempoStyle.ts:108 | "3.0 is that guess" | OPEN ottava-plan.md §8 P0b; tempo-marks-plan.md §6.4 |
| `SCORE_TEXT_SPECS.title.baselineSpaces` | 3.46 sp (0.78 ascent) | rendering/ScoreHeaderPass.ts:90 | "0.78 is a serif face's ascent … ⚠️ A GUESS" | score-header-sketch.md §3b — 🚧 SKETCH module, to be thrown away |
| `SCORE_TEXT_SPECS.composer.baselineSpaces` | 9.3 sp (0.25 descender) | rendering/ScoreHeaderPass.ts:93 | "less a descender's worth" (0.25 uncited) | score-header-sketch.md §3b — 🚧 SKETCH |

### Slurs & ties (5)

| name | value | file:line | comment words | possibly-covering doc |
|---|---|---|---|---|
| `CURVE.brokenSlurMaxRise` | 2.0 sp | rendering/curveStyle.ts:78 | "OURS, and provisional" | slur-plan.md §"Phase 5 — a broken slur must lean toward its own music" ("⚠️ ours"); slur-tie-research.md §5 row 15 |
| `CURVE.slurNestGap` | 1.0 sp per level | rendering/curveStyle.ts:121 | "so concentric slurs don't collide" (no citation) | slur-tie-research.md §4.1 LilyPond `free-slur-distance` 0.8 sp; slur-plan.md §8 |
| `CURVE.slurSlantMaxTravel` | 1.0 sp | rendering/curveStyle.ts:170 | "OURS, and provisional … ⛔ No source: a number to tune by eye." | slur-plan.md §"Phase 6 — a maximum slant"; slur-tie-research.md §5 |
| `SLUR_ARCH_TILT` | 0.25 × dy | rendering/curveStyle.ts:337 | "How much the arch LEANS with its own interval" (no citation) | slur-plan.md §"1. The lean was unbounded — slurArchHeight.archLean", §"Phase 8 — interior notes" |
| accidental avoid point, double sharp | 0 (centre) | rendering/slurAccidentalPoint.ts:69 | "NOT in LilyPond's table … but it is OURS" | slur-tie-research.md §8.8 (no double-sharp row) |

### Tremolo (6)

| name | value | file:line | comment words | possibly-covering doc |
|---|---|---|---|---|
| stroke stack centred on the free stem (rule) | stem middle | rendering/CenteredTremolo.ts:27 | "CENTRING IS OUR RULE, NOT GOULD'S" | tremolo-plan.md §4 "The conventions, and which of them we follow" (Gould ~pp. 224–226) |
| `TREMOLO_FLAG_STEM_STRETCH` | 0.25 × stem length | rendering/CenteredTremolo.ts:55 | "as a fraction of the stem's own length" | tremolo-plan.md §4 "The two stem stretches" — "She gives no number for either" |
| `TREMOLO_STROKE_CLEARANCE` | 0.25 sp each end | rendering/CenteredTremolo.ts:65 | "the *chosen* number in the fit rule" | tremolo-plan.md §4 "The two stem stretches" |
| `PAIR_STROKE_CLEARANCE_SPACES` | 1 sp | rendering/TwoNoteTremolo.ts:34 | "Both are chosen by eye and tunable" | two-note-tremolo-plan.md §2 (describes, no source) |
| `PAIR_STROKE_CLEARANCE_RATIO` | 0.25 × stem gap | rendering/TwoNoteTremolo.ts:35 | "chosen by eye and tunable" | (as above) |
| `PAIR_STROKE_MAX_CLEARANCE_RATIO` | 0.35 × stem gap | rendering/TwoNoteTremolo.ts:42 | "The hard ceiling on that clearance" | (as above) |

### Tuplets (5)

| name | value | file:line | comment words | possibly-covering doc |
|---|---|---|---|---|
| `TUPLET_FONT_SIZE` | 26 px @10 | rendering/ScoreTuplet.ts:20 | "THE knob for how big the numbers are" | tuplet-extension-plan.md §9 "The FORMAT" (names the knob, no source) |
| `NOTE_GLYPH_SCALE` (note in a ratio mark) | 0.55 × figure size | rendering/ScoreTuplet.ts:32 | "0.55 lands it a little taller than the figures" | tuplet-extension-plan.md §9 |
| `MARK_SPACE_EM` | 0.15 em | rendering/ScoreTuplet.ts:38 | "About a thin space at 24px" | tuplet-extension-plan.md §9 |
| `BRACKET_END_GAP` (`beforeNext`) | 6 px @10 | rendering/ScoreRenderer.ts:3220 | "stops a little short of that note" | tuplet-extension-plan.md §9 (modes only) |
| `GHOST_TUPLET_NUMBER_GAP` | 1.5 sp | rendering/ghosts/GhostRenderer.ts:81 | "Tune here." | tuplet-extension-plan.md §"The ghost" — ghost only; the page's number is VexFlow's (⚠️ 2026-09-19: ours since S12a, `ScoreTuplet`) |

### Accidentals & dots (3) · Ledger lines (3) · Noteheads & stems (1) · Beams (3)

| name | value | file:line | comment words | possibly-covering doc |
|---|---|---|---|---|
| `LEDGER_ACCIDENTAL_GAP` | 2 px @10 = 0.2 sp | rendering/ledgerAccidentalClearance.ts:57 | "the air VexFlow itself leaves … less a whisker" | accidental-dot-research.md §4 row A5; accidental-dot-engines.md §A row A5; accidental-ledger-clearance.md §"What the engraving sources say" |
| `FAN_ACCIDENTAL_GAP` | 2 px @10 = 0.2 sp | rendering/FanPass.ts:123 | "PROVISIONAL, like every fan number" | accidental-dot-research.md §A row A1 (Gould: no number); accidental-dot-engines.md §A; ⚠️ the note's own gap is the `accidentalGap` preset table (0.3) |
| `MIN_SHARED_COLUMN_LINES` (fan accidental columns) | 2.5 lines (a sixth) | rendering/chordAccidentalColumns.ts:44 | "Closer than that and a sharp's … arms run into the one above" | ⭐ ALREADY ANSWERED: accidental-dot-research.md §A row A3 (Gould p. 88 "an octave or more") + §4 row A3; ⚠️ `layout/spacingPadding.ts:286` uses a seventh |
| `LEDGER_OVERHANG_BESIDE_ACCIDENTAL` | 2 px @10 = 0.2 sp | rendering/ledgerAccidentalClearance.ts:75 | "Two thirds of the default: still a visible overhang" | accidental-dot-engines.md §A row A5 (LilyPond shortens to the midpoint); accidental-dot-research.md §4 A5 |
| rest supporting-ledger overhang `PAD` | 2 px @10 per side | rendering/ScoreRenderer.ts:2390 | "px the ledger overhangs the rest glyph on each side" | rest-shift-plan.md §10 (convention sourced, number not); ⚠️ note ledgers are 3 px (accidental-dot-engines.md §2.4) |
| ghost rest ledger overhang `PAD` | 3 px @10 per side | rendering/ghosts/GhostRenderer.ts:461 | "reads as a staff line, not a strike-through" | ⚠️ disagrees with the real render's 2 px above |
| `FAN_MIN_STEM_SPACES` | 2 sp | rendering/FannedBeam.ts:137 | "PROVISIONAL" | ⭐ ALREADY ANSWERED: note-engraving-plan.md §3.5 (books' floor 2.5 sp); stem-length-research.md §1; fanned-beams-plan.md §1 |
| `CROSS_SYSTEM_BEAM_STUB_LINE_END` | 22 px @10 (2.2 sp) | rendering/beamInk.ts:36 | "these are tuned by eye" | cross-barline-beaming-plan.md §"What stays whole-group, and the two stub ends" (describes); beam-hook-research.md §8 decision A (stub length) |
| `CROSS_SYSTEM_BEAM_STUB_LINE_START` | 12 px @10 (1.2 sp) | rendering/beamInk.ts:37 | "tuned by eye" | (as above) |
| `CROSS_SYSTEM_BEAM_MARGIN` | 10 px @10 (1 sp past barline) | rendering/beamInk.ts:38 | same "tuned by eye" block | (as above) |

### Spacing (4) · Page / system layout (4)

| name | value | file:line | comment words | possibly-covering doc |
|---|---|---|---|---|
| `LAYOUT_CONFIG.MAX_MEASURE_WIDTH` | 40 sp | rendering/layoutConfig.ts:100 | "so one measure can't dominate" (no citation) | layout-plan.md §1 "What we have today, named honestly"; spacing-model-research.md §3; bar-width-plan.md §3 |
| `USER_SPACE_LINE_FRACTION` | 0.6 of line width | rendering/MeasureLayout.ts:514 | "How much of a line the user may claim with authored space" | bar-width-plan.md §3 "Justification"; note-spacing-plan.md §3 "option B" |
| format-width right reserve (`noteAreaWidth − 15`) | 15 px @10 | rendering/ScoreRenderer.ts:2180 | bare literal | note-spacing-plan.md §4 "Render — shift the columns, never the glyphs" + §"Review record (2026-07-21)" R6 (records it, no source) |
| ghost format-width reserve + floor | 15 px / 50 px | rendering/ghosts/GhostRenderer.ts:272-273 | `const rightPadding = 15`, no comment | ⚠️ a duplicate of ScoreRenderer.ts:2180 |
| `SYSTEM_GAP_SPACES` | 11 sp | layout/staffStride.ts:108 | "The number itself is still arbitrary — the books give no figure for it" | vertical-spacing-research.md §3.1–3.2 (Gould pp. 489/558 system gaps MEASURED 7.95 / 8.25 sp), §5 UNKNOWN, §6 |
| `LAYOUT_CONFIG.STAVE_HEIGHT` | 12 sp | rendering/layoutConfig.ts:125 | "five lines plus what hangs off them — 12 staff-spaces" | vertical-spacing-research.md §0/§1 (gaps now line-to-line); staff-size-plan.md §1; staff-spacing-plan.md |
| sketch canvas | 1000 px wide, 20 px margin | layout/surface.ts:104 | "the 1000 px column with a 20 px margin the editor has always drawn" | layout-plan.md §1 ("1000 px isn't any paper size"), §2 |
| A4 "normal" margins | 15 mm all sides | layout/surface.ts:110-111 | "the first page there is" (no citation) | ⭐ ALREADY ANSWERED: vertical-spacing-research.md §2.6 Margins (Gould p. 481 "at least 15mm", Ross p. A-2 ½ inch); pdf-export.md |

## 3. The D list (his eye, 22)

| name | value | file:line | comment words | doc |
|---|---|---|---|---|
| `STAFF_GAP_SPACES` | 6.5 sp | layout/staffStride.ts:94 | "A COMPROMISE BETWEEN THE MEASURED TOP AND HIS HAND" | vertical-spacing-research.md §3.3, §6 "What was decided, 2026-08-28" |
| `CAUTIONARY_KEY_TO_LINE_END` | 0.75 sp | layout/cautionaryKey.ts:105 | "OUR DEFAULT IS 0.75 — HIS CHOICE" | key-signature-plan.md P6 (§8) |
| pairPadding note→barline (trailing) | 1.0 sp | layout/spacingPadding.ts:413 | "Judged on screen and left at 1.0 (i think is ok now)" | spacing-model-research.md §6d |
| multi-voice rest lane order V3/V1/V2/V4 | order | layout/restVoicePlacement.ts:271-289 | "HIS LANE ORDER … a TASTE CALL" | multi-voice-plan.md §13; multi-voice-rest-position.md §8 |
| outer indent after outermost brace/bracket | 0.40 sp (reuses `SIGN_SEPARATION_SPACES`) | layout/systemStartColumn.ts:344 | "His report, 2026-08-29: brackets are almost touching the border" | braces-brackets-research.md §3.8 |
| `ACTIVE_BEAM_SLOPE_RULE` | row `vexflow` | engrave/beams/beamSlope.ts:244 | "HIS CALL, 2026-09-01 … i prefer vexflow angle" | beam-slope-research.md; beam-engraving-plan.md |
| `STAVE_LINE_WIDTH_PX` | 0.11 sp | engrave/staff/staffLines.ts:179 | "HIS DECISION, 2026-09-01: GOULD — 0.11" | staff-line-research.md §8 A |
| `HAIRPIN_LINE_SPACES` | 0.13 sp | rendering/thinLineWeight.ts:146 | "his eye rejected 0.10 and 0.12 as 'too thin'" | staff-line-research.md §8 D |
| `CURVE.curveFromHeader` | 0 sp | rendering/curveStyle.ts:109 | "HIS EYE, 2026-08-16: LilyPond's 0" | slur-plan.md §12 |
| `CURVE.slurHeightLimit` | 2.0 sp | rendering/curveStyle.ts:119 | "HIS CALL, 2026-08-16, option (b)" | slur-plan.md §12 Phase 2 (LilyPond define-grobs.scm:3178) |
| `CURVE.tieEndpointInset` | 0.25 sp | rendering/curveStyle.ts:239 | "Verovio's, his call of 2026-08-16" | slur-plan.md §13.3 |
| `CURVE.tieBow` | 0.53 sp control rise | rendering/curveStyle.ts:247 | "SETTLED by his call, 2026-08-15 (§13.1)" | slur-plan.md §13.1 |
| `SLUR_MAX_SLANT_DEG` | 60 deg | rendering/curveStyle.ts:313 | "HIS CALL … THE ONE CONSTANT IN THIS FILE WITH NO PUBLISHED SOURCE" | slur-plan.md §11.10 / Phase 6 (Verovio slur.cpp:570 default) |
| `SLUR_ARCH_TILT_LIMIT` | 0.693 lean÷arch | rendering/curveStyle.ts:363 | "the citation for this one is his drawing" | slur-plan.md §"1. The lean was unbounded" |
| `LAYOUT_CONFIG.MIN_MEASURE_WIDTH` | 10 sp | rendering/layoutConfig.ts:98 | "a DEFAULT chosen by eye … *I think 10 was nicer*" | bar-width-plan.md §1.5 |
| `SCORE_TEXT_SPECS.composer.sizeSpaces` | 2.8 sp | rendering/ScoreHeaderPass.ts:93 | "The COMPOSER is NOT, and his eye is why" | score-header-sketch.md (🚧 SKETCH) |
| `HAIRPIN.APERTURE` | 1.5 sp | rendering/hairpinShape.ts:52 | "the majority, chosen on 2026-08-15 over the 1.33" | dynamics-line-and-hairpins-plan.md §2.4d, §13.1 |
| `HAIRPIN.GROWTH_FROM_SPACES` | 36 sp | rendering/hairpinShape.ts:176 | "We do NOT take Dorico's numbers, and the reason is his eye" | dynamics-line-and-hairpins-plan.md §2.4d (§13.1 still calls it PROVISIONAL) |
| `HAIRPIN.MAX_ANGLE_DEGREES` | 11.5 deg | rendering/hairpinShape.ts:253 | "11.5°, not Verovio's 16° — his eye" | dynamics-line-and-hairpins-plan.md §2.4a, §13.1 |
| `TRILL_PAREN_SCALE` | 0.52 × tr size | rendering/trillStyle.ts:100 | "Pure taste, tuned against his eye … 0.85 was 'definitely too big'" | trill-plan.md §1 rule 6 |
| `OTTAVA_LINE_RAISE_ABOVE` | 0.5 × mark ink above | rendering/ottavaStyle.ts:195 | "Both numbers are taste and both are his" | ottava-plan.md §"HIS EYE, 2026-08-13" item 4 |
| `OTTAVA_LINE_RAISE_BELOW` | 0 sp | rendering/ottavaStyle.ts:196 | "BELOW is 0 — the baseline itself" | (as above) |

Several S rows also carry a D *choice of row* (e.g. `DOT_GAP_RULES` armed `house` = "his report",
`BARLINE_METER_RULES` armed `gerouLusk`, `CLEF_METER_RULES` armed `stone`, `HEADER_GAP_RULES` armed
`musescore`, `CLEF_INDENT`, `HEADER_TO_NOTE_AFTER_SIGN`). They are listed once, under S.

## 4. The S list (sourced, 105), condensed

### Already a preset table (a row per source, one armed)
- `ACCIDENTAL_GAP_RULES` — layout/accidentalGap.ts:63-98 — VexFlow, Gould plate, MuseScore, LilyPond, Ross p. 131.
- `DOT_GAP_RULES` — layout/dotGap.ts:64-121 — Gould p. 54, Ross pp. 169/171, 5 engines.
- `BARLINE_METER_RULES` — layout/barlineMeterGap.ts:57-85 — Stone p. 46, Gould p. 43, Ross p. 168, Gerou & Lusk p. 28, LilyPond, MuseScore.
- `CLEF_METER_RULES` — layout/clefMeterGap.ts:82-120 — Stone p. 44, MuseScore, LilyPond, library median.
- `HEADER_GAP_RULES` — layout/headerAccidentalLadder.ts:71-135 — Gould p. 42, MuseScore, LilyPond; header-spacing-research.md §3.7.
- `SPACING_LAWS` — layout/spacingExperiment.ts:49-156 — Gould p. 39, Ross p. 77, engines (sibelius/finale/dorico rows marked "SECOND-HAND").
- `GOULD_SPACING` / `LILYPOND_SPACING` (armed) — layout/spacing.ts:96,138.
- `BEAM_SLOPE_RULES` (+ `INTERVAL_QUARTERS`, `WIDTH_QUARTERS`, `VEXFLOW_MAX_SLOPE`) — engrave/beams/beamSlope.ts:95-121 — Ross pp. 101–102, Gould p. 20, MuseScore, LilyPond, Verovio.
- `FRACTIONAL_BEAM_SIDE_RULES` — engrave/beams/fractionalBeam.ts:131,144 — Gould p. 157, Ross p. 124, Gerou & Lusk p. 31, Stone p. 12.
- `HEIGHT_LAW` (slur height: lilypond/verovio/musescore) — rendering/slurShapeExperiment.ts:36-56.

### Single sourced numbers
- **spacing:** barline→next lead-in 1.2 sp (spacingPadding.ts:399, VexFlow Stave.padding, MuseScore 1.35).
- **rests:** rest→barline 1.65 sp (spacingPadding.ts:413, MuseScore) · rest↔any 0.5 sp (:414) · multi-voice rest `GAP` 0.75 sp (restVoicePlacement.ts:76, LilyPond minimum-distance) · `TOP_LINE`/`BOTTOM_LINE` (restVoicePlacement.ts:63-64, multi-voice-rest-position.md §3.1) · `REST_LINE` (restPlacement.ts:88-101, Gould + LilyPond rest.cc).
- **accidentals & dots:** →accidental padding 0.35 sp (spacingPadding.ts:416, MuseScore) · `VEXFLOW_ACCIDENTAL_GAP` 0.3 sp (:270) · `ACCIDENTAL_SHARE_INTERVAL` a seventh (:286; comment "the engraver's own rule", pages in accidental-dot-research.md §2.1/§2.2 A3) · `VEXFLOW_ACCIDENTAL_PADDING`/`MODIFIER_LEFT_OFFSET` (ledgerAccidentalClearance.ts:82,89, compensation) · `VEXFLOW_DOT_SPACING`/`_BASE_GAP` (dotPlacement.ts:96,128, compensation) · dot lifted off a line 0.5 sp (engrave/notes/augmentationDot.ts:49, VexFlow `Dot.format`).
- **ledger lines:** ledger↔any 0.35 sp (spacingPadding.ts:419, MuseScore) · note ledger overhang 3 px @10 (EngravedNote.ts:128 / ledgerLines.ts:105, VexFlow; ⏳ vs Bravura 0.4, font-metrics-plan.md §3.6 #5) · `FAN_LEDGER_OVERHANG` 3 px (FanPass.ts:120).
- **noteheads & stems:** `STEM_REACH` 3.5 sp (spacingPadding.ts:258, Gould/VexFlow) · stem reaches the middle line (measureColumns.ts:210) · second-interval displacement (chordHeadLayout.ts:35,83, VexFlow).
- **header:** `HEADER_TO_NOTE` 2.0 sp (headerInk.ts:71, LilyPond) · `HEADER_TO_NOTE_AFTER_SIGN` 2.5 sp (:94, Gould p. 42 + MuseScore; his decision D) · `HEADER_ACCIDENTAL_FLOOR` 1.0 sp (:158, Gould p. 42) · `CLEF_INDENT` 0.7 sp (:189, Gould p. 6, Ross p. 144; decision A) · `VEXFLOW_CLEF_INDENT` 0.5 sp (:195, engine difference) · `KEY_ACCIDENTAL_GAP` 0.25 sp (keySignatureLayout.ts:52, Gould+Ross measured; "owed his eye", natural's gap ⏳ §4.0b) · `CLEF_TO_KEY_INK` 0.82 sp (:75) · `KEY_TO_METER_INK` 1.15 sp (:95) · `BARLINE_TO_KEY_INK` 1.0 sp (:109) · `SHARP_STEPS`/`FLAT_STEPS` (:320,329, Gerou & Lusk pp. 80–81, Gould p. 91) · `BARLINE_TO_CAUTIONARY_KEY_INK` 0.75 sp (cautionaryKey.ts:62, Gould p. 93).
- **barlines:** `THICK` 0.5 sp (barlineSign.ts:60) · `SEPARATION` 0.32 sp (:72, Gould engraved finals) · `DOT_SEPARATION` 0.16 sp (:84) · repeat `dotLines` (:360, Gould p. 234) · `HEADER_TO_REPEAT` 1.0 sp (:495, LilyPond) · barline extent 4 sp line-middle to line-middle (engrave/staff/barlineExtent.ts:62, Ross p. 151 + 3 engines).
- **braces & brackets:** `BRACE_DEPTH_SPACES` 0.89 (systemStartColumn.ts:56, Gould p. 331) · `BRACKET_DEPTH_SPACES` 0.5 (:66) · rod projection / serif inset (:146,153, Verovio) · `SIGN_TO_BARLINE_SPACES` 0.45 (:183) · `SUB_BRACKET_WIDTH_SPACES` 0.60 (:211) · `SUB_BRACKET_STROKE_SPACES` 0.10 (:213) · brace flush with outer lines (:242, Ross p. 155).
- **page/system:** `MIN_STAFF_GAP_SPACES` 4 (staffStride.ts:138, Gould p. 488, Ross p. 68) · `MM_PER_STAFF_SPACE` 1.75 mm (surface.ts:73, MuseScore) · `FRAME_SPACES` 10 (ScoreHeaderPass.ts:107, MuseScore; 🚧 sketch) · `COMPOSER_AIR_SPACES` 5 (ScoreHeaderPass.ts:123, LilyPond; 🚧 sketch).
- **beams:** `BEAM_LEVEL_STRIDE` 1.5 × thickness (beamLines.ts:61) · beam edge flush with stem (beamLines.ts:121) · `BEAM_END_OVERSHOOT` 1 px (EngravedBeam.ts:70) · `SUBDIVIDE_STUB_PX` 10 px (FannedBeam.ts:723, VexFlow `partialBeamLength`; ⏳ ordinary stub LENGTH is OPEN decision A, beam-hook-research.md §8) · `FAN_MAX_BEAM_SLOPE` 0.25 (FannedBeam.ts:124) · fan level step ×1.5 (FannedBeam.ts:151,617,661,746).
- **tremolo:** VexFlow `Tremolo.spacing`/`fontSize` (CenteredTremolo.ts:149,161,198) · two-note stroke step 1.5 × beam width (TwoNoteTremolo.ts:52,142).
- **tuplets:** inner-flip bracket y term (NoteBuilder.ts:477,483, VexFlow) · bracket leg 10 px mirror (ScoreRenderer.ts:3313, VexFlow `tuplet.js`).
- **slurs & ties:** `CURVE.brokenSlurTiltPerStep` 0.25 (curveStyle.ts:53, Verovio) · `brokenSlurMinRise` 1.0 (:59) · `brokenSlurTieLikeSpan` 8.0 (:70) · `slurArticulationGap` 0.5 (:136, MuseScore) · `slurObstacleMarginMin`/`Max` 0.1/0.5 (:160,162) · `slurStemDodge` 0.35 (:182) · `slurStemNearBand` 0.25 (:185) · `tieLineClearance` 0.15 (:190) · `tieLineApexClearance` 0.3 (:210) · `tieLineMaxGrowth` 0.75 (:214) · `tieLift` 0.70 (:243) · `SLUR_HEIGHT_RATIO` 0.25 (:298) · `SLUR_CONTROL_ANGLE` (:375, ⛔ UNUSED record) · `SLUR_OBSTACLE_MARGIN_RATIO` 0.04 (:385) · `SLUR_EDGE_DISCOUNT_SPACES` 2.5 (:406) · curveFillGap 0.75 (curveArc.ts:23, Verovio) · `F0_1` saturate law (slurArchHeight.ts:52, LilyPond) · `DEFAULT_INDENT` 0.25 (slurShapeExperiment.ts:71) · accidental avoid fractions flat/sharp/natural (slurAccidentalPoint.ts:58-63, LilyPond) · `maxArchScale` bound (slurObstacles.ts:183, LilyPond) · control-point spacing span/(cps+2) (engrave/curves/curveInk.ts:65, VexFlow).
- **hairpins & dynamics:** `DYNAMICS_LINE.padding` 0.6 sp (layout/dynamicsLine.ts:79, LilyPond; ⚠️ same comment says "By eye … where the tuning starts") · `DYNAMICS_LINE.minFromStaff` 2.1 sp (:96, derived) · `HAIRPIN.AUTHORED_MIN_APERTURE` 1.0 (hairpinShape.ts:71, Dorico) · `MAX_APERTURE` 2.0 (:216, Gould p. 103) · `BOUND_PADDING` 1.0 (:256, LilyPond + Gould) · `BREAK_PADDING` 0.5 (:311, Gould p. 107 measured) · `MIN_FRAGMENT` 1.0 (:322, Verovio) · fragment thirds (:469-472, LilyPond + Verovio).
- **tempo & text / trills:** `DYNAMIC_TEXT_SIZE` 16 pt (dynamicStyle.ts:37, MuseScore + LilyPond) · `PT_TO_PX` 4/3 (drawnFontSize.ts:43, VexFlow unit) · `TEMPO_TEXT_FONT_SIZE` 18 pt (tempoStyle.ts:62, LilyPond + MuseScore) · `SCORE_TEXT_SPECS.title.sizeSpaces` 4.44 (ScoreHeaderPass.ts:90, MuseScore; 🚧 sketch) · `TRILL_SIGN_GAP` 0.3 sp (trillStyle.ts:187, LilyPond `bound-padding`).

**Added after the sweep (S9g–S9h, 2026-09-18)** — ported VexFlow rules, each number a row citing its
`file:line`, all **S (engine)**: `engrave/notes/voiceStack` `VOICE_SIDE_STEP_PAD_PX` 2 (`StaveNote.format`'s
`voiceXShift + 2`); `engrave/inheritedDefaults` `UNISON_SHARES_HEAD` true (`Tables.UNISON`, tables.js:593);
`layout/softmaxSpacing` `SOFTMAX_FACTOR` 10 (tables.js:594), `END_PADDING_MIN_PX` 5 / `END_PADDING_MAX_PX` 10 /
`STAVE_PADDING_PX` 12 (metrics.js:132–134), `MAX_ITERATIONS` 5 (`Formatter` default). ⏸️ The softmax ones decide
only a clef change after a bar's last onset, and go with the clef review (`vexflow-removal-map.md` §9.4 #5).

## 5. The F list (font facts, 37), condensed

- **fonts/bravuraMetrics.ts** (generated): `GLYPH_BOXES` 71 glyphs (:121), `GLYPH_ANCHORS` (:309), `ENGRAVING_DEFAULTS` 29 weights/gaps (:339). `fonts/fontMetrics.ts` compositions `secondDisplacement` 1.12, `flagInkRight`, `flagDropFromTip` 3.24, `ledgerExtension` 0.40 (:248-301). ⚠️ fontMetrics.ts holds **no** non-font house defaults. Its `ENGRAVING_DEFAULTS` are Bravura's own values, and several are overridden in the drawing (staff line 0.11, stem 0.15, ledger overhang 0.3).
- **layout/spacingPadding.ts INK tables** (measured, Bravura-checked): `INK.notehead` 1.13 (:76 — override "pending his eye" vs Bravura 1.18, font-metrics-plan.md §3.6 #2), `secondDisplacement` 1.13 (:84), `dotWidth` 0.4 (:102), `accidentalToHead` 0.1 (:111), `flagReach` 1.0 (:135 — "an OVERRIDE until that is settled"), `INK_HEIGHT` notehead/dot/ledger/flagFromTip (:168-181), `REST_HEIGHT` (:206-213), `ACCIDENTAL_HEIGHT` (:231-237), `ACCIDENTAL_WIDTH` (:272-278), `REST_WIDTH` (:302-309).
- **layout/headerInk.ts:** `CLEF_FULL` (:210-215), `CLEF_SMALL` (:218-223), `meterExtent` (:234). **layout/keySignatureLayout.ts:** `METER_PART_LEFT_AIR` 0.6 (:129, "a MODEL correction").
- **layout/barlineSign.ts:** repeat `DOT_WIDTH` ≈ 0.4 (:96). **layout/systemStartColumn.ts:** `BRACKET_SERIF_WIDTH_SPACES` 1.876 (:158).
- **rendering:** `CROSS_SYSTEM_BEAM_WIDTH` 0.5 (beamInk.ts:48) · `ACCIDENTAL_REACH_LINES` 1.4 (ledgerAccidentalClearance.ts:66) · `THIN_LINE_SPACES` 0.16 (thinLineWeight.ts:60) · flag `glyphReach` (engrave/notes/flag.ts:77) · `CURVE.thickness` = `slurMidpointThickness` 0.22 (curveStyle.ts:280, "still a taste call inside a real range", slur-plan.md §13.6) · `CURVE.outline` = `slurEndpointThickness` 0.10 (:284) · repeat dot / wing glyph size 3 × space pt = 1 em (BarlineRenderer.ts:143,242) · sub-bracket arm = `staffLineThickness` (systemStart.ts:299) · system sign glyph size 1 em (systemStart.ts:452) · `SIGN_FONT_SIZE` 30 pt = 1 em (KeySignaturePass.ts:113) · `LEDGER_LINE_STYLE.lineWidth` ≈1.23 × staff line (layoutConfig.ts:264 — ⏳ **OPEN decision C**, staff-line-research.md §3.3 "it is 2×, not 1.23×") · dynamic letter ink reach via glyphBox (dynamicMarkInk.ts:61) · SMuFL em = 4 sp (sceneInk.ts:50).

## 5b. The ? list (unsure, 31) — one line each, with the reason

Owed a **decision, not research**: the doc already holds the sources.
- `SIGN_SEPARATION_SPACES` 0.40 sp, layout/systemStartColumn.ts:82 — a font value borrowed for a gap no book states. braces-brackets-research.md §3.8 answers **UNKNOWN — checked, genuinely absent**.
- `INK.ledgerLeft/Right` ±0.30 sp overhang, layout/spacingPadding.ts:95-96 — VexFlow's value, not the font's 0.4. font-metrics-plan.md §3.6 #5; accidental-dot-research.md §4 A5.
- `Stem.WIDTH` 1.5 px @10 = 0.15 sp, engrave/notes/stem.ts:38 — "Nothing supports what we draw … it is HIS call". stem-length-research.md §3.4, §5.4; note-engraving-plan.md §1c.3.
- ✅ **stem LENGTH 3.5 sp — DECIDED, and the decision was *keep it*.** Now `STEM_LENGTH_PX`, engrave/engrave/inheritedDefaults.ts, used by engrave/notes/stemLength.ts (S6e / P3e, 2026-09-16). ⭐ The one row in that table the research CONFIRMS: four treatises for four state 3½ stave-spaces from the notehead centre, which is exactly VexFlow's `STEM_HEIGHT` = 35. stem-length-research.md §1. ⏳ Still owed by that doc: the ATTACHMENT point (§4) and the short-note minimums.
- small (mid-score) clef ⅔, engrave/header/clef.ts:34 — VexFlow's. clef-research.md §3 (Gerou & Lusk 75%, Gould ⅔).
- meter row gap 2.0 sp, engrave/header/meter.ts:39-51 — "UNKNOWN IN EVERY BOOK". header-spacing-research.md §2.8 row H.
- meter `lineShift` ±½ line, engrave/header/meter.ts:41 — "an unsourced compensation of theirs" (VexFlow). header-spacing-research.md §4.2.
- `BETWEEN_PARTS` 1.0 sp, layout/headerInk.ts:243 — a measurement of VexFlow. header-spacing-research.md §4.2, §3.6; clef-spacing-research.md PART 7.

Engine-copied or borrowed without a citation:
- `INK.firstDot`/`dotStep` 1.7/0.9 sp, layout/spacingPadding.ts:98,100 — VexFlow's placement, superseded in principle by `dotGap`. dot-placement.md; accidental-dot-research.md §2 B.
- pairPadding dot→next 0.5 sp, layout/spacingPadding.ts:415 — "Corrected by eye". The MuseScore row it seeds from runs the other direction. spacing-model-research.md §3.
- pairPadding note↔note 0.3 sp, layout/spacingPadding.ts:420 — justified by its result (lands on Sibelius/LilyPond), while MuseScore uses 0.1. spacing-model-research.md §3; spacing-model-plan.md §1.1.
- `KERN_CLEARANCE` 0.35 sp, layout/kerning.ts:88 — "A judgement rather than a measurement". accidental-dot-engines.md §2.2, §4; spacing-model-plan.md P3.1/P3.2.
- beamed stem assumed to reach the far staff edge, layout/measureColumns.ts:209 — a model heuristic. stem-length-research.md §2.1.
- `CURVE.slurLift` 1.0 sp, rendering/curveStyle.ts:40 — Gould gives only a ½ sp minimum. slur-tie-research.md §5 row 8 (MuseScore 0.9).
- `CURVE.slurStemOvershoot` 1.0 sp, rendering/curveStyle.ts:221 — "MuseScore's clamp", but no MuseScore line is quoted. slur-plan.md §12 Phase 1.
- `BROKEN_SLUR_MAX_SLOPE` 0.5, rendering/curveStyle.ts:325 — the idea is MuseScore's, the number is uncited. slur-plan.md §"Phase 5"; slur-tie-research.md §5 row 15.
- `LAYOUT_CONFIG.BARLINE_PADDING` 1 sp, rendering/layoutConfig.ts:122 — ⚠️ **apparently DEAD**: only comments reference it (measureColumns.ts:289, MeasureLayout.ts:171). barline-types-plan.md §5.
- format-width floor 50 px, rendering/ScoreRenderer.ts:2180 — a degenerate-bar clamp rather than a look. note-spacing-plan.md §4, R6.
- two-note tremolo tip offset ×1.5, rendering/ScoreRenderer.ts:1227 — "THIS is the one line to turn". It matches the beam level stride (beam-engraving-plan.md §2.1). two-note-tremolo-plan.md §"Beamed, or apart with flags".
- tuplet bracket air 5 px @10, rendering/ScoreTuplet.ts:147-175 + ScoreRenderer.ts:3304 — probably VexFlow's `tuplet.js`, but uncited. tuplet-control-plan.md §1–§2.
- tuplet bracket leg 10 px @10, rendering/ScoreTuplet.ts:180-181 — bare `location * 10`, which is VexFlow's. tuplet-control-plan.md §2.
- tuplet bracket thickness 1 px @10, rendering/ScoreTuplet.ts:170-180 + ScoreRenderer.ts:3331 — ⚠️ **conflicts** with thinLineWeight.ts's claim that tuplet brackets share 0.16 sp. staff-line-research.md §4.3.
- `MARK_INK` (dynamics ink in sp), rendering/dynamicsLinePass.ts:74 — a re-export of `dynamicStyle` 0.68/0.18. Don't count it twice.
- `TRILL_LINE.padding` 0.5 sp, rendering/trillStyle.ts:157 — ⚠️ **conflicting comments**: "LilyPond's `TrillSpanner` defaults" here, while ottavaStyle.ts:164 says the trill's 0.5/1.0 "were tuned by looking". trill-plan.md §1 rule 8, §10 P2.
- wiggle glyph size `/10`, rendering/TrillRenderer.ts:918 — `STAFF_SPACE_PX` inlined. A unit conversion, but the sign and the wiggle take different size paths. above-staff-ladder.md §pt vs px.
- `OTTAVA_NUMERAL_GAP` 0.3 sp, rendering/ottavaStyle.ts:173 — borrowed from the trill's LilyPond value. ottava-plan.md §1 (Gould pp. 28–34 unread).
- `OTTAVA_CONTINUATION_INSET` 2.0 sp, rendering/ottavaStyle.ts:229 — ⚠️ conflicting: "Taste — his eye picks" here, "his eye's value" at pedalStyle.ts:113, and ottava-plan.md §"HIS EYE" still lists it open.
- tempo draw origin `getYForTopText(1)`, rendering/TempoLayout.ts:450 — translated away by the line pass, so probably not a preset value. tempo-marks-plan.md §6.4.
- linear-view gutter bar number 11 px / 8 px lift / 10 px inset, rendering/GutterRenderer.ts:17-26 — editor chrome, arguably not engraving. linear-view-plan.md §"P3".

## 6. Suggested research batches (topics only)

Before any batch runs: **the ⭐ ALREADY ANSWERED and "owed a decision" rows above need his eye, not an
agent** (A4 margins, `MIN_SHARED_COLUMN_LINES`, `FAN_MIN_STEM_SPACES`, stem width/length, ledger overhang
0.3 vs 0.4, ledger thickness decision C, small clef ⅔, meter row gap, nested-sign gap). And the **nine
F-answerable ink ratios** (dynamic 0.68/0.18, trill 0.62/0.04, ottava 0.62/0.04, pedal 0.52/0.18, tempo ♩
0.75) are a glyph-box lookup against `fonts/bravuraMetrics.ts`, not research.

1. **Marks outside the staff — vertical placement and glyph size.** `TRILL/OTTAVA/PEDAL/TEMPO_LINE`
   `padding` + `minFromStaff`, the `tr` / `8va` / `Ped.` / ♩ / dynamic glyph sizes, the paren scale+raise
   (trill, ottava), `TEMPO_INK_BELOW` (text descender), the co-located dynamics `GAP`, the trill-padding
   source conflict. Start from: above-staff-ladder.md, ottava-plan.md §1 + §8 P0b, pedal-plan.md §12,
   trill-plan.md §10 P2, reference/README.md (Gould p. 337 measured; Gould pp. 28–34 now on disk).
2. **Line marks — horizontal shape and ends.** Ottava dash length/gap, hook, min line, end air,
   continuation insets (ottava/trill/pedal), `OTTAVA_NUMERAL_GAP`, `TRILL_END_INSET`, pedal min span /
   barline air / sign gap, `HAIRPIN.END_INSET`, `HAIRPIN.GROWTH_PER_SPACE`, the squeezed-wedge sliver.
   Start from: ottava-plan.md §"HIS EYE, 2026-08-13", pedal-plan.md §12, dynamics-line-and-hairpins-plan.md
   §2.4b–d + §13.1.
3. **Slur residue.** `slurLift`, `brokenSlurMaxRise`, `BROKEN_SLUR_MAX_SLOPE`, `slurNestGap`,
   `slurSlantMaxTravel`, `SLUR_ARCH_TILT`, `slurStemOvershoot`, the double-sharp avoid point. Start from:
   slur-tie-research.md §4.1, §5, §8.8; slur-plan.md Phases 1/5/6/8.
4. **Tremolo and tuplets.** Stroke centring rule, flag-stem stretch, stroke clearances (single and
   two-note), the two-note tip offset; tuplet number size, ratio-mark note scale and space, bracket
   air/leg/thickness/end gap (incl. the 1 px vs 0.16 sp conflict). Start from: tremolo-plan.md §4,
   two-note-tremolo-plan.md §2, tuplet-extension-plan.md §9, tuplet-control-plan.md §1–2.
5. **Small note-level gaps VexFlow left us.** Ledger overhang beside an accidental and under a rest
   (2 px, and the ghost's 3 px), `LEDGER_ACCIDENTAL_GAP`, `FAN_ACCIDENTAL_GAP`, cross-system beam stub
   ends + margin, `KERN_CLEARANCE`, pairPadding note↔note and dot→next, `INK.firstDot`/`dotStep`,
   `BETWEEN_PARTS`, meter `lineShift`. Start from: accidental-dot-research.md §4 A5,
   accidental-dot-engines.md, accidental-ledger-clearance.md, cross-barline-beaming-plan.md,
   beam-hook-research.md §8, spacing-model-research.md §3, header-spacing-research.md §4.2.
6. **Page and system frame.** `SYSTEM_GAP_SPACES` 11 (Gould measured 7.95/8.25 exists), `STAVE_HEIGHT`
   12, `MAX_MEASURE_WIDTH` 40, `USER_SPACE_LINE_FRACTION` 0.6, the 15 px format reserve (and its ghost
   duplicate), the 1000 px sketch canvas. Start from: vertical-spacing-research.md §3.1–3.2, §5,
   layout-plan.md §1–2, bar-width-plan.md §3, note-spacing-plan.md §4. (The score-header text baselines are
   a 🚧 SKETCH, so leave them out.)
