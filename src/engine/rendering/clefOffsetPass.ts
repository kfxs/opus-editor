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
 * ⭐ **A shift on the glyph, ⛔ not an SVG translate.** The clef change folds it into what the glyph
 * REPORTS — `getBoundingBox()` — and everything downstream of this clef is measured from that box, this
 * render: the registry's hit box (so the press follows the ink), and the clef SEGMENT that
 * pixel↔pitch lookup reads (so the notes after it are still read in the right clef). A translate on
 * the group would move the picture and leave both behind.
 *
 * ⛔ **A HEADER clef is never here to be moved.** Only mid-measure changes are drawn as
 * `EngravedClefChange` tickables (`VexFlowRenderer.interleaveClefNotes` filters `beat > 0`); the clef at a system's head
 * is a stave modifier laid out by the header, which is precisely the clef he excluded.
 */
import type { EngravedClefChange } from './EngravedClefChange'
import type { Fraction, Measure, Score } from '@/types/music'
import { clefOffsetOverrideOf } from '@/engine/models/engravingOverrides'
import { staffSpacesToPixels } from './staffSpace'
import { fracEq, fracIsZero } from '@/utils/fraction'
import { staveFrame } from './staveFrame'
import { staveSigns, type EngravedStave } from './EngravedStave'

/** One drawn inline clef: the beat it stands at, and the clef change that draws it. */
export interface InlineClef {
  beat: Fraction
  clefNote: EngravedClefChange
}

/**
 * Shift each inline clef of `measure` by its stored offset, in the staff's own pixels.
 *
 * ⚠️ **The staff's pixels, ⛔ not the score's**: the glyph lives inside its staff's scale group, so a
 * small staff's clef is nudged in that staff's spaces and a nudge that looks like "one space" stays
 * one space to the eye at any staff size. (The barline's gap ink went the other way, and for the
 * opposite reason — it belongs to neither staff.)
 *
 * ⭐ **ADDED to the glyph's current shift**, never assigned — as it always was (VexFlow's formatting
 * could have put a shift there; ours does not, but a second writer must not be clobbered).
 *
 * @param staffId the staff whose clefs to shift — a clef is per-staff, and an absent id is staff 0
 *        (the write convention `ClefChange.staffId` records).
 *
 * 🚨🚨 **THE SHIFT GOES ON THE CLEF GLYPH, ⛔ NEVER ON THE NOTE THAT CARRIES IT** — kept from when the
 * carrier was VexFlow's `ClefNote`: `Note.setXShift` was inert there, and silently, because
 * `Note.getAbsoluteX()` does not add `xShift` (reported from the running app: *"i am offseting in the
 * properties but i dont see anything changing in the score"*). The shift lived on the inner `Clef`,
 * whose `renderText` drew at `x + xShift` and whose `getBoundingBox` reported the same.
 *
 * ⭐ S12j-e: that inner shift is {@link EngravedClefChange.glyphShift} — drawn AND boxed, so the hit box
 * and the clef segment pixel↔pitch reads still follow the ink. `getXShift()` on the change still
 * answers 0, as the note's did.
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
    clefNote.glyphShift += staffSpacesToPixels(off.x, staveFrame(stave))
  }
}

/**
 * ⭐⭐ **THE OTHER HALF: a bar's OPENING clef, which the STAVE draws.**
 *
 * A clef change written at beat 0 is not an inline clef change at all — `interleaveClefNotes` filters
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
