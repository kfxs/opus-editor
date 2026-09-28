/**
 * ⭐ **A NOTE'S STEM AND FLAG, REGISTERED AS INK** — each its own clickable rect in the `ElementRegistry`, one per
 * slot, anchored on the chord's lowest pitch (moved out of `ScoreRenderer.registerStem`, and the FLAG added —
 * his ask, 2026-09-28: *"the stem and the accidentals are individual selectable elements, i want also make the
 * individual flag a selectable element"*).
 *
 * ## The stem
 *
 * WHY IT IS ITS OWN ELEMENT. The note registers a box that spans head + stem + beam on purpose
 * (docs/history/tight-bbox-plan.md §4a keeps that "semantic" box), which means the stem's own geometry —
 * which side of the head it is on, how far it reaches — is not readable from outside: only guessable. The
 * note knows it exactly, so the answer is written down here rather than inferred at hit-test time. First
 * caller was the tremolo stamp (the strokes ride the stem, so that is where the pointer goes —
 * `ElementRegistry.findStemAt`); stem selection wants the same rect.
 *
 * `stemX` is the x the stem is DRAWN at (head's right edge for stem-up, left for stem-down, and it already
 * includes the note-offset `xShift`), and the tip → base run is the drawn one. Called after the beams are
 * drawn (see the draw order in `drawMeasureContent`), so a beamed stem's extension is already applied and
 * the rect is the real length, not the default one.
 *
 * A stemless note registers nothing: a whole note has no stem, and a stem you cannot see is not a thing to click.
 *
 * ## The flag (`noteFlag`)
 *
 * Only a flag that was DRAWN — an unbeamed flagged note (`shouldDrawFlag`). Its rect is the flag's own box,
 * from the point its draw wrote back (`engraved/EngravedFlag.getBoundingBox` — the box the note's own box
 * already merges): the drawn glyph, as the dots register through their modifiers' boxes. ⚠️ In jsdom a glyph
 * measures 0 wide, so there the rect is empty and nothing is registered — the browser has the real one.
 *
 * ⛔ No DOM.
 */
import type { ElementRegistry } from '@/engine/ElementRegistry'
import { stemThicknessPx } from '@/engine/engrave/inheritedDefaults'
import type { EngravedNote } from './engraved/EngravedNote'
import { noteRuler } from './engraved/noteRuler'

/** Register `staveNote`'s stem — and its flag, when it drew one — against `anchorNoteId`. */
export function registerStemInk(
  registry: ElementRegistry,
  staveNote: EngravedNote,
  anchorNoteId: string,
  measureNumber: number,
  staffIndex: number,
  beat: number,
): void {
  try {
    const stemRuler = noteRuler(staveNote)
    if (!stemRuler.hasStem) return
    const x = stemRuler.stemX
    const topY = stemRuler.stemTipY
    const baseY = stemRuler.stemBaseY
    const y = Math.min(topY, baseY)
    const height = Math.abs(baseY - topY)
    if (!Number.isFinite(x) || !Number.isFinite(y) || height <= 0) return
    registry.add({
      type: 'stem',
      noteId: anchorNoteId,
      measure: measureNumber,
      staff: staffIndex,
      beat,
      // The drawn line is STEM_THICKNESS_PX wide, centred on x. Clicking it is padded by the registry
      // (STEM_CLICK_PAD) rather than here, so what is stored stays the ink and not a target.
      bbox: { x: x - stemThicknessPx() / 2, y, width: stemThicknessPx(), height },
    })
  } catch (_e) { /* stem geometry may not be available pre-draw */ }

  try {
    if (!staveNote.shouldDrawFlag()) return
    const box = staveNote.flag.getBoundingBox()
    if (!(box.w > 0 && box.h > 0) || !Number.isFinite(box.x) || !Number.isFinite(box.y)) return
    registry.add({
      type: 'noteFlag',
      noteId: anchorNoteId,
      measure: measureNumber,
      staff: staffIndex,
      beat,
      bbox: { x: box.x, y: box.y, width: box.w, height: box.h },
    })
  } catch (_e) { /* a flag's box is only real once it has drawn */ }
}
