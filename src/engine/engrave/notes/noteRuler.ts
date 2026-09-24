/**
 * ⭐⭐ **WHERE A DRAWN NOTE'S PARTS ARE — the questions a reader asks of a note, as ours.**
 * S3 of `docs/history/vexflow-removal-map.md` (R2, the note's ruler).
 *
 * Slurs, ties, trills, ottavas, pedals, hairpins, dynamics, tempo marks, tremolos and the renderer's
 * own passes all need to know where a note's heads, stem and tie points landed. They used to ask a
 * VexFlow `StaveNote` directly; they ask this instead, and ⏭️ S6 answers it from our own geometry
 * without any of those readers changing.
 *
 * ⚠️ **In the staff's OWN space**, like the stave frame (`../staff/staffFrame`): a small staff's note is
 * drawn inside its scale group.
 *
 * ⚠️ **Only real once the note is laid out.** A position exists after the voice is formatted, and
 * several are only written while it is drawn (`reference: vexflow geometry is only real after draw`) —
 * which is why the adapter reads each field at the moment it is asked, ⛔ never up front.
 *
 * ⛔ **Not the note's BOX.** A box is a different question with its own plan — each reader asks what
 * it really needs of the ink (`own-engraving-engine.md` §5 P6b), ⛔ never a union of the note's parts.
 */
export interface NoteRuler {
  /** ⭐ The note's own size — 1, or a CUE note's (`EngravedNoteStruct.glyphScale`, cue-size-plan §2). */
  readonly glyphScale: number
  /** Which way the stem points: `1` up, `-1` down — the direction our own code set. */
  readonly stemDirection: number
  /** False for a note drawn without a stem (a whole note), whatever stem object exists underneath. */
  readonly hasStem: boolean
  readonly hasFlag: boolean
  /** The stem's x. */
  readonly stemX: number
  /** The y of the stem's free end — the tip, above for a stem up and below for a stem down. */
  readonly stemTipY: number
  /** The y where the stem meets its notehead. */
  readonly stemBaseY: number
  /** Every head's y, in the note's key order. */
  readonly headYs: readonly number[]
  /** The heads' left edge. */
  readonly headLeftX: number
  /** The heads' right edge. */
  readonly headRightX: number
  /** The note's own x — where its heads are placed from, before any head's displacement. */
  readonly originX: number
  /** The notehead glyph's width. */
  readonly glyphWidth: number
  /** Where a tie leaves the note on its left. */
  readonly tieLeftX: number
}
