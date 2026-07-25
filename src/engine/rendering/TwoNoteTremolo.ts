/**
 * The TWO-NOTE tremolo's strokes — where they go, as pure arithmetic.
 *
 * SMuFL is explicit that this is **not** a glyph: *"scoring applications should draw two-note
 * tremolos using the same primitives used for drawing beams, rather than using these glyphs"* — so
 * `tremoloFingered1–5` (E225–E229) are never used here, and neither is `CenteredTremolo`. Each
 * stroke is a beam quad, at VexFlow's own beam thickness and its ×1.5 step between levels.
 *
 * Everything below is numbers in, numbers out: no VexFlow, no DOM. The renderer reads the two stems'
 * geometry, calls this, and fills the quads (docs/two-note-tremolo-plan.md §2).
 */

/** One stroke, as `fillBeamQuad` wants it: the TOP edge, thickness applied downward. */
export interface TremoloStrokeQuad {
  startX: number
  startY: number
  endX: number
  endY: number
  thickness: number
}

/**
 * How far the strokes stop short of each stem — "floating means detached at both ends".
 *
 * That gap is not decoration: a stroke touching two *filled* noteheads' stems reads as two beamed
 * eighths, which is exactly why MuseScore restricts its joined style to half-note tremolos ("beaming
 * tremolos of shorter duration may introduce rhythmic ambiguity").
 *
 * TWO numbers because one does not hold at both ends of the range. A fixed staff-space clearance
 * looks right on a wide gap and eats the whole stroke on a narrow one (two eighths drawn as quarters
 * sit ~25px apart); a fixed fraction of the gap grows silly when the notes are far apart. So:
 * a quarter of the gap, capped at one staff space. Both are chosen by eye and tunable.
 */
export const PAIR_STROKE_CLEARANCE_SPACES = 1
export const PAIR_STROKE_CLEARANCE_RATIO = 0.25

/**
 * The hard ceiling on that clearance, as a fraction of the gap — however much room the ends ask for
 * (see `minClearance`), at least this much of the gap stays stroke. A mark that shortened itself to
 * nothing to keep clear of something would be a mark you cannot read.
 */
export const PAIR_STROKE_MAX_CLEARANCE_RATIO = 0.35


/**
 * The stack's own height: `n` strokes of `beamWidth`, stepped ×1.5 apart — VexFlow's beam levels.
 *
 * Read by the renderer's stretch pass to ask whether the stems are long enough, and by
 * {@link twoNoteTremoloStrokes} to centre the stack. One definition, so the two cannot disagree.
 */
export function twoNoteTremoloStackHeight(strokes: number, beamWidth: number): number {
  return (strokes - 1) * beamWidth * 1.5 + beamWidth
}

