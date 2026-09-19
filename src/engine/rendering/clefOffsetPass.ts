/**
 * ⭐⭐ **THE HAND-NUDGED INLINE CLEF** — one clef moved sideways off where the engraver put it.
 * His ask, 2026-08-28: *"when the clef is not in the beguining of a line (i mean a header clef) i
 * want to be able to offset it horizontally either by keys in the keyboard or be the property"*.
 *
 * ## ⭐⭐ POST-FORMAT, PRE-DRAW — an OFFSET is not a SPACE
 *
 * `applyNoteOffsets`' rule, one glyph over, and the reason it is a pass of its own rather than a term
 * in the layout: the column's width is already reserved at the un-shifted position, so a nudged clef
 * moves **its own ink and nothing else's** — the bar does not re-space, the notes do not shuffle, and
 * a second nudge cannot start a feedback loop with the formatter.
 *
 * ⭐ **`setXShift`, ⛔ not an SVG translate.** VexFlow folds `xShift` into what the glyph REPORTS —
 * `getBoundingBox()` — and everything downstream of this clef is measured from that box, this
 * render: the registry's hit box (so the press follows the ink), and the clef SEGMENT that
 * pixel↔pitch lookup reads (so the notes after it are still read in the right clef). A translate on
 * the group would move the picture and leave both behind.
 *
 * ⛔ **A HEADER clef is never here to be moved.** Only mid-measure changes are drawn as `ClefNote`
 * tickables (`VexFlowRenderer.interleaveClefNotes` filters `beat > 0`); the clef at a system's head
 * is a stave modifier laid out by the header, which is precisely the clef he excluded.
 */
import type { ClefNote } from 'vexflow'
import type { Fraction, Measure, Score } from '@/types/music'
import { clefOffsetOverrideOf } from '@/engine/models/engravingOverrides'
import { staffSpacesToPixels } from './staffSpace'
import { fracEq, fracIsZero } from '@/utils/fraction'
import { staveFrame } from './staveFrame'
import { staveSigns, type EngravedStave } from './EngravedStave'

/** One drawn inline clef: the beat it stands at, and the glyph VexFlow will draw. */
export interface InlineClef {
  beat: Fraction
  clefNote: ClefNote
}

/**
 * Shift each inline clef of `measure` by its stored offset, in the staff's own pixels.
 *
 * ⚠️ **The staff's pixels, ⛔ not the score's**: the glyph lives inside its staff's scale group, so a
 * small staff's clef is nudged in that staff's spaces and a nudge that looks like "one space" stays
 * one space to the eye at any staff size. (The barline's gap ink went the other way, and for the
 * opposite reason — it belongs to neither staff.)
 *
 * ⭐ **ADDED to the glyph's current shift**, never assigned: VexFlow's own formatting may have put a
 * shift there, and clobbering it would move the clef twice.
 *
 * @param staffId the staff whose clefs to shift — a clef is per-staff, and an absent id is staff 0
 *        (the write convention `ClefChange.staffId` records).
 */
export function applyClefOffsets(
  measure: Measure, staffId: string | undefined, inlineClefs: readonly InlineClef[], score: Score, stave: EngravedStave,
): void {
  if (inlineClefs.length === 0 || !measure.clefs) return
  for (const { beat, clefNote } of inlineClefs) {
    const change = measure.clefs.find(c => fracEq(c.beat, beat) && c.staffId === staffId)
    if (!change) continue
    const off = clefOffsetOverrideOf(score, change.id)
    if (!off || off.x === 0) continue
    shiftClef(clefNote.getClef(), staffSpacesToPixels(off.x, staveFrame(stave)))
  }
}

/**
 * 🚨🚨 **THE SHIFT GOES ON THE CLEF GLYPH, ⛔ NEVER ON THE `ClefNote` THAT CARRIES IT.**
 *
 * `Note.setXShift` is inert here, and silently: `ClefNote.draw()` positions its glyph with
 * `this.clef.setX(this.getAbsoluteX())`, and **`Note.getAbsoluteX()` does not add `xShift`** — it is
 * the tick context's x plus the stave's note-start, and nothing else (vexflow `note.js`). So a
 * `ClefNote.setXShift` is stored, reported by `getXShift`, and never drawn. ⚠️ This is NOT the note
 * offset's situation, where `StaveNote`'s own draw path folds the shift in — the two look identical
 * in the source and behave completely differently. Reported from the running app: *"i am offseting in
 * the properties but i dont see anything changing in the score"*.
 *
 * ⭐ The inner `Clef` is a plain `Element`, and `Element.renderText` draws at `x + xShift` while
 * `Element.getBoundingBox` reports `x + xShift` — so shifting THAT moves the ink **and** everything
 * measured from it (the hit box, the clef segment that pixel↔pitch lookup reads).
 *
 * ⚠️ `setXShift` here is `Element`'s plain setter — `Clef extends StaveModifier extends Element`, ⛔
 * not `Modifier`, whose same-named method resets to 0 and negates for a LEFT modifier (the trap
 * `applyNoteOffsets` records for accidentals).
 */
function shiftClef(clef: { getXShift(): number; setXShift(v: number): void }, px: number): void {
  clef.setXShift(clef.getXShift() + px)
}

/**
 * ⭐⭐ **THE OTHER HALF: a bar's OPENING clef, which the STAVE draws.**
 *
 * A clef change written at beat 0 is not an inline `ClefNote` at all — `interleaveClefNotes` filters
 * those to `beat > 0`, and the bar's own opening clef is a **stave modifier**, laid out by the header.
 * His case was exactly this one (a clef applied to the start of bar 4, mid-line), and without this
 * the offset was stored, logged, and drawn nowhere.
 *
 * ⛔ **Refused on the first bar of a system** — that is the HEADER clef, the one he excluded
 * (*"when the clef is not in the beguining of a line"*), and it is the same test the registry uses to
 * mark that box `immovable`.
 *
 * ⚠️ Must run BEFORE `drawStave`: the stave draws its modifiers, and after that the ink is on the page.
 */
export function applyStaveClefOffset(
  measure: Measure, staffId: string | undefined, score: Score, stave: EngravedStave, isFirstInLine: boolean,
): void {
  if (isFirstInLine) return
  const change = measure.clefs?.find(c => fracIsZero(c.beat) && c.staffId === staffId)
  if (!change) return
  const off = clefOffsetOverrideOf(score, change.id)
  if (!off || off.x === 0) return
  // ⭐ S4b1: the stave's clef holds its own hand offset (`./staveSign`), which it adds when it draws.
  for (const clef of staveSigns(stave).opening) {
    if (clef.signKind === 'clef') clef.signShift += staffSpacesToPixels(off.x, staveFrame(stave))
  }
}
