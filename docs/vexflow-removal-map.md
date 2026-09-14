# The VexFlow removal map — what VexFlow still does here, measured, and the order to take it out

> **His priority, 2026-09-14: remove the VexFlow dependency first; the engine grows after.**
> (`own-engraving-engine.md` §0.2.) This document is the inventory that priority needs: every use,
> resolved by the TypeScript compiler to its declaration inside `node_modules/vexflow`, and grouped
> into roles and steps. It changes no code. Measured on `src/` at `5a13039`.
>
> ⚠️ **Where this disagrees with `own-engraving-engine.md` §5, §10 below lists each disagreement
> with its evidence.** That document was not edited.

---

## 0. The headline numbers

| | count |
|---|---|
| **Resolved VexFlow uses in `src/` (non-test)** — member access, call, `new`, type reference, `extends`, `instanceof`, destructure | **1,449** |
| …of which a VALUE use (runs at runtime) | **1,239** |
| …of which TYPE-only | **210** |
| …called on OUR subclasses but resolving to an INHERITED VexFlow member | **235** (206 through `this`/`super`) |
| Calls that resolve to one of OUR overrides of a VexFlow member | 7 |
| `import … from 'vexflow'` specifiers | 137 (95 value, 42 type) |
| Files importing `vexflow` | **45** (31 with a value import) — ⭐ **every one in `src/engine/rendering/`** |
| Specs using VexFlow | **21 files, 262 uses** |
| `npm run lint:paint` (run today) | `vexContext` 9/9 · `svgNode` 10/10 · 14 allowlisted files |
| Uses that no call count can see | the **font faces** (§8), and VexFlow's **internal** format/draw paths (§4, §5) |

**Two files hold 39% of it**: `VexFlowRenderer.ts` **332** and `GhostRenderer.ts` **238** (+ `FanGhost.ts` 22).
`interactions/`, `ElementRegistry`, `CoordinateMapper`, `layout/`, `engrave/`, `scene/` and `paint/`
have **zero** resolved uses. The dependency is fenced into one directory already; it is not yet fenced
into one *file*.

### 0.1 By role

| # | role | uses | value / type | files | in the ghosts | §  |
|---|---|---|---|---|---|---|
| R1 | **The staff's coordinate system** (`Stave` as a ruler) | **175** | 175 / 0 | 27 | 4 | §2 |
| R2 | **The note's ruler** (`StaveNote` geometry reads, `BoundingBox`) | **199** | 199 / 0 | 23 | 10 | §3 |
| R3 | **Placement rules** (stems, beams, modifiers, tuplets, header + barline signs) | **439** | 423 / 16 | 31 | 84 | §4 |
| R4 | **The formatter** (`Voice`, `Formatter`, `TickContext`, `ModifierContext`) | **98** | 93 / 5 | 6 | **55** | §5 |
| R5 | **Painting + leftovers** (`Renderer`, `SVGContext`, `Element` text, `Annotation`) | **147** | 110 / 37 | 28 | 32 | §6 |
| R6 | ⭐ **The object graph** — VexFlow classes used as our render-time data structure | **341** | 189 / 152 | 43 | 68 | §7 |
| R7 | ⭐ **Numbers and fonts** — `Metrics`, `Tables` constants, `fontInfo`, the font faces | **50** | 50 / 0 | 15 | 7 | §8 |
| | **total** | **1,449** | | | **260** | |

⭐ **R6 and R7 were not in the starting picture, and the data insists on them.** R6 is the largest
role after R3: `StaveNote` and `Stave` as *types* (71 each), `setContext` (31), `checkContext` (14),
`addModifier` (14), `setStave` (14), `getSVGElement` (14), `setRendered` (12). It is not a rule and not a
ruler. It is the fact that a render pass carries its notes around as `StaveNote`s. R7 is small in
calls, but it holds the one dependency with no call site at all: **the editor's music fonts are
registered by VexFlow's import side effect** (§8).

### 0.2 How it was measured — and why grep was not enough

`/tmp/claude-1000/vexflow-removal-map/scan.cjs` loads `tsconfig.json` with `ts.createProgram`, walks
every `src/**/*.ts`, and records every property access, call, `new`, type reference, heritage clause,
`instanceof` and object-destructure whose symbol's declaration lives under `node_modules/vexflow/`.
`roles.cjs` classifies each record by class, member and receiver type. `steps.cjs` assigns each record
to exactly one removal step, so §9's counts sum to 1,449 with no overlap. Appendix A says how to re-run
them.

🚨 **What grep got wrong**, measured against the brief's rough counts:

| member | grep (brief) | resolved to VexFlow |
|---|---|---|
| `getYForLine` | 49 | **41** |
| `getSpacingBetweenLines` | 27 | **26** |
| `getBoundingBox` | 27 | **13** (`Element` 7 · `ClefNote` 2 · `StaveNote` 1 · `Stave` 1 · + `BoundingBox` field reads 41) |
| `getAbsoluteX` | 24 | **15** (`Note` 12 · `NoteHead` 3) |
| `getStemX` | 14 | **14** (`StaveNote` 11 · `StemmableNote` 3) |
| `getStemExtents` | 12 | **11** |
| `new Stave` | 12 | **12** — ⚠️ 10 of them in the ghosts |
| `new StaveNote` | 11 | **10** (+ `new EngravedNote` ×3, counted as subclass constructors) |

⚠️ **What the scan cannot see.** It counts OUR call sites. When `voice.draw()` runs `StaveNote.draw`
→ `drawModifiers` → each modifier's `draw`, or `formatter.format()` runs `ModifierContext.preFormat` →
`Accidental.format` / `Dot.format` / `Articulation.format` / `StaveNote.format`, those calls happen
inside VexFlow and appear as **one** `Formatter.format` or one `Voice.draw`. ⇒ ⭐⭐ **a call count
measures SEAMS, not WORK.** §4 and §5 name the internal paths by file:line, because they are where the
rules live and where the counts understate most.

---

## 1. What the roles mean for the order

Two kinds of step fall out of the data, and they want to be taken in that order:

1. ⭐ **A SEAM step** reroutes READERS from a VexFlow object to a value of ours, filled in *one*
   place from that same object. It moves no pixel by construction — the numbers are copied, not
   recomputed — and it turns every later port into a one-file swap. R1 and R2 are seam steps:
   **374 uses in 30+ files that only READ**.
2. **A PORT step** replaces the computation behind a seam: VexFlow's algorithm, ported with
   attribution (rule 3, §6.7), as the DEFAULT (rule 13). It is pixel-neutral when the port is exact,
   and the nets check that. R3, R4, R7 and most of R6 are port steps.

