# Articulation stem-side alignment (notehead vs stem)

**Shipped 2026-07-23.** A per-note option for where a **stem-side** articulation sits.

## The convention

An articulation on the **notehead side** (opposite the stem) is centred on the notehead in *both*
the traditional and the modern engraving systems — that never changes. The two systems differ only
on the **stem side**:

- **Traditional (default):** the mark stays centred on the **notehead**.
- **Modern:** the mark centres on the **stem** (which sits to the right of the head for a stem-up
  note, to the left for stem-down — so the mark shifts about half a notehead toward the stem).

The default is the traditional notehead alignment; a per-note toggle opts a note's stem-side marks
into the modern stem alignment.

## Data

`articulationStemAlign?: boolean` on the **slot** (`Chord`, and mirrored on the flat `Note` and
`NoteParams`), beside `articulationPlacement`. It is stored **only when true** and deleted on false,
so the default state serialises clean. Absent/false = the traditional notehead alignment. It only
has a visible effect on marks that land on the stem side; notehead-side marks ignore it.

- Projected in `toFlatNote`; threaded through `updateNote` / `addNote`.
- **Travels on the voice-move** (`moveNoteToVoice` payload → `insertPitch`), like `articulations` —
  a marked note keeps its alignment when it changes voice. The `articulationPlacement` flip is *not*
  carried (it is voice-aware; the new voice re-derives the auto side), but stem-align is orientation-
  agnostic, so it is.

## Model / facade

- `ScoreModel.setArticulationStemAlign(noteId, align)` — no-op for rests / notes without an
  articulation; returns the flat note.
- `MusicEngine.setArticulationStemAlign(noteId, align)` — one undo step (`saveOnly`).

## Render — reuses the note-offset lever

The horizontal placement is driven through the **same `getModifierStartXY` override** that the
note-offset fix installs (`applyNoteOffsets` in `VexFlowRenderer.ts` — see
`docs/note-offset-plan.md`). That override is now the single lever for an articulation's X placement:

- **note offset** → adds `px` to the ABOVE/BELOW base x, for both sides.
- **stem-align** → for the **stem side only**, on a note that `hasStem()`, snaps the base x to
  `sn.getStemX()` — the stem **centreline**, which already includes `xShift`, so any note offset is
  folded in there for free (do not also add `px`). Notehead-side marks and stemless notes (whole
  notes) fall through to the offset-only path.

Stem-side is `(ABOVE && stemDir === up) || (BELOW && stemDir === down)`.

The redraw key needs nothing special: the flag is slot data, so `laneFingerprint`'s
`JSON.stringify(lane.slots)` already fingerprints it and the measure re-renders when it changes.

## UI — Properties

A checkbox labelled **"align to stem"**, shown when the selected note carries an articulation. It
follows the same boundary the note-offset input defends: the window is a **dumb publisher**, writing
`{noteId, align}` to the `articulationStemAlignSelection` seam; `ArticulationStemAlignController`
(constructed in `App.ts`) is the one place that holds the engine and applies it, then repaints.

The offset input in the same panel also grew a small **reset** button (publishes offset `0` through
`noteOffsetSelection`).

## Tests

Guarded by three cases in `MusicEngine.test.ts`: default off; set stores true and clearing deletes
the flag; no-op without an articulation; undoable.

## Deferred

- A document-wide default (all stem-side marks align to the stem) — per-note only for now, by request.
