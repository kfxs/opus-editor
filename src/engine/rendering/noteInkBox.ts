/**
 * ⭐⭐ **THE INK A NOTE OWNS** — the box anything asking *"what is in the way?"* must measure, and
 * ⛔ NOT `StaveNote.getBoundingBox()`, which unions **every attached modifier**.
 *
 * His report, 2026-08-21: he put a dynamic under a note that a slur starts on, and *"the arch of the
 * slur"* changed. *"A dynamic never should affect the slur arch or shape."* He is right, and the
 * reason is structural rather than a tuning error:
 *
 * ⭐⭐ **A dynamic is attached to its note as a VexFlow `Annotation`** (`./DynamicsLayout`) — that is
 * how it gets an anchor and a baseline — and is then **translated to the dynamics LINE** by a later
 * pass (`./dynamicsLinePass`). So the box VexFlow merges into the note is not even where the mark
 * ends up; it is a way-station. Reading the note's box after the draw therefore reports a note
 * reaching all the way down to a mark that belongs to a lane the ladder plans *after* the curves.
 *
 * ⚠️ **`ElementRegistry.addGlyph` already carries this exact warning** — *"a rest/note carrying a
 * dynamic would register a box reaching all the way down to the dynamic's ink and steal its
 * clicks"* — and it is the choke point for every glyph REGISTRATION. What it never covered is code
 * that asks a `StaveNote` for its box directly, which the slur's obstacle scan does. This module is
 * that choke point.
 *
 * ## ⭐ Why it splices rather than re-derives
 *
 * A union cannot be un-merged: once the annotation is in the box there is no arithmetic that takes it
 * back out. The alternative is to rebuild the box from noteheads + stem tip + flag + the remaining
 * modifiers — i.e. to re-implement `StaveNote.getBoundingBox()` and then keep the copy in step with
 * VexFlow for ever. So instead the lane's modifiers are lifted out of the note's own array, VexFlow's
 * method is asked, and they are put straight back. ⛔ Nothing is drawn between the two, and the array
 * is restored in a `finally`, so a throwing `getBoundingBox()` cannot leave a note stripped.
 *
 * ⚠️ **Post-draw only**, like everything it serves: before the draw the boxes are meaningless.
 */

/** The only thing this module needs of a modifier: which family it belongs to. */
interface ModifierLike {
  getCategory?(): string
}

/** …and of a note: its box and its modifier list. Structural, so a spec can stand one up without
 *  VexFlow and without a DOM (`reference_jsdom_cannot_measure_glyphs`). */
export interface BoxedNote {
  getBoundingBox?(): { x: number; y: number; w: number; h: number } | undefined
  /** ⚠️ VexFlow returns the LIVE array (`Tickable.getModifiers` is `return this.modifiers`), which
   *  is what makes the lift-and-restore below possible. */
  getModifiers?(): ModifierLike[]
}

/** A rectangle in the drawing's own pixels; `y` grows DOWN. */
export interface NoteInkRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * VexFlow's category string for the modifier the dynamics line uses. ⚠️ Ours is the only
 * `Annotation` this renderer ever attaches (`DynamicsLayout.buildDynamicAnnotation` is the single
 * `new Annotation` outside the ghost preview), so the category IS "a dynamics-line mark" here. The
 * day a second kind of annotation arrives, this is the line that has to tell them apart.
 */
const LANE_MODIFIER_CATEGORIES = new Set(['Annotation'])

/**
 * ⭐⭐ **THE NOTE'S OWN INK** — head, stem, flag and the modifiers that really ride with it
 * (accidentals, dots, articulations), with the dynamics-line marks left out.
 *
 * @returns null when VexFlow cannot answer for the note (not drawn, or a degenerate box), which
 *   every caller reads as *"not an obstacle"* rather than as a box at the origin.
 */
export function noteInkBox(note: BoxedNote): NoteInkRect | null {
  const modifiers = note.getModifiers?.()
  const lane = modifiers?.filter(m => LANE_MODIFIER_CATEGORIES.has(m.getCategory?.() ?? ''))

  // ⛔ Only touch the array when there is something to take out — the common note keeps VexFlow's
  // own object untouched, and the restore below cannot then be the thing that breaks it.
  if (!modifiers || !lane?.length) return rectOf(note)

  // ⚠️ Restored from a SNAPSHOT, not rebuilt from the two halves: VexFlow draws modifiers in array
  // order, so putting them back in a different one would be a silent picture change.
  const original = [...modifiers]
  const kept = modifiers.filter(m => !lane.includes(m))
  try {
    modifiers.length = 0
    modifiers.push(...kept)
    return rectOf(note)
  } finally {
    modifiers.length = 0
    modifiers.push(...original)
  }
}

/** VexFlow's box as a plain rect, or null for anything it cannot measure. */
function rectOf(note: BoxedNote): NoteInkRect | null {
  try {
    const b = note.getBoundingBox?.()
    if (!b || isNaN(b.x) || isNaN(b.y) || !(b.w > 0)) return null
    return { x: b.x, y: b.y, width: b.w, height: b.h }
  } catch (_e) {
    // A note whose geometry VexFlow cannot answer for is simply not an obstacle.
    return null
  }
}
