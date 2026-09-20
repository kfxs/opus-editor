> Companion to `docs/research/accidental-dot-research.md` (the treatises).

# The accidental and the augmentation dot, in four engines' SOURCE

**What this is:** a survey of the CODE that places exactly two note modifiers — the accidental and
the augmentation dot — in LilyPond, MuseScore, Verovio and VexFlow. Every number below has a
`file:line` behind it and was read at the use site, not at the declaration. ⛔ Nothing here is a
recommendation; §4 records where the engines disagree and §5 what could not be established.

⚠️ **Read from source, not measured from output.** No engine was built or run. Where a *white gap*
is quoted rather than a raw constant, the glyph width used for the subtraction is named.

---

## §1 What was surveyed

| engine | tree | HEAD / version | native unit | → staff spaces |
|---|---|---|---|---|
| LilyPond | `~/dev/engine-sources/lilypond` | `beedbfa075` (2026-08-03) | the **staff space** itself; `staff-position` = HALF spaces | ×1 (positions ÷2) |
| MuseScore | `~/dev/engine-sources/MuseScore` | `929d1e99d7` (2026-08-18), 4.x | the **spatium** = one staff space; `0.25_sp` literals | ×1 |
| Verovio | `~/dev/engine-sources/verovio` | `efff0bc992` (2026-08-18) | `m_drawingUnit` = **half** a staff space (`DEFAULT_UNIT 9.0`, `include/vrv/vrvdef.h:455`); `doubleUnit` = one space | ÷2 |
| VexFlow | `node_modules/vexflow/build/esm/src` (⚠️ gone from `node_modules` since S14 — the same build is kept at `~/dev/engine-sources/vexflow-5.0.0-npm/package/build/esm/src`) | **5.0.0** | raw **pixels**, `Tables.STAVE_LINE_DISTANCE = 10` (`tables.js:647`) | ÷10 |

Verovio's unit claim was checked, not assumed: `Doc::GetDrawingStaffSize` = `unit * 8`
(`src/doc.cpp:2037`) for a 5-line staff = 4 spaces, and `GetDrawingOctaveSize` = `unit * 7`
(`:2042`) for 7 diatonic steps — both only consistent with 1 unit = 1 diatonic step = 0.5 sp.

`belle/` and `musxdom/` are on disk and were **not** surveyed (outside the brief).

**Why VexFlow is the fourth witness:** it is the engine this editor ran (⚠️ 2026-09-19: VexFlow is REMOVED — its
placement rules below were transcribed EXACTLY into ours in S9c–f: `engrave/notes/accidentalStack`, `dotStack`,
`modifierStart`, run by `rendering/format/modifierColumns` — so its numbers are still what this editor does). As of 2026-09-14 the
accidental's and the dot's **ink** are ours (`src/engine/engrave/notes/accidental.ts`,
`src/engine/engrave/notes/augmentationDot.ts`) while their **placement** is still VexFlow's
(`Accidental.format`, `Dot.format`, `StaveNote.getModifierStartXY`) — with three of our own modules
already overriding pieces of it: `src/engine/rendering/format/dotPlacement.ts` (the notehead→dot gap),
`src/engine/rendering/format/ledgerAccidentalClearance.ts` (the accidental beside a ledger line) and
`src/engine/rendering/format/chordAccidentalColumns.ts` (the chord ORDER).

Glyph widths used for the white-gap arithmetic, from `verovio/fonts/Bravura/bravura_metadata.json`:
`augmentationDot` **0.4 sp** wide (±0.2 tall), `noteheadBlack` 1.18 sp, `accidentalFlat` 0.904,
`accidentalSharp` 0.996, `accidentalNatural` 0.672, `staffLineThickness` 0.13.

---

## §2 Engine by engine

### 2.1 LilyPond

Files: `lily/accidental-placement.cc`, `lily/accidental.cc`, `lily/accidental-engraver.cc`,
`lily/ledger-line-spanner.cc`, `lily/dot-column.cc`, `lily/dot-configuration.cc`,
`lily/dot-formatting-problem.cc`, `scm/define-grobs.scm`, `scm/output-lib.scm`, `mf/feta-dots.mf`,
`mf/feta-params.mf`, `mf/feta-{flats,sharps,naturals}.mf`.

**A1 — accidental→notehead: 0.35 staff spaces, SKYLINE to skyline.** Two properties add up, and
the second is easy to miss because it has no entry in `define-grobs.scm` and falls back to a C++
literal:

- `AccidentalPlacement.right-padding = 0.15` — `scm/define-grobs.scm:85`, read at
  `lily/accidental-placement.cc:399-400`, where the heads' left skyline is pushed 0.15 further left
  before anything is placed.
- `AccidentalPlacement.padding`, **C++ default 0.2** (`lily/accidental-placement.cc:397`; the grob
  definition does not set it), subtracted again per accidental group at `:416`.

The measurement is `Skyline::internal_distance` (`lily/skyline.cc:617-643`) — the maximum of
(accidental's right height + head's left height) over the **shared vertical band** only, with a
0.1 sp horizon padding (`:406`). So this is ink-to-ink in a band, not box-to-box. Flats get an
extra brake: `lily/accidental.cc:63-81` merges an artificial box reaching `0.375 ×` the glyph's
width into a flat's RIGHT skyline, so a flat's thin vertical stem cannot be tucked into.

**A2 — vertical: exactly the head's line.** `lily/accidental-engraver.cc:312` sets the note head as
the accidental's **Y parent**, and the `Accidental` grob defines `X-offset` but no `Y-offset`
(`scm/define-grobs.scm:35-55`), so `Y = 0` relative to the head, always.

**A3 — chord stacking.** Accidentals are grouped by **note NAME** at
`Accidental_placement::add_accidental` (`lily/accidental-placement.cc:56-80`): the key is the
note-name (plus a per-voice hash when `accidentalGrouping = voice`), so the same letter in different
octaves forms ONE column — octave alignment is structural, not a special case. Inside a group
(`set_ape_skylines`, `:253-300`) same-octave accidentals of the *same* alteration are printed in
overstrike; of a different alteration, each is shifted left by its own width + `padding`. Groups are
then sorted by **SIZE — biggest closest to the note** (`ape_less`, `:137-146`; the comment at
`:195-199` says this "allows accidentals to be on-average closer to notes while still preserving
octave alignment"), and equal-sized groups are staggered alternately from the outside in
(`stagger_apes`, `:192-230`). Finally `position_apes` (`:391-437`) lays them out **right to left**,
each pushed just clear of the accumulated skyline of heads + already-placed accidentals. Within a
note, naturals sort as the "largest" so they are never confused with cancellation naturals
(`acc_less`, `:160-190`). The header comment at `:441-458` is explicit that the ideal is a C-shape
and that the implemented strategy is the simple one because the problem "looks NP hard".

**A4 — between columns: `padding` = 0.2 sp**, the same literal, same skyline measure
(`lily/accidental-placement.cc:397`, used at `:416` and again at `:289`).

**A5 — ledger shortening: YES, and the rule is a MIDPOINT.**
`lily/ledger-line-spanner.cc:358-368`: when a ledger's position falls inside the accidental glyph's
declared vertical band, the ledger's left end is moved to

```
dist = (accidental's right edge + notehead's left edge) / 2
```

— i.e. the ledger stops **halfway between the accidental and the head**, so the shortening is
whatever that midpoint costs rather than a fixed amount. The band is a **per-glyph font metric**
(`accbot`/`acctop`, emitted into the font table by `scripts/build/mf-to-table.py:108-109`, read at
`lily/ledger-line-spanner.cc:266-267` and converted to half-spaces): flat `0 … 0.8 sp`
(`mf/feta-flats.mf:262-263`), sharp `−0.8 … 1.0 sp` (`mf/feta-sharps.mf:208-209`), natural
`−1.8 … 1.0 sp` (`mf/feta-naturals.mf:204-205`). Unshortened, a ledger overhangs by
`length-fraction = 0.25` × the head's width on each side (`scm/define-grobs.scm:2069`, used at
`lily/ledger-line-spanner.cc:206` and `:231`).

