# Note Selection Hit-Detection — Issue & Robust Fix Proposal

**Status:** Phase 1 (selection) and Phase 2 (highlight bleed) both implemented 2026-06-01.
**Date:** 2026-06-01

## Update — Phase 2 shipped (highlight bleed)

The bleed lived in `HighlightController` (post-render DOM scans over a synthetic bbox
band), NOT the renderer. Both the note highlight and the tuplet highlight bled into
neighbouring systems. Fix: recolor inside each element's OWN VexFlow SVG group instead
of scanning the document, so the recolor physically cannot reach another system.

- **Notes** (`applySelectionHighlight`): recolor inside the note's `<g class="vf-stavenote">`.
  Color rule = "what belongs solely to the note": the selected **notehead** (picked by the
  stored chord `noteIndex`, which matches notehead DOM order low→high) and its **stem**.
  The stem is resolved by identity via `staveNote.getStem().getSVGElement()` so it's found
  whether the note drew it (unbeamed) or the **beam** drew it (beamed notes don't render
  their own stem — `shouldRenderStem = hasStem() && !beam`). The **flag** is intentionally
  NOT colored (reserved as a future separate selectable element, like accidentals/ties);
  shared structure (beam bar, staff lines, barlines) is never colored.
- **Tuplets** (`applyTupletSelectionHighlight`): recolor inside the tuplet's
  `<g class="vf-tuplet">` — the bracket (thin `<rect>`s, 1px in one dimension) and the
  number `<text>`. The full-size transparent pointer hit-area (`opacity:0`) is skipped.
- Renderer accessors: `getStaveNoteSVGGroup(noteId)` (group + noteIndex + stem) and
  `getTupletSVGGroup(tupletId)`, backed by `staveNoteMap` and a new `tupletObjectMap`.

Still using the old document-scan pattern (not yet reported bleeding, left as-is):
`applyAccidentalHighlight` (matches by X-column within 1px — latent cross-system risk),
`applyTieHighlight`, `applyClefSelectionHighlight`, `applyArticulationHighlight`.

## Update — what shipped (Phase 1)

The robust fix was simplified after a review against the codebase: **bbox-containment
as the primary strategy was dropped.** VexFlow note bboxes are wide and overlap heavily
(stems, flags, beams), so "several contain the point" happens for ordinary monophonic
notes, not just chords — containment-primary buys nothing over the existing pitch-Y
nearest pass. The real defect was simply the `el.measure === measure` filter.

Implemented (commit pending):
- `ElementRegistry.findClosestNoteOrRest(x, y, xTolerance=30)` — **measure param removed.**
  Scans all note/rest elements, computes each one's true rendered Y via clef-aware
  `pitchToPixelY(el.pitch, el.measure, centerX)`, returns nearest within X tolerance.
  Other systems are excluded naturally (their pixel Y is a system-height away → large
  Euclidean distance). Chord heads (shared bbox) are disambiguated by pitch-Y, as before.
- `ElementRegistry.getTupletAt(x, y)` — **measure param removed** (same latent bug:
  tuplet brackets are drawn off the staff and fall into a neighbouring band). Bbox
  containment in real rendered coords is unambiguous across measures.
- `MouseController.handleMouseDown` — dropped the band-derived `measureNum` from the
  selection path; the note distance gate and the tuplet pitch-Y disambiguation now use
  each element's OWN `measure`. `pixelToMeasure` is unchanged and still used for the
  note-entry / clef-tool / clef-drag paths (which legitimately want band resolution).
- Tests: `src/engine/ElementRegistry.test.ts` (high note above staff, chord pick, rest
  fallback, X-tolerance, tuplet containment).

