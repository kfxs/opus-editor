/**
 * ⭐⭐ **A SLUR'S ENDPOINT CLEARS ITS OWN NOTE'S ARTICULATION** — his report of 2026-09-14, and the
 * rule two engines already state (`docs/slur-tie-research.md` §8).
 *
 * ## ⭐ What this is for, and why it is an ENDPOINT rule rather than an obstacle rule
 *
 * > *"the articulation is bending the slur, while in my opinion they should not change the slur
 * > ANGLE but move it up a little"* — his words, and they are the whole specification.
 *
 * A slur over five staccato sixteenths came out bulged and lopsided because each mark was fed to the
 * obstacle solver (`./slurObstacles`), which answers by raising **one control point**. Raising a
 * control is changing the SHAPE; the launch angle went from 35.5° to 67.3° (measured, §8.1).
 *
 * ⭐⭐ **Moving the ENDPOINTS instead translates the curve, and a translation cannot change its
 * shape.** That is the same property the whole-curve offset override already relies on — *"the cps
 * are endpoint-relative, so translating both endpoints moves the drawn curve and changes nothing
 * about it"* (`./SlurRenderer`) — arriving here from the engraver's side rather than the hand's.
 *
 * ## ⭐ Who else does this, because ⛔ no book on disk answers it
 *
 * `docs/slur-tie-research.md` §8.3 records the negative: **no treatise states how a slur clears
 * articulation marks on the NOTEHEAD side.** (Gould p. 111 is about a slur at the STEM end and was
 * misapplied here once already — his catch.) What the books settle is only that staccato and tenuto
 * go INSIDE the slur, so the slur must be outside them (§8.2, four sources).
 *
 * The rule below is therefore taken from the engines, attributed:
 *
 * | | what it does |
 * |---|---|
 * | **MuseScore** | moves the tip **outside** the first/last staccato/tenuto by `slurTipToArticVertDist` = **0.5 sp**, and re-anchors its x to the mark's centre (`slurtielayout.cpp:889-923`) |
 * | **Verovio** | a named case — a **"portato slur"**: when a boundary note carries an *inside* artic the endpoint re-anchors to the note's drawing top rather than its notehead (`slur.cpp:688-696`, `:1058-1086`) |
 * | **LilyPond** | ⛔ does NOT do this; it keeps the attachment and scales the whole arch by one `fit_factor` instead (`slur-configuration.cc:191-195`) — a different answer to the same problem, and the one we are NOT taking |
 *
 * ⚠️ **This module is only the END.** Marks in the MIDDLE of the run are still the obstacle solver's,
 * and whether they should be is the open row in §8.6.
 */
import type { NoteInkRect } from './noteInkBox'

/** Just enough of a drawn note to find its marks — structural, so a spec needs no VexFlow. */
export interface MarkedNote {
  getModifiers?(): { getCategory?(): string; getBoundingBox?(): { x: number; y: number; w: number; h: number } | undefined }[]
}

/** VexFlow's category for the family this rule is about. ⛔ Ornaments and fermatas are not it. */
const ARTICULATION = 'Articulation'

/**
 * ⭐ **The outer edge of whatever this note wears on the slur's side**, in drawn pixels — the top of
 * the highest mark for a slur above, the bottom of the lowest for one below.
 *
 * ⛔ **Answers null rather than guessing** when the note has no marks, or when a mark's box is not a
 * finite number. ⚠️ The second case is real and it is VexFlow's: `Articulation.draw` centres a mark
 * with `setOrigin`, which divides by a glyph width that a page-less test measures as **0**, so under
 * the unit runner these boxes are NaN (`docs/own-engraving-engine.md` §5 P6a). A NaN must not reach
 * the arithmetic — *a box is either honest or absent*.
 *
 * @param direction −1 for a slur above, +1 for below.
 */
export function articulationEdge(note: MarkedNote, direction: number): number | null {
  let edge: number | null = null
  for (const modifier of note.getModifiers?.() ?? []) {
    if (modifier.getCategory?.() !== ARTICULATION) continue
    const box = modifier.getBoundingBox?.()
    if (!box) continue
    const side = direction === -1 ? box.y : box.y + box.h
    if (!isFinite(side)) continue
    edge = edge === null ? side : (direction === -1 ? Math.min(edge, side) : Math.max(edge, side))
  }
  return edge
}

/** {@link articulationEdge} for a mark whose box is already in hand (the ink ruler's, or a spec's). */
export function markEdgeOf(boxes: readonly NoteInkRect[], direction: number): number | null {
  let edge: number | null = null
  for (const box of boxes) {
    const side = direction === -1 ? box.y : box.y + box.height
    if (!isFinite(side)) continue
    edge = edge === null ? side : (direction === -1 ? Math.min(edge, side) : Math.max(edge, side))
  }
  return edge
}

/**
 * ⭐⭐ **THE RULE: an endpoint stands `gap` beyond its own note's mark, or at its ordinary lift —
 * whichever is further out.**
 *
 * ⛔ It can only ever push the endpoint OUTWARD. A note with no mark, a mark on the other side, or a
 * mark already inside the ordinary lift all answer `baseLift` unchanged — so ⛔ this rule cannot pull
 * a slur closer to its notes, which is the one thing §8.2's sources agree it must not do.
 *
 * @param anchorY the endpoint's anchor — the notehead or the stem end (`./slurStemEndpoint`).
 * @param baseLift the ordinary gap from that anchor (`CURVE.slurLift`), in px.
 * @param markEdge {@link articulationEdge}, or null when there is nothing to clear.
 * @param direction −1 above / +1 below.
 * @param gap how much air to leave beyond the mark, in px.
 * @returns the lift to use, in px — ⭐ always ≥ `baseLift`.
 */
export function endpointLiftOverMark(
  anchorY: number,
  baseLift: number,
  markEdge: number | null,
  direction: number,
  gap: number,
): number {
  if (markEdge === null || !isFinite(markEdge) || !isFinite(anchorY)) return baseLift
  // ⭐ One expression for both sides: `direction` turns "beyond the mark" into the right sign, the
  //   same trick `./slurObstacles` uses for its deficit.
  return Math.max(baseLift, (markEdge - anchorY) * direction + gap)
}