⭐ **Rule 10** (`own-engraving-engine.md` §8.2: *"only `engrave/vexflow/` imports `vexflow`, and
nothing outside it holds a `StaveNote`"*) is the seam steps' end state. The port steps then shrink
that adapter until nothing is left in it.

---

## 2. R1 — the staff's coordinate system (175 uses, 27 files)

**What VexFlow does.** `Stave` answers *where is line n*, *how far apart are the lines* and *where does
the note area start/end*. All of it is arithmetic on four options:

- `getYForLine(line) = y + (line + spaceAboveStaffLn) × spacingBetweenLinesPx` (`stave.js:195`)
- `getYForNote(line) = y + (spaceAboveStaffLn + 5 − line) × spacing` (`stave.js:214`)
- `getSpacingBetweenLines` (`stave.js:180`)
- `getNoteStartX` (`stave.js:81`)

The defaults are `spaceAboveStaffLn: 4` and `spacingBetweenLinesPx: Tables.STAVE_LINE_DISTANCE = 10`
(`stave.js:51`, `tables.js:647`). ⭐ **No file in `src/` overrides either option** — a grep for
`spaceAboveStaffLn|spacingBetweenLinesPx` finds nothing — so an exact port is available.

**Uses.** `getYForLine` 41 · `getSpacingBetweenLines` 26 · `Element.getX` on a stave 24 ·
`Note.getStave` 19 · `getNoteEndX` 8 · `getNoteStartX` 8 · `getYForNote` 6 · `getNumLines` 6 ·
`getTopLineTopY` 5 · `getBottomLineBottomY` 3 · `getYForTopText` 2.
Top files:

| file | uses |
|---|---|
| `VexFlowRenderer.ts` | 43 |
| `KeySignaturePass.ts` | 18 (lines 118–347) |
| `SlurRenderer.ts` | 15 (lines 333–996) |
| `EngravedStave.ts` | 13 |
| `BarlineRenderer.ts` | 13 |
| `headerPlacementPass.ts` | 10 |

The curve and line renderers read it too: `TieRenderer` 5, `HairpinRenderer` 4, `TrillRenderer` 3,
`OttavaRenderer` 2, `PedalRenderer` 2. Full list: Appendix B.

**Already ours:**
- `VexFlowRenderer.ts:301` `MeasurePlacement` carries `x`, `y`, `width`, `line`, `staffIndex` and `clef`.
- `layout/staffStride.ts:202` `systemStaffTops` places the staves vertically.
- `engrave/staff/staffLines.ts:98` `staffLinesInk` owns the line INK (P5a).
- `layout/measureColumns.ts:315` `measureLeadIn` decides where the notes start. It already REACHES
  `Stave` as a write: `VexFlowRenderer.ts:5189–5212` `applyLeadIn` → `stave.setNoteStartX(…)`.
  ⇒ **`getNoteStartX` returns a number we computed.**
- `ElementRegistry.ts:308` `StaffGeometry` is the editor's staff copy, filled from the stave at
  `VexFlowRenderer.ts:3595`.
- `rendering/staffSpace.ts:18,23` converts staff spaces ↔ pixels, but it takes a `Stave`.

**The step (S2).** Add one pure module — `engrave/staff/staffFrame.ts`, name to taste — that answers
the eleven questions above from a `MeasurePlacement` plus a staff size. It is a port of
`stave.js:180–220`. Rule 6 is honoured: this becomes *the one module that owns where the lines go*, and
`staffLinesInk` reads it. Every reader takes the frame instead of a `Stave`.

- **Pixels:** none — exact port.
- **Nets:** `VexFlowRenderer.scene.test.ts` (59 cases); e2e `staffSize`, `systems`, `systemStart`,
  `barline*`, `slur`, `tie`, `hairpin`, `ottava`, `pedal`, `trill`, `ladder`.
- ⚠️ `rendering/staveGeometry.test.ts` asserts *"Tier 1 is derivable from a `Stave` that was never
  drawn"* — a property **of VexFlow**. It re-targets to the frame, where it becomes trivially true.
- **Frees completely:** `staffSpace.ts`, `barlineInk.ts`, `barlineGap.ts`, `systemStart.ts`.
- **Size:** 165 uses / 25 files after exclusive assignment. Mechanical.

---

## 3. R2 — the note's ruler (199 uses, 23 files)

**What VexFlow does.** It answers where a drawn note's parts are:

| method | where | ⚠️ note |
|---|---|---|
| `getAbsoluteX` | `note.js:339` | |
| `getYs` | `note.js:221` | |
| `getNoteHeadBeginX` | `stavenote.js:676` | |
| `getStemX`, `getStemExtents` | `stemmablenote.js:114,139` → `Stem.getExtents` (`stem.js:77`) | |
| `getGlyphWidth` | `note.js:214` | a **runtime `measureText`** (`element.js:339`) |
| `getBoundingBox` | `stavenote.js:407` | the union of heads, stem, flag **and every modifier** |

Most values are written during `draw()`/`format()` — the lesson of the flag write-back bug
(`note-engraving-plan.md` §1b.5).

**Uses:**
- Rulers: `getStemDirection` 16 · `getAbsoluteX` 12 · `getStemX` 11 · `getNoteHeadBeginX` 10 ·
  `getStemExtents` 10 · `getNoteHeadEndX` 7 · `getYs` 7 · `getGlyphWidth` 6 · `getTieLeftX` 5.
- `BoundingBox` field reads: 41.

Top files:

| file | uses | what they are |
|---|---|---|
| `VexFlowRenderer.ts` | **81** | mostly `registerSlotElements`, `VexFlowRenderer.ts:3358–3540`, which files registry boxes from `staveNote.getBoundingBox()` at `:3400` |
| `EngravedNote.ts` | 24 | |
| `FanPass.ts` | 19 | |
| `GhostRenderer.ts` | 10 | |
| `EngravedBeam.ts` | 9 | |
| `CenteredTremolo.ts` | 8 | |
| `SlurRenderer.ts` | 8 | |
| `ScoreTuplet.ts` | 7 | |

**Already ours:**
- `ElementRegistry.ts:588` `headCentreX` — P6b's reader 1, today — fed by `EngravedNote.ts:275`
  `headCentreX`.
- `scene/sceneBox.ts:134` `sceneInkBox` (P6a).
- `rendering/drawnHitBox.ts:48` `accidentalHitBox` (P6b's first kind).
- `rendering/noteInkBox.ts:74` — the slur's union with the dynamic spliced out.
- **Stem DIRECTION is already decided by us:**
  - `utils/clefUtils.ts:33` `naturalStemDirection`
  - `models/stemOps.ts:53` `beamGroupStemDirection`
  - `NoteBuilder.ts:283` passes `autoStem: false`, and `:301` sets the direction.

  ⇒ its 16 `getStemDirection` reads return OUR value.
- `utils/clefUtils.ts:48` `staffLineForSpelling` is the pitch → line map.

**The step (S3) — a `NoteGeometry` value.** Everything the readers above ask, captured once per note
**after its draw**. That is the write-back lesson: capture it before and it is garbage. It is held in
the render pass's maps instead of a `StaveNote`. It continues P6b's *"one reader at a time"*
(`own-engraving-engine.md` P6b) with the same next readers: `resolveSlotBeat`, `measuredRoom`,
`getInRect`, `noteInkBox`. It extends them from the BOX to the whole ruler.

- **Pixels:** none (values copied).
- **Nets:** `ElementRegistry.*.test.ts`, `VexFlowRenderer.scene.test.ts`; e2e `notes`, `slur`, `tie`,
  `beam`, `tremolo`, `accidentalHitBox`, `sceneBox`.
- **Frees completely, together with S2:** `TrillRenderer`, `OttavaRenderer`, `PedalRenderer`,
  `TieRenderer`, `HairpinRenderer`, `dynamicsLinePass`, `dynamicNudgePass`.
  `SlurRenderer` keeps two uses — it reads an `Accidental` off `getModifiers()`
  (`SlurRenderer.ts:292,296`) — which fall to S5.
- **Size:** 170 uses / 21 files, plus the `StaveNote` types those readers hold (Appendix B, R6).

---

## 4. R3 — placement rules (439 uses, 31 files) — ⭐ where the counts understate most

**What VexFlow does, by family:**

| family | the rule, in VexFlow | its internal entry | already ours |
|---|---|---|---|
| **Modifier attachment** | `StaveNote.getModifierStartXY` — the `+2 px` literals, `glyphWidth/2` for above/below | `stavenote.js:518` | `layout/dotGap.ts`, `layout/accidentalGap.ts` (rows); ⚠️ the repo's one **monkeypatch** wraps it per note, `VexFlowRenderer.ts:2495–2505` |
| **Accidental columns** | `Accidental.format` | `accidental.js:16`, run from `modifiercontext.js:79–100` | ⛔ **not ported**: `chordAccidentalColumns.ts:19` says *"Not a re-implementation of VexFlow's `Accidental.format`"*, and only `FanPass.ts:50` uses it |
| **Dots** | `Dot.format` | `dot.js:30` | `rendering/dotPlacement.ts:148` adjusts after it |
| **Articulations** | `Articulation.format` (text-line stacking) + `draw` re-centring | `articulation.js:134` | `engrave/notes/articulation.ts` owns the INK; `fanArticulations.ts:129–155` **borrows the rule** by building a probe `StaveNote` + `ModifierContext` |
| **Dynamics text** | `Annotation.format` (vertical justification) | `annotation.js:33` | `layout/dynamicsLine.ts` places the line; `DynamicsLayout.ts:202–217` still builds an `Annotation` per mark, width zeroed |
| **Multi-voice collisions** | `StaveNote.format` — displacement, rest nudge, hides a duplicate rest | `stavenote.js:40` | largely UNDONE after the fact, `VexFlowRenderer.ts:2229–2245`; `layout/restVoicePlacement.ts:222` owns rest lines |
| **Note head x / key props** | `calculateKeyProps`, `getNoteHeadBeginX`, displaced heads | `stavenote.js:368,676,609` | `chordHeadLayout.ts:46` `chordHeadDisplacement` |
| **Stem length** | `Stem.HEIGHT` 35 px + extension; `getExtents` | `stem.js:69–86`, `tables.js:596` | `engrave/notes/stem.ts:65` owns the INK only |
| **Beam slope + stem extensions** | the cost function, then stretching the stems to the beam | `beam.js:351`, `beam.js:442`, via `postFormat` `beam.js:617` | `engrave/beams/beamSlope.ts:121` is the CAP table; `EngravedBeam.ts:110–122` writes it into `renderOptions.maxSlope` and then calls `super.postFormat()` ⇒ VexFlow's cost function still picks the slope inside our cap |
| **Tuplet bracket** | `Tuplet.getYPosition`, `draw` | `tuplet.js:125,174` | nothing; `ScoreTuplet.ts` subclasses it |
| **Header + barline signs** | `Stave.format`'s modifier walk, `Barline` types | `stave.js:374` | `headerPlacementPass.ts` places line-opening clef/key/meter from INK; `engrave/header/clef.ts:97`, `engrave/header/meter.ts:121`; `BarlineRenderer` draws every closing barline; ⛔ still the walk's: the **mid-line clef change** (0.5 sp) and END modifiers |

**Uses.** The largest single members are the barline suppressions:

- `Barline.type` 22 + `BarlineType.NONE` 22 + `setBegBarType` 11 + `setEndBarType` 11 = **66**, of
  which 36 are in the ghosts. They exist to *stop* VexFlow drawing a barline we draw ourselves.
- Then: `Modifier.Position` 16 · `Stave.getModifiers` 12 · `StaveModifierPosition.BEGIN` 12 ·
  `setStemDirection` 9 · `Beam` 9 types + 25 members · `Dot.buildAndAttach` 5 · `Accidental`
  constructor 5.

By file:

| file | uses |
|---|---|
| `GhostRenderer.ts` | 77 |
| `VexFlowRenderer.ts` | 68 |
| `EngravedBeam.ts` | 32 |
| `EngravedNote.ts` | 27 |
| `ScoreTuplet.ts` | 24 |
| `EngravedTimeSignature.ts` | 21 |
| `EngravedStave.ts` | 21 |
| `fanArticulations.ts` | 19 |
| `NoteBuilder.ts` | 18 |

⭐ **Inheritance is most of this role: 154 of its 439 uses are VexFlow members called through our own
subclasses.** The override lists are the progress bar `note-engraving-plan.md` names:

| subclass | overrides |
|---|---|
| `EngravedNote` | `buildStem`, `drawLedgerLines`, `drawNoteHeads`, `drawFlag` |
| `EngravedStem` | `draw` |
| `EngravedStave` | `draw`, `addClef`, `addTimeSignature` |
| `EngravedBeam` | `postFormat`, `draw` |
| `EngravedAccidental`, `EngravedDot`, `EngravedClef`, `EngravedBarline` | `draw` |
| `EngravedTimeSignature` | `draw`, `drawAt` |
| `EngravedArticulation` | `renderText` |

⭐⭐ **Every override is a DRAW override except `postFormat` and `buildStem`.** ⇒ the ink is ours;
**no placement rule has been overridden yet**, and all of them still run inside VexFlow.

**The steps.** S4 takes the header/barline signs, S5 the modifier attachment, S6 the note geometry,
S7 the beam and S8 the tuplet and tremolo — §9. Each ports VexFlow's function as the default.

- **Pixels:** none where exact. The one known exception is `getGlyphWidth`'s runtime `measureText`
  (`element.js:339`) versus `fonts/fontMetrics.ts:84` `glyphBox().advance`. They are the same font's
  advance, but measured two ways. **Rule 13: keep what runs today's number as the row, and record the
  diff as a follow-up.** ⛔ Not a blocker.

---

## 5. R4 — the formatter (98 uses, 6 files — but only 38 outside the ghosts and the fan)

**What VexFlow does.**

- `Formatter.joinVoices` + `format` (`formatter.js:582,587`) builds `TickContext`s (`:294`).
- It runs `preFormat` (`:307`), which calls every `ModifierContext.preFormat`
  (`modifiercontext.js:79–100`). ⭐ **That one function is where `StaveNote.format`, `Dot.format`,
  `Accidental.format`, `Articulation.format` and `Annotation.format` all execute** — §4's rules, run
  as a side effect of formatting.
- It then distributes x with its softmax.
- `Voice` (`voice.js`) checks ticks (strict/soft) and draws its tickables (`voice.js:165`).

**Already ours.**
- **X is already ours.** `layout/measureColumns.ts:520` builds the system's columns,
  `layout/spacing.ts:411` `spaceColumns` solves them, and `rendering/spacingPass.ts:112` writes the
  answer into VexFlow's tick contexts after `format()` (*"the last `setX` wins"*, `spacingPass.ts`
  header).
- Voice mode is chosen by us: `chooseVoiceMode`, at the `new Voice` call in `VexFlowRenderer.ts`
  around line 2123.

⇒ what the formatter still contributes to the picture is **the modifier rules it runs**, not the
spacing.

**Uses.** Main path: `VexFlowRenderer.ts` 24 (`new Voice` around line 2123; `new Formatter` + `format` at
`:2185–2186`); `spacingPass.ts` 8; `NoteBuilder.ts` 6. `fanArticulations.ts` 5 — a private
`TickContext` + `ModifierContext` at `:129–155` to borrow `Articulation.format`. **Ghosts: 55** —
every ghost runs its own formatter (`GhostRenderer.ts:265–274, 451–452, 666–669, 759, 820, 894, 1024`;
`FanGhost.ts:66–67`).

**The step (S9).** It comes after S5 (the modifier formats are ported) and S6 (the note knows its own
head x and ys). Delete `Voice`/`Formatter`/`TickContext`, and let `spacingPass` write columns into
`NoteGeometry` directly.

- **Pixels:** none *if* nothing reads formatter state beyond x. ⚠️ **UNKNOWN** — `spacingPass.ts:112`
  reads the formatter's tick contexts, and whether any consumer reads `ModifierContext` widths
  (`leftShift`/`rightShift`) was not audited. Audit before cutting.
- **Size:** 38 uses / 3 files, plus the internal rules S5 must already have ported.

---

## 6. R5 — painting and the leftovers (147 uses, 28 files)

**What VexFlow does.**

- `Renderer` + `SVGContext` is the SVG writer: `VexFlowRenderer.ts:916`, and a **second renderer**
  for the gutter, `GutterRenderer.ts:73`.
- `Element` resolves a font per category (`Metrics.getFontInfo`, via `new Element(tag)`) and paints
  text (`element.js:331`): `glyphPainter.ts:124,171` (the P1a adapter), `TempoLayout.ts:151`,
  `ScoreTuplet.ts:59`.
- `Annotation` draws dynamics text (`DynamicsLayout.ts:202`).

**Uses:**
- `SVGContext` type 21, `openGroup`/`closeGroup` 8+8.
- `Element.getText` 10, `getCategory` 9.
- `RenderContext.fillRect` 6 (the tuplet bracket and the tremolo).
- `SVGContext.svg` 5 — the four read-backs `lint:paint` lists: `tempoAnchorInk.ts:78`,
  `tempoLinePass.ts:100`, `tempoNudgePass.ts:61`, `markPreviewPass.ts:259`.

**Already ours:**
- `paint/DrawContext.ts` (20 primitives), `paint/DrawGroup.ts`, `paint/Affine.ts`.
- `scene/SceneRecorder.ts`.
- `engrave/glyph.ts:46` `stampGlyph`, which puts a glyph down through `DrawContext`.
- ⭐ **The painter is the only piece with no implementation yet** (P1e).

**The step (S13 — P1e).** Last among the code steps, after nothing calls `.draw()` on a VexFlow object.
- An SVG `DrawContext` of ours replaces `Renderer`; the gutter gets the same one.
- The four `.svg` read-backs take the painter's root.
- `pointerRect` is dropped (`note-engraving-plan.md` §1e: nothing consumes it).
- **Pixels:** none intended; the e2e suite is the net.
- **Size:** 41 uses / 9 files after exclusive assignment.

---

## 7. R6 — the object graph (341 uses, 43 files; 152 type-only)

**What it is.** Not engraving: the render pass's *data structure*.
- `RenderPass` maps hold `StaveNote`, `Tuplet` and `Annotation` (`RenderPass.ts:36,80,97,99`; `SVGContext` at `:78`).
- Every renderer is handed a `Stave`.
- Drawing is VexFlow's lifecycle: `setContext → setStave → addModifier → format → drawWithStyle →
  setRendered`.
- The editor's highlight maps store `<g>` elements obtained through VexFlow's `getSVGElement` (14 uses)
  or cast group returns (`FanPass.ts:552`).

**Uses.** `StaveNote` type 71 · `Stave` type 71 · `setContext` 31 · `checkContext` 14 · `addModifier` 14
· `setStave` 14 · `getSVGElement` 14 · `setRendered` 12 · `Stave` constructor 12 · `getAttribute` 11 ·
`StaveNote` constructor 10 · `renderText` 8.
Top files: `VexFlowRenderer.ts` 92 · `GhostRenderer.ts` 62 · `FanPass.ts` 20 · `EngravedNote.ts` 16 ·
`SlurRenderer.ts` 12.

**The step (S12).** Once S2–S9 have emptied them, `EngravedNote` and its siblings stop extending
VexFlow classes, and the maps hold our `NoteGeometry` and our groups.

- ⚠️ **U3 (the highlight) is NOT a prerequisite here.** A painter of ours can return a DOM node
  exactly as today (`own-engraving-engine.md` U3: *"`svgNode` does not gate P1e"*). What U3 constrains
  is *scene-only* rendering, which removal does not need.
- **Size:** 155 uses / 20 files remain after the earlier steps take their share. 103 of them are
  type-only, so this step is mostly retyping.

---

## 8. R7 — numbers and fonts (50 uses + one side effect)

### 8.1 🚨 The font faces — the dependency no phase owns

`node_modules/vexflow/build/esm/entry/vexflow.js:12–17` runs `Font.load(...)` **on import** for
**Bravura, Academico, Academico Bold, Gonville, Petaluma and Petaluma Script**, as embedded base64
faces.

⭐ **Nothing else in the repo registers a font face.** A grep of `src/`, `index.html` and
`e2e/harness.html` for `@font-face`, `new FontFace` or `document.fonts.add` finds nothing. So:

- every `<text>` in Bravura renders because VexFlow was imported;
- so do the menus' `font-family: Bravura` (`menus/MenuLayer.ts:144,158`);
- so does `rendering/musicFontReady.ts`'s gate, whose own header says so.

`public/fonts/Bravura.otf`, `Academico.otf` and `AcademicoBold.otf` already ship, for PDF export only
(`export/exportFonts.ts:36–37`). ⚠️ **`own-engraving-engine.md` never mentions `Font.load`** (grep:
no hits).

⇒ **Deleting the package without S1 blanks every glyph in the editor.** No test would catch it in
jsdom. `e2e/appFirstRender.e2e.ts` might.

✅ **ANSWERED 2026-09-14 (S1a), measured in Chromium with each build alone on the page:** Bravura's
ADVANCES are identical glyph for glyph, but its ink boxes are not — VexFlow's woff2 read a notehead
1.30 sp and a G clef 2.90 at staff size 1 where our `.otf` reads 1.20 / 2.70 (the "reader inflation"
three browser specs were calibrated to), and the canvas rounds a flag's reach up in one build and to
the nearest pixel in the other. Academico's advances differ by up to ~2%. The screen now draws in our
files, which is also what the PDF outlines.

### 8.2 The constants

| read | count | where the number really comes from |
|---|---|---|
| `Element.fontInfo` / `FontInfo.*` / `getFontScale` | 10 + 8 + 2 | `Metrics` font table, per category |
| `Stem.WIDTH` | 11 | `Tables.STEM_WIDTH = 1.5` (`tables.js:595`) |
| `Metrics.get` | 6 | `Stave.padding` 12 (`metrics.js:132`) at `VexFlowRenderer.ts:5127,5212`; `Tremolo.spacing` / `fontSize` in `CenteredTremolo.ts:149–198`; `Accidental.noteheadAccidentalPadding` in `ledgerAccidentalClearance.ts:82` |
| `Metrics.clear` | 3 | cache busting after writing `MetricsDefaults` (`TempoLayout.ts:54–55`, `ScoreTuplet.ts:22`) |
| `StaveNote.LEDGER_LINE_OFFSET` | 2 | `EngravedNote.ts` |

**Already ours:**
- `fonts/bravuraMetrics.ts:119` `GLYPH_BOXES` and `:339` `ENGRAVING_DEFAULTS`.
- `fonts/fontMetrics.ts:84,142` `glyphBox`, `engravingDefault`.
- ✅ S1: `engrave/inheritedDefaults.ts` (the numbers) and `engrave/inheritedFonts.ts` (the faces each category resolved).
- The row-table pattern (`layout/dotGap.ts`, `layout/accidentalGap.ts`).

**The step (S1).**
- Register the three faces from `public/fonts/` with our own `@font-face`/`FontFace`.
- Move each constant to a named, attributed row holding **today's value**.
- Replace `Metrics` font resolution with a small category → font table.

The steps:
- **Pixels:** none if the font versions match (see the UNKNOWN above).
- **Nets:** `e2e/appFirstRender`, `pdfExport`, `headerGap` (glyph metrics), `musicFontReady.test.ts`.
- **Size:** 41 uses / 13 files, plus one new font-registration module.

---

## 9. ⭐ THE ORDER

The order is dependency first, then uses removed per unit of effort. Each step is one commit the user
can check in the UI. **Counts are exclusive** — every one of the 1,449 uses is assigned to exactly one
step (`steps.cjs`, 0 unassigned).

| # | step | removes (uses / files) | needs | pixels | end signal |
|---|---|---|---|---|---|
| **S0** ✅ | **Census ratchet** — `npm run lint:vexflow` (`scripts/check-vexflow-census.mjs`, in `build:check`), per-role ceilings that may only fall | 0 — makes every later number checkable | — | none | the census runs in `build:check` |
| **S1** | **Fonts + numbers**: our `@font-face` from `public/fonts/`; `Metrics`/`Tables` constants → attributed rows; font categories → our table — ✅ **S1a** fonts (`engine/fonts/fontFiles` + `rendering/musicFontFaces`) · ✅ **S1b** numbers (`engine/engrave/inheritedDefaults`, R7 50 → 29) · ✅ **S1c** font categories (`engine/engrave/inheritedFonts`, R7 29 → 0; the tempo and tuplet marks stamp through `glyphPainter` with faces of ours, and VexFlow's own `Tuplet.textElement` is sized per tuplet instead of by a global `MetricsDefaults` write) | **41 / 13** + the import side effect | — | none (if font versions match — §8.1 UNKNOWN) | no `Metrics`, `MetricsDefaults`, `Stem.WIDTH`, `fontInfo` outside the adapter; glyphs render with VexFlow's faces unloaded |
| **S2** | **Staff frame** (§2) — ✅ **S2a** the vertical: `engine/engrave/staff/staffFrame` (the one module doing staff-line arithmetic) filled by `rendering/staveFrame` from the stave's own numbers (so a reused bar's staleness is unchanged), every `getYForLine`/`getSpacingBetweenLines`/`getYForNote`/`getNumLines`/`getTopLineTopY`/`getBottomLineBottomY`/`getYForTopText` reader moved, the registry's `pixelYToPitch`/`pitchToPixelY` folded in (rule 5), `getBottomLineBottomY`'s hard 1 a row (`STAFF_BOTTOM_EDGE_PX`); R1 174 → 85 · ✅ **S2b** the horizontal: `BarFrame` (x, width, note start/end) read through LIVE getters in `rendering/staveFrame.barFrame` — ⚠️ never a snapshot, because `getNoteStartX` formats the stave and `applyLeadIn` rewrites it — plus ONE `staleShift` (was three copies) and `staveBox`; three helpers narrowed from a `Stave` to a `StaffFrame`; R1 85 → 57 · ✅ **census corrected**: `STAVE_RECV` was a prefix test, so `StaveModifier` and `StaveNote` receivers were counted as staff coordinates — 22 of the 57 (17 header-modifier x's, now R3 → S4; 5 note xShifts, now R2 → S3). Anchored: R1 57 → 35, R2 198 → 203, R3 438 → 455, total unchanged · ✅ **S2c** a note's frame: `staveFrame.noteFrame`/`requireNoteFrame`, and every helper handed a note's stave only for its space (`resolveCps`, `slurEndpointOffsetPx`, `slurOffsetPx`, `segmentEndpointOffsetPx`, `hairpinEndpointOffsetPx`, `drawTieArc`, the slur's representative stave) takes a `StaffFrame`; R1 35 → 19, R6 336 → 325. ⚠️ Two `Note.getStave` STAY, each needing the stave OBJECT rather than its lines: `EngravedNote.drawLedgerLines` (its ledger STYLE — S4) and `FanPass` (heads set on it — S10). R1's other 14 are the adapter itself (12) and `EngravedStave`'s own options/measure (S4) | **165 / 25**; frees 4 files | — | none (exact port) | no `Stave.getYForLine` / `getSpacingBetweenLines` / `getNoteStartX` / `getYForNote` outside `engrave/vexflow/` |
| **S3** | **Note ruler seam** — `NoteGeometry`, captured after draw; P6b's readers generalised (§3) | **170 / 21**; with S2 frees 7 more files (Tie, Trill, Ottava, Pedal, Hairpin, `dynamicsLinePass`, `dynamicNudgePass`) | S2 (readers take both) | none (copied values) | no `StaveNote` type outside `engrave/vexflow/` + `NoteBuilder`; no registry box from `getBoundingBox()` |
| **S4** | **The stave object**: header + barline signs placed by us; `Stave` → frame + a sign run; END modifiers and the **mid-line clef change ported at today's 0.5 sp as a row** (rule 13 — ⛔ not waiting on the clef review) | **181 / 12** (EngravedStave 34, EngravedTimeSignature 30, GutterRenderer 28, VexFlowRenderer 25, headerPlacementPass 17…) | S2 | none | no `Stave`, `Clef`, `TimeSignature`, `Barline`, `StaveModifierPosition` import; gutter on our painter's API |
| **S5** | **Modifier placement**: port `getModifierStartXY` (delete the monkeypatch), `Accidental.format`, `Dot.format`, `Articulation.format`, `Annotation.format` | **154 / 13** (fanArticulations 34, EngravedDot 22, EngravedAccidental 18, DynamicsLayout 18, NoteBuilder 13…) | S3 | none (exact ports); ⚠️ the fan's `chordAccidentalColumns` stays as it is — switching it to the port is a separate, pixel-moving step | no `Accidental`/`Dot`/`Articulation`/`Annotation`/`Modifier` import; `fanArticulations`' probe note gone |
| **S6** | **Note geometry**: port `calculateKeyProps`, `getNoteHeadBeginX`, `getYs`, `Stem.getExtents`/`HEIGHT`; glyph width → `glyphBox` | **58 / 5** (EngravedNote 26, VexFlowRenderer 25) | S3 | ⚠️ sub-pixel where `measureText` ≠ font advance → rule 13 row | `EngravedNote` answers every S3 question without `super` |
| **S7** | **Beam**: port `calculateSlope` + `applyStemExtensions` + `getBeamYToDraw` behind `beamSlope.ts`'s cap | **53 / 2** | S6 | none (exact port) | `EngravedBeam` no longer extends `Beam` |
| **S8** | **Tuplet + tremolo**: port `Tuplet.getYPosition`/bracket; `CenteredTremolo` off `Tremolo` | **67 / 4** (ScoreTuplet 44, CenteredTremolo 19) | S3, S1 | none | no `Tuplet`/`Tremolo` import |
| **S9** | **The formatter**: `spacingPass` writes into `NoteGeometry`; `Voice`/`Formatter`/`TickContext` gone; the multi-voice rule ported only as far as we keep it | **38 / 3** (+ the internal rules S5 already ported) | S5, S6, S7, S8 | ⚠️ UNKNOWN — audit formatter-state readers first (§5) | no `Voice`/`Formatter` in the main path |
| **S10** | **The fan (U2)**: heads, accidentals, prefix stems on `DrawContext`; the member group as a `DrawGroup` | **66 / 1** | S5, S6 | none | `FanPass` off the `lint:paint` allowlist; `vexContext` −2 (`FanPass.ts:455,467`) — ⚠️ may cost `svgNode` +1 (`FanPass.ts:552`) |
| **S11** | **Ghosts**: each builder (`GhostRenderer.ts:83` note, `:426` rest, `:512–1024` the tool ghosts, `FanGhost.ts:45`) rebuilt on the engrave modules + a ghost style — §8.1's *"a ghost is a scene with a style"* | **260 / 2** — the largest step | S6, S5, S8, S9 | ⚠️ ghosts become the real engraving; e2e `ghosts` is the net | `GhostRenderer`/`FanGhost` import no `vexflow` |
| **S12** | **Object graph**: the `Engraved*` classes stop extending; `RenderPass` maps retyped; `setContext`/`setRendered`/`getSVGElement` gone | **155 / 20** (103 type-only) | S2–S11 | none | only the painter swap left |
| **S13** | **Painter (P1e)**: `paint/svg/` replaces `Renderer`/`SVGContext`; `glyphPainter`'s `Element` → `engrave/glyph.stampGlyph`; `.svg` read-backs → painter root | **41 / 9** | S12 | none intended | `lint:paint` `vexContext` **0/0**; allowlist empty |
| **S14** | **Delete**: `package.json:26` `"vexflow"` removed; `.eslintrc.boundary.json` refuses `vexflow` in every file; the 21 specs (262 uses) migrated or deleted with their subject; a NOTICE for the MIT ports | 0 left | all | none | `npm ls vexflow` empty; `build:check` green |

**Sum:** 41 + 165 + 170 + 181 + 154 + 58 + 53 + 67 + 38 + 66 + 260 + 155 + 41 = **1,449**.

### 9.1 Why this order

- **S1–S3 remove 376 uses (26%) with no pixel risk and no prerequisite**, and S2+S3 empty 11 files
  outright. Every later port becomes a change in one adapter instead of thirty readers. S0 comes first
  because *"a ceiling nobody re-measured reads as coverage"*: the only gauge today (`lint:paint`) saw
  none of R1–R4 and R6–R7.
- **S4 before S5–S9** because it has no dependency on the note, and the header's INK and most of its
  PLACEMENT are already ours (P5b). What is left is object plumbing plus one walk.
- **S5 → S6 → S7/S8 → S9** is forced: the formatter cannot go while it is the thing that runs the
  modifier rules (`modifiercontext.js:79–100`), and the beam's port reads head and stem geometry.
- **S10 and S11 after the rules**: the fan and the ghosts consume the same rules as the main path.
  Ported first, they would port them twice.
- ⭐ **The long pole is S5 + S6 + S9 together.** They are where VexFlow's *thinking* lives: modifier
  stacking, multi-voice collision, key props and stem length. `VexFlowRenderer.ts` (332 uses)
  converges on all three. **S11 is the largest by count** (260), but it is repetitive: nine ghost
  builders of one shape.

### 9.2 What "VexFlow removed" means

1. `package.json` has no `vexflow`; `node_modules/vexflow` is absent after `npm ci`.
2. `.eslintrc.boundary.json` has a `no-restricted-imports` pattern `vexflow` / `vexflow/*` for **all**
   of `src/`, tests included.
3. `lint:paint`'s `vexContext` ceiling is 0 and its allowlist is empty (or the script is retired in
   favour of S0's census, which reads 0 everywhere).
4. The fonts render from our own faces; the ports carry VexFlow's MIT notice, attributed per module.
5. `e2e/` green and `VexFlowRenderer.scene.test.ts` green, **with no pixel moved except rows recorded
   under rule 13** (S1's font version, S6's glyph width, S9's audit result).
6. ⭐⭐ **No VexFlow NAME is left either** (his rule, 2026-09-14): no file, function, variable, constant
   or class in `src/` or `e2e/` is called anything with `vex` / `Vex` / `VEX` in it, and the SVG no
   longer uses VexFlow's `vf-` id/class prefix. The ONE place the word stays is the **licence
   attribution** of a ported algorithm (MIT requires it) — a comment giving credit, ⛔ never a name.
   `lint:vexflow` counts the names beside the uses (§9.3).

### 9.3 ⭐⭐ Names — everything called "VexFlow" gets the name of what it really is

⛔ **Removing the package is not enough.** A file called `VexFlowRenderer.ts` or a variable called
`vexContext` compiles perfectly well without VexFlow and describes something that no longer exists.
The map's counts (§0) are USES; this section is the NAMES, measured 2026-09-14:

| kind | today | what happens to it |
|---|---|---|
| **file names** | `VexFlowRenderer.ts` + its 7 specs `VexFlowRenderer.*.test.ts` | **renamed** to what the file does (e.g. `ScoreRenderer.ts`), specs with it — ONE commit of its own near the end (S12/S14), a `git mv` so `git log --follow` keeps the history (§8.2's *"never a big rename"* protects the history; a rename alone in its commit keeps it) |
| **names that TRANSLATE into VexFlow's format** | `durationToVexflow`, `spellingToVexflowKey`, `timeSignatureVexKey`, `articulationVexCodes`, `vexDuration`, `vexNote`, `vexVoices`, `vexTuplet(s)` | **deleted, not renamed** — with no VexFlow there is nothing to translate into; they go with the step that stops building VexFlow objects (S4–S11) |
| **names of things that STAY** | `vexContext` → e.g. `drawContext`; `VEXFLOW_ACCIDENTAL_STANDOFF` (✅ `ACCIDENTAL_STANDOFF_PX`, S1b), `VEXFLOW_DOT_SPACING`, `VEXFLOW_DOT_BASE_GAP`, `VEXFLOW_MAX_SLOPE` → the name of the quantity (`ACCIDENTAL_STANDOFF`…); `vexFontSpacePx`, `vexflowCorrection`, `vexflowAccidentalGapSpaces` | **renamed** in the step that already rewrites that file — ⛔ never renamed twice |
| **the SVG prefix** `vf-` (`g.vf-notehead`, `vf-slur`…) — read by the highlight and 200+ e2e selectors | | **S13**, together with moving the highlight and the e2e readers (§11 row "the `vf-` ids") |
| **comments** explaining what VexFlow does (≈1,200 lines) | | rewritten when their file is touched; a last sweep at S14. ⭐ **Kept:** the attribution line of each port, e.g. `// Based on VexFlow's beam slope calculation (MIT licence, © VexFlow authors)`, plus a NOTICE file |

⚠️ Measuring names needs CASE: `/vex/i` also matches `staveX` and `relativeX`. The count is
`vex|Vex|VEX`, on identifiers only (so a comment is never counted).

---

## 10. ⚠️ Where this contradicts `own-engraving-engine.md`

| # | the doc says | the measurement says | evidence |
|---|---|---|---|
| 1 | §5 *"⛔ Not on this list: Accidental column stacking and articulation placement"* | Removal **requires** both: they run inside every `Formatter.format` call, and the formatter cannot go until they are ported (S5 → S9) | `modifiercontext.js:79–100` |
| 2 | §5: *"we have already done it once (`chordAccidentalColumns`)"* | That module says it is **not** a port of `Accidental.format`, and only the fan uses it | `chordAccidentalColumns.ts:19`; `FanPass.ts:50` is its only importer |
| 3 | §0.2 / `lint:paint`: *"the only VexFlow object still painting its own ink is the fan's"* — read as nearly done | True of INK. Painting (S10 + S13) is **107 of 1,449 uses (7%)**; the dependency is rules (R3 439), rulers (R1+R2 374) and object graph (R6 341) | §0.1 |
| 4 | U2 *"blocked on U3"* | For **removal**, U3 blocks nothing: the obstacle is the `svgNode` ceiling (`check-paint-boundary.mjs:94`), a ratchet of ours. U3's own section says `svgNode` does not gate P1e | `FanPass.ts:494,552`; §7 |
| 5 | §0.2 order *"… → P1e → P6"* | P6's ruler work belongs **early** (S3, a seam, no pixels); P1e is **last** (S13), because `Renderer` is needed until nothing calls `.draw()` on a VexFlow object | §3, §6 |
| 6 | §8.1: `GhostRenderer` + `FanGhost` *"⛔ mostly deleted"* | They are **260 uses (18%)**, the second-largest consumer, with 9 private `Stave`+`Voice`+`Formatter` builds. A step of their own, after the rules | `GhostRenderer.ts:163–1024`; `FanGhost.ts:55–67` |
| 7 | nowhere | The **font faces** come from VexFlow's import side effect; no phase owns it | `entry/vexflow.js:12–17`; §8.1 |
| 8 | §2.3's call profile | Stale; re-measured in the table below. The old counting method is not recorded, so the deltas are indicative, not exact | Appendix A |
| 9 | P5b: *"a mid-line CLEF change… ⛔ A migration may not decide it"* | Under rule 13 (added the same day) the migration **keeps today's 0.5 sp as a row** and moves on. The SIDE of the barline stays his model decision, and removal does not need it | `headerPlacementPass.ts` header table |

**§2.3 then → now** (resolved counts; `StemmableNote`/`Note`/`NoteHead` declarations included under
`StaveNote`):

| `Stave` | 2026-08-16 | today | `StaveNote` | 2026-08-16 | today |
|---|---|---|---|---|---|
| `getYForLine` | 22 | **41** | `getStemDirection` | 20 | **18** (+3 on `Beam`) |
| `getNoteStartX` | 9 | 8 | `getStemExtents` | 9 | 11 |
| `getNoteEndX` | 8 | 8 | `getAbsoluteX` | 9 | **15** |
| `getSpacingBetweenLines` | 5 | **26** | `getNoteHeadBeginX` | 7 | 10 |
| `getYForTopText` / `getYForNote` | 8 | 8 (2 + 6) | `getStemX` | 6 | **14** |
| `addClef` | 4 | 4 (+2 into our override) | `getNoteHeadEndX` | 6 | 7 |
| `addTimeSignature` | 2 | 2 (+1 into our override) | `getYs` | 5 | 7 |

---

## 11. ⭐⭐ What each step must KEEP from `own-engraving-engine.md` (added 2026-09-14)

This map counts the dependency and orders its removal. The engine plan carries standing rules about
**what we build in its place**, and a removal step that ignores them would trade VexFlow's
assumptions for the same assumptions written in our own files. ⛔ A step is not done because its
count reached zero; it is done when its count reached zero **and** the rows below still hold.

| from `own-engraving-engine.md` | binds at | what the step must do |
|---|---|---|
| **Rule 5** — no inverse mapping written as straight-staff arithmetic; ask the placement. **§0.4** — *"if the staff were a circle, how many files would change?"* — the answer must be TWO (the staff module, the placement) | **S2**, and every later reader | The staff frame is the ONLY place that does line arithmetic, and readers ASK it — ⛔ never copy `top + line × spacing` into the 25 files that asked `Stave`. Fold existing straight-staff readers in while there: `ElementRegistry.pixelYToPitch` computes `(y − topLineY) / lineSpacing` itself (`ElementRegistry.ts` ~1417), and `StaffGeometry` (`:308`) is the editor's copy of the same assumption. |
| **Rule 6** — a staff is a SPINE plus a thickness, one module owns where the lines go | **S2** | Already honoured by S2's design (§2); keep `staffLinesInk` reading the frame. |
| **Rules 7–8** — the rigid unit is a FRAGMENT (a bar, a beamed group) placed by an `Affine`, ⛔ never flattened into absolute x/y | **S4, S12, S13** | Keep group placements as matrices through `paint/DrawGroup.setPlacement`; ⛔ no step bakes a group's transform into its children's coordinates. |
| **Rule 9** — the registry records the SPACE an element was drawn in, beside its box (`withScale(k)` → `withSpace(affine)`) | **S3** | S3 rebuilds where the registry's boxes come from; that is the cheapest moment to add the space, and the rule's trigger (*"the next time a coordinate field is added to `ElementInfo`"*) has already fired unnoticed. |
| **The `vf-` ids and classes are a SEAM** — the selection highlight finds ink through them (`getSVGElement`: 22 uses in 7 rendering files) and the browser suite reads them (`vf-notehead` 52 selectors, `vf-ghost` 32, `vf-slur` 23, … over 200 in `e2e/`) | **S12, S13** (and U3, *"the root of the knot"*) | Either keep emitting the same ids/classes from our painter, or move the highlight and the e2e readers onto our own handles FIRST. ⛔ Dropping one fails SILENTLY — P3c's stem id is the recorded example. |
| **The four standing painter gotchas** (P1 section): `save`/`restore` are no-ops, the `vf-` prefix, the `setStyle` context leak, `getElementById` is document-wide | **S13** | S13's checklist; each must be decided, not inherited by accident. |
| **PDF export** renders through the same drawing (`engine/export/scoreSvg.ts`, `pdfExport.ts`) — and *"paper wins the tie-break"* | **S1, S13** | S1's own `@font-face` must also reach the PDF path; S13 must keep the export working. The scene plan's promise is that PDF stops being a second renderer. |
| **Goal order §0.1** — professional engraving first; contemporary notation and eye music *never designed for, never foreclosed* | every PORT step (S5–S9) | A port reproduces VexFlow's result on a straight staff; ⛔ it must not add NEW straight-staff assumptions of its own (rule 5 again). |
| **`recordScene` on an unchanged score records almost nothing** — a reused bar draws nothing | every step whose net is a scene test | Use `MusicEngine.recordFullScene()` / `forgetReuse()`, or the test passes vacuously. |
| **Taking a `draw()` must keep its write-back** — VexFlow writes position while painting (the flag bug) | **S5, S6, S10** | Before emptying a draw, list every ASSIGNMENT in the base method and reproduce it; assert the object's box in a spec. *"No pixel moved" ≠ "no ruler moved".* |
| **Rule 13** — a number is never a blocker; **rule 3** — port attributed | every PORT step | Already in §1; the port's number is the DEFAULT row, and the MIT notice travels with it (S14). |
| **§8.2's tree** — a file migrates on the commit that touches it, ⛔ never a big rename | every step | New modules go in `engrave/` / `paint/` / `scene/`; existing files move only when a step already rewrites them. |

---

## Appendix A — how to re-run the census

✅ **S0 landed (2026-09-14): the scan and the R1–R7 classifier are `scripts/check-vexflow-census.mjs`**,
run by `npm run lint:vexflow` inside `build:check` (≈6 s). It fails if any role's count rises above
its ceiling or a use falls in no role, and prints the new ceilings when a count falls;
`--detail` lists the busiest members and files per role. Its first run reproduced this map's
counts exactly (1,449 · R1 175 · R2 199 · R3 439 · R4 98 · R5 147 · R6 341 · R7 50 · specs 262).
The per-step assignment (`steps.cjs`) and the appendix generator were not carried over.

The original scripts lived outside the repo, in `/tmp/claude-1000/vexflow-removal-map/`:

| script | what it does |
|---|---|
| `scan.cjs` | TypeScript compiler API over `tsconfig.json`; writes `uses.json`, one record per resolved use: file, line, kind, VexFlow class + member, type-only, receiver type, and whether the call went through one of our subclasses |
| `roles.cjs` | the R1–R7 classifier; writes `uses-roles.json` |
| `steps.cjs` | exclusive assignment to S1–S13 |
| `appendix.cjs` | generates the tables below |

Run them with `node scan.cjs && node roles.cjs && node appendix.cjs && node steps.cjs` (about 6 s).
⚠️ `/tmp` does not survive a reboot. S0 is the step that turns this into a tracked script.

**Classifier conventions, so the counts can be argued with:**
- `Element.getX`/`getWidth`/`setX` count under R1 when the receiver is a `Stave`, R2 when it is a
  note, and R3 when it is a modifier or sign (its own placement).
- ⚠️ A receiver is a `Stave` only when its type IS `Stave` or `EngravedStave` (optionally `| undefined`).
  Until 2026-09-14 the test was a PREFIX, so `StaveNote` and `StaveModifier` receivers counted as R1:
  **every R1 figure in this map dated before that includes them** (22 uses at the time of the fix).
- A `Stave`/`StaveNote` *type*, constructor or `extends` counts under R6.
- `Barline.type`/`BarlineType` and `StaveModifierPosition` count under R3.
- `Stem.WIDTH`, `Metrics`, `fontInfo` and `LEDGER_LINE_OFFSET` count under R7.
- Import specifiers and calls that resolve to our overrides are counted separately (§0) and are in no
  role.
- Test files (`*.test.ts`, `__tests__/`) are excluded from the roles and listed in Appendix D.

**The old §2.3 profile** (2026-08-16) does not record how it counted. Its deltas in §10 compare
against resolved counts, so part of each change may be method rather than growth.

## Appendix B — every use, by role and file

Line ranges merge uses within 3 lines of each other.

### R1 staff coords

| file | uses | lines | members |
|---|---|---|---|
| `rendering/VexFlowRenderer.ts` | 43 | 1027, 1158, 2088, 2173, 2203, 2247, 2427, 2472, 2751, 2839, 2847–2848, 3226, 3578, 3589–3593, 3601, 3613–3615, 3669, 3680–3682, 3686, 3691, 3726, 4908, 5127, 5150–5152, 5168, 5175–5176 | Stave.getYForLine×8, Stave.getSpacingBetweenLines×6, Stave.getNoteEndX×6, Element.getX×6, Stave.getNoteStartX×5, Note.getStave×3, Element.getXShift×3, Element.setXShift×2, Stave.getYForNote, Stave.getBoundingBox, Element.setX, Element.getWidth |
| `rendering/KeySignaturePass.ts` | 18 | 118, 138–142, 175, 214–216, 245–248, 274–276, 314, 337, 347 | Element.getX×4, Stave.getSpacingBetweenLines×4, Stave.getTopLineTopY×4, Stave.getBottomLineBottomY×2, Stave.getYForLine×2, Element.getY, Stave.getNumLines |
| `rendering/SlurRenderer.ts` | 15 | 333–334, 390, 755, 760–761, 786, 846, 899, 926, 936, 965, 995–996 | Note.getStave×9, Stave.getYForLine×2, Stave.getSpacingBetweenLines×2, Stave.getTopLineTopY, Stave.getBottomLineBottomY |
| `rendering/EngravedStave.ts` | 13 | 139–142, 210–213 | Stave.measure×3, Element.getX×2, Stave.options×2, Stave.getYForTopText, StaveOptions.numLines, StaveLineConfig.visible, StaveOptions.lineConfig, Stave.getYForLine, Element.getWidth |
| `rendering/BarlineRenderer.ts` | 13 | 119, 319, 330–331, 434, 439, 483, 611, 617 | Element.getX×6, Stave.getSpacingBetweenLines×2, Element.getWidth×2, Element.getY, Stave.getNumLines, Stave.getYForLine |
| `rendering/headerPlacementPass.ts` | 10 | 97–99, 103, 128–130, 165, 172 | Element.getX×5, Stave.getSpacingBetweenLines×2, Element.setX×2, Element.getXShift |
| `rendering/FanPass.ts` | 6 | 528, 690, 750, 777, 808, 995 | Stave.getYForNote×3, Note.getStave, Stave.getNoteEndX, Stave.getSpacingBetweenLines |
| `rendering/TempoLayout.ts` | 6 | 240, 260, 281, 450, 513, 517 | Stave.getNoteStartX×2, Element.getX, Stave.getYForTopText, Stave.getYForLine, Stave.getSpacingBetweenLines |
| `rendering/EngravedTimeSignature.ts` | 5 | 121, 127, 131–134 | Stave.getYForLine×5 |
| `rendering/TieRenderer.ts` | 5 | 51, 216, 235, 243 | Note.getStave×3, Stave.getNumLines, Stave.getYForLine |
| `rendering/DynamicsLayout.ts` | 4 | 356–358 | Note.getStave×2, Stave.getYForLine, Stave.getSpacingBetweenLines |
| `rendering/GhostRenderer.ts` | 4 | 271, 332, 462 | Stave.getNoteEndX, Stave.getNoteStartX, Stave.getSpacingBetweenLines, Stave.getYForNote |
| `rendering/HairpinRenderer.ts` | 4 | 576, 596, 647, 727 | Stave.getYForLine×3, Stave.getSpacingBetweenLines |
| `rendering/GutterRenderer.ts` | 4 | 100, 144–146 | Stave.getYForLine×3, Stave.getNumLines |
| `rendering/TrillRenderer.ts` | 3 | 367, 371, 698 | Stave.getYForLine×2, Stave.getSpacingBetweenLines |
| `rendering/barlineInk.ts` | 3 | 54–55 | Stave.getYForLine×2, Stave.getNumLines |
| `rendering/systemStart.ts` | 3 | 176, 192 | Stave.getYForLine×2, Stave.getNumLines |
| `rendering/CenteredTremolo.ts` | 2 | 90 | Stave.getSpacingBetweenLines, Note.getStave |
| `rendering/EngravedNote.ts` | 2 | 164, 173 | Note.checkStave, Stave.getYForNote |
| `rendering/EngravedDot.ts` | 2 | 76 | Stave.getSpacingBetweenLines, Note.checkStave |
| `rendering/staffSpace.ts` | 2 | 19, 24 | Stave.getSpacingBetweenLines×2 |
| `rendering/OttavaRenderer.ts` | 2 | 521, 641 | Stave.getYForLine×2 |
| `rendering/PedalRenderer.ts` | 2 | 432, 473 | Stave.getYForLine×2 |
| `rendering/EngravedClef.ts` | 1 | 78 | Stave.getYForLine |
| `rendering/barlineGap.ts` | 1 | 110 | Element.getY |
| `rendering/dynamicsLinePass.ts` | 1 | 146 | Stave.getYForLine |
| `rendering/tempoLinePass.ts` | 1 | 159 | Stave.getYForLine |

### R2 note ruler

| file | uses | lines | members |
|---|---|---|---|
| `rendering/VexFlowRenderer.ts` | 81 | 971, 1031, 1159–1166, 1173, 1306–1308, 1408, 1418, 1462, 2080, 2084, 2165, 2238–2239, 2244, 2353–2354, 2396, 2402–2403, 2499–2503, 2870, 3109, 3113, 3163–3165, 3195, 3227, 3288–3289, 3305, 3375, 3400, 3421, 3438, 3467, 3545, 3584, 4883–4885, 4889–4890 | StemmableNote.getStemDirection×9, BoundingBox.x×8, StaveNote.getStemX×8, BoundingBox.y×7, BoundingBox.w×7, BoundingBox.h×7, Note.getAbsoluteX×5, StaveNote.hasStem×4, StaveNote.getGlyphWidth×3, StaveNote.getNoteHeadBeginX×3, StaveNote.getNoteHeadEndX×3, StemmableNote.getStemExtents×2, ClefNote.getBoundingBox×2, StaveNote.isRest×2, Note.renderOptions×2, StaveNote.x×2, StaveNote.hasFlag, StemmableNote.topY, StemmableNote.baseY, StaveNote.getTieLeftX, StaveNote.noteHeads, StaveNote.getBoundingBox, Note.getYs |
| `rendering/EngravedNote.ts` | 24 | 138, 163–167, 227, 236–240, 247, 281–282, 286–288, 309–310, 314, 318, 363 | StemmableNote.flag×5, StaveNote.isRest×2, StaveNote.noteHeads×2, NoteHead.getAbsoluteX×2, NoteHead.getLine, StaveNote.getGlyphWidth, Element.setX, Element.getXShift, NoteHead.getWidth, Element.getY, Element.getYShift, StaveNoteHeadBounds.yTop, StaveNoteHeadBounds.yBottom, StaveNote.getNoteHeadBounds, StemmableNote.getStemDirection, StaveNote.getStemX, Note.renderOptions |
| `rendering/FanPass.ts` | 19 | 479, 497, 509, 693–695, 713, 777–779, 801, 906, 939 | StemmableNote.getStemExtents×4, StemmableNote.topY×3, StaveNote.getGlyphWidth×2, StaveNote.getNoteHeadBeginX×2, StemmableNote.baseY×2, StemmableNote.getStemDirection×2, StaveNote.getStemX×2, NoteHead.getAbsoluteX, Note.getYs |
| `rendering/GhostRenderer.ts` | 10 | 284, 317–322, 326, 459–460 | StaveNote.getNoteHeadBeginX×2, StaveNote.getNoteHeadEndX×2, Note.getAbsoluteX, StemmableNote.getStemExtents, StaveNote.hasStem, Note.getYs, StemmableNote.topY, StemmableNote.baseY |
| `rendering/EngravedBeam.ts` | 9 | 140–141, 147, 195 | StemmableNote.getStemX×3, Note.getLineNumber×2, StemmableNote.topY×2, StemmableNote.getStemExtents×2 |
| `rendering/CenteredTremolo.ts` | 8 | 89–91, 194, 207–209 | Note.getStemDirection×2, Note.getAbsoluteX×2, Note.getGlyphWidth×2, Note.getStemExtents, Note.hasStem |
| `rendering/SlurRenderer.ts` | 8 | 110–111, 140–144, 151, 628 | StemmableNote.getStemDirection×2, StaveNote.hasStem, StemmableNote.topY, StemmableNote.getStemExtents, Note.getYs, StaveNote.getNoteHeadBeginX, StaveNote.getNoteHeadEndX |
| `rendering/ScoreTuplet.ts` | 7 | 143, 147–148, 191 | Note.getAbsoluteX, Note.getTieLeftX, Note.getTieRightX, BoundingBox.getX, BoundingBox.getY, BoundingBox.getW, BoundingBox.getH |
| `rendering/fanArticulations.ts` | 5 | 160, 173 | StaveNote.getNoteHeadBeginX, BoundingBox.x, BoundingBox.y, BoundingBox.w, BoundingBox.h |
| `rendering/drawnHitBox.ts` | 4 | 61 | BoundingBox.x, BoundingBox.y, BoundingBox.w, BoundingBox.h |
| `rendering/TieRenderer.ts` | 4 | 37, 41–42, 150 | Note.getYs, StaveNote.getNoteHeadBeginX, StaveNote.getNoteHeadEndX, StemmableNote.getStemDirection |
| `rendering/dotPlacement.ts` | 3 | 150–153 | StaveNote.isRest, StaveNote.hasFlag, StemmableNote.getStemDirection |
| `rendering/EngravedAccidental.ts` | 2 | 107–108 | Note.x, Note.y |
| `rendering/EngravedDot.ts` | 2 | 75–76 | Note.x, Note.y |
| `rendering/DynamicsLayout.ts` | 2 | 355–357 | Note.getYs, Note.getAbsoluteX |
| `rendering/TempoLayout.ts` | 2 | 272, 308 | Note.getAbsoluteX×2 |
| `rendering/TrillRenderer.ts` | 2 | 146, 839 | StaveNote.getTieLeftX, Note.getYs |
| `rendering/OttavaRenderer.ts` | 2 | 149, 165 | StaveNote.getTieLeftX, StaveNote.getTieRightX |
| `rendering/ledgerAccidentalClearance.ts` | 1 | 152 | StaveNote.isRest |
| `rendering/accidentalPlacement.ts` | 1 | 67 | StaveNote.isRest |
| `rendering/PedalRenderer.ts` | 1 | 108 | StaveNote.getTieLeftX |
| `rendering/clefOffsetPass.ts` | 1 | 59 | ClefNote.getClef |
| `rendering/HairpinRenderer.ts` | 1 | 119 | StaveNote.getTieLeftX |

### R3 placement rules

| file | uses | lines | members |
|---|---|---|---|
| `rendering/GhostRenderer.ts` | 77 | 164–171, 178–181, 213, 217, 222–225, 238, 243, 255, 432–433, 446, 457, 462, 513–515, 556–558, 657–658, 743–744, 754, 769, 811–812, 817, 885–886, 1014–1015, 1020 | BarlineType.NONE×16, Barline.type×16, Stave.setBegBarType×8, Stave.setEndBarType×8, Dot.buildAndAttach×4, Stave.addClef×3, Accidental.constructor×3, Modifier.Position×3, Stave.addTimeSignature×2, ModifierPosition.ABOVE×2, Modifier.setPosition×2, Articulation.constructor×2, StaveNote.getLineForRest×2, Stave.setDefaultLedgerLineStyle, Stave.addEndClef, Stave.addEndTimeSignature, StemmableNote.setStemDirection, ModifierPosition.BELOW, Modifier.setTextLine |
| `rendering/VexFlowRenderer.ts` | 68 | 284, 963, 1031, 1037, 1066, 1105–1106, 2081, 2142, 2241–2244, 2397, 2417–2418, 2462, 2477, 2494–2495, 2567, 2593, 2627, 2642, 2654, 2972–2974, 3001–3002, 3010, 3018, 3025, 3052–3053, 3101, 3110–3111, 3119, 3159, 3164, 3188–3190, 3232, 3292, 3309–3312, 3458, 3507–3508, 3537–3540, 3667, 5151, 5170 | Beam.<type>×7, StemmableNote.setStemDirection×6, Element.getBoundingBox×4, StaveNote.getKeyLine×3, Stave.getModifiers×3, StaveModifierPosition.BEGIN×3, Stem.setExtension×2, Stem.getExtension×2, Stave.getDefaultLedgerLineStyle×2, BarlineType.NONE×2, Barline.type×2, StaveNote.setBeam×2, Beam.breakSecondaryAt×2, Tuplet.getYPosition×2, StemmableNote.getStemLength, StaveNote.setKeyLine, ModifierPosition.ABOVE, ModifierPosition.BELOW, Modifier.Position, Accidental.<instanceof>, Articulation.<instanceof>, StaveNote.getModifierStartXY, Stave.setDefaultLedgerLineStyle, Stave.setEndBarType, Stave.setBegBarType, Stave.addEndClef, Stave.addEndTimeSignature, Beam.beamWidth, Beam.renderOptions, Beam.getStemDirection, Beam.getBeamYToDraw, Beam.getSlopeY, Beam.slope, Stem.adjustHeightForBeam, Stem.topY, Stem.getExtents, Tuplet.getNotes, Element.width, Accidental.<type>, Modifier.getIndex |
| `rendering/EngravedBeam.ts` | 32 | 82, 111–112, 120–123, 136–138, 142, 148, 173, 177, 186, 195–197, 202–203, 208–211, 247, 261, 284 | Beam.notes×6, Beam.renderOptions×3, Beam.postFormatted×2, Beam.getStemDirection×2, Beam.getSlopeY×2, Beam.slope×2, Beam.<type>×2, Beam.<extends>, Beam.maxSlope, Beam.minSlope, Beam.postFormat, Stem.DOWN, Beam.getBeamCount, Beam.drawStems, Beam.beamWidth, Beam.getBeamYToDraw, Beam.getBeamLines, Beam.start, Beam.end, Beam.setPartialBeamSideAt |
| `rendering/EngravedNote.ts` | 27 | 70, 80, 86–92, 99, 138, 176, 280–285, 309–310 | Stem.stemDirection×3, Stem.DOWN×2, Stem.getHeight×2, Stem.<extends>, Stem.hide, Stem.xBegin, Stem.xEnd, Stem.yTop, Stem.stemDownYOffset, Stem.yBottom, Stem.stemUpYOffset, Stem.stemDownYBaseOffset, Stem.stemUpYBaseOffset, Stem.isStemlet, Stem.stemletHeight, Stem.renderHeightAdjustment, StemmableNote.setStem, Stave.getDefaultLedgerLineStyle, StaveNote.getLedgerLineStyle, StaveNote.shouldDrawFlag, StemmableNote.checkStem, Element.setX, Element.setY |
| `rendering/ScoreTuplet.ts` | 24 | 73, 82, 107, 125, 129–132, 153–155, 160–163, 167–175, 181, 187–190 | Element.width×6, Tuplet.textElement×3, Tuplet.notes×3, Element.getWidth×2, Tuplet.<extends>, TupletOptions.location, TupletOptions.bracketed, TupletOptions.textYOffset, Tuplet.options, Tuplet.getYPosition, Tuplet.LOCATION_BOTTOM, Element.getHeight, Tuplet.LOCATION_TOP, Element.getBoundingBox |
| `rendering/EngravedTimeSignature.ts` | 21 | 61, 80, 84, 120–121, 126–127, 131–134, 154–155 | Element.getX×3, TimeSignature.botText×2, TimeSignature.topLine×2, TimeSignature.lineShift×2, TimeSignature.bottomLine×2, TimeSignature.<extends>, StaveModifier.checkStave, TimeSignature.isNumeric, TimeSignature.getLine, TimeSignature.topText, TimeSignature.topStartX, TimeSignature.botStartX, Element.getXShift, Element.getY, Element.getYShift |
| `rendering/EngravedStave.ts` | 21 | 85–86, 90–93, 116, 122, 132, 160–165, 186 | Stave.modifiers×5, Barline.<type>×3, StaveModifier.setStave×2, Stave.addModifier×2, Barline.getType, StaveModifier.setPosition, StaveModifier.getPosition, Stave.formatted, Stave.format, StaveModifierPosition.BEGIN, Stave.clef, StaveModifierPosition.END, Stave.endClef |
| `rendering/fanArticulations.ts` | 19 | 77–78, 117–118, 137–144, 167, 172 | Modifier.Position×6, ModifierPosition.ABOVE×3, ModifierPosition.BELOW×3, StemmableNote.setStemLength, StemmableNote.setStemDirection, Articulation.constructor, Modifier.setPosition, Element.setX, Element.getX, Element.getBoundingBox |
| `rendering/NoteBuilder.ts` | 18 | 183, 193, 301, 335–340, 349 | Modifier.Position×6, ModifierPosition.ABOVE×3, ModifierPosition.BELOW×3, StaveNote.setKeyLine×2, StaveNote.getLineForRest×2, StemmableNote.setStemDirection, Modifier.setPosition |
| `rendering/EngravedDot.ts` | 14 | 47, 63, 68, 73–76, 80–81 | Element.x×2, Element.y×2, Dot.<extends>, Modifier.checkAttachedNote, isTabNote.<value-ref>, Element.children, Note.getModifierStartXY, Modifier.position, Modifier.checkIndex, Dot.dotShiftY, Modifier.getXShift, Element.getYShift |
| `rendering/EngravedAccidental.ts` | 13 | 63, 98, 105–108, 114, 121–122 | Element.x×2, Element.y×2, Accidental.<extends>, Modifier.checkAttachedNote, Note.getModifierStartXY, Modifier.position, Modifier.checkIndex, Element.getWidth, Element.children, Modifier.getXShift, Element.getYShift |
| `rendering/headerPlacementPass.ts` | 12 | 95, 101–102, 126, 158 | Stave.getModifiers×4, StaveModifierPosition.BEGIN×4, Clef.CATEGORY×2, Barline.CATEGORY, TimeSignature.CATEGORY |
| `rendering/CenteredTremolo.ts` | 11 | 95, 147–149, 191, 208, 233, 245–247, 264, 268 | Tremolo.num×4, Modifier.checkAttachedNote×2, Element.x×2, Tremolo.<extends>, Stem.UP, Element.y |
| `rendering/FanPass.ts` | 11 | 137, 572–574, 724, 735, 907–909, 997 | Accidental.constructor×2, Element.getWidth, Element.setY, Element.setX, StaveNote.isDisplaced, StemmableNote.getBeamCount, Stem.setExtension, Stem.getExtension, Stem.adjustHeightForBeam, Stave.getDefaultLedgerLineStyle |
| `rendering/EngravedClef.ts` | 8 | 48, 76–78, 82 | Element.y×2, Clef.<extends>, StaveModifier.checkStave, Clef.line, Element.getX, Element.getXShift, Element.getYShift |
| `rendering/dotPlacement.ts` | 7 | 118, 151–155 | Dot.getDots×2, Element.setWidth, Element.getWidth, Stem.UP, Modifier.setXShift, Modifier.getXShift |
| `rendering/ledgerAccidentalClearance.ts` | 7 | 153–158, 168 | KeyProps.line×2, Accidental.<type>, Accidental.<instanceof>, Modifier.checkIndex, Modifier.setXShift, Modifier.getXShift |
| `rendering/FanGhost.ts` | 7 | 56–57, 61 | BarlineType.NONE×2, Barline.type×2, Stave.setBegBarType, Stave.setEndBarType, Dot.buildAndAttach |
| `rendering/GutterRenderer.ts` | 7 | 118–121 | BarlineType.NONE×2, Barline.type×2, Stave.addClef, Stave.setBegBarType, Stave.setEndBarType |
| `rendering/EngravedArticulation.ts` | 6 | 50, 73, 80–81 | Articulation.<extends>, Element.children, Element.getX, Modifier.getXShift, Element.getY, Element.getYShift |
| `rendering/EngravedBarline.ts` | 5 | 70, 96, 100, 105 | Barline.<extends>, Barline.getType, BarlineType.SINGLE, StaveModifier.checkStave, Element.getX |
| `rendering/BarlineRenderer.ts` | 5 | 432, 482 | Stave.getModifiers×2, StaveModifierPosition.BEGIN, StaveModifierPosition.END, Barline.CATEGORY |
| `rendering/TempoLayout.ts` | 4 | 165, 239 | Element.getWidth, Stave.getModifiers, StaveModifierPosition.BEGIN, TimeSignature.CATEGORY |
| `rendering/accidentalPlacement.ts` | 3 | 69–71 | Accidental.<instanceof>, Modifier.setXShift, Modifier.getXShift |
| `rendering/clefOffsetPass.ts` | 3 | 108 | Stave.getModifiers, StaveModifierPosition.BEGIN, Clef.CATEGORY |
| `rendering/drawnHitBox.ts` | 2 | 48, 60 | Accidental.<type>, Element.getBoundingBox |
| `rendering/DynamicsLayout.ts` | 2 | 217, 354 | Element.setWidth, Modifier.getNote |
| `rendering/KeySignaturePass.ts` | 2 | 139 | Stave.getModifiers, StaveModifierPosition.BEGIN |
| `rendering/RenderPass.ts` | 1 | 97 | Tuplet.<type> |
| `rendering/glyphPainter.ts` | 1 | 116 | Element.getWidth |
| `rendering/SlurRenderer.ts` | 1 | 296 | Accidental.type |

### R4 formatter

| file | uses | lines | members |
|---|---|---|---|
| `rendering/GhostRenderer.ts` | 47 | 265–269, 274, 451–452, 666–670, 759–762, 820–823, 894–897, 1024–1027 | Voice.constructor×7, Formatter.format×7, Formatter.joinVoices×7, Formatter.constructor×7, Voice.addTickables×6, Voice.setStrict×5, Voice.setMode×2, VoiceMode.SOFT×2, Voice.Mode×2, Voice.addTickable, Voice.draw |
| `rendering/VexFlowRenderer.ts` | 24 | 173, 177–179, 186, 210, 2081, 2123–2127, 2185–2186, 2285, 2825, 2864–2865, 2871, 5212 | Voice.<type>×2, Tickable.isCenterAligned×2, Formatter.<type>, Formatter.getTickContexts, AlignmentContexts.list, AlignmentContexts.map, AlignmentContexts.resolutionMultiplier, Fraction.value, Voice.getTotalTicks, TickContext.setX, TickContext.getX, Voice.setMode, Voice.constructor, Voice.addTickables, Formatter.joinVoices, Formatter.constructor, Formatter.format, Voice.draw, Voice.getTickables, Tickable.setCenterXShift, Tickable.getCenterXShift, Stave.setNoteStartX |
| `rendering/spacingPass.ts` | 8 | 112, 116–118, 124, 137 | Formatter.<type>, Voice.<type>, Formatter.getTickContexts, AlignmentContexts.map, AlignmentContexts.resolutionMultiplier, Fraction.value, Voice.getTotalTicks, TickContext.setX |
| `rendering/FanGhost.ts` | 8 | 66–67 | Voice.addTickable, Voice.setMode, Voice.constructor, VoiceMode.SOFT, Voice.Mode, Formatter.format, Formatter.joinVoices, Formatter.constructor |
| `rendering/NoteBuilder.ts` | 6 | 76, 292, 299 | Voice.Mode×2, Tickable.applyTickMultiplier×2, VoiceMode.SOFT, VoiceMode.FULL |
| `rendering/fanArticulations.ts` | 5 | 131, 155–157 | Note.setTickContext, TickContext.constructor, ModifierContext.constructor, Tickable.addToModifierContext, StaveNote.preFormat |

### R5 paint+leftovers

| file | uses | lines | members |
|---|---|---|---|
| `rendering/GhostRenderer.ts` | 31 | 84, 426, 463–466, 506, 551, 614, 618, 623, 650, 738, 765, 771, 808, 826, 830, 882, 900, 904, 956, 975, 983, 1011, 1021, 1030, 1034, 1088, 1121–1124 | SVGContext.<type>×14, SVGContext.openGroup×6, SVGContext.closeGroup×6, SVGContext.beginPath, SVGContext.moveTo, SVGContext.lineTo, SVGContext.stroke, Element.getCategory |
| `rendering/VexFlowRenderer.ts` | 18 | 439, 480–481, 613, 916–918, 962, 3457, 3506, 3668, 4044, 5005, 5041, 5171 | Element.getCategory×5, SVGContext.<type>×3, Annotation.<type>×2, Renderer.resize×2, Renderer.<type>, Renderer.constructor, RendererBackends.SVG, Renderer.Backends, Renderer.getContext, SVGContext.svg |
| `rendering/ScoreTuplet.ts` | 16 | 43, 56–59, 65–67, 77, 125, 160, 165, 170, 174–175, 180–181, 191–192 | RenderContext.fillRect×5, Element.<type>×2, Element.setText×2, Element.constructor, Element.setFont, RenderContext.<type>, Element.getText, RenderContext.openGroup, RenderContext.pointerRect, RenderContext.closeGroup |
| `rendering/GutterRenderer.ts` | 16 | 49, 73–76, 86–89, 93–94, 122, 127, 149, 157–158 | Renderer.<type>, Renderer.constructor, RendererBackends.SVG, Renderer.Backends, Renderer.resize, Renderer.getContext, RenderContext.save, RenderContext.restore, RenderContext.scale, RenderContext.setStrokeStyle, RenderContext.setFillStyle, RenderContext.openGroup, RenderContext.closeGroup, RenderContext.fillRect, RenderContext.setFont, RenderContext.fillText |
| `rendering/glyphPainter.ts` | 10 | 88–89, 114, 123–126, 171–173 | RenderContext.<type>×2, Element.<type>×2, Element.constructor×2, Element.setText×2, Element.setFontSize, Element.setFont |
| `rendering/FanPass.ts` | 8 | 468, 494, 504, 530, 622, 630, 896, 986 | SVGContext.openGroup×2, SVGContext.closeGroup×2, SVGContext.<type>×2, NoteHead.constructor, NoteHead.setStave |
| `rendering/EngravedNote.ts` | 7 | 94, 102, 229, 245, 251, 286, 314 | Element.getText×2, RenderContext.openGroup, RenderContext.closeGroup, RenderContext.save, RenderContext.restore, Element.getTextMetrics |
| `rendering/DynamicsLayout.ts` | 7 | 200–207, 211 | Annotation.<type>, Annotation.constructor, Annotation.setVerticalJustification, Annotation.setJustification, AnnotationHorizontalJustify.LEFT, Annotation.HorizontalJustify, Element.setFont |
| `rendering/EngravedStave.ts` | 5 | 114, 119, 140–142 | RenderContext.openGroup, RenderContext.closeGroup, RenderContext.setFont, RenderContext.measureText, RenderContext.fillText |
| `rendering/CenteredTremolo.ts` | 4 | 120, 161–162, 263 | Element.textMetrics×2, Element.text, Element.setFontSize |
| `rendering/TempoLayout.ts` | 3 | 151, 160–163 | Element.constructor, Element.setFont, Element.setText |
| `rendering/EngravedTimeSignature.ts` | 3 | 126, 151–153 | Element.getText×2, Element.<type> |
| `rendering/RenderPass.ts` | 2 | 78, 99 | SVGContext.<type>, Annotation.<type> |
| `rendering/fanArticulations.ts` | 2 | 55, 108 | RenderContext.<type>×2 |
| `rendering/EngravedBeam.ts` | 2 | 175, 180 | RenderContext.openGroup, RenderContext.closeGroup |
| `rendering/EngravedAccidental.ts` | 1 | 120 | Element.getText |
| `rendering/EngravedArticulation.ts` | 1 | 79 | Element.getText |
| `rendering/EngravedDot.ts` | 1 | 79 | Element.getText |
| `rendering/drawnHitBox.ts` | 1 | 56 | Element.getText |
| `rendering/FanGhost.ts` | 1 | 46 | SVGContext.<type> |
| `rendering/KeySignaturePass.ts` | 1 | 140 | Element.getCategory |
| `rendering/EngravedClef.ts` | 1 | 81 | Element.getText |
| `rendering/BarlineRenderer.ts` | 1 | 432 | Element.getCategory |
| `rendering/headerPlacementPass.ts` | 1 | 102 | Element.getCategory |
| `rendering/tempoLinePass.ts` | 1 | 100 | SVGContext.svg |
| `rendering/tempoAnchorInk.ts` | 1 | 78 | SVGContext.svg |
| `rendering/tempoNudgePass.ts` | 1 | 61 | SVGContext.svg |
| `rendering/markPreviewPass.ts` | 1 | 259 | SVGContext.svg |

### R6 object graph

| file | uses | lines | members |
|---|---|---|---|
| `rendering/VexFlowRenderer.ts` | 92 | 389, 426, 431, 596, 954, 961, 1012, 1023–1024, 1059, 1063, 1105, 1152, 1247–1248, 1252, 1299, 1341, 1348, 1370–1374, 1378, 1402, 1444, 1459, 1910, 1967, 2000, 2063–2065, 2114–2115, 2164, 2291, 2387, 2461, 2476, 2494, 2565, 2732, 2825, 2866–2869, 2888–2890, 2895, 2899–2900, 2963, 3047, 3080, 3099, 3103, 3112, 3156–3160, 3203, 3207–3208, 3221, 3232, 3239, 3260, 3296, 3360, 3448, 3505, 3563, 4968–4970, 4985, 4995, 5126, 5148, 5167, 5189 | StaveNote.<type>×40, Stave.<type>×17, Tickable.getModifiers×7, ClefNote.<type>×7, StemmableNote.getStem×5, Element.setContext×5, Element.getSVGElement×4, Note.hasBeam×2, ClefNote.constructor, Beam.draw, StaveNote.setStave, Stave.draw, Element.drawWithStyle |
| `rendering/GhostRenderer.ts` | 62 | 163, 183, 207, 222–225, 233, 243, 254, 259, 276, 292, 308, 431–434, 445–448, 453, 512, 516, 555, 559, 656–664, 672, 742–745, 751–755, 763, 769, 810–818, 824, 828, 884–892, 898, 902, 1013–1021, 1028, 1032 | Element.setContext×16, StaveNote.setStave×11, Stave.constructor×9, StaveNote.constructor×8, Note.addModifier×8, StaveNote.draw×2, Stave.draw×2, StaveNote.<type>, Element.getSVGElement, Articulation.draw, Accidental.draw, Tickable.getModifiers, Modifier.draw |
| `rendering/FanPass.ts` | 20 | 83–85, 101, 245, 286, 394, 531, 573–575, 671, 677–679, 730, 896–899, 910, 931, 987 | StaveNote.<type>×9, Stave.<type>×3, Element.setContext×3, StemmableNote.getStem×2, NoteHead.draw, Element.renderText, Element.drawWithStyle |
| `rendering/EngravedNote.ts` | 16 | 79–81, 94, 107, 171, 224, 228–231, 244, 249, 313, 334–337, 345, 361 | Element.checkContext×4, Element.setRendered×2, Element.getAttribute×2, StaveNote.<type>×2, StaveNote.<extends>, Element.setContext, Element.applyStyle, StaveNote.drawModifiers, StemmableNote.getStem, Tickable.getModifiers |
| `rendering/SlurRenderer.ts` | 12 | 80, 108, 292, 385, 463, 489–492, 518, 565, 878, 924 | Stave.<type>×9, StaveNote.<type>×2, Tickable.getModifiers |
| `rendering/DynamicsLayout.ts` | 9 | 110, 123, 158, 203, 237, 299, 304, 334, 354 | Element.getSVGElement×4, StaveNote.<type>×2, Note.addModifier, Element.setAttribute, Stave.<type> |
| `rendering/TempoLayout.ts` | 9 | 164, 225–226, 301, 332, 381–382, 410–413 | StaveNote.<type>×5, Stave.<type>×3, Element.renderText |
| `rendering/fanArticulations.ts` | 8 | 109, 129–130, 145, 165–168 | Element.setContext×2, Stave.<type>, StaveNote.constructor, StaveNote.setStave, Note.addModifier, Articulation.draw, Element.renderText |
| `rendering/EngravedStave.ts` | 8 | 52, 83, 110–114, 131–134, 223 | Stave.<extends>, StaveOptions.<type>, Element.checkContext, Element.setRendered, Element.getAttribute, Element.setContext, Element.drawWithStyle, Stave.<type> |
| `rendering/HairpinRenderer.ts` | 8 | 73, 184, 258, 265, 488–491, 512 | Stave.<type>×6, Element.getSVGElement×2 |
| `rendering/EngravedDot.ts` | 7 | 62–64, 69, 85, 98–99 | Element.checkContext, Element.setRendered, Dot.draw, Element.getAttribute, StaveNote.<type>, Note.getKeys, Note.addModifier |
| `rendering/FanGhost.ts` | 6 | 55–63, 68 | Element.setContext×2, Stave.constructor, StaveNote.constructor, StaveNote.setStave, StaveNote.draw |
| `rendering/EngravedTimeSignature.ts` | 6 | 81–85, 105–106, 119 | Element.setRendered×2, Stave.<type>×2, Element.checkContext, Element.getAttribute |
| `rendering/NoteBuilder.ts` | 5 | 154, 159, 310, 349, 374 | Note.addModifier×3, StaveNote.<type>×2 |
| `rendering/GutterRenderer.ts` | 5 | 99–102, 113, 125 | Stave.constructor×2, Stave.<type>, Stave.draw, Element.setContext |
| `rendering/ScoreTuplet.ts` | 4 | 81, 130, 165, 193 | Element.renderText, Element.checkContext, Element.getAttribute, Element.setRendered |
| `rendering/CenteredTremolo.ts` | 4 | 88, 190–192, 248 | Note.<type>, Element.checkContext, Element.setRendered, Element.renderText |
| `rendering/EngravedAccidental.ts` | 4 | 97–99, 115, 126 | Element.checkContext, Element.setRendered, Accidental.draw, Element.getAttribute |
| `rendering/KeySignaturePass.ts` | 4 | 42, 137, 174, 335 | Stave.<type>×4 |
| `rendering/EngravedBarline.ts` | 4 | 97, 101–106 | Barline.draw, Element.setRendered, Element.checkContext, Element.getAttribute |
| `rendering/headerPlacementPass.ts` | 4 | 75, 94, 125, 152 | Stave.<type>×4 |
| `rendering/EngravedArticulation.ts` | 3 | 74, 85 | Element.renderText, Element.checkContext, Element.getAttribute |
| `rendering/ledgerAccidentalClearance.ts` | 3 | 150–155 | StaveNote.<type>, Tickable.getModifiers, Note.getKeyProps |
| `rendering/EngravedBeam.ts` | 3 | 170–175 | Element.checkContext, Element.setRendered, Element.getAttribute |
| `rendering/EngravedClef.ts` | 3 | 77–80, 84 | Element.setRendered, Element.checkContext, Element.getAttribute |
| `rendering/BarlineRenderer.ts` | 3 | 83, 430, 481 | Stave.<type>×3 |
| `rendering/clefOffsetPass.ts` | 3 | 33, 51, 101 | Stave.<type>×2, ClefNote.<type> |
| `rendering/TieRenderer.ts` | 3 | 36, 48, 68 | Stave.<type>×2, StaveNote.<type> |
| `rendering/RenderPass.ts` | 2 | 36, 80 | StaveNote.<type>×2 |
| `rendering/dotPlacement.ts` | 2 | 116, 148 | StaveNote.<type>×2 |
| `rendering/staffSpace.ts` | 2 | 18, 23 | Stave.<type>×2 |
| `rendering/accidentalPlacement.ts` | 2 | 63, 68 | StaveNote.<type>, Tickable.getModifiers |
| `rendering/glyphPainter.ts` | 2 | 144, 174 | Element.renderText×2 |
| `rendering/TrillRenderer.ts` | 2 | 105, 917 | Stave.<type>×2 |
| `rendering/dynamicsLinePass.ts` | 2 | 58, 124 | Stave.<type>, Element.getSVGElement |
| `rendering/dynamicNudgePass.ts` | 2 | 42, 70 | Stave.<type>, Element.getSVGElement |
| `rendering/OttavaRenderer.ts` | 1 | 82 | Stave.<type> |
| `rendering/PedalRenderer.ts` | 1 | 77 | Stave.<type> |
| `rendering/barlineInk.ts` | 1 | 52 | Stave.<type> |
| `rendering/systemStart.ts` | 1 | 68 | Stave.<type> |
| `rendering/tempoLinePass.ts` | 1 | 63 | Stave.<type> |
| `rendering/tempoNudgePass.ts` | 1 | 48 | Stave.<type> |
| `rendering/markPreviewPass.ts` | 1 | 331 | Element.getSVGElement |

### R7 numbers+fonts

| file | uses | lines | members |
|---|---|---|---|
| `rendering/CenteredTremolo.ts` | 7 | 147–149, 161, 195–198, 208 | Metrics.get×3, Element.getFontScale×2, Stem.WIDTH×2 |
| `rendering/TempoLayout.ts` | 7 | 54–55, 159–160 | Metrics.clear×2, Element.fontInfo, FontInfo.family, FontInfo.size, FontInfo.weight, FontInfo.style |
| `rendering/GhostRenderer.ts` | 7 | 689–693 | FontInfo.size×3, FontInfo.style×2, Element.fontInfo, FontInfo.family |
| `rendering/ScoreTuplet.ts` | 6 | 22, 62 | Metrics.clear, FontInfo.family, FontInfo.size, FontInfo.weight, FontInfo.style, Element.fontInfo |
| `rendering/VexFlowRenderer.ts` | 6 | 1320, 3113, 3165, 5127, 5212 | Stem.WIDTH×4, Metrics.get×2 |
| `rendering/EngravedNote.ts` | 5 | 100, 128, 248, 288, 318 | Stem.WIDTH×2, Element.fontInfo×2, StaveNote.LEDGER_LINE_OFFSET |
| `rendering/ledgerAccidentalClearance.ts` | 2 | 69, 82 | StaveNote.LEDGER_LINE_OFFSET, Metrics.get |
| `rendering/FanPass.ts` | 2 | 481, 581 | Stem.WIDTH×2 |
| `rendering/EngravedStave.ts` | 2 | 140–141 | Element.fontInfo, TextMeasure.width |
| `rendering/EngravedAccidental.ts` | 1 | 123 | Element.fontInfo |
| `rendering/EngravedArticulation.ts` | 1 | 82 | Element.fontInfo |
| `rendering/EngravedDot.ts` | 1 | 82 | Element.fontInfo |
| `rendering/chordHeadLayout.ts` | 1 | 83 | Stem.WIDTH |
| `rendering/EngravedClef.ts` | 1 | 83 | Element.fontInfo |
| `rendering/EngravedTimeSignature.ts` | 1 | 156 | Element.fontInfo |

## Appendix C — file × role matrix (non-test)

| file | total | R1 | R2 | R3 | R4 | R5 | R6 | R7 | value imports |
|---|---|---|---|---|---|---|---|---|---|
| `VexFlowRenderer.ts` | 332 | 43 | 81 | 68 | 24 | 18 | 92 | 6 | Renderer, Stave, StaveModifierPosition, StaveNote, Voice, Formatter, Accidental, Articulation, Annotation, Modifier, Barline, Beam, Stem, ClefNote, Metrics |
| `GhostRenderer.ts` | 238 | 4 | 10 | 77 | 47 | 31 | 62 | 7 | Stave, StaveNote, Voice, Formatter, Accidental, Articulation, Modifier, Dot, Barline |
| `EngravedNote.ts` | 81 | 2 | 24 | 27 |  | 7 | 16 | 5 | StaveNote, Stem |
| `FanPass.ts` | 66 | 6 | 19 | 11 |  | 8 | 20 | 2 | Stave, StaveNote, NoteHead, Accidental, Stem |
| `ScoreTuplet.ts` | 57 |  | 7 | 24 |  | 16 | 4 | 6 | Element, Metrics, MetricsDefaults, Tuplet |
| `EngravedStave.ts` | 49 | 13 |  | 21 |  | 5 | 8 | 2 | Barline, Stave, StaveModifierPosition |
| `EngravedBeam.ts` | 46 |  | 9 | 32 |  | 2 | 3 |  | Beam, Stem |
| `fanArticulations.ts` | 39 |  | 5 | 19 | 5 | 2 | 8 |  | Articulation, Modifier, ModifierContext, StaveNote, TickContext |
| `CenteredTremolo.ts` | 36 | 2 | 8 | 11 |  | 4 | 4 | 7 | Tremolo, Metrics, Stem |
| `SlurRenderer.ts` | 36 | 15 | 8 | 1 |  |  | 12 |  | StaveNote |
| `EngravedTimeSignature.ts` | 36 | 5 |  | 21 |  | 3 | 6 | 1 | TimeSignature |
| `GutterRenderer.ts` | 32 | 4 |  | 7 |  | 16 | 5 |  | Renderer, Stave, Barline |
| `TempoLayout.ts` | 31 | 6 | 2 | 4 |  | 3 | 9 | 7 | Element, Metrics, MetricsDefaults, StaveModifierPosition, TimeSignature |
| `NoteBuilder.ts` | 29 |  |  | 18 | 6 |  | 5 |  | StaveNote, Voice, Modifier |
| `EngravedDot.ts` | 27 | 2 | 2 | 14 |  | 1 | 7 | 1 | Dot, isTabNote |
| `headerPlacementPass.ts` | 27 | 10 |  | 12 |  | 1 | 4 |  | Barline, Clef, StaveModifierPosition, TimeSignature |
| `KeySignaturePass.ts` | 25 | 18 |  | 2 |  | 1 | 4 |  | StaveModifierPosition |
| `DynamicsLayout.ts` | 24 | 4 | 2 | 2 |  | 7 | 9 |  | Annotation |
| `FanGhost.ts` | 22 |  |  | 7 | 8 | 1 | 6 |  | Stave, StaveNote, Voice, Formatter, Dot, Barline |
| `BarlineRenderer.ts` | 22 | 13 |  | 5 |  | 1 | 3 |  | Barline, StaveModifierPosition |
| `EngravedAccidental.ts` | 21 |  | 2 | 13 |  | 1 | 4 | 1 | Accidental |
| `EngravedClef.ts` | 14 | 1 |  | 8 |  | 1 | 3 | 1 | Clef |
| `ledgerAccidentalClearance.ts` | 13 |  | 1 | 7 |  |  | 3 | 2 | Metrics, StaveNote, Accidental |
| `glyphPainter.ts` | 13 |  |  | 1 |  | 10 | 2 |  | Element |
| `HairpinRenderer.ts` | 13 | 4 | 1 |  |  |  | 8 |  | — (type only) |
| `dotPlacement.ts` | 12 |  | 3 | 7 |  |  | 2 |  | Dot, Stem, StaveNote |
| `TieRenderer.ts` | 12 | 5 | 4 |  |  |  | 3 |  | StaveNote |
| `EngravedArticulation.ts` | 11 |  |  | 6 |  | 1 | 3 | 1 | Articulation |
| `EngravedBarline.ts` | 9 |  |  | 5 |  |  | 4 |  | Barline, BarlineType |
| `spacingPass.ts` | 8 |  |  |  | 8 |  |  |  | — (type only) |
| `drawnHitBox.ts` | 7 |  | 4 | 2 |  | 1 |  |  | — (type only) |
| `TrillRenderer.ts` | 7 | 3 | 2 |  |  |  | 2 |  | — (type only) |
| `clefOffsetPass.ts` | 7 |  | 1 | 3 |  |  | 3 |  | Clef, StaveModifierPosition |
| `accidentalPlacement.ts` | 6 |  | 1 | 3 |  |  | 2 |  | Accidental, StaveNote |
| `RenderPass.ts` | 5 |  |  | 1 |  | 2 | 2 |  | — (type only) |
| `OttavaRenderer.ts` | 5 | 2 | 2 |  |  |  | 1 |  | — (type only) |
| `staffSpace.ts` | 4 | 2 |  |  |  |  | 2 |  | — (type only) |
| `PedalRenderer.ts` | 4 | 2 | 1 |  |  |  | 1 |  | — (type only) |
| `barlineInk.ts` | 4 | 3 |  |  |  |  | 1 |  | — (type only) |
| `systemStart.ts` | 4 | 3 |  |  |  |  | 1 |  | — (type only) |
| `dynamicsLinePass.ts` | 3 | 1 |  |  |  |  | 2 |  | — (type only) |
| `tempoLinePass.ts` | 3 | 1 |  |  |  | 1 | 1 |  | — (type only) |
| `tempoNudgePass.ts` | 2 |  |  |  |  | 1 | 1 |  | — (type only) |
| `dynamicNudgePass.ts` | 2 |  |  |  |  |  | 2 |  | — (type only) |
| `markPreviewPass.ts` | 2 |  |  |  |  | 1 | 1 |  | — (type only) |
| `chordHeadLayout.ts` | 1 |  |  |  |  |  |  | 1 | Stem |
| `barlineGap.ts` | 1 | 1 |  |  |  |  |  |  | — (type only) |
| `tempoAnchorInk.ts` | 1 |  |  |  |  | 1 |  |  | — (type only) |

## Appendix D — specs that use VexFlow (secondary count: 21 files, 262 uses)

A spec moves or dies with its subject (`CLAUDE.md`: *a spec moves with its module*). `staveGeometry.test.ts` asserts a property **of VexFlow** and retargets to the staff frame at S2.

| spec | uses |
|---|---|
| `rendering/CenteredTremolo.test.ts` | 50 |
| `rendering/NoteBuilder.multiVoiceStem.test.ts` | 34 |
| `rendering/EngravedNote.test.ts` | 31 |
| `rendering/NoteBuilder.test.ts` | 29 |
| `rendering/drawnHitBox.test.ts` | 26 |
| `rendering/staveGeometry.test.ts` | 21 |
| `rendering/accidentalPlacement.test.ts` | 19 |
| `rendering/dotPlacement.test.ts` | 9 |
| `rendering/clefOffsetPass.test.ts` | 8 |
| `paint/DrawContext.test.ts` | 6 |
| `rendering/VexFlowRenderer.incrementalRedraw.test.ts` | 6 |
| `rendering/glyphPainter.test.ts` | 6 |
| `rendering/fanArticulations.test.ts` | 4 |
| `rendering/SlurRenderer.test.ts` | 3 |
| `rendering/TempoLayout.test.ts` | 2 |
| `rendering/dynamicsLinePass.test.ts` | 2 |
| `rendering/systemStart.test.ts` | 2 |
| `rendering/HairpinRenderer.test.ts` | 1 |
| `rendering/drawnFontSize.test.ts` | 1 |
| `rendering/staffSpace.test.ts` | 1 |
| `rendering/__tests__/tier1Geometry.test.ts` | 1 |
