/**
 * ⭐⭐ **WHERE A NOTE'S HEADS AND STEM STAND ALONG THE STAFF** — S6a of `docs/history/vexflow-removal-map.md`
 * (the note's geometry; ⏭️ S6b its y's and displaced heads, S6c its stem's extents, S6d the head width
 * from the font).
 *
 * Every reader of a note's x — the stem, the beam over it, a tie, a tuplet bracket, a slur, the
 * registry's boxes — asks one of four questions: where do the heads begin, where do they end, where is
 * the glyph's centre, where is the stem. They are this module, transcribed from VexFlow 5's
 * `StaveNote.getNoteHeadBeginX` / `getNoteHeadEndX` / `getStemX` and `StemmableNote.getCenterGlyphX` /
 * `getStemX` (`stavenote.js`, `stemmablenote.js`, MIT), so every one of those readers — VexFlow's own
 * `Beam`, `StaveTie` and `Tuplet` included — receives exactly the number it always did.
 *
 * | question | answer |
 * |---|---|
 * | heads' left edge | the note's origin + its own shift |
 * | heads' right edge | that + the head glyph's width |
 * | glyph centre | origin + shift + half the width |
 * | stem x | a REST: the glyph centre · a stem DOWN: the heads' left edge · otherwise their right edge — then moved half a {@link STEM_THICKNESS_PX} INTO the heads, so the stroke's outer edge meets the head's |
 * | displaced heads' room (S6b) | a chord with a second pushes one head across the stem: a glyph width to the LEFT for a stem down, to the RIGHT for an unflagged stem up (a flag already takes that side) |
 * | where a tie leaves on the left (S6b) | origin + shift, less the left room |
 *
 * ⚠️ The head width is still MEASURED at run time (`getGlyphWidth`, a `measureText`) — S6d moves it to
 * the font's own box, and that is the step that may move a sub-pixel. ⛔ Not this one.
 *
 * ⛔ No note, no stave, no VexFlow: the caller reads the note (`rendering/EngravedNote`).
 */
import { STEM_THICKNESS_PX } from '@/engine/engrave/inheritedDefaults'

/** A stem pointing UP / DOWN — VexFlow's `Stem.UP` / `Stem.DOWN`. */
const STEM_UP = 1
const STEM_DOWN = -1

/** What a note's x's are built from. */
export interface NoteXInputs {
  /** The note's origin — `getAbsoluteX()`, the column the formatter gave it. */
  originX: number
  /** The note's own x shift (a hand offset rides here). */
  xShift: number
  /** The head glyph's width. */
  glyphWidth: number
  /** `1` up, `-1` down, `0` for a note that has no direction. */
  stemDirection: number
  /** Whether the note is a REST by its type — VexFlow's `noteType === 'r'`, which is what its stem x asks. */
  isRestType: boolean
}

/** Where the heads begin. */
export function headsLeftX(note: NoteXInputs): number {
  return note.originX + note.xShift
}

/** Where the heads end. */
export function headsRightX(note: NoteXInputs): number {
  return headsLeftX(note) + note.glyphWidth
}

/** The head glyph's centre. */
export function glyphCentreX(note: NoteXInputs): number {
  return note.originX + note.xShift + note.glyphWidth / 2
}

/** What a note's displaced-head room is built from (S6b). */
export interface DisplacedRoomInputs {
  /** Whether any two of the note's keys stand less than a line apart — VexFlow's `displaced`. */
  displaced: boolean
  /** `1` up, `-1` down, `0` before the note has one. */
  stemDirection: number
  hasFlag: boolean
  /** The head glyph's width — ⚠️ a thunk, read only when a side takes room, as VexFlow reads it. */
  glyphWidth: () => number
}

/**
 * ⭐ S6b — the room a note's displaced heads take beyond its column, on each side (VexFlow's
 * `StaveNote.calcNoteDisplacements`). It widens the note for the formatter and moves where a tie leaves it.
 */
export function displacedHeadRoom(note: DisplacedRoomInputs): { left: number; right: number } {
  return {
    left: note.displaced && note.stemDirection === STEM_DOWN ? note.glyphWidth() : 0,
    right: !note.hasFlag && note.displaced && note.stemDirection === STEM_UP ? note.glyphWidth() : 0,
  }
}

/** ⭐ S6b — where a tie leaves the note on its LEFT: the heads' own left edge, less the displaced room there. */
export function tieLeftX(note: NoteXInputs, leftRoom: number): number {
  return note.originX + (note.xShift - leftRoom)
}

/** Where the stem stands — see the table in the header. */
export function stemX(note: NoteXInputs): number {
  if (note.isRestType) return glyphCentreX(note)
  const edge = note.stemDirection === STEM_DOWN
    ? note.originX + note.xShift
    : note.originX + note.xShift + note.glyphWidth
  return edge + (note.stemDirection ? STEM_THICKNESS_PX / (2 * -note.stemDirection) : 0)
}
