/**
 * ⭐⭐ **A MEASURE REST IS DRAWN CENTRED, SO ITS GLYPH X IS NOT WHERE ITS TIME IS** — one rule, shared
 * by everyone who asks *"where on the page is beat b of this bar"* off the last render.
 *
 * 🚨 **His report, 2026-08-21**: *"the pedal of the upper staff behaves normal while walking but the
 * pedal of the down staff shrinks"*, and then the instruction that found it — *"try to reproduce the
 * issue (probably it even shrinks before crossing the system)"*. It does, and the browser measured it
 * (`e2e/pedal.e2e.ts`): with the press on a bar holding only a whole-bar rest, the `Ped.` was drawn at
 * **322** in a bar running 290…378 — the REST's own x, halfway along — while the release stayed at the
 * bar's end. The pair came out 40 px wide where it should have been ~72, and with the pair's own
 * floors in play it prints as a `Ped.✻` smudge. ⛔ Nothing to do with the walk, the wrap or the band:
 * every gesture was reading a glyph that means something else.
 *
 * ⭐ **A measure rest is a picture of a SILENT BAR, not of an event at a moment.** It is centred by
 * convention (Gould p. 41 and every engine), so what its x says is *"this bar is empty"* — the bar's
 * own beginning is where its time starts, and that is what a mark hanging on beat 0 must use.
 *
 * ⚠️ Only the ONSET moves. A rest that is not a measure rest is drawn at its beat like any note, and
 * this rule leaves it alone; so does an ordinary notehead, whose glyph x already IS its time.
 */

/**
 * Where the TIME of a drawn slot is, given where its glyph landed.
 *
 * @param glyphX the slot's drawn left edge, in whatever space the caller works in.
 * @param isMeasureRest is this slot the bar's whole-bar rest? (`Note.isMeasureRest` on the flat view,
 *   `ChordRest.isMeasureRest` in the model.)
 * @param barNoteStartX where that bar's music begins — `noteStartX`, ⚠️ in the SAME space as
 *   `glyphX`. Undefined when the last render did not measure it, which leaves the glyph's own x: the
 *   no-guessing rule, and it is what the drawing did before this existed.
 */
export function onsetXOf(
  glyphX: number,
  isMeasureRest: boolean | undefined,
  barNoteStartX: number | undefined,
): number {
  return isMeasureRest && barNoteStartX !== undefined ? barNoteStartX : glyphX
}
