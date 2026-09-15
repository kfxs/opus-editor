/**
 * ⭐⭐ **WHERE A NOTE'S HEADS AND STEM STAND ALONG THE STAFF** — S6a of `docs/vexflow-removal-map.md`
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
 *
 * ⚠️ The head width is still MEASURED at run time (`getGlyphWidth`, a `measureText`) — S6d moves it to
 * the font's own box, and that is the step that may move a sub-pixel. ⛔ Not this one.
 *
 * ⛔ No note, no stave, no VexFlow: the caller reads the note (`rendering/EngravedNote`).
 */
import { STEM_THICKNESS_PX } from '@/engine/engrave/inheritedDefaults'

/** A stem pointing DOWN — VexFlow's `Stem.DOWN`. */
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

/** Where the stem stands — see the table in the header. */
export function stemX(note: NoteXInputs): number {
  if (note.isRestType) return glyphCentreX(note)
  const edge = note.stemDirection === STEM_DOWN
    ? note.originX + note.xShift
    : note.originX + note.xShift + note.glyphWidth
  return edge + (note.stemDirection ? STEM_THICKNESS_PX / (2 * -note.stemDirection) : 0)
}