/**
 * The quads for one pair's strokes — all three drawn cases, from ONE anchor line.
 *
 * ⭐ THE ANCHOR LINE IS THE TWO STEM TIPS, in every drawn case. It carries both the height and the
 * SLOPE ("determined by the height of the stems", Dorico), so nothing here needs a second geometry
 * input, and only `tipOffset` — how much of the stem's top end is already occupied — tells the cases
 * apart:
 *
 * | drawn value | `tipOffset` | where the stack sits |
 * |---|---|---|
 * | half / quarter | 0 | flush from the stem tips |
 * | whole | 0 | flush from the tips of the IMAGINARY stems — see below |
 * | eighth or shorter | the drawn value's beam lines | just past them — whether they are drawn as a beam over the pair or as a flag on each note |
 *
 * ⚠️ A WHOLE NOTE STILL HAS STEM EXTENTS. `hasStem()` is false, but VexFlow builds the `Stem` object
 * regardless, so `getStemExtents()` reports exactly where a stem *would* run — and that is where the
 * strokes go. Hanging them between the noteheads instead puts them far too low (reported by eye).
 * So the stemless case needs no branch at all: the caller reads the same geometry it reads for a
 * quarter.
 *
 * Anchoring on the tips rather than centring in the stems is what makes the mark read as "these two
 * alternate": the strokes sit where a beam over the pair would, which for a beamed pair is literally
 * true — `tipOffset` steps the stack past the beam's own lines so the two never overlap, and the eye
 * reads all of them together (see `pairStrokesDrawn`: the beam is one of the lines, so it SPENDS one
 * of the count rather than adding to it).
 *
 * `stemDirection` says which way "toward the notehead" is: +1 = stems up, so the stack marches DOWN
 * from the tip; −1 = stems down, marching up. It is the ONE direction case, and it is the same one
 * VexFlow's own tremolo loop makes.
 *
 * `leftX`/`rightX` are the facing edges of the two notes' INK — the two stems' x when there are
 * stems, and the first notehead's right edge / the second's left edge when there are not (an
 * imaginary stem has a height to borrow but no x to run between). The strokes stop short of each by
 * {@link PAIR_STROKE_CLEARANCE_RATIO} of the gap (capped at {@link PAIR_STROKE_CLEARANCE_SPACES}
 * staff spaces): "floating" means detached at BOTH ends.
 *
 * Returns `[]` for a non-positive stroke count or a gap that has collapsed — a stroke with no room
 * is not a shorter stroke, it is nothing to draw.
 */
export function twoNoteTremoloStrokes(opts: {
  strokes: number
  leftX: number
  leftAnchorY: number
  rightX: number
  rightAnchorY: number
  /** +1 stems up, −1 stems down — which way the stack marches from the tip. */
  stemDirection: number
  /** Pixels of the stem's top end already taken (a beam's lines, or a flag's reach). */
  tipOffset?: number
  /**
   * A floor on the end clearance, in pixels — for ink standing in the gap that the plain rule knows
   * nothing about. The caller passes a MEASURED width (a flag's), never a chosen one, so it scales
   * with the staff; {@link PAIR_STROKE_MAX_CLEARANCE_RATIO} keeps it from eating the whole stroke.
   */
  minClearance?: number
  staffSpace: number
  beamWidth: number
}): TremoloStrokeQuad[] {
  const {
    strokes, leftX, leftAnchorY, rightX, rightAnchorY,
    stemDirection, tipOffset = 0, minClearance = 0, staffSpace, beamWidth,
  } = opts
  const gap = rightX - leftX
  if (strokes <= 0 || gap <= 0) return []

  const wanted = Math.max(
    Math.min(staffSpace * PAIR_STROKE_CLEARANCE_SPACES, gap * PAIR_STROKE_CLEARANCE_RATIO),
    minClearance,
  )
  const clearance = Math.min(wanted, gap * PAIR_STROKE_MAX_CLEARANCE_RATIO)
  const startX = leftX + clearance
  const endX = rightX - clearance
  if (endX <= startX) return []

  // The anchor line, sampled at the stroke ends rather than at the stems.
  const slope = (rightAnchorY - leftAnchorY) / gap
  const anchorAt = (x: number): number => leftAnchorY + (x - leftX) * slope

  const step = beamWidth * 1.5
  // Where the first stroke's TOP edge sits, relative to the anchor line: on it, pushed toward the
  // notehead by whatever already occupies the tip. A quad is drawn from its top edge DOWNWARD, so a
  // stack marching UP (stems down) has to start a full thickness above the line for its first stroke
  // to sit ON it rather than below it.
  const start = stemDirection * tipOffset + (stemDirection < 0 ? -beamWidth : 0)
  const march = stemDirection * step

  const quads: TremoloStrokeQuad[] = []
  for (let k = 0; k < strokes; k++) {
    const offset = start + k * march
    quads.push({
      startX,
      startY: anchorAt(startX) + offset,
      endX,
      endY: anchorAt(endX) + offset,
      thickness: beamWidth,
    })
  }
  return quads
}