**B1 — notehead→dot: ONE DOT WIDTH ≈ 0.45 sp.** `DotColumn.padding` is not a number at all but a
callback, `dot-column-interface::pad-by-one-dot-width` (`scm/define-grobs.scm:1264`,
`scm/output-lib.scm:692-704`), which returns the max X-extent of the dot stencils. The column is
translated to `cfg.x_offset() + padding` (`lily/dot-column.cc:229-232`), where `x_offset`
(`lily/dot-configuration.cc:125-133`) is the head/stem/flag skyline's right edge at each dot's own
vertical position. The dot's diameter is `(staff_space − stafflinethickness) / 2`
(`mf/feta-dots.mf:23`); at the default 20 pt staff, line thickness = 0.50 pt = 0.10 sp
(`mf/feta-params.mf:41`, mirrored in `scm/paper.scm:52-60`), giving **0.45 sp**.

**B2 — on a line, and seconds.** `lily/dot-column.cc:219-224`: an on-line dot is entered into the
configuration and then immediately treated as a *collision*. `Dot_configuration::shifted`
(`lily/dot-configuration.cc:63-98`) moves an on-line dot by **one half-space (0.5 sp)** and an
already-occupied in-space dot by **two half-spaces (1.0 sp)**. Direction is chosen by
`Dot_configuration::badness` (`:26-45`), which squares the distance moved, adds 2 if the move
contradicts an explicit `Dots.direction`, and otherwise **adds 1 to any move that is not UP** — so
"up unless that costs more" is an optimiser's preference, not a hardcoded sign. `remove_collision`
(`:108-121`) builds both the up- and the down-shifted configuration and keeps the cheaper.
`DotColumn.chord-dots-limit = 3` (`scm/define-grobs.scm:1262`, enforced at
`lily/dot-column.cc:148-176`) **kills** dots — by `suicide()`, from the ends of the stem inward —
once a chord would need more dot rows than `(chord span + 2 + limit) / 2`.

**B3 — dot to dot: the same one dot width, 0.45 sp.** `ly:dots::print`
(`scm/output-lib.scm:686-690`) stacks `dot-count` copies with `padding = the dot's own X-extent`.
⭐ LilyPond is the only engine surveyed in which the notehead→dot gap and the dot→dot gap are
**literally the same expression**.

**B4 — a dot on a rest: same gap, different vertical.** The rest's extent joins `base_x`
(`lily/dot-column.cc:95-99`) so the same one-dot-width padding applies; `Dot_column::add_head`
(`:249-257`) pre-translates a rest's dot by `rest width + padding` and that translation is undone at
`:194-196`. Vertically, `dots::calc-staff-position` (`scm/output-lib.scm:652-664`) adds a
per-duration offset in half-spaces **only for rests** — whole `−2`, 32nd/64th `+2`, 128th/256th
`+4`, 512th/1024th `+6`, everything else `0` — on top of the rest's own position, after which the
on-line correction above still applies.

**B5 — drawn size: diameter `(staff_space − stafflinethickness)/2` ≈ 0.45 sp**
(`mf/feta-dots.mf:23`, `:27-34`) — a drawn pen circle in the METAFONT source, i.e. the dot is
*defined* as a function of the staff line thickness rather than being a fixed glyph.

---

### 2.2 MuseScore 4.x

Files: `src/engraving/style/styledef.cpp`, `src/engraving/rendering/paddingtable.cpp`,
`src/engraving/rendering/score/accidentalslayout.cpp`, `.../chordlayout.cpp`, `.../restlayout.cpp`,
`.../tlayout.cpp`, `src/engraving/dom/{notedot,rest}.cpp`,
`src/engraving/internal/engravingfont.cpp`.

⚠️ **Accidental placement is NOT in `chordlayout.cpp`.** Since 4.4 it is a dedicated 1161-line
module, `rendering/score/accidentalslayout.cpp`, invoked once per segment from
`chordlayout.cpp:2284` (grace chords separately at `:2286`). Dots remain arithmetic inside
`chordlayout.cpp` (`placeDots`, `setDotRelativeLine`, `setDotX`) and `restlayout.cpp`.

