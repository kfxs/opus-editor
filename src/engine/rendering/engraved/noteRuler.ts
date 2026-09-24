import type { EngravedNote } from './EngravedNote'
import type { NoteRuler } from '@/engine/engrave/notes/noteRuler'

/**
 * ⭐ **THE ONE PLACE a note's parts are read off a VexFlow `StaveNote`** — S3 of
 * `docs/history/vexflow-removal-map.md`. Everything else asks the {@link NoteRuler}.
 *
 * A SEAM, not a port, exactly like `./staveFrame`'s `barFrame`: every field is a getter, so each value
 * is read from the note at the moment a reader asks — ⛔ never copied up front. That keeps every read
 * where it was: a note's positions are written while it is formatted and drawn, and a snapshot taken
 * any earlier would be wrong (`reference: taking a draw must keep its write-back`).
 */
export function noteRuler(note: EngravedNote): NoteRuler {
  return {
    get glyphScale() { return note.getGlyphScale() },
    get stemDirection() { return note.getStemDirection() },
    get hasStem() { return note.hasStem() },
    get hasFlag() { return note.hasFlag() },
    get stemX() { return note.getStemX() },
    get stemTipY() { return note.getStemExtents().topY },
    get stemBaseY() { return note.getStemExtents().baseY },
    get headYs() { return note.getYs() },
    get headLeftX() { return note.getNoteHeadBeginX() },
    get headRightX() { return note.getNoteHeadEndX() },
    get originX() { return note.getAbsoluteX() },
    get glyphWidth() { return note.getGlyphWidth() },
    get tieLeftX() { return note.getTieLeftX() },
  }
}