Confirmed safe: deriving measure from the matched element does not affect drag-to-repitch
(`handleMouseMove` re-derives the note's measure from the model).

**Still open — Phase 2 (highlight bleed).** Correction to the proposal below: the bleed
lives in `HighlightController.applySelectionHighlight` (a post-render DOM band-scan), NOT
in the renderer. VexFlow 5 wraps each StaveNote in `<g class="vf-stavenote">` with ledger
lines drawn *inside* it (verified in `node_modules/vexflow`), and the renderer already
keeps each `staveNote` in `staveNoteMap` — so we can capture the group id and recolor
exactly that group. Cleaner still: color at render time via VexFlow's
`setStyle`/`setLedgerLineStyle`/per-notehead `setKeyStyle` (keyed off `selectedNoteId`
and the stored `noteIndex`), deleting the brittle band-scan entirely.

---

## Original write-up (for reference)

## Symptoms (observed while testing)

1. **Can't select high/low notes on a lower line.** Clicking directly on a note
   whose head is drawn far from its staff (e.g. B4/A4 in a bass clef on line 2,
   rendered high above the staff with ledger lines) logs
   `Selection cleared (too far from element)` even though the click is right on
   the note. It "always happens on the next line."
2. **Such notes never highlight** — because they were never actually selected.
3. **Highlight bleed:** a note high enough that its head sits vertically near the
   line *above* highlights stray glyphs on that upper line (orange recolor leaks
   into the previous staff).

## Root cause

Selection in `MouseController.handleMouseDown` chooses the target measure from the
click's **vertical band**:

```ts
const measureNum = engine.pixelToMeasure({ x, y })            // band-based
const closestElement = registry.findClosestNoteOrRest(x, y, measureNum)
```

- `pixelToMeasure` resolves the measure purely from `measureY ≤ y < measureY + staffHeight`
  (`CoordinateMapper.ts`).
- `findClosestNoteOrRest` only considers notes **in that one measure**
  (`el.measure === measure`, `ElementRegistry.ts:557`).

A high note's head is drawn **above its own staff** (ledger lines), so the click's
Y lands in the band of the line *above* (or the inter-line gap). Then:

1. `pixelToMeasure` returns a measure on the **wrong line**.
2. `findClosestNoteOrRest` searches that wrong line — the real note isn't even a
   candidate.
3. Nearest match is far away → `distance < 30` fails → "too far from element."

The highlight bleed is the same root issue one notch less severe: the highlight
box is built from a **recomputed** pitch‑Y (`pitchToPixelY`) and a global SVG scan,
so a high note's box overlaps and recolors the line above.

The deep problem: **selection of an existing element is driven by a *synthetic*
position (the click's Y-band) instead of the element's *actual rendered* geometry.**

## Robust fix proposal

Principle: for selecting an existing element, identify it by **where it is actually
drawn** (its registered VexFlow bbox), then derive the measure from the matched
element. Never use `pixelToMeasure(y)` to choose the line for selection.

### Selection (do this — confident)
1. **Primary:** find the note/rest whose real `element.bbox` **contains** the click
   point. Unambiguous regardless of how high the note is or which Y-band the click
   falls in.
2. **Derive the measure from the matched element** (`element.measure`), not the click.
3. **Fallback:** if the click is in whitespace (no containment), pick the nearest
   bbox by distance (X tolerance + Euclidean).
4. **Chord disambiguation only:** when several noteheads stack at one X, use
   `pitchToPixelY(pitch, element.measure, x)` to pick the closest head. This is the
   one place a computed Y genuinely helps.

Implementation sketch:
- Add a global `ElementRegistry` method (e.g. `findNoteOrRestAtPoint(x, y, tol)`)
  that scans all note/rest elements, prefers bbox containment, falls back to nearest,
  and uses each element's *own* measure for any pitch‑Y math.
- In `MouseController`, use it for selection; in the `distance < 30` check compute
  `elementY` from `closestElement.measure` (not the band-derived `measureNum`).

Why this beats the first idea (global search by recomputed pitch‑Y): it grounds in
the rendered truth (VexFlow `getBoundingBox()`), so it can't drift from a second
source of truth (clef geometry / ledger offsets) the way a recomputed Y can.

### Highlight (verify first, then choose)
The current highlight scans **all** SVG nodes and repaints any inside a synthetic
box (`HighlightController.applySelectionHighlight`) — inherently leaky.
- **Robust:** recolor the selected note's **own rendered glyph group**. VexFlow
  draws each `StaveNote` into an identifiable SVG group; if we capture/tag that
  group at render time, we can recolor exactly it. **Open question: confirm VexFlow's
  per-note SVG group structure before committing.**
- **Pragmatic fallback (if no usable group):** clamp the recolor scan to the
  selected note's **own line band** (upper bound = midpoint to the previous line's
  staff, lower bound = midpoint to the next line's), so it can't bleed into an
  adjacent line. Compute line bounds from `staffGeometries` (`lineYPositions`) of
  the measures on the lines above/below.

## Decisions / open items
- Use the geometry (bbox) hit-test for **all** selections (recommended, single code
  path) vs. only as a fallback when the measure-restricted search misses (lower risk).
  → Leaning: all selections.
- Highlight approach depends on verifying VexFlow per-note SVG grouping (TODO).

## Relevant files
- `src/interactions/MouseController.ts` — `handleMouseDown` selection path.
- `src/engine/rendering/CoordinateMapper.ts` — `pixelToMeasure` (band-based).
- `src/engine/ElementRegistry.ts` — `findClosestNoteOrRest`, `pixelYToPitch`,
  `pitchToPixelY`, registered `bbox` per element.
- `src/interactions/HighlightController.ts` — `applySelectionHighlight` (global scan).