**A1 — 0.25 sp**, `styledef.cpp:284` `styleDef(accidentalNoteDistance, 0.25_sp)`, loaded into the
padding table at `paddingtable.cpp:215` (`ACCIDENTAL → NOTE`) and consumed at
`accidentalslayout.cpp:809` (`computePadding`, scaled by the mean of the two elements' `mag()`),
which feeds `minAccidentalToChordDistance()` (`:745`) and thence `stackAccidental()` (`:291`).

The clearance is **shape-to-shape with SMuFL cut-outs**, not bbox-to-bbox:
`accidentalslayout.cpp:273` builds the chord's shape from `note->symShapeWithCutouts(noteSym)`, and
`EngravingFont::constructShapeWithCutouts` (`internal/engravingfont.cpp`) decomposes a glyph into up
to six rectangles using the font's `cutOutNW/NE/SW/SE` anchors. The 0.25 sp is small *because* the
boxes are already tight.

Four exceptions, all in `computePadding` (`:785-805`) and `additionalPaddingForVerticals` (`:930`):
flat/double-flat over a ledger line below its own note → **0.0**; sharp over a ledger more than
1.1 sp below → **0.0**; flat/double-flat against a lower note → **0.15 sp**
(`reducedFlatToNotePadding`, `:63`); an unbracketed **natural** against a stem or another
natural/flat → **+0.1 sp** (`:59`), because of its vertical strokes.

⚠️ Do not confuse this with `paddingtable.cpp:57-58`, `NOTE → ACCIDENTAL = max(0.25, 0.35) sp` —
that is one chord's notehead against the NEXT chord's accidental, a horizontal-spacing figure.

**A2 — never moved vertically.** `tlayout.cpp:536` sets `ldata->setPos(PointF())`, and
`stackAccidental` (`accidentalslayout.cpp:291-308`) calls only `setXposRelativeToSegment`, which
touches `setPosX` alone (`:1105`). `verticallyAlignAccidentals` (`:953`) despite its name aligns
**x** (right-edge alignment of a vertical set, `:1059`). Every collision is resolved by moving left.

**A3 — chord stacking.** `doAccidentalPlacement` (`:141`): collect and park redundant/invisible
signs (`:110`, `:130`) → tag octave and second partners (`:155`) → **split into sub-chords wherever
consecutive accidentals are a seventh or more apart** (`LINE_DIFF_OF_SEVENTH = 6`, `:175-184`), with
small adjacent groups re-merged (`:205`) → choose an ordering per sub-chord (`determineStackingOrder`,
`:527`): **≤3** standard zig-zag (`:573` — top, bottom, next top…, pulling an octave partner in
immediately after its mate), **>6** compact (`:600` — same zig-zag but greedily filling each column
before moving on), **4–6** *both are computed and the one yielding fewer columns wins*
(`computeOrderingWithLeastColumns`, `:541`) → stack (`:291`) → align octave sets by right edge
(`:953`).

The fit test is `canFitInSameColumn` (`:903`): the two accidentals' bboxes are translated to their
notes' y and asked whether their **vertical** ranges intersect once inflated by the vertical
padding — no x is involved. Two naturals a **sixth** apart are declared to fit unconditionally
(`isExceptionOfNaturalsSixth`, `:896`) and do not even increment the column counter (`:851-853`).
The x itself comes from `minAccidentalToAccidentalGroupDistance` (`:812`), a bounded (`safetyNet`
50) shift-left loop.

Four ordering rules ship **off** (`styledef.cpp:288-291`, read at `:69-72`):
`accidentalOrderFollowsNoteDisplacement`, `alignAccidentalOctavesAcrossSubChords`,
`keepAccidentalSecondsTogether`, `alignOffsetOctaveAccidentals`. `alignAccidentalsLeft` is marked
**OBSOLETE** (`styledef.cpp:286`).

**A4 — 0.25 sp horizontally** (`styledef.cpp:283` `accidentalDistance`, read at
`accidentalslayout.cpp:68`, applied in `horizontalPadding`, `:1158`) — note this is **not** in the
padding table; there is no `ACCIDENTAL → ACCIDENTAL` row. The vertical clearances are hardcoded
under a comment that calls them exactly that (`:55-58`): accidental↔accidental **0.15 sp**,
**sharp↔sharp 0.05 sp**, accidental↔chord **0.10 sp**.

⭐ And there is deliberate **negative** kerning: a flat/double-flat three lines above a
flat/double-flat/natural overlaps it — `flatKerningOfFourth = −0.15 sp`, `naturalKerningOfFourth =
−0.05 sp` (`:64-65`, `isExceptionOfFourth` `:877`, `kerningOfFourth` `:921`), disabled when either
sign is bracketed at full size (`:884-887`).

**A5 — NO shortening. The code exists and is commented out.**
`chordlayout.cpp:1361-1365`:

```
// Experimental:
// shorten ledger line to avoid collisions with accidentals
// TODO: do something with the following `accid` flag
```

The `LedgerLineData::accidental` flag it would have set (`:1322`) is only ever read as
`!d.accidental` (`:1370`), so it is dead. Ledger lines are a flat `ledgerLineLength = 0.33 sp` per
side (`styledef.cpp:279`, used at `chordlayout.cpp:1311`, `:2035`). The accidental is allowed to
**overlap** the ledger instead: `ACCIDENTAL → LEDGER_LINE = 0.18 sp` (`paddingtable.cpp:216`), or
0.0 for flats and low sharps (`accidentalslayout.cpp:791-801`) — with one brake,
`kerningLimitationsIntoChord` (`:767`): a **natural or sharp** whose ink spans a ledger's y is
pushed back out to `sharpAndNaturalLedgerLinePadding = 0.1 sp` (`:62`), because those two glyphs'
horizontal bars would read as an extension of the line.

**B1 — 0.5 sp from the notehead's right edge.** `styledef.cpp:304`
`styleDef(dotNoteDistance, 0.5_sp)`; the anchor is `chordlayout.cpp:2800`
`dotX = noteX + note->headBodyWidth() + chord->pos().x()`, max-reduced across the chord into
`chord->dotPosX()`; the use site is `chordlayout.cpp:3193` (`d`) → `:3227-3229`
(`setPosX(visibleX)`). Since a `NoteDot`'s bbox is `symBbox(augmentationDot)` starting at 0, this is
**0.5 sp of white space, edge to edge**. Also reserved as right-side room at `:265-268` and `:2206`.
Padding row `NOTEDOT → NOTE = max(dotNoteDistance, dotDotDistance) = 0.65 sp`
(`paddingtable.cpp:94-95`), so a double dot costs a following chord the same as a single one.

`correctMag` (`:3192`) is the **chord's** mag when the chord has more than one note, so cue notes in
a mixed chord still align their dots; different-sized dots are **centre**-aligned, not left-aligned
(`:3197-3201`).

**B2 — ±0.5 sp, with claimed slots.** `chordlayout.cpp:2461` `bool onLine = !(note->line() & 1);`
and `setDotRelativeLine` (`:2560-2562`) `y = dotMove / 2.0` × spatium — so `dotMove = ±1` is **half
a staff space**. The direction is *not* a blanket "up": `placeDots` (`:2461-2537`) walks the chord
bottom-up (`:2478`) then top-down (`:2497`), seeding each from the note's own `dotPosition`
property (a user-settable `DirectionV`, default AUTO), with opposite default biases per pass
(`:2483`, `:2501`). The collision rule is a claimed-slot list, `anchoredDots` (`:2473`): if the
wanted slot is taken, `dotMove = -dotMove` (`:2486-2490`, `:2504-2508`). Invisible and visible dots
are kept in separate universes (`:2480`, `:2499`).

The **seconds/unison case** is separate (`:2539-2554`): a note in a *space* sharing a line with
another note of the same chord moves by `±2` = **1.0 sp**, the sign from
`adjustDown = (voice & 1) && !chord->up()`.

⭐ Across voices with shared noteheads and equal dot counts, one dot set is **hidden outright**
rather than displaced (`:2067-2089`). And an up-stem chord's dots are pushed clear of a visible
**hook** by replacing `d` with the hook's full width (`:3202-3211`).

**B3 — 0.65 sp, origin to origin** (`styledef.cpp:306` `dotDotDistance`, used at
`chordlayout.cpp:3194`, `:3228`) — `visibleX += dd` regardless of glyph width, so with Bravura's
0.4 sp dot the **white gap is 0.25 sp**, half the notehead→dot gap. Invisible dots get their own
deliberately distinguishable ladder at `0.1 × spatium` + glyph width (`:3224-3233`,
`restlayout.cpp:145-148`); tablature halves `dd` (`:3217-3221`).

**B4 — a rest uses the SAME two constants.** `restlayout.cpp:141-142` reads `dotNoteDistance` and
`dotDotDistance`, measured from `symWidthNoLedgerLines` (the rest glyph without the whole rest's
ledger stub). ⚠️ `Sid::dotRestDistance` (`styledef.cpp:305`, 0.25 sp) is **DEAD** in 4.x — no `.cpp`
or `.h` reads it; it survives only so old files round-trip. Vertically the rest dot does not follow
the rest's y but a fixed per-duration line, `restlayout.cpp:144` `y = item->dotLine() * spatium * .5`
from `Rest::getDotline()` (`dom/rest.cpp:2060-2083`): whole/measure `+1` (+0.5 sp), 32nd/64th `−3`
(−1.5 sp), 128th and shorter `−5` (−2.5 sp), everything else `−1` (−0.5 sp).

**B5 — `SymId::augmentationDot` × `dotMag`, default 1.0** (`dom/notedot.cpp:64-67`,
`styledef.cpp:303`), i.e. the glyph at its natural SMuFL size — but `dotMag` is a live user knob
exposed in the Edit Style dialog (`src/notationscene/widgets/editstyle.cpp:603`), not a dead
constant.

---

### 2.3 Verovio

Files: `src/accid.cpp`, `src/adjustaccidxfunctor.cpp`, `src/calcdotsfunctor.cpp`,
`src/adjustdotsfunctor.cpp`, `src/note.cpp`, `src/chord.cpp`, `src/view_element.cpp`,
`src/view_graph.cpp`, `src/boundingbox.cpp`, `src/calcledgerlinesfunctor.cpp`, `src/options.cpp`,
`src/doc.cpp`, `include/vrv/elementpart.h`.

**A1 — `rightMarginAccid = 0.5 unit = 0.25 sp**, ink to ink.` `src/options.cpp:1766-1768`
(`m_rightMarginAccid.Init(0.5, 0.0, 2.0)`, "The right margin for accid in MEI units"), read at
`src/doc.cpp:2186`, used at `src/accid.cpp:172` inside `Accid::AdjustX` and consumed at `:222` via
`HorizontalRightOverlap(...)`, applied at `:227` `SetDrawingXRel(GetDrawingXRel() - xRelShift)`.

⭐ There is no fixed offset anywhere: an accidental *starts* at the note's own alignment x
(`src/layerelement.cpp:406-411`) and is only ever moved LEFT (`src/accid.cpp:226`, comment "Move
only to the left"). The 0.25 sp is a clearance added to a **measured** overlap. And the overlap is
measured on SMuFL cut-out sub-rectangles (`BoundingBox::GetRectangles`, `src/boundingbox.cpp:250-266`
and `~564`), decomposing each glyph into two or three boxes from its `cutOutNE/SE/NW/SW` anchors,
so a flat's bowl can sit inside a notehead's notch.

**A ledger-line note gets a bigger margin**, not a shorter line: `src/accid.cpp:182-185` raises the
margin to `ledgerLineExtension × unit + 0.5 × rightMarginAccid` = `0.54 + 0.25 = 0.79 unit` =
**0.395 sp** (`m_ledgerLineExtension.Init(0.54, …)`, `src/options.cpp:1384`). A separate
`leftMarginAccid = 1.0 unit = 0.5 sp` (`src/options.cpp:1697`, `src/doc.cpp:2149`,
`src/adjustxposfunctor.cpp:352-357`) governs what stands to the accidental's LEFT.

**A2 — exactly the head's y.** `src/calcalignmentpitchposfunctor.cpp:63-79` writes a `YRel` for an
accid only when it is not a note's child (mensural/neume) or has explicit `@ploc/@oloc/@loc`; for an
ordinary `<note><accid/></note>` nothing is written, so `src/layerelement.cpp:448` resolves it to the
note's y verbatim (drawn at `src/view_element.cpp:287`). The `verticalMargin = unit / 4` (0.125 sp)
at `src/accid.cpp:187` is only a **band gate** for `VerticalSelfOverlap` — "does this accidental
even concern that element" — never a placement.

**A3 — chord stacking.** `AdjustAccidXFunctor::VisitAlignmentReference`
(`src/adjustaccidxfunctor.cpp:37-129`): sort **top-down** by drawing y, natural last on a unison
tie (`AccidSpaceSort`, `include/vrv/accid.h:200-215`) → **octave pass** (`:55-92`), grouping same
pitch-name/same-sign octaves via `AccidOctaveSort` (`src/accid.cpp:378-389`) into one column, pulled
back to the group's leftmost only when the correction is under half the accidental's own width
(`:87`) → **unison pass** (`:94-98`), copying the partner's `XRel` → **zig-zag** (`:100-126`),
top/bottom alternating, keeping several accidentals of one note in written order. Every placement is
`AdjustAccidWithSpace` (`:181-196`) against *every* element in the alignment reference, recording
into `m_adjustedAccids` so nothing is placed twice. ⭐ After a shift, `Accid::AdjustX` **recurses**
over the accidentals it had previously judged clear (`src/accid.cpp:230-236`) — a relaxation, not a
one-pass column assignment.

**A4 — 0.66 × 0.5 unit = 0.33 unit = 0.165 sp.** `src/accid.cpp:173-176`, literally
`if (element->Is(ACCID)) { horizontalMargin *= 0.66; }` under the comment "Reduce spacing for
successive accidentals". Identical signs at identical y are not separated at all — they are declared
unisons and superimposed (`:195-204`).

**A5 — NO for accidentals; the accidental moves instead** (to the 0.395 sp above; `src/accid.cpp:141`
in `AdjustToLedgerLines`, called at `:190`). One refinement at `:149-155`: a flat/double-flat whose
ink crosses only the *first* ledger above the staff is measured from `GetCutOutRight(...)` rather
than its full right edge, so the bowl may sit under the line. Ledger lines **are** shortened in
Verovio — but only against *each other*: `CalcLedgerLinesFunctor::AdjustLedgerLines`
(`src/calcledgerlinesfunctor.cpp:117-204`) shrinks neighbouring dashes toward a floor of
`0.20 unit = 0.1 sp` (`src/doc.cpp:2104-2107`), splitting the gap proportionally between cue and
normal (`:163-166`). Accidentals play no part in it.

**B1 — the dot's CENTRE at the head's right edge + 1 unit (0.5 sp) ⇒ 0.3 sp of white.** The anchor
is `src/calcdotsfunctor.cpp:121-122` `xRel = 2 * radius + flagShift`, where `radius` is
`GetGlyphWidth(noteheadGlyph)/2` (`src/layerelement.cpp:658`) — the head's advance width, no
constant. The gap is added at draw time, `src/view_element.cpp:899`
`x = dots->GetDrawingX() + GetDrawingUnit(staffSize) * offsetFactor` with `offsetFactor` 1.0
(0.75 `m_graceFactor` for cue). `View::DrawDot` centres a circle on that x, so with radius 0.2 sp
the white gap is **0.3 sp**. A chord's dots share one column by `max`-ing over the notes (`:96`).
A dot colliding with an up-flag shifts by **0.8 × the width of `flag8thUp`** — marked
`// HARDCODED` at `src/calcdotsfunctor.cpp:92` and `:116`, with a measured test
(`IsDotOverlappingWithFlag`, `:179-197`). `Dots` has no entry in `GetLeftMargin`/`GetRightMargin`
(`src/doc.cpp:2148-2186`), so it falls through to a default margin of 0.0.

**B2 — one unit (0.5 sp), up or down by rule, and a `std::set` does the merging.**
`Note::CalcDotLocations` (`src/note.cpp:1023-1035`):

```
const bool isUpwardDirection = (GetDrawingStemDir() == STEMDIRECTION_up) || (layerCount == 1);
const bool shiftUpwards = (isUpwardDirection == primary);
if (loc % 2 == 0) loc += (shiftUpwards ? 1 : -1);
```

`loc` is in diatonic steps (1 loc = 1 unit = 0.5 sp), even = on a line. A paint-time safety net at
`src/view_element.cpp:2086-2088` raises any dot still on a line by one unit, always up.
`LayerElement::CalcOptimalDotLocations` (`src/layerelement.cpp:909-…`) computes both the primary and
the secondary solution and, for two layers, picks between them.

The chord case is `Chord::CalcDotLocations` (`src/chord.cpp:580-596`) → `CalculateDotLocations`
(`~:555`), which walks a preference chain `{0, +1, −1, −2, +2}` (negated when reversed), skipping
even (on-line) candidates and inserting into a **`std::set`** — so two notes resolving to the same
loc silently **share one dot**, and two notes a second apart are forced apart by the chain. The map
is per staff (`MapOfDotLocs m_dotLocsByStaff`, `include/vrv/elementpart.h:84`), which makes
cross-staff chords fall out for free. Across layers, `AdjustDotsFunctor`
(`src/adjustdotsfunctor.cpp:37-75`) groups dots within `unit/3` horizontally (1/6 sp) and `2·unit/3`
vertically (1/3 sp) and aligns the group to its **rightmost** member.

**B3 — 1.5 unit = 0.75 sp, centre to centre** — `src/view_element.cpp:2098-2099`, marked
`// HARDCODED`; × 0.75 for cue. With a 0.4 sp dot that is **0.35 sp of white**.

**B4 — a rest dot goes UP, always, and gets a per-duration climb.**
`src/calcdotsfunctor.cpp:128-177`: `if ((loc % 2) == 0) loc += 1;` (`:152`, no stem-direction
alternative), then extra upward steps for short rests whose glyphs climb — 32nd/64th `+2`,
128th/256th `+4`, 512th `+6`, 1024th `+8` (`:156-164`). Horizontally the anchor is
`unit * 2.5 = 1.25 sp` (`:169`, `// HARDCODED`) for a half rest or longer, and the rest glyph's own
measured width for a quarter or shorter (`:171-172`) — the draw-time `+1 unit` is then added as for
notes. Mensural rests get no `Dots` object at all (`:130-133`); breves and longer are skipped
(`:136`).

**B5 — not a glyph at all: a drawn circle.** `View::DrawDot`, `src/view_graph.cpp:203-213`:
`r = max(GetDrawingDoubleUnit(staffSize) / 5, 2)` = **0.2 sp radius, 0.4 sp diameter**, × 0.75 for
cue. `SMUFL_E1E7_augmentationDot` is never used for the CMN augmentation dot. In mensural notation
the same routine draws a diamond instead (`src/view_element.cpp:2093`).

---

### 2.4 VexFlow 5.0.0 (what this editor runs today — ⚠️ since 2026-09-19 as our own transcription, not the library)

⚠️ **Check the override chain.** `Modifier.setXShift` (`modifier.js:87-95`) **negates** its argument
when `position === LEFT` — so an accidental's stored `xShift` is negative while `Element.renderText`
(`element.js:331-338`) adds it. Reading `Accidental.format`'s positive offsets without that override
gives the sign of every accidental shift backwards.

**A1 — 3 px = 0.30 sp**, from two constants in two files:

- `StaveNote.getModifierStartXY` (`stavenote.js:526`) `x = -1 * 2` — a flat **2 px** for every LEFT
  modifier, applied at `accidental.js:323-324` (`this.x = start.x - this.width`);
- `Metrics.Accidental.noteheadAccidentalPadding = 1` (`metrics.js:74`), folded into `leftShift` at
  `accidental.js:20` and thence into every accidental's `xShift` via `columnXOffsets[0]`
  (`:180-181`, `:195-196`).

Measured bbox to bbox — no cut-outs, no skyline, no shared-band test. (Also `NoteHead.minPadding`,
`stavenote.js:37`, is unrelated to this gap.)

**A2 — exactly the head's y**: `accidental.js:325` `this.y = start.y`, where `start.y` is
`this.ys[index]` (`stavenote.js:563`), the notehead's own y. The `restShift` switch at `:541-560`
applies to rests only.

**A3 — chord stacking: a LOOKUP TABLE, not a solver.** `Accidental.format`
(`accidental.js:16-203`): collect one record per accidental with its line rounded to the nearest
half (`:37-40`) → sort by **line descending** (top first, `:57`) → collapse to one metric per
distinct line, tracking whether that line is all-flats or all-double-sharps (`:58-88`) → walk the
lines forming **conflict groups** with `checkCollision` (`:204-218`): a clearance requirement of
**3.0 lines**, relaxed to **2.5** when the relevant neighbour is a flat or double sharp, with a
further 0.5 credit against a double sharp → assign each group member a column number by looking up
`Tables.accidentalColumnsTable[groupLength][endCase]` (`tables.js:153-190`), where `endCase` is one
of `a`, `b`, `secondOnBottom`, `spacedOutTetrachord`, `spacedOutPentachord`,
`verySpacedOutPentachord`, `spacedOutHexachord`, `verySpacedOutHexachord`, chosen by the special
cases at `accidental.js:110-143`. Groups of **7 or more** fall out of the table and get a computed
repeating pattern whose length grows until no collision remains (`:145-166`).

Note that this editor already **replaces the ORDER** with its own `chordAccidentalColumns`
(`src/engine/rendering/format/chordAccidentalColumns.ts`), keeping VexFlow's packing machinery (⚠️ ported since S9d: `engrave/notes/accidentalStack`).

**A4 — `Accidental.accidentalSpacing = 3` px = 0.30 sp** (`metrics.js:76`), added after each
accidental within a line (`accidental.js:87`, `:197`); column x-offsets accumulate the widest line
in each column (`:182-190`). A further `Accidental.leftPadding = 2` px = 0.20 sp (`metrics.js:75`)
is added to `state.leftShift` afterwards (`:201`) for whatever stands further left.

**A5 — NO.** `StaveNote.drawLedgerLines` (`stavenote.js:686-729`) computes
`width = glyphWidth + strokePx * 2` and never consults a modifier; `strokePx` defaults to
`StaveNote.LEDGER_LINE_OFFSET = 3` px = **0.3 sp overhang per side** (`stavenote.js:34-36`; grace
notes 2 px, `gracenote.js:9-11`). Because that 3 px equals the 3 px accidental standoff above, a
ledger line's tip lands *exactly* on the accidental's right arm — which is why this editor added
`src/engine/rendering/format/ledgerAccidentalClearance.ts` (shifts the sign out to a 2 px = 0.2 sp ink gap
**and** trims the ledger's overhang beside it from 3 px to 2 px).

**B1 — 2 px = 0.20 sp.** `StaveNote.getModifierStartXY`'s RIGHT branch (`stavenote.js:528-534`)
`x = this.getGlyphWidth() + this.xShift + 2`, plus the flag's width when the note is stem-up **and**
of a flagged duration (so a *beamed* eighth gets the flag allowance with no flag drawn). `Dot.format`
seeds each dot's shift from `note.getFirstDotPx()` (`dot.js:45`, `note.js:307-314`), which is the
right-displaced-head offset plus any parenthesis.

**B2 — half a space, up, unless a neighbour has taken the space.** `Dot.format`
(`dot.js:65-84`): a head at a half-integer `line` is in a space → `halfShiftY = 0`; otherwise (on a
line) `halfShiftY = 0.5` and `dot.dotShiftY = -0.5`, i.e. **up half a space** (`dot.js:122`
`y = start.y + dotShiftY * lineSpace`). Two exceptions flip it **down**: the previous (higher) note
is a second away (`lastLine - line === 0.5`), or the target space is already `prevDottedSpace`.

**B3 — `dotSpacing = 1` px = 0.10 sp** (`dot.js:31`, stepped at `:91`) — the tightest dot-to-dot
figure of the four by a factor of 2.5. This editor widens it: `reserveDotRoom` in
`src/engine/rendering/format/dotPlacement.ts` inflates each dot's width so the step lands at half a space.

**B4 — rests: same x, and a per-glyph y.** `dot.js:85-87` *accumulates* (`+=`) into `dotShiftY` for
a rest instead of assigning, and `halfShiftY` is only recomputed for non-rests — so a rest dot takes
whatever the previous note left. The real rest adjustment is the glyph switch in
`getModifierStartXY` (`stavenote.js:541-560`): whole/double-whole `+0.5` line spacings,
half/quarter/8th/16th `−0.5`, 32nd/64th `−1.5`, 128th `−2.5`.

**B5 — `Glyphs.augmentationDot` as TEXT at the note's own font** (`dot.js:105-106`,
`setNote` at `:109-112`) — no magnification of its own; Bravura's 0.4 sp.

---

## §3 The comparison tables

Every figure in **staff spaces**. "white" = the visible gap between two inks, computed with
Bravura's `augmentationDot` 0.4 sp where the engine's constant is a pitch rather than a gap.

### A. The accidental

| | LilyPond | MuseScore 4 | Verovio | VexFlow 5 |
|---|---|---|---|---|
| **A1** accidental→notehead | **0.35** = `right-padding` 0.15 + `padding` 0.2, *skyline in a shared band* (`accidental-placement.cc:397-416`, `define-grobs.scm:85`) | **0.25** `accidentalNoteDistance`, *shape with SMuFL cut-outs* (`styledef.cpp:284` → `paddingtable.cpp:215` → `accidentalslayout.cpp:809`); 0.0 for flats/low sharps over a ledger; 0.15 flat→lower note; +0.1 for naturals vs. verticals | **0.25** `rightMarginAccid` 0.5 unit, *cut-out rectangles* (`options.cpp:1766` → `accid.cpp:172,222`); **0.395** when the note has ledger lines (`accid.cpp:182-185`) | **0.30** = 2 px `getModifierStartXY` (`stavenote.js:526`) + 1 px `noteheadAccidentalPadding` (`metrics.js:74`), *plain bbox* |
| **A2** vertical anchor | the head's line **exactly** — head is the Y parent, no `Y-offset` (`accidental-engraver.cc:312`, `define-grobs.scm:35-55`) | the head's line **exactly**; accidentals are **never** moved vertically (`tlayout.cpp:536`; only `setPosX` in `accidentalslayout.cpp:1105`) | the head's line **exactly**; `unit/4` is a band *gate* only (`accid.cpp:187`) | the head's line **exactly** (`accidental.js:325`, `stavenote.js:563`) |
| **A3** chord order + fit test | group by **note NAME** (octaves = one column); columns sorted **biggest-first, closest to the note**, equal sizes staggered; placed right-to-left by **skyline distance** (`:56-80`, `:137-146`, `:192-230`, `:391-437`) | split at a **seventh**; ordering by group size — zig-zag (≤3) / compact (>6) / **both computed, fewer columns wins** (4–6); fit = **vertical bbox overlap** inflated by vertical padding (`:141`, `:527-620`, `:903`) | sort **top-down**; octave pass, unison pass, then zig-zag; **shift-left-only relaxation that re-tests** already-cleared signs (`adjustaccidxfunctor.cpp:37-129`, `accid.cpp:230-236`) | sort by line desc; conflict groups by a **clearance of 3.0 lines (2.5 vs. flat/double-sharp)**; columns read out of a **lookup table** per group size + case; ≥7 uses a computed pattern (`accidental.js:16-203`, `tables.js:153-190`) |
| **A4** column→column | **0.2** (`padding`, same literal as A1's second term) | **0.25** horizontally (`accidentalDistance`); vertical clearances 0.15 / **0.05 sharp-sharp** / 0.10 to chord; ⭐ **negative** at the fourth: −0.15 flat, −0.05 natural | **0.165** = 0.66 × the A1 margin (`accid.cpp:173-176`) | **0.30** `accidentalSpacing` (`metrics.js:76`), + 0.20 `leftPadding` outside the group |
| **A5** shorten a ledger? | ⭐ **YES** — the ledger's end moves to the **midpoint** of (accidental right, head left), inside a **per-glyph vertical band** from the font (flat 0…0.8, sharp −0.8…1.0, natural −1.8…1.0 sp) (`ledger-line-spanner.cc:266-267`, `:358-368`) | **NO** — the code is written and **commented out** (`chordlayout.cpp:1361-1365`); instead the sign *overlaps* the ledger (padding 0.18, or 0.0), with a 0.1 sp brake for sharps/naturals | **NO** — the *accidental* moves instead (0.395 sp). Ledgers are shortened, but only against **each other**, to a floor of 0.1 sp (`calcledgerlinesfunctor.cpp:117-204`) | **NO** — overhang is a flat `LEDGER_LINE_OFFSET = 3 px = 0.3 sp`, accidental-blind (`stavenote.js:34`, `:686-729`). *(This editor patches it: `ledgerAccidentalClearance.ts`.)* |

### B. The augmentation dot

| | LilyPond | MuseScore 4 | Verovio | VexFlow 5 | **this editor today** |
|---|---|---|---|---|---|
| **B1** notehead→dot (raw) | **one dot width** = `(1 − staffLineThickness)/2` ≈ **0.45** (`define-grobs.scm:1264`, `output-lib.scm:692-704`, `dot-column.cc:229-232`, `feta-dots.mf:23`) | **0.5** `dotNoteDistance`, from `headBodyWidth` (`styledef.cpp:304`, `chordlayout.cpp:2800`, `:3193`) | dot **centre** at head-right + 1 unit = **0.5** (`calcdotsfunctor.cpp:121`, `view_element.cpp:899`) | **0.2** = the literal `+ 2` px (`stavenote.js:528`), + the flag's width when stem-up and flagged | **0.5** edge to edge (`dotPlacement.ts`, `DOT_GAP_SPACES = 0.5`) |
| **B1′ → the SAME gap as `dotPlacement.ts` measures (white, edge to edge)** | **≈ 0.45** | **0.50** | **0.30** (0.5 − the 0.2 sp radius) | **0.20** | **0.50** |
| **B2a** head ON a line | ±**0.5** (one half-space), direction by an **optimiser** — `badness` penalises any move that is not UP (`dot-configuration.cc:26-45`, `:63-98`, `dot-column.cc:219-224`) | ±**0.5**; direction from the note's own `dotPosition` + the pass, **flipping when the slot is claimed** (`chordlayout.cpp:2461`, `:2473-2508`, `:2560-2562`) | +**0.5**, up for stem-up or a single layer, down for the "secondary" solution; an unconditional up-shift again at paint time (`note.cpp:1023-1035`, `view_element.cpp:2086-2088`) | −**0.5** (up) (`dot.js:70-83`, `:122`) | VexFlow's, drawn by us (`augmentationDot.ts` takes `dotShiftY` already decided) |
| **B2b** two dots would collide (SECONDS) | the second moves a **full space** (2 half-spaces); ⚠️ `chord-dots-limit = 3` **deletes** surplus dots (`dot-column.cc:148-176`) | a chord **unison** moves ±**1.0**; across voices with equal dot counts one set is **HIDDEN** (`chordlayout.cpp:2539-2554`, `:2067-2089`) | dot locs are a **`std::set` per staff** ⇒ coincident dots **merge into one**; seconds are pushed apart by the chain `0, +1, −1, −2, +2` (`chord.cpp:~555-596`) | flips the half space **down** when the previous note is a second higher, or its space is taken (`dot.js:76-80`) | VexFlow's |
| **B3** dot→dot | **one dot width ≈ 0.45**, white — ⭐ *the same expression as B1* (`output-lib.scm:686-690`) | **0.65** origin-to-origin ⇒ **0.25 white** (`styledef.cpp:306`, `chordlayout.cpp:3228`) | **0.75** centre-to-centre ⇒ **0.35 white** (`view_element.cpp:2098`, `// HARDCODED`) | **0.1** white (`dotSpacing = 1` px, `dot.js:31`) | **0.5** white (`dotPlacement.ts` widens VexFlow's step) |
| **B4** dot on a REST | same padding; a per-duration `staff-position` in half-spaces (whole −2, 32/64 +2, 128/256 +4, 512/1024 +6) (`output-lib.scm:652-664`) | **same** 0.5 / 0.65 as a note (⚠️ `dotRestDistance` is **dead code**); y from a fixed per-duration `dotLine` (`restlayout.cpp:141-144`, `rest.cpp:2060-2083`) | x = **1.25** for a half rest or longer, else the glyph's width; y always **up**, plus +1/+2/+3/+4 spaces for 32nd…1024th (`calcdotsfunctor.cpp:128-177`) | same 2 px x; per-glyph y (whole +0.5, half…16th −0.5, 32/64 −1.5, 128 −2.5 spaces) (`stavenote.js:541-560`) | VexFlow's — `dotPlacement.placeDots` **skips rests** deliberately |
| **B5** drawn size | diameter `(1 − staffLineThickness)/2` ≈ **0.45**, a METAFONT pen circle (`feta-dots.mf:23-34`) | `SymId::augmentationDot` × `dotMag` **1.0** — a live user knob (`notedot.cpp:64-67`, `styledef.cpp:303`) | ⭐ **not a glyph** — a drawn circle, radius `doubleUnit/5` = **0.2** (dia. 0.4) (`view_graph.cpp:203-213`) | `Glyphs.augmentationDot` at the note's font; Bravura **0.4** wide (`dot.js:105`) | Bravura's glyph, stamped by `augmentationDot.ts` |

---

## §4 Where they disagree, and what each choice implies

**1. The accidental gap is not one number — it is one number *plus a model of ink*.**
0.25 (MuseScore, Verovio) vs. 0.30 (VexFlow) vs. 0.35 (LilyPond) looks like a 40 % spread, but the
three tight engines are not measuring the same thing. LilyPond measures **skyline to skyline in the
shared vertical band**; MuseScore and Verovio measure **cut-out sub-rectangle to sub-rectangle**;
VexFlow measures **bounding box to bounding box**. The two cut-out engines can afford the smallest
constant precisely because their boxes already hug the glyph. ⇒ A constant lifted from MuseScore
into a bbox-based renderer is **not** MuseScore's gap; it is a smaller one.

**2. Vertical anchoring is unanimous — the only unanimity in this survey.** All four put the
accidental on the notehead's own line, exactly, and resolve every conflict by moving **left** only.
MuseScore says so structurally (there is no `setPosY` for a visible accidental anywhere in
`accidentalslayout.cpp`); Verovio writes the comment "Move only to the left".

**3. Chord accidentals: a table, a grouping, or a relaxation.** VexFlow reads a **lookup table**
keyed by group size and a named "end case" — fast, deterministic, and silent past 6 accidentals,
where it falls back to a computed repeating pattern. LilyPond groups by **note name**, making octave
alignment a property of the data structure, and orders columns **by size** so the busiest column
lands closest to the note. MuseScore **computes two orderings and picks the one with fewer columns**
for mid-size chords — it treats the choice as an optimisation, not a rule. Verovio runs a
**shift-left relaxation that re-tests** what it had already cleared. Each is a different answer to
"what is a column?" — and only LilyPond's makes octaves structural rather than a special case.

**4. Negative kerning is a real rule in exactly one engine.** MuseScore lets a flat at a fourth
*overlap* the sign below it by −0.15 sp (−0.05 against a natural), and gives sharps a tighter
vertical clearance (0.05) than anything else (0.15). It is the only engine surveyed that keys its
clearances to the **glyph's shape** rather than to the category "accidental". LilyPond gets a
weaker version of the same effect for free from skylines, and pushes in the other direction for
flats (`accidental.cc:63-81` *widens* a flat's right skyline by construction).

**5. The ledger line: LilyPond is alone.** It is the only engine that **shortens** a ledger for an
accidental, and its rule is unusually principled — the line stops at the **midpoint** between the
two inks, and *which* ledgers may be shortened is a **per-glyph font metric**, not a constant. The
other three all decided the ledger is inviolable and the accidental must move (MuseScore even wrote
the shortening code and commented it out). ⇒ Anyone choosing "shorten the ledger" is choosing
LilyPond's side of a 1-vs-3 split; anyone choosing "move the sign" is choosing the majority's.
*(This editor currently does **both**: shifts the sign to a 0.2 sp ink gap and trims the overhang
from 0.3 to 0.2 sp — `ledgerAccidentalClearance.ts`.)*

**6. The notehead→dot gap: VexFlow is the outlier, by a factor of 2.5.** 0.2 sp against 0.3
(Verovio), 0.45 (LilyPond) and 0.5 (MuseScore). The editor's own 0.5 sp lands on MuseScore's figure
and within 0.05 of LilyPond's — i.e. `dotPlacement.ts` moved the gap from *outside* the engines'
range to the top of it.

**7. Whether the dot→dot gap equals the notehead→dot gap: 1 yes, 3 no.**

| | head→dot | dot→dot | equal? |
|---|---|---|---|
| LilyPond | 0.45 | 0.45 | ⭐ **yes, by construction** (the same callback) |
| MuseScore | 0.50 | 0.25 | no — the second gap is **half** the first |
| Verovio | 0.30 | 0.35 | no — the second is slightly **wider** |
| VexFlow | 0.20 | 0.10 | no — half again |
| this editor | 0.50 | 0.50 | yes (deliberately: `DOT_GAP_SPACES` feeds both) |

⇒ The "notehead-to-dot equals dot-to-dot" principle that `dotPlacement.ts` builds on is **LilyPond's
practice and nobody else's** among the code surveyed. MuseScore's double dots are visibly tighter
than its first gap; Verovio's are slightly looser.

**8. A dot on a rest: two engines say "same as a note", two say "different".** LilyPond and
MuseScore use the identical horizontal constant for a rest (MuseScore's `dotRestDistance` exists,
has a default of 0.25 sp, appears in every `.mss` file — and is read by **no C++ at all**). Verovio
gives a half-or-longer rest a fixed 1.25 sp anchor. All four give rests a **per-duration vertical**
table, and the tables do not agree: for a whole rest LilyPond offsets the dot by **−2
half-spaces (one space down)**, MuseScore and VexFlow by **half a space down** (`dotLine +1`;
`restShift +0.5`), while Verovio's rest dot is pushed **up** unconditionally and never down.

**9. The dot is a glyph in three engines and a drawn circle in one.** Verovio computes
`radius = doubleUnit/5` and draws it, so its dot does **not** follow the music font — and it lands
on 0.4 sp diameter, exactly Bravura's `augmentationDot`. LilyPond derives its diameter from the
**staff line thickness** (`(1 − t)/2`), so a house style that thickens the staff lines automatically
shrinks the dots. MuseScore alone exposes a user multiplier (`dotMag`).

**10. The engines label their own weak spots.** Verovio marks four of the numbers above
`// HARDCODED` (`calcdotsfunctor.cpp:91`, `:115`, `:168`; `view_element.cpp:2098`); MuseScore heads
its vertical clearances with "Hardcoded engraving parameters that don't have a style (some of these
may get a style in future)" (`accidentalslayout.cpp:55`); LilyPond's accidental placement carries a
TODO admitting the ideal is a C-shape and the implementation is "a simple strategy, not an optimal
choice" (`accidental-placement.cc:441-458`). None of these numbers is presented by its own authors
as settled law.

---

## §5 UNKNOWN — and where it was looked for

1. **Every figure here is read, not rendered.** No engine was built or run, so none of the composite
   numbers (notably LilyPond's 0.35 = 0.15 + 0.2) has been confirmed against output. The addition
   was derived by tracing `Skyline::raise` (`lily/skyline.cc:510-515`) and
   `Skyline::internal_distance` (`:617-643`) by hand: for a LEFT-facing skyline `raise(r)` moves the
   boundary by `r` in x, and `internal_distance` returns the current overlap, so `offset = −distance;
   offset −= padding` places the two inks `padding` apart *after* the skyline was already displaced
   by `right-padding`. ⛔ If a rendered LilyPond page shows 0.20 rather than 0.35, this reading is
   what is wrong.
2. **LilyPond's whole-rest dot position.** `dots::calc-staff-position` returns `−2` half-spaces for a
   whole rest (`scm/output-lib.scm:660`), which is *added* to the rest grob's own staff position —
   and the rest's own y-offset callback was not traced (`lily/rest.cc` not read). The absolute
   landing position of a whole rest's dot is therefore **UNKNOWN**; only the offset is cited.
3. **Where VexFlow's `accidentalColumnsTable` came from.** The table (`tables.js:153-190`) and its
   case names (`spacedOutTetrachord`, `verySpacedOutPentachord`, …) carry no citation in the shipped
   build; `node_modules/vexflow` ships no TypeScript sources (only `build/`, `tests/`), so any
   source comment in the original repository could not be checked. **UNKNOWN.**
4. **Whether LilyPond's `chord-dots-limit` suicide interacts with the dot gap.** `dot-column.cc:148-176`
   removes dots before the x is computed; whether a chord that lost dots gets a different padding was
   not traced. **UNKNOWN** (only `calc_positioning_done` and `add_head` were read in full).
5. **Verovio has no fixed "accidental x = head x − k" anywhere.** Searched `src/accid.cpp`,
   `src/adjustaccidxfunctor.cpp`, `src/adjustxposfunctor.cpp`, `include/vrv/options.h`,
   `src/options.cpp`, `include/vrv/vrvdef.h`; the only two accidental options in the tree are
   `leftMarginAccid` and `rightMarginAccid`. The 0.25 sp is always a clearance on a measured overlap.
   This is a **confirmed absence**, not a failed search.
6. **MuseScore ledger shortening is a confirmed absence too**, not a gap: `shorten|Shorten` was
   grepped across `chordlayout.cpp` and `dom/ledgerline.*` (2 hits — one about ties, one the
   commented-out block), `ledgerLineLength` tree-wide (all hits the flat 0.33 sp), and
   `layoutLedgerLines` (`chordlayout.cpp:1295-1400`) was read in full.
7. **The white-gap column of table B depends on the font.** The subtractions use Bravura's
   `augmentationDot` (0.4 sp). LilyPond does not use Bravura, and its own dot is 0.45 sp, so its
   figures are internally consistent but not directly commensurable with the other three at the
   level of the last decimal.
8. **`belle/` and `musxdom/` were not surveyed** — both are on disk. Finale's model (via `musxdom`)
   would be a fifth witness and is **UNKNOWN** here.
